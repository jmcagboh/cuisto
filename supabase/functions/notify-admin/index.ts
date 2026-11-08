// Cuisto — alerte e-mail au restaurant (appelée par les déclencheurs de la base).
// Secrets à définir : RESEND_API_KEY, ADMIN_EMAIL (adresse qui reçoit les alertes).
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function build(table: string, r: Record<string, unknown>) {
  const fcfa = (n: unknown) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;
  if (table === 'orders') return {
    subject: `Nouvelle commande — ${fcfa(r.total)}`,
    lines: [`Client : ${r.customer_name}`, `Téléphone : ${r.customer_phone}`, `Mode : ${r.fulfillment === 'livraison' ? 'Livraison' : 'À emporter'}`, r.address ? `Adresse : ${r.address}` : '', r.note ? `Note : ${r.note}` : '', `Total : ${fcfa(r.total)}`],
  };
  if (table === 'reservations') return {
    subject: `Nouvelle réservation — ${r.reservation_date} à ${String(r.reservation_time).slice(0, 5)}`,
    lines: [`Nom : ${r.name}`, `Téléphone : ${r.phone}`, `Date : ${r.reservation_date} à ${String(r.reservation_time).slice(0, 5)}`, `Personnes : ${r.guests}`, r.note ? `Note : ${r.note}` : ''],
  };
  if (table === 'contact_messages') return {
    subject: `Nouveau message de contact — ${r.name}`,
    lines: [`Nom : ${r.name}`, `E-mail : ${r.email}`, `Message : ${r.message}`],
  };
  return {
    subject: `Nouveau message client — ${r.user_name || 'Client'}`,
    lines: [`Client : ${r.user_name || 'Client'}`, `Message : ${r.body}`],
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // 1) le secret partagé doit correspondre à celui de la base
  const secret = req.headers.get('x-notify-secret') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const check = await fetch(`${url}/rest/v1/rpc/check_notify_secret`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ s: secret }),
  }).then((r) => r.json()).catch(() => false);
  if (check !== true) return new Response('Forbidden', { status: 403 });

  // 2) e-mail
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('ADMIN_EMAIL');
  if (!resendKey || !to) return new Response(JSON.stringify({ sent: false, reason: 'RESEND_API_KEY ou ADMIN_EMAIL manquant' }), { status: 200 });

  const { table, record } = await req.json();
  const { subject, lines } = build(String(table), record || {});
  const rows = lines.filter(Boolean);
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px"><h2 style="color:#c0392b">${esc(subject)}</h2>${rows.map((l) => `<p style="margin:4px 0">${esc(l)}</p>`).join('')}<p style="margin-top:18px"><a href="https://jmcagboh.github.io/cuisto/admin.html">Ouvrir l'administration</a></p></div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Cuisto <onboarding@resend.dev>', to: [to], subject: `🔔 ${subject}`, html }),
  });
  return new Response(JSON.stringify({ sent: res.ok, status: res.status }), { status: 200 });
});

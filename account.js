/* ============================================================
   Cuisto — compte client (Supabase Auth)
   Inscription / connexion par e-mail + mot de passe.
   Nom et téléphone sont gardés dans les métadonnées du compte.
   Chaque client ne peut lire que SES commandes et réservations (règles RLS, voir schema.sql).
   ============================================================ */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CUISTO_CONFIG || {};
const sb = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const dateTime = (iso) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/* ---------- notifications visibles (toast) ---------- */
const toast = document.createElement('div');
toast.className = 'toast';
toast.setAttribute('role', 'status');
document.body.append(toast);
let toastTimer = null;

function notify(text, type = 'success', ms = 4200) {
  toast.className = `toast ${type}`;
  toast.textContent = text;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

function say(text, isError = false) {
  const node = $('accountMessage');
  node.textContent = text;
  node.classList.toggle('error', isError);
  if (isError && text) notify(text, 'error', 6000);
}

function showTab(which) {
  const login = which === 'login';
  $('loginForm').hidden = !login;
  $('signupForm').hidden = login;
  $('tabLogin').classList.toggle('active', login);
  $('tabSignup').classList.toggle('active', !login);
  $('tabLogin').setAttribute('aria-selected', String(login));
  $('tabSignup').setAttribute('aria-selected', String(!login));
  say('');
}

function authError(error) {
  const text = error?.message || '';
  if (/rate limit|too many|security purposes/i.test(text)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (/already registered|already been registered/i.test(text)) return 'Un compte existe déjà avec cette adresse e-mail.';
  if (/not confirmed/i.test(text)) return 'Confirmez d’abord votre adresse e-mail (lien reçu par e-mail).';
  if (/password/i.test(text) && /(short|least|weak)/i.test(text)) return 'Mot de passe trop court ou trop simple (8 caractères minimum).';
  if (/invalid login/i.test(text)) return 'E-mail ou mot de passe incorrect.';
  if (/signups? (is |are )?(not allowed|disabled)|signup.*disabled/i.test(text)) return 'Les inscriptions sont désactivées dans Supabase (Authentication > Sign In / Providers > « Allow new users to sign up »).';
  if (/error sending .*email|sending confirmation|smtp/i.test(text)) return 'Le compte n’a pas pu être créé car Supabase n’arrive pas à envoyer l’e-mail de confirmation. Désactivez « Confirm email » (Authentication > Sign In / Providers > Email) ou réessayez plus tard.';
  if (/failed to fetch|network|load failed/i.test(text)) return 'Connexion au serveur impossible. Vérifiez votre connexion Internet.';
  if (/invalid api key|apikey|jwt/i.test(text)) return 'Clé Supabase invalide : vérifiez config.js.';
  if (/database error/i.test(text)) return 'Erreur de base de données : relancez schema.sql dans Supabase.';
  // cause réelle affichée pour faciliter le diagnostic
  return `Une erreur est survenue${text ? ` (${text})` : ''}. Réessayez.`;
}

/* ---------- vue client connecté ---------- */
function statusBadge(status) {
  return `<span class="badge">${esc(status)}</span>`;
}

async function loadOrders() {
  const { data, error } = await sb.from('orders')
    .select('id, created_at, fulfillment, total, status, order_items(name, quantity)')
    .order('created_at', { ascending: false }).limit(50);
  if (error) { $('ordersList').innerHTML = '<p class="empty">Impossible de charger vos commandes.</p>'; return; }
  $('ordersCount').textContent = String(data.length);
  $('ordersCount').classList.toggle('zero', data.length === 0);
  $('ordersList').innerHTML = data.length ? data.map((o) => {
    const items = (o.order_items || []).map((i) => `${esc(i.quantity)} x ${esc(i.name)}`).join(', ');
    return `<article class="history-item">
      <div><strong>${items || '—'}</strong>
      <p>${esc(dateTime(o.created_at))} · ${o.fulfillment === 'livraison' ? 'Livraison' : 'À emporter'}</p></div>
      <div class="history-side"><strong>${Number(o.total || 0).toLocaleString('fr-FR')} FCFA</strong>${statusBadge(o.status)}</div>
    </article>`;
  }).join('') : '<p class="empty">Aucune commande pour le moment.</p>';
}

async function loadReservations() {
  const { data, error } = await sb.from('reservations')
    .select('id, created_at, reservation_date, reservation_time, guests, status')
    .order('created_at', { ascending: false }).limit(50);
  if (error) { $('reservationsList').innerHTML = '<p class="empty">Impossible de charger vos réservations.</p>'; return; }
  $('reservationsCount').textContent = String(data.length);
  $('reservationsCount').classList.toggle('zero', data.length === 0);
  $('reservationsList').innerHTML = data.length ? data.map((r) => {
    const day = new Date(`${r.reservation_date}T00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `<article class="history-item">
      <div><strong>${esc(day)} à ${esc(String(r.reservation_time).slice(0, 5))}</strong>
      <p>${esc(r.guests)} personne(s)</p></div>
      <div class="history-side">${statusBadge(r.status)}</div>
    </article>`;
  }).join('') : '<p class="empty">Aucune réservation pour le moment.</p>';
}

async function showUser(user) {
  const meta = user.user_metadata || {};
  $('guestView').hidden = true;
  $('userView').hidden = false;
  $('welcome').textContent = meta.full_name ? `Bonjour ${meta.full_name}` : 'Bonjour';
  $('userEmail').textContent = user.email || '';
  $('profileName').value = meta.full_name || '';
  $('profilePhone').value = meta.phone || '';
  $('profileAddress').value = meta.address || '';
  say('');
  loadOrders();
  loadReservations();
  const { data: isAdmin } = await sb.rpc('is_admin');
  $('adminLink').hidden = isAdmin !== true;
}

function showGuest() {
  $('userView').hidden = true;
  $('guestView').hidden = false;
}

/* ---------- actions ---------- */
$('tabLogin').addEventListener('click', () => showTab('login'));
$('tabSignup').addEventListener('click', () => showTab('signup'));

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  say('Connexion...');
  const { data, error } = await sb.auth.signInWithPassword({
    email: $('loginEmail').value.trim().toLowerCase(),
    password: $('loginPassword').value
  }).catch((e) => ({ data: null, error: e }));
  button.disabled = false;
  if (error) { say(authError(error), true); return; }
  $('loginForm').reset();
  say('');
  const first = (data.user.user_metadata?.full_name || '').split(' ')[0];
  notify(first ? `Connexion réussie ✓ Bonjour ${first} !` : 'Connexion réussie ✓');
  showUser(data.user);
});

$('signupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  say('Création du compte...');
  const { data, error } = await sb.auth.signUp({
    email: $('signupEmail').value.trim().toLowerCase(),
    password: $('signupPassword').value,
    options: {
      data: { full_name: $('signupName').value.trim(), phone: $('signupPhone').value.trim() },
      // lien de confirmation par e-mail : ramène directement sur le site
      emailRedirectTo: new URL('index.html', window.location.href).href
    }
  }).catch((e) => ({ data: null, error: e }));
  button.disabled = false;
  if (error) { say(authError(error), true); return; }
  event.target.reset();
  if (data.session) {
    // compte créé et déjà connecté : on envoie le client sur le site
    const first = (data.user.user_metadata?.full_name || '').split(' ')[0];
    try { sessionStorage.setItem('cuistoWelcome', first || 'et bienvenue'); } catch { /* ignoré */ }
    notify('Compte créé ✓ Redirection vers le site...', 'success', 2000);
    setTimeout(() => window.location.assign('index.html'), 1300);
    return;
  }
  // confirmation par e-mail activée dans Supabase
  showTab('login');
  say('');
  notify('Compte créé ✓ Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien pour accéder au site.', 'info', 9000);
  $('accountMessage').textContent = 'Compte créé ✓ Confirmez votre adresse via le lien reçu par e-mail : il vous ramène sur le site.';
});

$('forgotPassword').addEventListener('click', async () => {
  const email = $('loginEmail').value.trim().toLowerCase();
  if (!email) { say('Saisissez d’abord votre adresse e-mail ci-dessus.', true); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
  if (error) say(authError(error), true);
  else notify('Si un compte existe, un e-mail de réinitialisation vient d’être envoyé.', 'info', 7000);
});

$('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  const { data, error } = await sb.auth.updateUser({
    data: { full_name: $('profileName').value.trim(), phone: $('profilePhone').value.trim(), address: $('profileAddress').value.trim() }
  });
  button.disabled = false;
  if (error) { say('Mise à jour impossible.', true); return; }
  $('welcome').textContent = `Bonjour ${data.user.user_metadata.full_name}`;
  say('');
  notify('Informations enregistrées ✓');
});

$('logoutButton').addEventListener('click', async () => {
  await sb.auth.signOut();
  showGuest();
  showTab('login');
  notify('Vous êtes déconnecté.', 'info');
});

/* ---------- démarrage ---------- */
(async () => {
  if (!sb) { showGuest(); say('Service momentanément indisponible.', true); return; }
  const { data: { session } } = await sb.auth.getSession();
  if (session) showUser(session.user); else showGuest();
  // lien de réinitialisation reçu par e-mail : on laisse choisir un nouveau mot de passe
  sb.auth.onAuthStateChange(async (event) => {
    if (event !== 'PASSWORD_RECOVERY') return;
    const password = window.prompt('Choisissez un nouveau mot de passe (8 caractères minimum) :');
    if (!password || password.length < 8) { say('Mot de passe non modifié.', true); return; }
    const { error } = await sb.auth.updateUser({ password });
    if (error) say(authError(error), true); else notify('Mot de passe modifié ✓');
  });
})();
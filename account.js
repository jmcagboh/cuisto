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

function say(text, isError = false) {
  const node = $('accountMessage');
  node.textContent = text;
  node.classList.toggle('error', isError);
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
  return 'Une erreur est survenue. Réessayez.';
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
  });
  button.disabled = false;
  if (error) { say(authError(error), true); return; }
  $('loginForm').reset();
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
    options: { data: { full_name: $('signupName').value.trim(), phone: $('signupPhone').value.trim() } }
  });
  button.disabled = false;
  if (error) { say(authError(error), true); return; }
  event.target.reset();
  if (data.session) { showUser(data.user); return; }
  // confirmation par e-mail activée dans Supabase
  showTab('login');
  say('Compte créé ✓ Confirmez votre adresse via le lien reçu par e-mail, puis connectez-vous.');
});

$('forgotPassword').addEventListener('click', async () => {
  const email = $('loginEmail').value.trim().toLowerCase();
  if (!email) { say('Saisissez d’abord votre adresse e-mail ci-dessus.', true); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
  say(error ? authError(error) : 'Si un compte existe, un e-mail de réinitialisation vient d’être envoyé.', !!error);
});

$('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  button.disabled = true;
  const { data, error } = await sb.auth.updateUser({
    data: { full_name: $('profileName').value.trim(), phone: $('profilePhone').value.trim() }
  });
  button.disabled = false;
  if (error) { say('Mise à jour impossible.', true); return; }
  $('welcome').textContent = `Bonjour ${data.user.user_metadata.full_name}`;
  say('Informations enregistrées ✓');
});

$('logoutButton').addEventListener('click', async () => {
  await sb.auth.signOut();
  showGuest();
  showTab('login');
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
    say(error ? authError(error) : 'Mot de passe modifié ✓', !!error);
  });
})();

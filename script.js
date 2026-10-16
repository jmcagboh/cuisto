/* ============================================================
   Cuisto — front branché sur Supabase (plus de server.js)
   Dépend de : supabase-js (CDN) + config.js
   ============================================================ */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CUISTO_CONFIG || {};
const supabaseReady = Boolean(
  window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('VOTRE-PROJET') && !SUPABASE_ANON_KEY.includes('VOTRE_CLE')
);
const sb = supabaseReady ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const NOT_CONFIGURED = 'Le service n’est pas encore configuré (voir config.js).';

/* ---------- utilitaires ---------- */
function friendlyError(error) {
  const msg = (error && error.message) || '';
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(msg)) return 'Confirmez d’abord votre e-mail (vérifiez votre boîte de réception).';
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet e-mail.';
  if (/Password should be at least/i.test(msg)) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (/not authorized/i.test(msg)) return 'L’envoi d’e-mails n’est pas encore activé pour cette adresse. Contactez-nous.';
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Trop de tentatives ou d’e-mails envoyés. Réessayez dans quelques minutes.';
  if (/Connexion requise/i.test(msg)) return 'Veuillez vous connecter.';
  if (/Panier vide|Adresse ou position|Aucun plat valide/i.test(msg)) return msg;
  return 'Une erreur est survenue. Réessayez.';
}

async function getSession() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

function setStatus(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('error', isError);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children); // les chaînes deviennent du texte : pas d'injection HTML
  return node;
}

const formatPrice = (value) => `${value.toLocaleString('fr-FR')} FCFA`;

/* ---------- retour du lien de confirmation e-mail ---------- */
// Lu avant que supabase-js ne nettoie l'URL
const cameFromEmailConfirmation = /[#&?]type=signup/.test(window.location.hash + window.location.search);

/* ---------- page de connexion ---------- */
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubmit = document.getElementById('authSubmit');
const authPasswordLabel = document.getElementById('authPasswordLabel');
const authPassword = document.getElementById('authPassword');
const togglePassword = document.getElementById('togglePassword');
const authMessage = document.getElementById('authMessage');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const forgotPassword = document.getElementById('forgotPassword');
const resetForm = document.getElementById('resetForm');
const profileFields = document.getElementById('profileFields');
let isRegisterMode = false;

const showAuthMessage = (message, isError = false) => setStatus(authMessage, message, isError);

function setAuthMode(register) {
  isRegisterMode = register;
  authTitle.textContent = register ? 'Créer votre compte' : 'Bon retour parmi nous';
  authSubmit.textContent = register ? 'Créer mon compte' : 'Se connecter';
  authPasswordLabel.textContent = register ? 'Créer votre mot de passe Cuisto' : 'Mot de passe Cuisto';
  authPassword.placeholder = register ? 'Créez votre mot de passe Cuisto' : 'Votre mot de passe Cuisto';
  authPassword.autocomplete = register ? 'new-password' : 'current-password';
  toggleAuthMode.textContent = register ? 'J’ai déjà un compte' : 'Créer un compte';
  profileFields?.classList.toggle('hidden-field', !register);
  const nameInput = document.getElementById('authName');
  if (nameInput) nameInput.required = register; // le téléphone reste facultatif
}

togglePassword?.addEventListener('change', () => {
  authPassword.type = togglePassword.checked ? 'text' : 'password';
});

toggleAuthMode?.addEventListener('click', () => {
  setAuthMode(!isRegisterMode);
  showAuthMessage('');
});

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sb) { showAuthMessage(NOT_CONFIGURED, true); return; }
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const password = authPassword.value;

  if (isRegisterMode) {
    const name = document.getElementById('authName').value.trim();
    const phone = document.getElementById('authPhone')?.value.trim() || '';
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone },
        emailRedirectTo: new URL('login.html', window.location.href).href
      }
    });
    if (error) { showAuthMessage(friendlyError(error), true); return; }
    // E-mail déjà utilisé : Supabase renvoie un utilisateur sans identités
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      showAuthMessage('Un compte existe déjà avec cet e-mail.', true);
      return;
    }
    if (data.session) {
      showAuthMessage('Compte créé. Redirection...');
      window.setTimeout(() => { window.location.href = 'index.html#reservation'; }, 500);
      return;
    }
    showAuthMessage('Compte créé. Vérifiez votre e-mail pour le confirmer, puis connectez-vous.');
    setAuthMode(false);
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { showAuthMessage(friendlyError(error), true); return; }
  const { data: profile } = await sb.from('profiles').select('role').eq('id', data.user.id).single();
  showAuthMessage('Connexion réussie. Redirection...');
  const target = profile && profile.role === 'admin' ? 'admin.html' : 'index.html#reservation';
  window.setTimeout(() => { window.location.href = target; }, 500);
});

forgotPassword?.addEventListener('click', async () => {
  if (!sb) { showAuthMessage(NOT_CONFIGURED, true); return; }
  const email = document.getElementById('authEmail')?.value.trim().toLowerCase();
  if (!email) { showAuthMessage('Saisissez votre adresse e-mail.', true); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: new URL('login.html', window.location.href).href
  });
  if (error) { showAuthMessage(friendlyError(error), true); return; }
  showAuthMessage('Si ce compte existe, un e-mail de réinitialisation vient d’être envoyé.');
});

// Clic sur « Confirmer mon e-mail » : Supabase ouvre la session, on envoie le client sur le site
if (sb && authForm && cameFromEmailConfirmation) {
  showAuthMessage('E-mail confirmé. Connexion en cours...');
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      showAuthMessage('E-mail confirmé. Redirection...');
      window.setTimeout(() => { window.location.href = 'index.html#reservation'; }, 800);
    }
  });
}

// Retour du lien « mot de passe oublié » : Supabase ouvre une session de récupération
if (sb && resetForm) {
  sb.auth.onAuthStateChange((event) => {
    if (event !== 'PASSWORD_RECOVERY') return;
    authForm.classList.add('hidden-field');
    document.querySelector('.auth-links')?.classList.add('hidden-field');
    resetForm.classList.remove('hidden-field');
  });

  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirmation = document.getElementById('resetConfirmPassword').value;
    if (password !== confirmation) { showAuthMessage('Les mots de passe ne correspondent pas.', true); return; }
    const { error } = await sb.auth.updateUser({ password });
    if (error) { showAuthMessage(friendlyError(error), true); return; }
    await sb.auth.signOut();
    showAuthMessage('Mot de passe modifié. Vous pouvez vous connecter.');
    resetForm.reset();
    resetForm.classList.add('hidden-field');
    authForm.classList.remove('hidden-field');
    document.querySelector('.auth-links')?.classList.remove('hidden-field');
  });
}

/* ---------- réservation ---------- */
const reservationForm = document.getElementById('reservationForm');
const reservationMessage = document.getElementById('reservationMessage');

reservationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sb) { setStatus(reservationMessage, NOT_CONFIGURED, true); return; }
  const session = await getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  const { error } = await sb.from('reservations').insert({
    user_id: session.user.id,
    date: document.getElementById('reservationDate').value,
    time: document.getElementById('reservationTime').value,
    guests: Number(document.getElementById('reservationGuests').value) || 1,
    note: document.getElementById('reservationNote').value.trim() || null
  });
  if (error) { setStatus(reservationMessage, friendlyError(error), true); return; }
  setStatus(reservationMessage, 'Réservation envoyée. Nous vous la confirmons très vite.');
  reservationForm.reset();
});

/* ---------- commande ---------- */
const orderForm = document.getElementById('orderForm');
const orderMessage = document.getElementById('orderMessage');
const orderAddress = document.getElementById('orderAddress');
const locationButton = document.getElementById('locationButton');
const locationMessage = document.getElementById('locationMessage');
const orderLatitude = document.getElementById('orderLatitude');
const orderLongitude = document.getElementById('orderLongitude');
const orderTotal = document.getElementById('orderTotal');

function updateOrderTotal() {
  if (!orderForm || !orderTotal) return;
  const total = [...orderForm.querySelectorAll('[data-price]')]
    .reduce((sum, input) => sum + (Number(input.value) || 0) * Number(input.dataset.price), 0);
  const label = formatPrice(total);
  if (orderTotal.textContent === label) return;
  orderTotal.textContent = label;
  // petit effet « pop » à chaque changement du total
  orderTotal.classList.remove('bump');
  void orderTotal.offsetWidth;
  orderTotal.classList.add('bump');
}

// délégation : fonctionne aussi pour les plats chargés depuis Supabase
orderForm?.addEventListener('input', (event) => {
  if (event.target.matches('[data-price]')) updateOrderTotal();
});

document.querySelectorAll('input[name="fulfillment"]').forEach((input) => {
  input.addEventListener('change', () => {
    const isDelivery = input.value === 'livraison' && input.checked;
    orderAddress.required = isDelivery;
    orderAddress.disabled = !isDelivery;
    locationButton.disabled = !isDelivery;
    if (!isDelivery) {
      orderAddress.value = '';
      orderLatitude.value = '';
      orderLongitude.value = '';
      locationMessage.textContent = '';
    }
  });
});

locationButton?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    locationMessage.textContent = 'La géolocalisation n’est pas disponible sur cet appareil.';
    return;
  }
  locationMessage.textContent = 'Recherche de votre position...';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      orderLatitude.value = position.coords.latitude.toFixed(6);
      orderLongitude.value = position.coords.longitude.toFixed(6);
      orderAddress.required = false;
      locationMessage.textContent = 'Position enregistrée pour la livraison.';
    },
    () => { locationMessage.textContent = 'Position refusée. Vous pouvez saisir votre adresse.'; },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
});

orderForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sb) { setStatus(orderMessage, NOT_CONFIGURED, true); return; }
  const session = await getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  // On n'envoie que le plat et la quantité : le prix est lu côté base (create_order)
  const items = [...orderForm.querySelectorAll('[data-slug]')]
    .map((input) => ({ slug: input.dataset.slug, quantity: Number(input.value) || 0 }))
    .filter((item) => item.quantity > 0);
  if (!items.length) { setStatus(orderMessage, 'Choisissez au moins un plat.', true); return; }

  const { error } = await sb.rpc('create_order', {
    p_items: items,
    p_fulfillment: orderForm.querySelector('input[name="fulfillment"]:checked').value,
    p_payment: orderForm.querySelector('input[name="paymentMethod"]:checked').value,
    p_address: orderAddress.value.trim() || null,
    p_lat: orderLatitude.value ? Number(orderLatitude.value) : null,
    p_lng: orderLongitude.value ? Number(orderLongitude.value) : null,
    p_note: document.getElementById('orderNote').value.trim() || null
  });
  if (error) { setStatus(orderMessage, friendlyError(error), true); return; }

  setStatus(orderMessage, 'Commande envoyée. Nous la préparons !');
  orderForm.reset();
  orderAddress.disabled = true;
  orderAddress.required = false;
  locationButton.disabled = true;
  locationMessage.textContent = '';
  updateOrderTotal();
});

/* ---------- menu et plats depuis Supabase (repli : HTML statique) ---------- */
async function loadDishes() {
  if (!sb) return;
  const menuGrid = document.querySelector('#menu .contenu');
  const orderItems = document.querySelector('#orderForm .order-items');
  if (!menuGrid && !orderItems) return;

  const { data, error } = await sb
    .from('dishes')
    .select('slug, name, price, image_url')
    .eq('available', true)
    .order('sort_order');
  if (error || !data || !data.length) return;

  if (menuGrid) {
    menuGrid.replaceChildren(...data.map((dish) => el('div', { class: 'box' },
      el('div', { class: 'imbox' }, el('img', { src: `./${dish.image_url || ''}`, alt: dish.name })),
      el('div', { class: 'text' },
        el('h3', {}, `Special ${dish.name.charAt(0).toLowerCase()}${dish.name.slice(1)}`),
        el('p', { class: 'dish-price' }, formatPrice(dish.price)))
    )));
    registerReveal(menuGrid.querySelectorAll('.box'), 'zoom', 3);
  }

  if (orderItems) {
    orderItems.replaceChildren(...data.map((dish) => el('label', {},
      el('span', {}, `${dish.name} `, el('strong', {}, formatPrice(dish.price))),
      el('input', {
        type: 'number', min: '0', max: '20', value: '0',
        'data-price': String(dish.price), 'data-dish': dish.name, 'data-slug': dish.slug,
        'aria-label': `Quantité ${dish.name}`
      })
    )));
    updateOrderTotal();
  }
}
loadDishes();

/* ---------- message de contact ---------- */
const contactForm = document.getElementById('contactForm');

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = contactForm.querySelector('.contact-status');
  if (!sb) { setStatus(status, NOT_CONFIGURED, true); return; }
  const name = document.getElementById('nameInput')?.value.trim() || 'Client';
  const email = document.getElementById('emailInput')?.value.trim() || '';
  const message = document.getElementById('messageInput')?.value.trim() || '';
  if (!email || !message) return;
  const { error } = await sb.from('contact_messages').insert({ name, email, message });
  if (error) { setStatus(status, 'Envoi impossible pour le moment. Réessayez.', true); return; }
  setStatus(status, 'Message envoyé. Nous vous répondons rapidement.');
  contactForm.reset();
});

/* ---------- menu mobile ---------- */
const menuToggle = document.querySelector('.menuToggle');
const navbar = document.querySelector('.navbar');

function toggleMenu() {
  if (!menuToggle || !navbar) return;
  const isOpen = navbar.classList.toggle('active');
  menuToggle.classList.toggle('active', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
}

menuToggle?.addEventListener('click', toggleMenu);
navbar?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    if (navbar.classList.contains('active')) toggleMenu();
  });
});

/* ---------- écran d'accueil ---------- */
const appLaunch = document.getElementById('appLaunch');
const appStartBtn = document.getElementById('appStartBtn');

appStartBtn?.addEventListener('click', () => {
  appLaunch.classList.add('hidden');
});

/* ---------- jeu ---------- */
const dishes = [
  { name: 'Riz au gras', emoji: '🍚', color: '#f4b942' },
  { name: 'Akoume', emoji: '🍛', color: '#c77dff' },
  { name: 'Poisson braisé', emoji: '🐟', color: '#4ecdc4' },
  { name: 'Attiéké', emoji: '🥭', color: '#ff9f1c' },
  { name: 'Spaghetti', emoji: '🍝', color: '#ff6b6b' },
  { name: 'Friture', emoji: '🍤', color: '#7bdff2' }
];

const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const bestScoreEl = document.getElementById('bestScore');
const targetDishEl = document.getElementById('targetDish');
const gameBoard = document.getElementById('gameBoard');
const startGameBtn = document.getElementById('startGameBtn');
const gameMessage = document.getElementById('gameMessage');

let score = 0;
let timeLeft = 30;
let currentTarget = null;
let timerId = null;
let isPlaying = false;
let bestScore = Number(localStorage.getItem('cuistoBestScore')) || 0;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function updateScoreboard() {
  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
  bestScoreEl.textContent = bestScore;
}

function setMessage(text) {
  gameMessage.textContent = text;
}

function endGame() {
  isPlaying = false;
  clearInterval(timerId);
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('cuistoBestScore', String(bestScore));
  }
  updateScoreboard();
  setMessage(`Partie terminée ! Tu as marqué ${score} points.`);
  targetDishEl.textContent = 'Clique sur démarrer pour rejouer';
  gameBoard.innerHTML = '<div class="game-empty">Le chef attend votre prochaine partie.</div>';
  startGameBtn.textContent = 'Rejouer';
}

function generateRound() {
  if (!isPlaying) return;

  const target = dishes[Math.floor(Math.random() * dishes.length)];
  currentTarget = target;
  targetDishEl.textContent = target.name;

  const wrongChoices = shuffle(
    dishes.filter((dish) => dish.name !== target.name)
  ).slice(0, 3);

  const choices = shuffle([target, ...wrongChoices]);

  gameBoard.innerHTML = choices
    .map(
      (dish) => `
        <button class="dish-card" data-name="${dish.name}" style="--card-color: ${dish.color}">
          <span class="dish-emoji">${dish.emoji}</span>
          <span class="dish-label">${dish.name}</span>
        </button>
      `
    )
    .join('');
}

function startGame() {
  score = 0;
  timeLeft = 30;
  isPlaying = true;
  currentTarget = null;
  setMessage('Choisissez le bon plat !');
  updateScoreboard();
  startGameBtn.textContent = 'Nouvelle partie';
  clearInterval(timerId);
  generateRound();

  timerId = setInterval(() => {
    timeLeft -= 1;
    updateScoreboard();

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

gameBoard?.addEventListener('click', (event) => {
  const card = event.target.closest('.dish-card');
  if (!card || !isPlaying) return;

  const chosenName = card.dataset.name;

  if (chosenName === currentTarget.name) {
    score += 10;
    timeLeft = Math.min(30, timeLeft + 1);
    setMessage('Bonne réponse ! Le client est ravi.');
  } else {
    score = Math.max(0, score - 5);
    setMessage(`Raté ! Il fallait choisir ${currentTarget.name}.`);
  }

  updateScoreboard();
  generateRound();
});

startGameBtn?.addEventListener('click', startGame);
if (scoreEl && timerEl && bestScoreEl) updateScoreboard();

/* ---------- animations ---------- */
// Apparition des blocs au défilement (IntersectionObserver).
// Sans JavaScript, ou sans IntersectionObserver, tout reste visible.
document.documentElement.classList.add('js');

const revealObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })
  : null;

// variant : '', 'left', 'right' ou 'zoom'. cycle : décalage en cascade (index % cycle).
function registerReveal(elements, variant = '', cycle = 4) {
  [...elements].forEach((element, index) => {
    element.classList.add('reveal');
    if (variant) element.classList.add(`reveal-${variant}`);
    element.style.setProperty('--i', String(index % cycle));
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add('in-view');
  });
}

function initAnimations() {
  // Page d'accueil : le contenu du hero apparaît (le CSS le masque tant que .is-visible est absent)
  const heroContent = document.querySelector('.baniere .contenu');
  if (heroContent) window.requestAnimationFrame(() => heroContent.classList.add('is-visible'));

  registerReveal(document.querySelectorAll('.titre'));
  registerReveal(document.querySelectorAll('.apropos .col50:first-child'), 'left');
  registerReveal(document.querySelectorAll('.apropos .col50:last-child'), 'right');
  registerReveal(document.querySelectorAll('.menu .contenu .box'), 'zoom', 3);
  registerReveal(document.querySelectorAll('.expert .contenu .box'), 'zoom', 3);
  registerReveal(document.querySelectorAll('.temoignage .contenu .box'), '', 3);
  registerReveal(document.querySelectorAll('.game-panel, .order-form, .reservation-form, .contactform'));
  registerReveal(document.querySelectorAll('.hours-card'), 'left');
  registerReveal(document.querySelectorAll('.map-card'), 'right');
}

initAnimations();

/* ============================================================
   Cuisto — site statique + Supabase
   Commandes, réservations et messages sont enregistrés dans Supabase.
   Pour commander et réserver, WhatsApp s'ouvre aussi pour prévenir le restaurant ;
   si l'enregistrement échoue, WhatsApp reste le moyen d'envoi.
   ============================================================ */
const WHATSAPP_NUMBER = '22871645867';

/* ---------- utilitaires ---------- */
function setStatus(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('error', isError);
}

const formatPrice = (value) => `${value.toLocaleString('fr-FR')} FCFA`;

/* ---------- Supabase (clé publique : la sécurité vient des règles RLS) ---------- */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CUISTO_CONFIG || {};
const sb = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/* ---------- compte client (facultatif) : bouton du menu + préremplissage ---------- */
// Client connecté : ses demandes sont enregistrées dans son compte, sans passer par WhatsApp.
let currentUser = null;
let accountMeta = {};

// Enregistre automatiquement nom, téléphone et adresse dans le compte (seulement si quelque chose a changé)
async function rememberDetails(details) {
  if (!sb || !currentUser) return;
  const changed = {};
  for (const [key, value] of Object.entries(details)) {
    if (value && value !== accountMeta[key]) changed[key] = value;
  }
  if (!Object.keys(changed).length) return;
  try {
    const { data, error } = await sb.auth.updateUser({ data: changed });
    if (!error && data?.user) { currentUser = data.user; accountMeta = data.user.user_metadata || {}; }
  } catch (error) { console.error(error); }
}

async function applyAccount() {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    currentUser = session.user;
    const meta = session.user.user_metadata || {};
    accountMeta = meta;
    const first = (meta.full_name || '').split(' ')[0];
    const nav = document.getElementById('navAccount');
    if (nav) nav.textContent = first ? `Bonjour ${first}` : 'Mon compte';
    const fill = (id, value) => {
      const field = document.getElementById(id);
      if (field && value && !field.value) field.value = value;
    };
    fill('orderName', meta.full_name);
    fill('orderPhone', meta.phone);
    fill('reservationName', meta.full_name);
    fill('reservationPhone', meta.phone);
    fill('orderAddress', meta.address);
    fill('nameInput', meta.full_name);
    fill('emailInput', session.user.email);
    document.querySelectorAll('#orderForm [type="submit"]').forEach((b) => { b.textContent = 'Passer la commande'; });
    document.querySelectorAll('#reservationForm [type="submit"]').forEach((b) => { b.textContent = 'Réserver'; });
  } catch (error) { console.error(error); }
}
applyAccount();

/* ---------- WhatsApp ---------- */
function whatsappUrl(lines) {
  const text = lines.filter(Boolean).join('\n');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

// Le navigateur n'autorise l'ouverture d'un onglet que pendant le clic : on l'ouvre tout de suite
// (vide), puis on le remplit avec WhatsApp quand l'enregistrement est terminé.
function reserveWhatsAppTab() {
  try {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    return tab;
  } catch { return null; }
}

// Client connecté : tout est enregistré dans son compte, WhatsApp n'est pas nécessaire.
function finishInAccount(statusEl, text) {
  setStatus(statusEl, text);
  const link = document.createElement('a');
  link.href = 'compte.html';
  link.textContent = ' Voir dans Mon compte';
  statusEl.append(link);
}

function finishWithWhatsApp(tab, lines, statusEl, text, isError = false) {
  const url = whatsappUrl(lines);
  setStatus(statusEl, text, isError);
  if (tab && !tab.closed) { tab.location.href = url; return; }
  // onglet bloqué par le navigateur : on propose un lien
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = ' Ouvrir WhatsApp';
  statusEl.append(link);
}

async function save(action) {
  if (!sb) return false;
  try {
    const { error } = await action();
    if (error) console.error('Enregistrement impossible :', error.message);
    return !error;
  } catch (error) {
    console.error('Enregistrement impossible :', error);
    return false;
  }
}

/* ---------- réservation ---------- */
const reservationForm = document.getElementById('reservationForm');
const reservationMessage = document.getElementById('reservationMessage');

reservationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = reservationForm.querySelector('[type="submit"]');
  const name = document.getElementById('reservationName').value.trim();
  const phone = document.getElementById('reservationPhone').value.trim();
  const date = document.getElementById('reservationDate').value;
  const time = document.getElementById('reservationTime').value;
  const guests = Number(document.getElementById('reservationGuests').value) || 1;
  const note = document.getElementById('reservationNote').value.trim();

  const useAccount = Boolean(currentUser);
  const tab = useAccount ? null : reserveWhatsAppTab();
  submit.disabled = true;
  setStatus(reservationMessage, 'Envoi en cours...');

  const saved = await save(() => sb.from('reservations').insert({
    name, phone, reservation_date: date, reservation_time: time, guests, note: note || null
  }));
  submit.disabled = false;

  if (saved && useAccount) {
    finishInAccount(reservationMessage, 'Réservation enregistrée ✓ Nous la confirmons rapidement.');
    showToast('✓ Réservation enregistrée', { href: 'compte.html', label: 'Voir mon compte' });
    await rememberDetails({ full_name: name, phone });
    reservationForm.reset();
    applyAccount();
    return;
  }

  if (!saved) showToast('Enregistrement impossible : utilisez WhatsApp pour envoyer la réservation.', null, 'error');
  finishWithWhatsApp(tab, [
    'Bonjour Cuisto, je souhaite réserver une table.',
    `Nom : ${name}`,
    `Téléphone : ${phone}`,
    `Date : ${new Date(`${date}T00:00`).toLocaleDateString('fr-FR')}`,
    `Heure : ${time}`,
    `Personnes : ${guests}`,
    note && `Remarque : ${note}`
  ], reservationMessage, saved
    ? 'Réservation enregistrée ✓ WhatsApp s’ouvre : envoyez le message pour la confirmer.'
    : 'Enregistrement impossible pour le moment : envoyez votre réservation par WhatsApp.', !saved);
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

orderForm?.addEventListener('input', (event) => {
  if (event.target.matches('[data-price]')) updateOrderTotal();
});

document.querySelectorAll('input[name="fulfillment"]').forEach((input) => {
  input.addEventListener('change', () => {
    const isDelivery = input.value === 'livraison' && input.checked;
    orderAddress.required = isDelivery;
    orderAddress.disabled = !isDelivery;
    locationButton.disabled = !isDelivery;
    if (isDelivery && !orderAddress.value && accountMeta.address) orderAddress.value = accountMeta.address;
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

  const items = [...orderForm.querySelectorAll('[data-dish]')]
    .map((input) => ({
      slug: input.dataset.slug,
      name: input.dataset.dish,
      price: Number(input.dataset.price),
      quantity: Number(input.value) || 0
    }))
    .filter((item) => item.quantity > 0);
  if (!items.length) { setStatus(orderMessage, 'Choisissez au moins un plat.', true); return; }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const fulfillment = orderForm.querySelector('input[name="fulfillment"]:checked').value;
  const paymentMethod = orderForm.querySelector('input[name="paymentMethod"]:checked').value;
  const isDelivery = fulfillment === 'livraison';
  const name = document.getElementById('orderName').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const address = orderAddress.value.trim();
  const hasPosition = orderLatitude.value && orderLongitude.value;
  const note = document.getElementById('orderNote').value.trim();

  if (isDelivery && !address && !hasPosition) {
    setStatus(orderMessage, 'Indiquez une adresse ou utilisez votre position.', true);
    return;
  }

  const submit = orderForm.querySelector('[type="submit"]');
  const useAccount = Boolean(currentUser);
  const tab = useAccount ? null : reserveWhatsAppTab();
  submit.disabled = true;
  setStatus(orderMessage, 'Envoi en cours...');

  // Le prix est recalculé côté base à partir du plat (slug) : seuls plat et quantité sont envoyés
  const saved = await save(() => sb.rpc('create_order', {
    p_name: name,
    p_phone: phone,
    p_items: items.map(({ slug, quantity }) => ({ slug, quantity })),
    p_fulfillment: fulfillment,
    p_payment: paymentMethod,
    p_address: address || null,
    p_lat: hasPosition ? Number(orderLatitude.value) : null,
    p_lng: hasPosition ? Number(orderLongitude.value) : null,
    p_note: note || null
  }));
  submit.disabled = false;

  if (saved && useAccount) {
    finishInAccount(orderMessage, 'Commande enregistrée ✓ Suivez son avancement dans votre compte.');
    showToast('✓ Commande enregistrée', { href: 'compte.html', label: 'Suivre ma commande' });
    await rememberDetails({ full_name: name, phone, address: isDelivery ? address : '' });
    orderForm.reset();
    orderAddress.disabled = true;
    orderAddress.required = false;
    locationButton.disabled = true;
    locationMessage.textContent = '';
    updateOrderTotal();
    applyAccount();
    return;
  }

  if (!saved) showToast('Enregistrement impossible : utilisez WhatsApp pour envoyer la commande.', null, 'error');
  finishWithWhatsApp(tab, [
    'Bonjour Cuisto, je souhaite passer une commande :',
    ...items.map((item) => `- ${item.quantity} x ${item.name} (${formatPrice(item.price * item.quantity)})`),
    `Total : ${formatPrice(total)}`,
    isDelivery ? 'Mode : Livraison' : 'Mode : À emporter',
    paymentMethod === 'sur_place' ? 'Paiement sur place' : 'Paiement à la livraison',
    `Client : ${name} (${phone})`,
    isDelivery && address && `Adresse : ${address}`,
    isDelivery && hasPosition && `Position : https://www.google.com/maps?q=${orderLatitude.value},${orderLongitude.value}`,
    note && `Remarque : ${note}`
  ], orderMessage, saved
    ? 'Commande enregistrée ✓ WhatsApp s’ouvre : envoyez le message pour la valider.'
    : 'Enregistrement impossible pour le moment : envoyez votre commande par WhatsApp.', !saved);

  orderForm.reset();
  orderAddress.disabled = true;
  orderAddress.required = false;
  locationButton.disabled = true;
  locationMessage.textContent = '';
  updateOrderTotal();
});

/* ---------- menu cliquable : un clic ajoute le plat à la commande ---------- */
const toast = document.createElement('div');
toast.className = 'toast';
toast.setAttribute('role', 'status');
document.body.append(toast);
let toastTimer = null;

// compare deux noms de plat sans tenir compte des accents ni de la casse (Attiékè = Attieke)
const plain = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const sameDish = (a, b) => plain(a) === plain(b);

function showToast(text, link = { href: '#commande', label: 'Voir la commande' }, type = 'success') {
  toast.className = `toast ${type}`;
  const nodes = [document.createTextNode(text)];
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    nodes.push(a);
  }
  toast.replaceChildren(...nodes);
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
}

{
  const boxes = document.querySelectorAll('#menu .box[data-dish]');
  boxes.forEach((box) => {
    const addToOrder = () => {
      const input = [...document.querySelectorAll('#orderForm [data-dish]')].find((i) => sameDish(i.dataset.dish, box.dataset.dish));
      if (!input) return;
      const max = Number(input.max) || 20;
      const quantity = Math.min(max, (Number(input.value) || 0) + 1);
      input.value = quantity;
      updateOrderTotal();

      const label = input.closest('label');
      label?.classList.add('flash');
      setTimeout(() => label?.classList.remove('flash'), 900);
      box.classList.remove('added');
      void box.offsetWidth;
      box.classList.add('added');

      const total = orderTotal ? orderTotal.textContent : '';
      const dishName = input.dataset.dish;
      showToast(quantity === max
        ? `${dishName} : quantité maximale (${max}) atteinte. Total : ${total}`
        : `✓ ${dishName} ajouté (×${quantity}). Total : ${total}`);
    };
    box.addEventListener('click', addToOrder);
    box.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      addToOrder();
    });
  });
}

/* ---------- message de contact ---------- */
const contactForm = document.getElementById('contactForm');

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = contactForm.querySelector('.contact-status');
  const submit = contactForm.querySelector('[type="submit"]');
  const name = document.getElementById('nameInput')?.value.trim() || 'Client';
  const email = document.getElementById('emailInput')?.value.trim() || '';
  const message = document.getElementById('messageInput')?.value.trim() || '';
  if (!email || !message) return;

  submit.disabled = true;
  setStatus(status, 'Envoi en cours...');
  const saved = await save(() => sb.from('contact_messages').insert({ name, email, message }));
  submit.disabled = false;

  if (saved) {
    showToast('✓ Message envoyé', null);
    setStatus(status, 'Message envoyé ✓ Nous vous répondons rapidement.');
    contactForm.reset();
    return;
  }
  // secours : WhatsApp (lien cliquable, car le navigateur bloquerait une ouverture automatique)
  finishWithWhatsApp(null, ['Bonjour Cuisto,', message, `— ${name} (${email})`], status,
    'Envoi impossible pour le moment : écrivez-nous par WhatsApp.', true);
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
  registerReveal(document.querySelectorAll('.hours-card, .contact-info'), 'left');
  registerReveal(document.querySelectorAll('.map-card'), 'right');
}

initAnimations();

/* ---------- accueil d'un nouveau client (après création du compte) ---------- */
try {
  const welcome = sessionStorage.getItem('cuistoWelcome');
  if (welcome) {
    sessionStorage.removeItem('cuistoWelcome');
    setTimeout(() => showToast(`Bienvenue ${welcome} ! Votre compte est créé ✓`, { href: '#menu', label: 'Voir le menu' }), 600);
  }
} catch { /* ignoré */ }
/* ============================================================
   Cuisto — site statique (sans base de données)
   Commande, réservation et contact s'envoient par WhatsApp.
   ============================================================ */
const WHATSAPP_NUMBER = '22871645867';

/* ---------- utilitaires ---------- */
function setStatus(element, text, isError = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle('error', isError);
}

const formatPrice = (value) => `${value.toLocaleString('fr-FR')} FCFA`;

function openWhatsApp(lines) {
  const text = lines.filter(Boolean).join('\n');
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
}

/* ---------- réservation ---------- */
const reservationForm = document.getElementById('reservationForm');
const reservationMessage = document.getElementById('reservationMessage');

reservationForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.getElementById('reservationName').value.trim();
  const date = document.getElementById('reservationDate').value;
  const time = document.getElementById('reservationTime').value;
  const guests = Number(document.getElementById('reservationGuests').value) || 1;
  const note = document.getElementById('reservationNote').value.trim();

  openWhatsApp([
    'Bonjour Cuisto, je souhaite réserver une table.',
    `Nom : ${name}`,
    `Date : ${new Date(date).toLocaleDateString('fr-FR')}`,
    `Heure : ${time}`,
    `Personnes : ${guests}`,
    note && `Remarque : ${note}`
  ]);
  setStatus(reservationMessage, 'WhatsApp s’ouvre : envoyez le message pour finaliser la réservation.');
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

orderForm?.addEventListener('submit', (event) => {
  event.preventDefault();

  const items = [...orderForm.querySelectorAll('[data-dish]')]
    .map((input) => ({ name: input.dataset.dish, price: Number(input.dataset.price), quantity: Number(input.value) || 0 }))
    .filter((item) => item.quantity > 0);
  if (!items.length) { setStatus(orderMessage, 'Choisissez au moins un plat.', true); return; }

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const isDelivery = orderForm.querySelector('input[name="fulfillment"]:checked').value === 'livraison';
  const payment = orderForm.querySelector('input[name="paymentMethod"]:checked').value === 'sur_place'
    ? 'Paiement sur place'
    : 'Paiement à la livraison';
  const address = orderAddress.value.trim();
  const hasPosition = orderLatitude.value && orderLongitude.value;
  const note = document.getElementById('orderNote').value.trim();

  if (isDelivery && !address && !hasPosition) {
    setStatus(orderMessage, 'Indiquez une adresse ou utilisez votre position.', true);
    return;
  }

  openWhatsApp([
    'Bonjour Cuisto, je souhaite passer une commande :',
    ...items.map((item) => `- ${item.quantity} x ${item.name} (${formatPrice(item.price * item.quantity)})`),
    `Total : ${formatPrice(total)}`,
    isDelivery ? 'Mode : Livraison' : 'Mode : À emporter',
    payment,
    isDelivery && address && `Adresse : ${address}`,
    isDelivery && hasPosition && `Position : https://www.google.com/maps?q=${orderLatitude.value},${orderLongitude.value}`,
    note && `Remarque : ${note}`
  ]);

  setStatus(orderMessage, 'WhatsApp s’ouvre : envoyez le message pour valider votre commande.');
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

function showToast(text) {
  const link = document.createElement('a');
  link.href = '#commande';
  link.textContent = 'Voir la commande';
  toast.replaceChildren(document.createTextNode(text), link);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
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

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const status = contactForm.querySelector('.contact-status');
  const name = document.getElementById('nameInput')?.value.trim() || 'Client';
  const email = document.getElementById('emailInput')?.value.trim() || '';
  const message = document.getElementById('messageInput')?.value.trim() || '';
  if (!email || !message) return;

  openWhatsApp([
    'Bonjour Cuisto,',
    message,
    `— ${name} (${email})`
  ]);
  setStatus(status, 'WhatsApp s’ouvre : envoyez le message pour nous joindre.');
  contactForm.reset();
});

/* ---------- carte : verrouillée tant qu'on n'a pas cliqué dessus ---------- */
const mapCard = document.getElementById('mapCard');
const mapOverlay = document.getElementById('mapOverlay');
const lockMap = () => mapCard?.classList.remove('unlocked');

mapOverlay?.addEventListener('click', () => mapCard.classList.add('unlocked'));
mapCard?.addEventListener('mouseleave', lockMap);
document.addEventListener('click', (event) => { if (mapCard && !mapCard.contains(event.target)) lockMap(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') lockMap(); });

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

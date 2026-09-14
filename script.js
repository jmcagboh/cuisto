const contactEmail = 'jeanagboh86@gmail.com';
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authSubmit = document.getElementById('authSubmit');
const authMessage = document.getElementById('authMessage');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const forgotPassword = document.getElementById('forgotPassword');
const resetForm = document.getElementById('resetForm');
const profileFields = document.getElementById('profileFields');
const reservationForm = document.getElementById('reservationForm');
const reservationMessage = document.getElementById('reservationMessage');
let isRegisterMode = false;

function showAuthMessage(message, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.classList.toggle('error', isError);
}

toggleAuthMode?.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  authTitle.textContent = isRegisterMode ? 'Créer votre compte' : 'Bon retour parmi nous';
  authSubmit.textContent = isRegisterMode ? 'Créer mon compte' : 'Se connecter';
  toggleAuthMode.textContent = isRegisterMode ? 'J’ai déjà un compte' : 'Créer un compte';
  profileFields?.classList.toggle('hidden-field', !isRegisterMode);
  profileFields?.querySelectorAll('input').forEach((input) => { input.required = isRegisterMode; });
  showAuthMessage('');
});

reservationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = sessionStorage.getItem('cuistoToken');
  if (!token) { window.location.href = 'login.html'; return; }
  const response = await fetch('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ date: document.getElementById('reservationDate').value, time: document.getElementById('reservationTime').value, guests: document.getElementById('reservationGuests').value, note: document.getElementById('reservationNote').value })
  });
  const result = await response.json();
  reservationMessage.textContent = response.ok ? result.message : result.error;
  reservationMessage.classList.toggle('error', !response.ok);
  if (response.ok) reservationForm.reset();
});

const orderForm = document.getElementById('orderForm');
const orderMessage = document.getElementById('orderMessage');
const orderAddress = document.getElementById('orderAddress');
const locationButton = document.getElementById('locationButton');
const locationMessage = document.getElementById('locationMessage');
const orderLatitude = document.getElementById('orderLatitude');
const orderLongitude = document.getElementById('orderLongitude');
const orderTotal = document.getElementById('orderTotal');
const formatPrice = (value) => `${value.toLocaleString('fr-FR')} FCFA`;

function updateOrderTotal() {
  const total = [...orderForm.querySelectorAll('[data-price]')]
    .reduce((sum, input) => sum + Number(input.value) * Number(input.dataset.price), 0);
  orderTotal.textContent = formatPrice(total);
}

orderForm?.querySelectorAll('[data-price]').forEach((input) => input.addEventListener('input', updateOrderTotal));

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
  const token = sessionStorage.getItem('cuistoToken');
  if (!token) { window.location.href = 'login.html'; return; }
  const items = [...orderForm.querySelectorAll('[data-dish]')]
    .map((input) => ({ name: input.dataset.dish, quantity: Number(input.value), unitPrice: Number(input.dataset.price) }))
    .filter((item) => item.quantity > 0);
  const fulfillment = orderForm.querySelector('input[name="fulfillment"]:checked').value;
  const paymentMethod = orderForm.querySelector('input[name="paymentMethod"]:checked').value;
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items, fulfillment, paymentMethod, address: orderAddress.value.trim(), latitude: orderLatitude.value, longitude: orderLongitude.value, note: document.getElementById('orderNote').value.trim() })
  });
  const result = await response.json();
  orderMessage.textContent = response.ok ? result.message : result.error;
  orderMessage.classList.toggle('error', !response.ok);
  if (response.ok) {
    orderForm.reset();
    orderAddress.disabled = true;
    orderAddress.required = false;
    locationButton.disabled = true;
    locationMessage.textContent = '';
    updateOrderTotal();
  }
});

forgotPassword?.addEventListener('click', async () => {
  const email = document.getElementById('authEmail')?.value.trim().toLowerCase();
  if (!email) { showAuthMessage('Saisissez votre adresse e-mail.', true); return; }
  const response = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  const result = await response.json();
  showAuthMessage(result.message || result.error, !response.ok);
});

const resetToken = new URLSearchParams(window.location.search).get('reset');
if (resetToken && resetForm) {
  authForm.classList.add('hidden-field');
  document.querySelector('.auth-links')?.classList.add('hidden-field');
  resetForm.classList.remove('hidden-field');
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('newPassword').value;
    const confirmation = document.getElementById('resetConfirmPassword').value;
    if (password !== confirmation) { showAuthMessage('Les mots de passe ne correspondent pas.', true); return; }
    const response = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, password }) });
    const result = await response.json();
    showAuthMessage(result.message || result.error, !response.ok);
    if (response.ok) { resetForm.reset(); resetForm.classList.add('hidden-field'); authForm.classList.remove('hidden-field'); document.querySelector('.auth-links')?.classList.remove('hidden-field'); }
  });
}

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('authEmail').value.trim().toLowerCase();
  const password = document.getElementById('authPassword').value;
  if (isRegisterMode) {
    const registerResponse = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('authName').value.trim(), email, password }) });
    const registerResult = await registerResponse.json();
    if (!registerResponse.ok) { showAuthMessage(registerResult.error, true); return; }
    showAuthMessage('Compte créé. Vous pouvez maintenant vous connecter.');
    isRegisterMode = false;
    authTitle.textContent = 'Bon retour parmi nous';
    authSubmit.textContent = 'Se connecter';
    toggleAuthMode.textContent = 'Créer un compte';
    profileFields?.classList.add('hidden-field');
    profileFields?.querySelectorAll('input').forEach((input) => { input.required = false; });
    return;
  }
  const loginResponse = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const loginResult = await loginResponse.json();
  if (!loginResponse.ok) { showAuthMessage(loginResult.error, true); return; }
  sessionStorage.setItem('cuistoToken', loginResult.token);
  showAuthMessage('Connexion réussie. Redirection...');
  window.setTimeout(() => { window.location.href = loginResult.redirect; }, 500);
});

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

const contactForm = document.getElementById('contactForm');

if (contactForm) {
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('nameInput')?.value.trim() || 'Client';
    const email = document.getElementById('emailInput')?.value.trim() || '';
    const message = document.getElementById('messageInput')?.value.trim() || '';

    if (!email || !message) return;
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, message })
    });
    const result = await response.json();
    const status = contactForm.querySelector('.contact-status');
    if (status) {
      status.textContent = response.ok ? result.message : result.error;
      status.classList.toggle('error', !response.ok);
    }
    if (response.ok) contactForm.reset();
  });
}

const appLaunch = document.getElementById('appLaunch');
const appStartBtn = document.getElementById('appStartBtn');

if (appStartBtn) {
  appStartBtn.addEventListener('click', () => {
    appLaunch.classList.add('hidden');
  });
}

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

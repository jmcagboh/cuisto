/* ============================================================
   Cuisto — site statique + Supabase
   Commandes, réservations et messages sont enregistrés dans Supabase.
   Pour commander et réserver, WhatsApp s'ouvre aussi pour prévenir le restaurant ;
   si l'enregistrement échoue, WhatsApp reste le moyen d'envoi.
   ============================================================ */
const WHATSAPP_NUMBER = window.SITE?.whatsapp || '22871645867';
const SITE_NAME = window.SITE?.name || 'Cuisto';

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
let activeReward = null; // récompense du jeu disponible pour ce client

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
    await loadReward();
    claimPending();
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
    `Bonjour ${SITE_NAME}, je souhaite réserver une table.`,
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
  const subtotal = [...orderForm.querySelectorAll('[data-price]')]
    .reduce((sum, input) => sum + (Number(input.value) || 0) * Number(input.dataset.price), 0);
  const useReward = activeReward && subtotal > 0 && document.getElementById('useReward')?.checked;
  const label = useReward
    ? `${formatPrice(Math.round(subtotal * (100 - activeReward.percent) / 100))} (−${activeReward.percent} %)`
    : formatPrice(subtotal);
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
    p_note: note || null,
    p_reward: (activeReward && document.getElementById('useReward')?.checked) ? activeReward.id : null
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
    loadReward();
    return;
  }

  if (!saved) showToast('Enregistrement impossible : utilisez WhatsApp pour envoyer la commande.', null, 'error');
  finishWithWhatsApp(tab, [
    `Bonjour ${SITE_NAME}, je souhaite passer une commande :`,
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

function bindMenuBoxes() {
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

bindMenuBoxes();

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
  finishWithWhatsApp(null, [`Bonjour ${SITE_NAME},`, message, `— ${name} (${email})`], status,
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

/* ---------- Jeu « Le bon plat » ----------
   Les plats et les photos viennent du menu de la page (aucun emoji).
   Récompense : 100 pts = -5 %, 200 pts = -10 % (client connecté). Elle est créée et contrôlée
   par Supabase (claim_game_reward / create_order) : le navigateur ne fixe jamais le prix. */
const GAME_SECONDS = 30;
const MAX_SCORE = 500;
const TIERS = [{ points: 100, percent: 5 }, { points: 200, percent: 10 }];
// ces deux plats se ressemblent : on ne les propose jamais ensemble dans une devinette
const LOOKALIKES = [['Akoume', 'Pokoume']];

const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const streakEl = document.getElementById('streak');
const bestScoreEl = document.getElementById('bestScore');
const gameBoard = document.getElementById('gameBoard');
const questionLabel = document.getElementById('questionLabel');
const questionBody = document.getElementById('questionBody');
const startGameBtn = document.getElementById('startGameBtn');
const gameMessage = document.getElementById('gameMessage');
const rewardFill = document.getElementById('rewardFill');
const rewardBar = document.getElementById('rewardBar');
const rewardHint = document.getElementById('rewardHint');

// plats du jeu = plats actuellement affichés dans le menu (donc ceux gérés dans l'administration)
function readGameDishes() {
  return [...document.querySelectorAll('#menu .box[data-dish]')].map((box) => ({
    key: box.dataset.slug || box.dataset.dish,
    name: box.dataset.dish,
    img: box.querySelector('img')?.getAttribute('src') || '',
    clue: box.dataset.clue || ''
  }));
}
let gameDishes = readGameDishes();

let score = 0;
let timeLeft = GAME_SECONDS;
let streak = 0;
let current = null;
let previousKey = null;
let timerId = null;
let isPlaying = false;
let locked = false;
const missed = new Set();
let bestScore = Number(localStorage.getItem('cuistoBestScore')) || 0;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const isLookalike = (a, b) => LOOKALIKES.some(([x, y]) => (a === x && b === y) || (a === y && b === x));

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
  streakEl.textContent = streak > 1 ? `×${streak}` : streak;
  bestScoreEl.textContent = bestScore;
  timerEl.classList.toggle('low', isPlaying && timeLeft <= 8);
  const pct = Math.min(100, (score / TIERS[TIERS.length - 1].points) * 100);
  rewardFill.style.width = `${pct}%`;
  rewardBar.setAttribute('aria-valuenow', String(Math.min(score, 200)));
  rewardBar.classList.toggle('t1-done', score >= TIERS[0].points);
  rewardBar.classList.toggle('t2-done', score >= TIERS[1].points);
  const next = TIERS.find((tier) => score < tier.points);
  rewardHint.textContent = next
    ? `Encore ${next.points - score} points pour −${next.percent} % sur votre commande.`
    : 'Remise maximale atteinte : −10 % sur votre commande !';
}

function setMessage(text) { gameMessage.textContent = text; }

function generateRound() {
  if (!isPlaying || gameDishes.length < 4) return;
  const useClue = Math.random() < 0.5;
  const pool = gameDishes.filter((d) => d.key !== previousKey && (!useClue || (d.clue && !plain(d.clue).includes(plain(d.name)))));
  const target = pick(pool);
  previousKey = target.key;
  const others = shuffle(gameDishes.filter((d) => d.key !== target.key && !(useClue && isLookalike(target.key, d.key)))).slice(0, 3);
  const choices = shuffle([target, ...others]);
  current = target;
  locked = false;

  if (useClue) {
    questionLabel.textContent = 'Quel plat correspond à cette description ?';
    questionBody.innerHTML = '';
    const clue = document.createElement('h3');
    clue.className = 'game-clue';
    clue.textContent = `« ${target.clue} »`;
    questionBody.append(clue);
    gameBoard.className = 'game-board photos';
    gameBoard.innerHTML = choices.map((d) => `
      <button type="button" class="dish-card photo" data-key="${d.key}" aria-label="${d.name}">
        <img src="${d.img}" alt="" width="220" height="140">
      </button>`).join('');
  } else {
    questionLabel.textContent = 'Quel est ce plat ?';
    questionBody.innerHTML = '';
    const photo = document.createElement('img');
    photo.className = 'game-photo';
    photo.src = target.img;
    photo.alt = 'Photo du plat à reconnaître';
    questionBody.append(photo);
    gameBoard.className = 'game-board names';
    gameBoard.innerHTML = choices.map((d) => `
      <button type="button" class="dish-card name" data-key="${d.key}">
        <span class="dish-label">${d.name}</span>
      </button>`).join('');
  }
}

function startGame() {
  gameDishes = readGameDishes();
  if (gameDishes.length < 4) { setMessage('Le jeu sera disponible dès que le menu comptera au moins 4 plats.'); return; }
  score = 0;
  streak = 0;
  timeLeft = GAME_SECONDS;
  isPlaying = true;
  previousKey = null;
  missed.clear();
  setMessage('Cherchez vite : chaque bonne réponse donne du temps en plus !');
  startGameBtn.textContent = 'Nouvelle partie';
  clearInterval(timerId);
  updateScoreboard();
  generateRound();
  timerId = setInterval(() => {
    timeLeft -= 1;
    if (timeLeft <= 0) { timeLeft = 0; endGame(); return; }
    updateScoreboard();
  }, 1000);
}

gameBoard?.addEventListener('click', (event) => {
  const card = event.target.closest('.dish-card');
  if (!card || !isPlaying || locked) return;
  locked = true;
  const right = card.dataset.key === current.key;

  if (right) {
    streak += 1;
    score = Math.min(MAX_SCORE, score + 10 + (streak >= 5 ? 10 : streak >= 3 ? 5 : 0));
    timeLeft = Math.min(GAME_SECONDS + 15, timeLeft + (score < 60 ? 2 : score < 150 ? 1 : 0));
    card.classList.add('right');
    setMessage(streak >= 3 ? `Série de ${streak} ! Bonus de points.` : 'Bonne réponse !');
  } else {
    streak = 0;
    score = Math.max(0, score - 5);
    timeLeft = Math.max(1, timeLeft - 2);
    missed.add(current.key);
    card.classList.add('wrong');
    gameBoard.querySelector(`[data-key="${current.key}"]`)?.classList.add('right');
    setMessage(`Raté : c’était ${current.name}.`);
  }
  updateScoreboard();
  setTimeout(() => {
    if (!isPlaying) return;
    if (score >= MAX_SCORE) { endGame(); return; }
    generateRound();
  }, right ? 350 : 800);
});

/* ---------- fin de partie, récompense ---------- */
function tierFor(points) {
  return [...TIERS].reverse().find((tier) => points >= tier.points) || null;
}

async function endGame() {
  isPlaying = false;
  clearInterval(timerId);
  const finalScore = score;
  if (finalScore > bestScore) {
    bestScore = finalScore;
    localStorage.setItem('cuistoBestScore', String(bestScore));
  }
  updateScoreboard();
  startGameBtn.textContent = 'Rejouer';
  setMessage('');
  questionLabel.textContent = 'Partie terminée';
  questionBody.innerHTML = `<h3>${finalScore} points</h3>`;

  const tier = tierFor(finalScore);
  const next = TIERS.find((t) => finalScore < t.points);
  const missedDishes = gameDishes.filter((d) => missed.has(d.key));
  const result = document.createElement('div');
  result.className = 'game-result';
  gameBoard.className = 'game-board';
  gameBoard.innerHTML = '';
  gameBoard.append(result);

  const line = (html) => { const p = document.createElement('p'); p.innerHTML = html; result.append(p); return p; };
  const button = (label, onClick, secondary = false) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = secondary ? 'admin-button secondary' : 'btn1';
    b.textContent = label;
    b.addEventListener('click', onClick);
    result.append(b);
    return b;
  };

  if (!tier) {
    line(`Il vous manquait <strong>${next.points - finalScore} points</strong> pour gagner −${next.percent} % sur votre commande. Retentez votre chance !`);
  } else if (!currentUser) {
    try { localStorage.setItem('cuistoPendingScore', JSON.stringify({ score: finalScore, at: Date.now() })); } catch { /* ignoré */ }
    line(`Bravo ! Vous avez gagné <strong>−${tier.percent} %</strong> sur une commande.`);
    line('Connectez-vous ou créez un compte pour débloquer cette récompense (valable 1 heure).');
    const a = document.createElement('a');
    a.className = 'btn1';
    a.href = 'compte.html';
    a.textContent = 'Me connecter';
    result.append(a);
  } else {
    line('Vérification de votre récompense...');
    const reward = await claimReward(finalScore);
    result.firstChild.remove();
    if (!reward) {
      line('La récompense n’a pas pu être enregistrée pour le moment. Réessayez plus tard.');
    } else if (reward.already && reward.used) {
      line('Vous avez déjà utilisé votre récompense du jour. Revenez demain pour en gagner une autre !');
    } else if (reward.already) {
      line(`Vous avez déjà une récompense active : <strong>−${reward.percent} %</strong> sur votre prochaine commande.`);
    } else {
      line(`Récompense gagnée : <strong>−${reward.percent} %</strong> sur votre prochaine commande (valable 24 h).`);
    }
    if (reward && !(reward.already && reward.used)) {
      button('Utiliser ma récompense', () => document.getElementById('commande')?.scrollIntoView({ behavior: 'smooth' }));
    }
  }

  if (missedDishes.length) {
    line(`À retenir : <strong>${missedDishes.map((d) => d.name).join(', ')}</strong>.`);
    const first = missedDishes[0];
    button(`Commander : ${first.name}`, () => {
      document.querySelector(`#menu .box[data-dish="${first.key}"]`)?.click();
      document.getElementById('commande')?.scrollIntoView({ behavior: 'smooth' });
    }, true);
  } else if (finalScore > 0) {
    line('Aucune erreur sur cette partie : vous connaissez bien notre menu !');
  }
}

startGameBtn?.addEventListener('click', startGame);
if (scoreEl && timerEl && bestScoreEl) updateScoreboard();

/* ---------- récompense du jeu : création, lecture, utilisation à la commande ---------- */
async function claimReward(points) {
  if (!sb || !currentUser) return null;
  try {
    const { data, error } = await sb.rpc('claim_game_reward', { p_score: points });
    if (error) throw error;
    await loadReward();
    return data;
  } catch (error) { console.error(error); return null; }
}

// un score obtenu avant de se connecter est validé après la connexion (1 heure maximum)
async function claimPending() {
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem('cuistoPendingScore') || 'null'); } catch { /* ignoré */ }
  if (!pending) return;
  try { localStorage.removeItem('cuistoPendingScore'); } catch { /* ignoré */ }
  if (Date.now() - pending.at > 3600000 || !tierFor(pending.score)) return;
  const reward = await claimReward(pending.score);
  if (reward && !reward.already) showToast(`Récompense du jeu débloquée : −${reward.percent} % sur votre commande`, { href: '#commande', label: 'Commander' });
}

async function loadReward() {
  activeReward = null;
  if (sb && currentUser) {
    try {
      const { data } = await sb.from('game_rewards').select('id, percent, expires_at')
        .is('used_at', null).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false }).limit(1);
      if (data && data.length) activeReward = data[0];
    } catch (error) { console.error(error); }
  }
  const box = document.getElementById('rewardBox');
  if (box) {
    box.hidden = !activeReward;
    if (activeReward) document.getElementById('rewardText').textContent = `−${activeReward.percent} %`;
  }
  updateOrderTotal();
}

document.getElementById('useReward')?.addEventListener('change', updateOrderTotal);

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

/* ---------- Badge « Ouvert / Fermé » (heure du Togo, mêmes horaires que la section Contact) ---------- */
(function openBadge() {
  const badges = document.querySelectorAll('[data-open-badge]');
  if (!badges.length || !window.SITE?.dayHours) return;
  const SITE = window.SITE;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmt = (h) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

  function status() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: SITE.timezone || 'Africa/Lome', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    const day = DAYS.indexOf(get('weekday'));
    const now = Number(get('hour')) + Number(get('minute')) / 60;
    const today = SITE.dayHours(day);
    if (today && now >= today[0] && now < today[1]) {
      return today[1] - now <= 1
        ? { cls: 'is-soon', text: `Ferme bientôt · ${fmt(today[1])}` }
        : { cls: 'is-open', text: `Ouvert maintenant · jusqu'à ${fmt(today[1])}` };
    }
    if (today && now < today[0]) return { cls: 'is-closed', text: `Fermé · ouvre à ${fmt(today[0])}` };
    for (let i = 1; i <= 7; i++) {
      const next = SITE.dayHours((day + i) % 7);
      if (next) return { cls: 'is-closed', text: `Fermé · ouvre ${i === 1 ? 'demain' : 'bientôt'} à ${fmt(next[0])}` };
    }
    return { cls: 'is-closed', text: 'Fermé' };
  }

  function paint() {
    const { cls, text } = status();
    badges.forEach((badge) => {
      badge.hidden = false;
      badge.className = badge.className.replace(/\bis-(open|soon|closed)\b/g, '').trim() + ` ${cls}`;
      badge.textContent = text;
    });
  }
  paint();
  setInterval(paint, 60000);
})();


/* ---------- Menu et commande chargés depuis Supabase (gérés dans l'administration) ----------
   Le HTML contient déjà le menu de départ : il reste affiché si la base est injoignable. */
const imageSrc = (url) => (!url ? '' : /^(https?:|\/|\.)/.test(url) ? url : `./${url}`);

function buildMenuBox(dish) {
  const box = document.createElement('div');
  box.className = 'box';
  box.dataset.dish = dish.name;
  box.dataset.slug = dish.slug;
  if (dish.game_clue) box.dataset.clue = dish.game_clue;
  box.setAttribute('role', 'button');
  box.tabIndex = 0;

  const imbox = document.createElement('div');
  imbox.className = 'imbox';
  if (dish.tag) {
    const tag = document.createElement('span');
    tag.className = 'dish-tag';
    tag.textContent = dish.tag;
    imbox.append(tag);
  }
  const img = document.createElement('img');
  img.src = imageSrc(dish.image_url);
  img.alt = dish.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  imbox.append(img);

  const text = document.createElement('div');
  text.className = 'text';
  const title = document.createElement('h3');
  title.textContent = dish.name;
  const price = document.createElement('p');
  price.className = 'dish-price';
  price.textContent = formatPrice(dish.price);
  text.append(title, price);
  if (dish.description) {
    const desc = document.createElement('p');
    desc.className = 'dish-desc';
    desc.textContent = dish.description;
    text.append(desc);
  }
  box.append(imbox, text);
  return box;
}

function buildOrderRow(dish, quantity) {
  const label = document.createElement('label');
  const span = document.createElement('span');
  span.append(`${dish.name} `);
  const strong = document.createElement('strong');
  strong.textContent = formatPrice(dish.price);
  span.append(strong);
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '20';
  input.value = quantity || '0';
  input.dataset.price = String(dish.price);
  input.dataset.dish = dish.name;
  input.dataset.slug = dish.slug;
  input.setAttribute('aria-label', `Quantité ${dish.name}`);
  label.append(span, input);
  return label;
}

async function loadMenu() {
  const menuList = document.querySelector('#menu .contenu');
  const orderList = document.querySelector('#orderForm .order-items');
  if (!sb || !menuList || !orderList) return;
  try {
    const { data, error } = await sb.from('dishes')
      .select('slug, name, price, description, image_url, tag, game_clue')
      .eq('available', true).eq('category', 'menu').order('sort_order').order('name');
    if (error || !Array.isArray(data)) return;

    const quantities = new Map([...orderList.querySelectorAll('[data-slug]')].map((i) => [i.dataset.slug, i.value]));
    if (!data.length) {
      menuList.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'Le menu est en cours de mise à jour. Revenez bientôt !' }));
      orderList.replaceChildren();
      updateOrderTotal();
      return;
    }
    const boxes = data.map(buildMenuBox);
    menuList.replaceChildren(...boxes);
    orderList.replaceChildren(...data.map((dish) => buildOrderRow(dish, quantities.get(dish.slug))));
    registerReveal(boxes, 'zoom', 3);
    bindMenuBoxes();
    updateOrderTotal();
    gameDishes = readGameDishes();
  } catch (error) { console.error(error); }
}

loadMenu();

/* ---------- Photos de l'accueil et de « À propos » (gérées dans l'administration) ---------- */
async function loadSiteImages() {
  if (!sb || !window.applySiteImages) return;
  try {
    const { data, error } = await sb.from('site_images').select('key, url');
    if (error || !Array.isArray(data)) return;
    const map = Object.fromEntries(data.map((row) => [row.key, row.url]));
    try { localStorage.setItem('cuistoSiteImages', JSON.stringify(map)); } catch { /* ignoré */ }
    window.applySiteImages(map);
  } catch (error) { console.error(error); }
}
loadSiteImages();

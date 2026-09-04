const contactEmail = 'jeanagboh86@gmail.com';

const contactForm = document.getElementById('contactForm');

if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = document.getElementById('nameInput')?.value.trim() || 'Client';
    const email = document.getElementById('emailInput')?.value.trim() || '';
    const message = document.getElementById('messageInput')?.value.trim() || '';

    if (!email || !message) return;

    const subject = encodeURIComponent(`Message depuis Cuisto - ${name}`);
    const body = encodeURIComponent(
      `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );

    window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
    contactForm.reset();
  });
}

const appLaunch = document.getElementById('appLaunch');
const appStartBtn = document.getElementById('appStartBtn');

if (appStartBtn) {
  appStartBtn.addEventListener('click', () => {
    appLaunch.classList.add('hidden');
    document.getElementById('jeu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

gameBoard.addEventListener('click', (event) => {
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

startGameBtn.addEventListener('click', startGame);
updateScoreboard();

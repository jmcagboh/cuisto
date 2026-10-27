/* ============================================================
   Cuisto — messagerie (version statique)
   Les messages sont envoyés via WhatsApp ; la conversation est gardée
   dans le navigateur du client (localStorage).
   Plus tard (Supabase) : remplacer uniquement deliverMessage().
   ============================================================ */
const WHATSAPP_NUMBER = '22871645867';
const STORAGE_KEY = 'cuistoChat';
const NAME_KEY = 'cuistoChatName';

const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatName = document.getElementById('chatName');
const chatChips = document.getElementById('chatChips');
const chatClear = document.getElementById('chatClear');

/* ---------- stockage (peut être indisponible : navigation privée, etc.) ---------- */
function readStore(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignoré */ }
}

let messages = readStore(STORAGE_KEY, []);
chatName.value = readStore(NAME_KEY, '');

/* ---------- affichage ---------- */
const timeLabel = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function bubble(message) {
  const node = document.createElement('div');
  node.className = `msg ${message.from}`;
  node.append(document.createTextNode(message.text)); // texte brut : pas d'injection HTML
  const meta = document.createElement('small');
  meta.textContent = message.from === 'me' ? `${timeLabel(message.time)} · envoyé via WhatsApp` : timeLabel(message.time);
  node.append(meta);
  return node;
}

function scrollToEnd() { chatLog.scrollTop = chatLog.scrollHeight; }

function addMessage(from, text) {
  const message = { from, text, time: Date.now() };
  messages.push(message);
  writeStore(STORAGE_KEY, messages);
  chatLog.append(bubble(message));
  scrollToEnd();
}

function render() {
  chatLog.replaceChildren(...messages.map(bubble));
  scrollToEnd();
}

function cuistoReply(text) {
  const typing = document.createElement('div');
  typing.className = 'msg cuisto typing';
  typing.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
  chatLog.append(typing);
  scrollToEnd();
  setTimeout(() => { typing.remove(); addMessage('cuisto', text); }, 900);
}

/* ---------- envoi ---------- */
// Point d'entrée unique pour la livraison du message (à remplacer par Supabase plus tard).
function deliverMessage(name, text) {
  const body = `Bonjour Cuisto, c'est ${name}.\n${text}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = chatName.value.trim();
  const text = chatInput.value.trim();
  if (!name || !text) return;

  writeStore(NAME_KEY, name);
  deliverMessage(name, text);
  addMessage('me', text);
  chatInput.value = '';
  autoGrow();
  cuistoReply(`Merci ${name} ! Terminez l'envoi dans WhatsApp : nous vous répondons dès que possible.`);
});

/* ---------- confort de saisie ---------- */
function autoGrow() {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 140)}px`;
}

chatInput.addEventListener('input', autoGrow);
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); chatForm.requestSubmit(); }
});

chatChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chat-chip');
  if (!chip) return;
  chatInput.value = chip.textContent;
  autoGrow();
  chatInput.focus();
});

chatClear.addEventListener('click', () => {
  if (!messages.length || !window.confirm('Effacer la conversation sur cet appareil ?')) return;
  messages = [];
  writeStore(STORAGE_KEY, messages);
  welcome();
});

function welcome() {
  messages = [];
  chatLog.replaceChildren();
  addMessage('cuisto', 'Bonjour et bienvenue chez Cuisto ! Une commande, une réservation ou une question ? Écrivez-nous ici, nous vous répondons sur WhatsApp.');
}

if (messages.length) render(); else welcome();

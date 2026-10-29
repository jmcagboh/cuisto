/* ============================================================
   Cuisto — messagerie
   - Client connecté : discussion directe avec le restaurant (Supabase, en temps réel).
   - Visiteur sans compte : le message s'ouvre dans WhatsApp, la conversation reste sur l'appareil.
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
const chatBanner = document.getElementById('chatBanner');
const chatNote = document.getElementById('chatNote');
const chatSubtitle = document.getElementById('chatSubtitle');

/* ---------- Supabase (clé publique : la sécurité vient des règles RLS) ---------- */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CUISTO_CONFIG || {};
const sb = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let account = null;   // { id, name } quand le client est connecté

/* ---------- stockage local (mode visiteur ; peut être indisponible : navigation privée, etc.) ---------- */
function readStore(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignoré */ }
}

let messages = [];

/* ---------- affichage ---------- */
const timeLabel = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function bubble(message) {
  const node = document.createElement('div');
  node.className = `msg ${message.from}`;
  if (message.id) node.dataset.id = String(message.id);
  node.append(document.createTextNode(message.text)); // texte brut : pas d'injection HTML
  const meta = document.createElement('small');
  meta.textContent = message.from === 'me' && !account ? `${timeLabel(message.time)} · envoyé via WhatsApp` : timeLabel(message.time);
  node.append(meta);
  return node;
}

function scrollToEnd() { chatLog.scrollTop = chatLog.scrollHeight; }

function render() {
  chatLog.replaceChildren(...messages.map(bubble));
  scrollToEnd();
}

/* ---------- mode visiteur : WhatsApp ---------- */
function addLocalMessage(from, text) {
  const message = { from, text, time: Date.now() };
  messages.push(message);
  writeStore(STORAGE_KEY, messages);
  chatLog.append(bubble(message));
  scrollToEnd();
}

function cuistoReply(text) {
  const typing = document.createElement('div');
  typing.className = 'msg cuisto typing';
  typing.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
  chatLog.append(typing);
  scrollToEnd();
  setTimeout(() => { typing.remove(); addLocalMessage('cuisto', text); }, 900);
}

function deliverViaWhatsApp(name, text) {
  const body = `Bonjour Cuisto, c'est ${name}.\n${text}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
}

function localWelcome() {
  messages = [];
  chatLog.replaceChildren();
  addLocalMessage('cuisto', 'Bonjour et bienvenue chez Cuisto ! Une commande, une réservation ou une question ? Écrivez-nous ici, nous vous répondons sur WhatsApp.');
}

function startGuestMode() {
  messages = readStore(STORAGE_KEY, []);
  chatName.value = readStore(NAME_KEY, '');
  if (chatBanner && sb) chatBanner.hidden = false;
  if (messages.length) render(); else localWelcome();
}

/* ---------- mode compte : discussion directe ---------- */
const toView = (row) => ({
  id: row.id,
  from: row.sender === 'client' ? 'me' : 'cuisto',
  text: row.body,
  time: new Date(row.created_at).getTime()
});

function addRemoteMessage(row) {
  if (messages.some((m) => m.id === row.id)) return;   // déjà affiché (envoi + temps réel)
  const view = toView(row);
  messages.push(view);
  chatLog.append(bubble(view));
  scrollToEnd();
}

async function loadConversation() {
  const { data, error } = await sb.from('chat_messages')
    .select('id, created_at, sender, body')
    .order('created_at', { ascending: true }).limit(300);
  if (error) {
    chatLog.replaceChildren(bubble({ from: 'cuisto', text: 'Impossible de charger la conversation pour le moment. Réessayez dans un instant.', time: Date.now() }));
    return;
  }
  messages = data.map(toView);
  if (!messages.length) {
    messages = [{ id: 0, from: 'cuisto', text: `Bonjour ${account.name || ''} ! Une commande, une réservation ou une question ? Écrivez-nous ici, nous vous répondons directement.`.replace('  ', ' '), time: Date.now() }];
  }
  render();
}

function subscribeToReplies() {
  // Réponses en direct ; l'actualisation toutes les 20 s sert de filet de sécurité
  sb.channel(`chat-${account.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${account.id}` },
      (payload) => {
        if (messages.length === 1 && messages[0].id === 0) { messages = []; chatLog.replaceChildren(); }
        addRemoteMessage(payload.new);
      })
    .subscribe();

  setInterval(async () => {
    if (document.hidden) return;
    const last = messages.reduce((max, m) => Math.max(max, m.id || 0), 0);
    const { data } = await sb.from('chat_messages')
      .select('id, created_at, sender, body').gt('id', last).order('id', { ascending: true });
    if (data?.length && messages.length === 1 && messages[0].id === 0) { messages = []; chatLog.replaceChildren(); }
    data?.forEach(addRemoteMessage);
  }, 20000);
}

async function sendRemote(text) {
  const { data, error } = await sb.from('chat_messages')
    .insert({ user_id: account.id, sender: 'client', user_name: account.name || null, body: text })
    .select('id, created_at, sender, body').single();
  if (error) {
    const limited = /trop de messages/i.test(error.message);
    const note = document.createElement('div');
    note.className = 'msg cuisto';
    note.textContent = limited
      ? 'Vous envoyez beaucoup de messages : patientez un instant.'
      : 'Message non envoyé. Vérifiez votre connexion et réessayez.';
    chatLog.append(note);
    scrollToEnd();
    return false;
  }
  if (messages.length === 1 && messages[0].id === 0) { messages = []; chatLog.replaceChildren(); }
  addRemoteMessage(data);
  return true;
}

async function startAccountMode(user) {
  const meta = user.user_metadata || {};
  account = { id: user.id, name: (meta.full_name || '').trim() };
  chatName.hidden = true;
  chatName.required = false;
  chatName.value = account.name || 'Client';
  if (chatBanner) chatBanner.hidden = true;
  if (chatSubtitle) chatSubtitle.textContent = 'Discussion directe avec Cuisto';
  if (chatNote) chatNote.textContent = 'Vos messages sont enregistrés dans votre compte : nous vous répondons ici.';
  chatClear.hidden = true;
  await loadConversation();
  subscribeToReplies();
}

/* ---------- envoi ---------- */
chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  if (account) {
    const button = chatForm.querySelector('.chat-send');
    button.disabled = true;
    const ok = await sendRemote(text);
    button.disabled = false;
    if (ok) { chatInput.value = ''; autoGrow(); }
    chatInput.focus();
    return;
  }

  const name = chatName.value.trim();
  if (!name) return;
  writeStore(NAME_KEY, name);
  deliverViaWhatsApp(name, text);
  addLocalMessage('me', text);
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
  if (account || !messages.length || !window.confirm('Effacer la conversation sur cet appareil ?')) return;
  messages = [];
  writeStore(STORAGE_KEY, messages);
  localWelcome();
});

/* ---------- démarrage ---------- */
(async () => {
  try {
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    if (session) { await startAccountMode(session.user); return; }
  } catch (error) { console.error(error); }
  startGuestMode();
})();
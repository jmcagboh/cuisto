/* ============================================================
   Cuisto — page « Carte complète »
   - Les plats viennent de Supabase (gérés dans l'administration, catégorie « carte »).
     La liste écrite dans plats.html reste affichée si la base est injoignable ou ne contient rien.
   - « Demander la disponibilité » : client connecté = message envoyé dans sa messagerie ;
     visiteur = WhatsApp, comme avant.
   ============================================================ */
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.CUISTO_CONFIG || {};
const sb = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const carteGrid = document.getElementById('carteGrid');
const WA_NUMBER = window.SITE?.whatsapp || '22871645867';
const SITE_LABEL = window.SITE?.name || 'Cuisto';
const money = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const imageUrl = (url) => (!url ? '' : /^(https?:|\/|\.)/.test(url) ? url : `./${url}`);
let currentUser = null;

/* ---------- notification ---------- */
const toast = document.createElement('div');
toast.className = 'toast';
toast.setAttribute('role', 'status');
document.body.append(toast);
let toastTimer = null;
function notify(text, type = 'success', link = null, ms = 6000) {
  toast.className = `toast ${type}`;
  toast.textContent = text;
  if (link) {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.label;
    if (link.external) { a.target = '_blank'; a.rel = 'noopener'; }
    toast.append(' ', a);
  }
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

/* ---------- plats de la carte ---------- */
function whatsappLink(name) {
  const text = `Bonjour ${SITE_LABEL}, le plat « ${name} » est-il disponible ?`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
}

function buildCard(dish) {
  const article = document.createElement('article');
  article.className = 'other-dish';
  const img = document.createElement('img');
  img.src = imageUrl(dish.image_url);
  img.alt = dish.name;
  img.loading = 'lazy';
  const copy = document.createElement('div');
  copy.className = 'other-dish-copy';
  const title = document.createElement('h2');
  title.textContent = dish.name;
  copy.append(title);
  if (dish.description) {
    const desc = document.createElement('p');
    desc.className = 'dish-description';
    desc.textContent = dish.description;
    copy.append(desc);
  }
  const price = document.createElement('p');
  price.className = 'dish-price';
  price.textContent = money(dish.price);
  const ask = document.createElement('a');
  ask.href = whatsappLink(dish.name);
  ask.target = '_blank';
  ask.rel = 'noopener';
  ask.textContent = 'Demander la disponibilité';
  copy.append(price, ask);
  article.append(img, copy);
  return article;
}

async function loadCarte() {
  if (!sb || !carteGrid) return;
  try {
    const { data, error } = await sb.from('dishes')
      .select('slug, name, price, description, image_url')
      .eq('available', true).eq('category', 'carte')
      .order('sort_order').order('name');
    if (error || !Array.isArray(data) || !data.length) return; // on garde la liste d'origine
    carteGrid.replaceChildren(...data.map(buildCard));
  } catch (error) { console.error(error); }
}

/* ---------- demande de disponibilité ---------- */
carteGrid?.addEventListener('click', async (event) => {
  const link = event.target.closest('a[href^="https://wa.me/"]');
  if (!link || !currentUser || !sb) return; // visiteur : WhatsApp comme avant
  event.preventDefault();
  if (link.dataset.busy) return;
  const dish = link.closest('.other-dish')?.querySelector('h2')?.textContent.trim();
  if (!dish) return;
  link.dataset.busy = '1';
  const original = link.textContent;
  link.textContent = 'Envoi...';
  const name = currentUser.user_metadata?.full_name || null;
  const { error } = await sb.from('chat_messages')
    .insert({ user_id: currentUser.id, sender: 'client', user_name: name, body: `Bonjour, le plat « ${dish} » est-il disponible ?` });
  if (error) {
    console.error(error);
    link.textContent = original;
    delete link.dataset.busy;
    notify('Envoi impossible pour le moment.', 'error', { href: link.href, label: 'Écrire sur WhatsApp', external: true });
    return;
  }
  link.textContent = 'Demande envoyée ✓';
  notify(`Demande envoyée pour « ${dish} ». Réponse dans votre messagerie.`, 'success', { href: 'messages.html', label: 'Ouvrir la messagerie' });
  setTimeout(() => { link.textContent = original; delete link.dataset.busy; }, 6000);
});

(async () => {
  loadCarte();
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  sb.auth.onAuthStateChange((_event, next) => { currentUser = next?.user || null; });
})();

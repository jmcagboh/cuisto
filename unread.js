/* ============================================================
   Cuisto — messages non lus
   Pour un client connecté : pastille sur le bouton de messagerie, compteur dans le pied de page
   et notification quand le restaurant répond (même après être sorti de la messagerie).
   Sans compte : ce fichier ne fait rien.
   ============================================================ */
(function () {
  const cfg = window.CUISTO_CONFIG || {};
  // réutilise le client de script.js s'il existe (page d'accueil), sinon en crée un (plats.html)
  const client = (typeof sb !== 'undefined' && sb)
    ? sb
    : (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
      ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
      : null);
  if (!client) return;

  const plural = (n) => `${n} nouveau${n > 1 ? 'x' : ''} message${n > 1 ? 's' : ''}`;
  let current = 0;

  function paint(count) {
    current = count;
    document.querySelectorAll('.chat-fab').forEach((fab) => {
      let badge = fab.querySelector('.chat-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'chat-badge';
        badge.setAttribute('aria-hidden', 'true');
        fab.append(badge);
      }
      badge.textContent = count > 9 ? '9+' : String(count);
      badge.hidden = count === 0;
      fab.setAttribute('aria-label', count ? `Ouvrir la messagerie : ${plural(count)}` : 'Ouvrir la messagerie');
    });
    document.querySelectorAll('.footer-nav a[href="messages.html"]').forEach((link) => {
      link.textContent = count ? `Messagerie (${count})` : 'Messagerie';
    });
  }

  async function refresh() {
    try {
      const { data, error } = await client.rpc('chat_unread_count');
      if (!error && Number.isInteger(data)) paint(data);
      return error ? 0 : data;
    } catch { return 0; }
  }

  // notification : bulle du site si elle existe (index.html), sinon une bulle simple (plats.html)
  let ownToast = null;
  function notify(text) {
    if (typeof showToast === 'function') { showToast(text, { href: 'messages.html', label: 'Lire' }); return; }
    if (!ownToast) {
      ownToast = document.createElement('div');
      ownToast.className = 'toast success';
      ownToast.setAttribute('role', 'status');
      document.body.append(ownToast);
    }
    const link = document.createElement('a');
    link.href = 'messages.html';
    link.textContent = 'Lire';
    ownToast.replaceChildren(document.createTextNode(text), link);
    void ownToast.offsetWidth;
    ownToast.classList.add('show');
    setTimeout(() => ownToast.classList.remove('show'), 7000);
  }

  (async function start() {
    let session = null;
    try { session = (await client.auth.getSession()).data.session; } catch { /* ignoré */ }
    if (!session) return;

    const count = await refresh();
    // rappel à l'arrivée sur le site, une seule fois par nombre de messages
    try {
      if (count > 0 && sessionStorage.getItem('cuistoUnreadSeen') !== String(count)) {
        sessionStorage.setItem('cuistoUnreadSeen', String(count));
        setTimeout(() => notify(`Cuisto vous a répondu : ${plural(count)}`), 1500);
      }
    } catch { /* ignoré */ }

    // réponse reçue en direct pendant que le client navigue sur le site
    client.channel(`unread-${session.user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${session.user.id}` },
        async (payload) => {
          if (payload.new.sender !== 'admin') return;
          await refresh();
          notify('Cuisto vous a répondu dans la messagerie');
        })
      .subscribe();

    // retour sur l'onglet, retour arrière du navigateur, et filet de sécurité toutes les 60 s
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('pageshow', (event) => { if (event.persisted) refresh(); });
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  })();
})();

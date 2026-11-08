/* ============================================================
   Applique les réglages de site.config.js à la page : couleurs, nom, contacts, horaires, liens.
   À charger dans <head>, juste après site.config.js.
   ============================================================ */
(function () {
  const S = window.SITE;
  if (!S) return;

  /* ---- couleurs : appliquées tout de suite, avant l'affichage ---- */
  const colors = S.colors || {};
  const root = document.documentElement;
  if (colors.brand) root.style.setProperty('--brand', colors.brand);
  if (colors.brandDark) root.style.setProperty('--brand-dark', colors.brandDark);
  if (colors.accent) root.style.setProperty('--accent', colors.accent);
  if (colors.mint) root.style.setProperty('--mint', colors.mint);

  /* ---- horaires : utilisés aussi par le badge Ouvert/Fermé (script.js) ---- */
  const toHours = (text) => { const [h, m] = String(text).split(':').map(Number); return h + (m || 0) / 60; };
  const label = (text) => String(text).replace(':', 'h');
  S.dayHours = function (day) {
    const rule = (S.hours || []).find((entry) => entry.days.includes(day));
    return rule ? [toHours(rule.open), toHours(rule.close)] : null;
  };


  /* ---- photos modifiables depuis l'administration (accueil, à propos) ----
     Les adresses viennent de la table site_images ; la dernière version connue est gardée dans le navigateur
     pour que la bonne photo s'affiche dès le début du chargement. */
  const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\/[^\s"'()]+$/.test(u)) ? u : null;
  window.applySiteImages = function (map) {
    const hero = safeUrl(map && map.hero);
    if (hero) root.style.setProperty('--hero-image', `url("${hero}")`);
    else root.style.removeProperty('--hero-image');
    const about = safeUrl(map && map.about);
    document.querySelectorAll('[data-site-image="about"]').forEach((img) => {
      if (!img.dataset.defaultSrc) img.dataset.defaultSrc = img.getAttribute('src');
      img.src = about || img.dataset.defaultSrc;
    });
  };
  let cachedImages = null;
  try { cachedImages = JSON.parse(localStorage.getItem('cuistoSiteImages') || 'null'); } catch { /* ignoré */ }
  if (cachedImages) {
    const hero = safeUrl(cachedImages.hero);
    if (hero) root.style.setProperty('--hero-image', `url("${hero}")`);
  }

  const DEFAULT_NAME = 'Cuisto';

  function replaceName(text) {
    return text.split(DEFAULT_NAME).join(S.name);
  }

  function applyName() {
    if (!S.name || S.name === DEFAULT_NAME) return;
    document.title = replaceName(document.title);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(node.parentNode.nodeName) || !node.nodeValue.includes(DEFAULT_NAME))
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => { node.nodeValue = replaceName(node.nodeValue); });
    document.querySelectorAll('[alt],[title],[aria-label],[placeholder]').forEach((el) => {
      ['alt', 'title', 'aria-label', 'placeholder'].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value && value.includes(DEFAULT_NAME)) el.setAttribute(attr, replaceName(value));
      });
    });
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = replaceName(meta.content);
  }

  function applyLogo() {
    document.querySelectorAll('[data-logo]').forEach((el) => {
      const split = Number(el.dataset.split || S.logoSplit || 1);
      const first = document.createElement('span');
      first.textContent = S.name.slice(0, split);
      el.replaceChildren(first, document.createTextNode(S.name.slice(split)));
    });
    document.querySelectorAll('[data-site-initial]').forEach((el) => { el.textContent = S.name.charAt(0).toUpperCase(); });
  }

  function applyTexts() {
    document.querySelectorAll('[data-site]').forEach((el) => {
      if (S[el.dataset.site] != null) el.textContent = S[el.dataset.site];
    });
    document.querySelectorAll('[data-site-href]').forEach((el) => {
      const kind = el.dataset.siteHref;
      if (kind === 'tel') el.href = `tel:${S.phone}`;
      else if (kind === 'mailto') el.href = `mailto:${S.email}`;
      else if (kind === 'instagram') {
        if (S.instagram) el.href = `https://www.instagram.com/${S.instagram}`;
        else el.hidden = true;
      }
    });
    document.querySelectorAll('[data-site-src="mapEmbed"]').forEach((el) => { if (S.mapEmbed) el.src = S.mapEmbed; });
    document.querySelectorAll('[data-site-demo]').forEach((el) => { el.hidden = !S.demo; });

    // liens WhatsApp : numéro et nom du restaurant
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach((a) => {
      try {
        const url = new URL(a.href);
        url.pathname = `/${S.whatsapp}`;
        const text = url.searchParams.get('text');
        if (text) url.searchParams.set('text', replaceName(text));
        a.href = url.href;
      } catch { /* lien ignoré */ }
    });

    // liste des horaires
    document.querySelectorAll('[data-site-hours]').forEach((list) => {
      list.replaceChildren(...(S.hours || []).map((rule) => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.textContent = rule.label;
        const strong = document.createElement('strong');
        strong.textContent = `${label(rule.open)} - ${label(rule.close)}`;
        li.append(span, strong);
        return li;
      }));
    });
  }

  function apply() { applyName(); applyLogo(); applyTexts(); if (cachedImages) window.applySiteImages(cachedImages); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();

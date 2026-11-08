/* ============================================================
   RÉGLAGES DU RESTAURANT — le seul fichier à modifier pour personnaliser le site.
   Les pages (accueil, messagerie, compte, administration…) lisent ces valeurs.
   Les plats, les prix et les photos se gèrent dans l'administration (section « Menu »).
   ============================================================ */
window.SITE = {
  // --- Identité ---
  name: 'Cuisto',              // nom affiché partout (logo, titres, messages WhatsApp…)
  logoSplit: 3,                // nombre de lettres colorées au début du logo : « Cui|sto »
  author: 'jmc AGBOH',         // signature du pied de page

  // --- Contact ---
  phone: '+22871645867',       // format international, sans espaces (bouton « Appeler »)
  phoneDisplay: '71 64 58 67', // numéro tel qu'il s'affiche
  whatsapp: '22871645867',     // numéro WhatsApp : indicatif + numéro, sans « + »
  email: 'jeanagboh86@gmail.com',
  address: 'Lomé, Togo',
  instagram: '',               // nom d'utilisateur Instagram (laisser vide = icône masquée)
  mapEmbed: 'https://www.openstreetmap.org/export/embed.html?bbox=1.1827%2C6.1061%2C1.2763%2C6.1838&layer=mapnik&marker=6.1467%2C1.2218',

  // --- Horaires (days : 0 = dimanche … 6 = samedi ; jour absent de la liste = fermé) ---
  timezone: 'Africa/Lome',
  hours: [
    { label: 'Lundi - Vendredi', days: [1, 2, 3, 4, 5], open: '10:00', close: '22:00' },
    { label: 'Samedi',           days: [6],             open: '10:00', close: '23:00' },
    { label: 'Dimanche',         days: [0],             open: '12:00', close: '20:00' }
  ],

  // --- Couleurs ---
  colors: {
    brand: '#006a4e',      // couleur principale (boutons, titres)
    brandDark: '#004d39',  // version foncée (survol)
    accent: '#fb911f',     // couleur d'accent (orange)
    mint: '#2ce0bd'        // touche claire
  },

  // --- Mention « projet de démonstration » dans le pied de page (mettre false pour un vrai client) ---
  demo: true
};

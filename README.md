# Cuisto

Application de restaurant avec menu, commandes, réservations, livraison, géolocalisation et tableau de bord administrateur.

## Installation locale

Node.js 18 ou plus récent est nécessaire.

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd start
```

Puis ouvrir http://localhost:3000.

Le fichier `.env` contient les identifiants locaux et SMTP. Il est ignoré par Git et ne doit jamais être publié. Avec Gmail, utilise un mot de passe d'application, jamais le mot de passe habituel du compte.

Sans configuration SMTP, les réservations et commandes sont conservées dans le tableau de bord, mais aucune notification e-mail ne sera envoyée.

## Fonctionnalités

- Inscription et connexion client.
- Menu complet avec prix en FCFA.
- Commande avec quantités, total, livraison ou retrait.
- Paiement à la livraison ou sur place.
- Géolocalisation et lien Google Maps pour les livraisons.
- Réservations et messages Contact.
- Tableau administrateur dans `admin.html`.

## Publication

GitHub conserve le code source, mais GitHub Pages ne peut pas exécuter `server.js`. Pour faire fonctionner la connexion, les commandes, les réservations et les e-mails en ligne, déploie le projet sur Render, Railway ou un autre hébergeur Node.js.

Sur l'hébergeur, configure les variables présentes dans `.env.example`, puis utilise la commande de démarrage :

```text
npm start
```

Ne publie jamais `.env`, `data/*.json`, `node_modules` ou un mot de passe SMTP.

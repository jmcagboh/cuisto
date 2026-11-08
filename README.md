# Cuisto

Site web d'un restaurant de **cuisine africaine à Lomé (Togo)** : menu, commande (à emporter ou en livraison), réservation de table, contact, messagerie, comptes clients et tableau de bord administrateur.

> **Projet de démonstration** : réalisé à des fins d'apprentissage à partir d'un tutoriel YouTube, puis enrichi (comptes clients, messagerie en direct, base Supabase sécurisée par RLS, tableau de bord administrateur, alertes, notifications). Le restaurant, les plats, les prix, les horaires et les avis sont fictifs ; le projet n'est pas commercialisé.

Site en ligne : https://jmcagboh.github.io/cuisto/

---

## Fonctionnalités

**Pour les clients**
- Menu illustré, cliquable : un clic sur un plat l'ajoute à la commande.
- Commande avec total calculé, retrait ou livraison (adresse ou position GPS), paiement sur place ou à la livraison.
- Réservation de table (date, heure, nombre de personnes).
- Formulaire de contact, horaires, coordonnées, carte (qui ne zoome pas sans clic).
- Page **« Carte complète »** (`plats.html`) : les autres plats de la carte, avec un bouton « Demander la disponibilité » : pour un client connecté, la demande arrive directement dans sa messagerie ; pour un visiteur, elle s'ouvre dans WhatsApp.
- **Jeu « Le bon plat »** : reconnaître les plats du menu (photo → nom, ou description → photo) en 30 secondes, avec séries de bonnes réponses. **Récompense** pour les clients connectés : 100 points = −5 %, 200 points = −10 % sur une commande (une récompense par jour et par compte, valable 24 h, utilisable une seule fois). Le visiteur sans compte est invité à se connecter pour la débloquer.
- **Compte client facultatif** (`compte.html`) : inscription / connexion, historique des commandes et réservations, modification du nom, du téléphone et de l'adresse de livraison habituelle. Après l'inscription, le client est envoyé directement sur le site (le lien de confirmation par e-mail le ramène aussi sur le site).
- **Enregistrement automatique** des informations du client connecté : nom, téléphone et adresse sont mémorisés à chaque commande ou réservation et préremplis ensuite.
- **Notifications** (bulles en bas de l'écran) pour la connexion, l'inscription, la déconnexion, l'enregistrement du profil, les commandes, réservations et messages.
- **Messagerie** (`messages.html`) :
  - client connecté : discussion directe avec le restaurant, réponses en temps réel ;
  - visiteur sans compte : le message s'ouvre dans WhatsApp.
- **Messages non lus** : quand le restaurant répond, une pastille rouge avec le nombre de messages non lus apparaît sur le bouton de messagerie (accueil et page des plats), le pied de page affiche « Messagerie (2) » et une notification prévient le client, même s'il a quitté la messagerie. Tout est remis à zéro dès qu'il ouvre la conversation.

- **Bouton « Appeler »** flottant sur mobile ; **badge « Ouvert maintenant / Fermé · ouvre à… »** (heure du Togo) sur l'accueil et dans les horaires ; **étiquettes** sur certains plats du menu (Épicé, Grillé…).

**Pour le restaurant** (`login.html` puis `admin.html`)
- Commandes, réservations et messages de contact, avec changement de statut.
- Messagerie clients : conversations regroupées par client, réponse en un clic.
- **Photos du site** : la photo de la page d'accueil et celle de « À propos » se changent depuis `admin.html` (section « Photos du site »), avec retour possible à la photo d'origine.
- **Menu et carte complète modifiables** (section « Menu et carte complète » de `admin.html`) : ajouter, modifier, masquer ou supprimer un plat, changer son prix, sa description, son étiquette, son indice pour le jeu et sa **photo** (envoyée depuis le téléphone ou l'ordinateur). Le site, le formulaire de commande et le jeu se mettent à jour tout de suite ; les prix restent contrôlés par la base. Un plat déjà commandé ne se supprime pas : on le décoche « Visible sur le site ».
- Liens WhatsApp et Google Maps directs, actualisation automatique.
- **Alertes en direct** : à chaque nouvelle commande, réservation ou message, une notification s'affiche, un son retentit et le nombre de nouveautés apparaît dans l'onglet (bouton « Activer les alertes »). Ces alertes fonctionnent quand la page d'administration est ouverte.
- **Alertes par e-mail** même page fermée : à chaque commande, réservation ou message, la base appelle la fonction Supabase `notify-admin`, qui envoie un e-mail au restaurant via Resend (secrets `RESEND_API_KEY` et `ADMIN_EMAIL`).

**Règle WhatsApp**
- Visiteur sans compte : la demande est enregistrée **puis** WhatsApp s'ouvre pour prévenir le restaurant.
- Client connecté : tout est enregistré dans son compte, WhatsApp n'est pas nécessaire.
- Si l'enregistrement échoue, WhatsApp reste le moyen de secours.

---

## Technologies

- HTML, CSS, JavaScript (aucun framework, aucune étape de build).
- [Supabase](https://supabase.com) : base de données PostgreSQL, authentification, temps réel.
- Hébergement : GitHub Pages.

---

## Structure du projet

| Fichier | Rôle |
|---|---|
| `index.html` | Page principale (accueil, menu, commande, réservation, contact…) |
| `script.js` | Logique de la page principale (commande, réservation, contact, menu cliquable, jeu, animations) |
| `plats.html` + `plats.js` | Carte complète (plats chargés depuis Supabase, demande de disponibilité) |
| `unread.js` | Pastille et notification des messages non lus (accueil et page des plats) |
| `messages.html` + `chat.js` | Messagerie (mode compte ou mode WhatsApp) |
| `compte.html` + `account.js` | Espace client (connexion, inscription, historique) |
| `login.html` | Connexion administrateur |
| `admin.html` | Tableau de bord administrateur |
| `site.config.js` | **Réglages du restaurant** : nom, logo, téléphone, WhatsApp, e-mail, adresse, Instagram, horaires, couleurs, mention démo. Seul fichier à modifier pour personnaliser le site |
| `site.js` | Applique ces réglages à toutes les pages |
| `style.css` | **Tous** les styles du site, y compris login, admin et compte |
| `animations.css` | Animations (chargé après `style.css`) |
| `config.js` | Adresse du projet Supabase et clé publique |
| `supabase/functions/notify-admin/index.ts` | Fonction Edge : envoi de l'e-mail d'alerte |
| `schema.sql` | Structure complète de la base de données et règles de sécurité |
| `images/` | Photos du site |

---

## Installation et mise en route

### 1. Lancer le site en local
Ouvrir le dossier avec VS Code et utiliser l'extension **Live Server** (adresse habituelle : `http://127.0.0.1:5500`).

### 2. Configurer Supabase
1. Créer un projet sur supabase.com.
2. Ouvrir **SQL Editor**, coller le contenu de `schema.sql`, cliquer sur **Run**. Le fichier peut être relancé sans risque : aucune donnée n'est supprimée.
3. Dans **Authentication → Sign In / Providers → Email** :
   - activer **« Allow new users to sign up »** (sinon aucune inscription client n'est possible) ;
   - décider de **« Confirm email »** : désactivé = le client est connecté tout de suite, activé = il doit cliquer sur un lien reçu par e-mail (l'envoi par défaut de Supabase est très limité).
4. Créer le compte administrateur : **Authentication → Users → Add user**, puis dans le SQL Editor :
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'adresse-de-ladmin@exemple.com';
   ```

### 3. Renseigner `config.js`
```js
window.CUISTO_CONFIG = {
  SUPABASE_URL: 'https://VOTRE-PROJET.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_...'
};
```
- La clé « publishable » est **faite pour être publique** : la sécurité vient des règles RLS de `schema.sql`.
- **Ne jamais** mettre la clé `secret` / `service_role` dans le site.
- `config.js` doit être déployé avec le site : s'il est dans `.gitignore`, il n'est pas envoyé sur GitHub et les commandes ne seront pas enregistrées en ligne.

### 4. Déployer
Pousser le dossier sur GitHub, puis activer **GitHub Pages** sur la branche principale.

---

## Personnaliser le site pour un autre restaurant

1. Créer un **nouveau projet Supabase** pour ce restaurant (ne jamais partager la base entre deux clients), puis exécuter `schema.sql` et créer le compte administrateur (voir « Installation »).
2. Mettre la nouvelle adresse et la clé publique dans `config.js`.
3. Modifier `site.config.js` : nom, téléphone, WhatsApp, e-mail, adresse, Instagram, horaires, couleurs, et `demo: false` pour retirer la mention « Projet de démonstration ».
4. Se connecter à `admin.html` > **Menu** : remplacer les plats, prix et photos du modèle, et supprimer ceux qui ne conviennent pas.
5. Remplacer dans `index.html` les textes propres au modèle (histoire, chefs, avis) et les images du dossier `images/` (logo, bannière, chefs) ; n'afficher que de vrais avis.
6. Facultatif : alertes e-mail (voir la fonction `notify-admin`), domaine personnalisé, page de confidentialité.

---

## Sécurité

- Toutes les tables ont la **sécurité au niveau des lignes (RLS)** activée.
- Un visiteur peut seulement **envoyer** (réservation, message, commande) et jamais lire.
- La commande passe par la fonction `create_order` : le **prix est recalculé côté base** à partir du plat, le navigateur ne peut pas le modifier.
- Un client connecté ne lit que **ses** commandes, réservations et messages, et ne peut pas écrire au nom d'un autre.
- Seuls les comptes listés dans la table `admins` voient et gèrent tout.
- Messagerie : limite de 20 messages par minute et par client.
- Récompenses du jeu : créées uniquement par la fonction `claim_game_reward` (client connecté, une par jour), contrôlées et appliquées par `create_order` côté base (propriétaire, non utilisée, non expirée). Le score étant calculé dans le navigateur, la remise reste volontairement petite et limitée.
- `is_admin()` n'est plus appelable par les visiteurs non connectés.
- Tout texte venant de la base est échappé avant affichage (protection contre l'injection de HTML).

---

## Base de données (résumé)

| Table | Contenu |
|---|---|
| `dishes` | Plats, prix, photos et catégorie : `menu` (commandable) ou `carte` (carte complète). Référence des prix |
| `orders`, `order_items` | Commandes et leurs lignes |
| `reservations` | Réservations de table |
| `contact_messages` | Messages du formulaire de contact |
| `chat_messages` | Messagerie client ↔ restaurant |
| `game_rewards` | Récompenses du jeu (pourcentage, expiration, utilisée ou non) |
| `chat_reads` | Date du dernier message lu par chaque client (messages non lus) |
| `site_images` | Photos de l'accueil et de « À propos » choisies par l'administrateur |
| `admins` | Comptes administrateurs |

---

## Journal des évolutions

- **2026-11-08 (soir)** : administration plus lisible (fiches de plats, groupes Menu / Carte complète) ; photos de l'accueil et de « À propos » modifiables ; page « Autres plats » renommée **« Carte complète »** et gérée depuis l'administration (catégorie `carte`) ; demande de disponibilité envoyée dans la messagerie pour un client connecté (WhatsApp pour un visiteur) ; seuls les plats du menu principal sont commandables (contrôle dans `create_order`).
- **2026-11-08** : fichier unique de réglages `site.config.js` (identité, contacts, horaires, couleurs) et menu modifiable depuis l'administration (plats, prix, photos stockées dans Supabase Storage), avec règles de sécurité (seul l'administrateur écrit) ; `schema.sql` ne remet plus le menu à zéro quand on le relance.
- **2026-11-07 (nuit)** : jeu refait avec les vraies photos du menu (plus aucun emoji), devinettes, séries, barre de progression vers la récompense, fin de partie qui propose de commander les plats ratés ; récompense −5 % / −10 % gérée par Supabase (`game_rewards`, `claim_game_reward`, `create_order` avec paramètre `p_reward`) ; la remise apparaît dans l'administration. **Correctif** : le déclencheur d'alertes e-mail faisait échouer les nouvelles commandes depuis le 2026-10-31 (corrigé).
- **2026-11-07 (soir)** : mention « Projet de démonstration » dans le pied de page et le README. Bouton « Appeler » affiché uniquement sur mobile (écran ≤ 768 px).
- **2026-11-07 (suite)** : bouton « Appeler » sur mobile, badge Ouvert/Fermé calculé d'après les horaires, étiquettes sur le menu. Les horaires sont écrits dans `script.js` (constante `HOURS`) : à modifier en même temps que la section Contact.
- **2026-11-07** : section « Que disent nos clients » refaite (le texte des avis était blanc sur fond blanc, donc illisible) : fond vert sombre, cartes à bandeau de couleur, guillemets, étoiles qui s'allument, étiquette par client, cartes de même hauteur.
- **2026-10-31** : alertes par e-mail quand la page d'administration est fermée (extension `pg_net`, déclencheurs sur les 4 tables, fonction Edge `notify-admin`, secret partagé stocké dans le schéma privé `private`).
- **2026-10-30** : compteur de messages non lus pour les clients (pastille sur le bouton de messagerie, pied de page, notification à leur retour sur le site, mise à zéro à l'ouverture de la conversation) ; horodatage des messages à l'heure réelle.
- **2026-10-29 (soir)** : notifications visibles (toasts) sur toutes les actions du compte et des formulaires ; redirection vers le site après la création du compte, avec message de bienvenue ; informations du client (nom, téléphone, adresse) enregistrées automatiquement ; alertes en direct pour le restaurant (nouvelle commande, réservation, message) avec son et notification du navigateur ; police Poppins enfin appliquée (règle `font-family: calc()` invalide supprimée) ; chemin d'image erroné `./image/d1.jpg` retiré ; `is_admin()` retirée aux visiteurs ; chargement différé des images.
- **2026-10-29** : messagerie directe pour les clients connectés (temps réel) et boîte de réponse dans l'administration ; commandes et réservations sans WhatsApp pour les clients connectés ; flèche « retour en haut » masquée sur mobile.
- **2026-10-28** : comptes clients (inscription, connexion, historique, préremplissage des formulaires) ; fusion de `admin.css` dans `style.css` ; diagnostic de l'inscription (les inscriptions étaient désactivées dans Supabase).
- **2026-10-27** : version statique avec WhatsApp, puis connexion à Supabase (commandes, réservations, contact, tableau de bord administrateur) ; menu cliquable, page messagerie, retouches de l'interface (photos arrondies, descriptions, section contact, carte verrouillée, pied de page).

---

## À faire / idées

- Renseigner `instagram` dans `site.config.js` (laissé vide, l'icône est masquée).
- Activer « Leaked password protection » dans Supabase (Authentication → Sign In / Providers → Email → Password security) : refuse les mots de passe déjà piratés. Cette option peut être réservée aux offres payantes.
- Alertes e-mail : saisir les secrets `RESEND_API_KEY` et `ADMIN_EMAIL` dans Supabase (Edge Functions → Secrets). Telegram/WhatsApp automatique non utilisés.
- Remplacer les descriptions provisoires (chefs, Veyi, Pokoumè).
- Paiement mobile (Mobile Money).

---

*Projet de Jmc AGBOH.*

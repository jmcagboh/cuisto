# Cuisto

Site web d'un restaurant de **cuisine africaine à Lomé (Togo)** : menu, commande (à emporter ou en livraison), réservation de table, contact, messagerie, comptes clients et tableau de bord administrateur.

Site en ligne : https://jmcagboh.github.io/cuisto/

---

## Fonctionnalités

**Pour les clients**
- Menu illustré, cliquable : un clic sur un plat l'ajoute à la commande.
- Commande avec total calculé, retrait ou livraison (adresse ou position GPS), paiement sur place ou à la livraison.
- Réservation de table (date, heure, nombre de personnes).
- Formulaire de contact, horaires, coordonnées, carte (qui ne zoome pas sans clic).
- Page « Autres plats » (`plats.html`).
- Mini-jeu des plats.
- **Compte client facultatif** (`compte.html`) : inscription / connexion, historique des commandes et réservations, modification du nom, du téléphone et de l'adresse de livraison habituelle. Après l'inscription, le client est envoyé directement sur le site (le lien de confirmation par e-mail le ramène aussi sur le site).
- **Enregistrement automatique** des informations du client connecté : nom, téléphone et adresse sont mémorisés à chaque commande ou réservation et préremplis ensuite.
- **Notifications** (bulles en bas de l'écran) pour la connexion, l'inscription, la déconnexion, l'enregistrement du profil, les commandes, réservations et messages.
- **Messagerie** (`messages.html`) :
  - client connecté : discussion directe avec le restaurant, réponses en temps réel ;
  - visiteur sans compte : le message s'ouvre dans WhatsApp.
- **Messages non lus** : quand le restaurant répond, une pastille rouge avec le nombre de messages non lus apparaît sur le bouton de messagerie (accueil et page des plats), le pied de page affiche « Messagerie (2) » et une notification prévient le client, même s'il a quitté la messagerie. Tout est remis à zéro dès qu'il ouvre la conversation.

**Pour le restaurant** (`login.html` puis `admin.html`)
- Commandes, réservations et messages de contact, avec changement de statut.
- Messagerie clients : conversations regroupées par client, réponse en un clic.
- Liens WhatsApp et Google Maps directs, actualisation automatique.
- **Alertes en direct** : à chaque nouvelle commande, réservation ou message, une notification s'affiche, un son retentit et le nombre de nouveautés apparaît dans l'onglet (bouton « Activer les alertes »). Les alertes fonctionnent quand la page d'administration est ouverte.

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
| `plats.html` | Autres plats |
| `unread.js` | Pastille et notification des messages non lus (accueil et page des plats) |
| `messages.html` + `chat.js` | Messagerie (mode compte ou mode WhatsApp) |
| `compte.html` + `account.js` | Espace client (connexion, inscription, historique) |
| `login.html` | Connexion administrateur |
| `admin.html` | Tableau de bord administrateur |
| `style.css` | **Tous** les styles du site, y compris login, admin et compte |
| `animations.css` | Animations (chargé après `style.css`) |
| `config.js` | Adresse du projet Supabase et clé publique |
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

## Sécurité

- Toutes les tables ont la **sécurité au niveau des lignes (RLS)** activée.
- Un visiteur peut seulement **envoyer** (réservation, message, commande) et jamais lire.
- La commande passe par la fonction `create_order` : le **prix est recalculé côté base** à partir du plat, le navigateur ne peut pas le modifier.
- Un client connecté ne lit que **ses** commandes, réservations et messages, et ne peut pas écrire au nom d'un autre.
- Seuls les comptes listés dans la table `admins` voient et gèrent tout.
- Messagerie : limite de 20 messages par minute et par client.
- `is_admin()` n'est plus appelable par les visiteurs non connectés.
- Tout texte venant de la base est échappé avant affichage (protection contre l'injection de HTML).

---

## Base de données (résumé)

| Table | Contenu |
|---|---|
| `dishes` | Plats et prix (référence des prix) |
| `orders`, `order_items` | Commandes et leurs lignes |
| `reservations` | Réservations de table |
| `contact_messages` | Messages du formulaire de contact |
| `chat_messages` | Messagerie client ↔ restaurant |
| `chat_reads` | Date du dernier message lu par chaque client (messages non lus) |
| `admins` | Comptes administrateurs |

---

## Journal des évolutions

- **2026-10-30** : compteur de messages non lus pour les clients (pastille sur le bouton de messagerie, pied de page, notification à leur retour sur le site, mise à zéro à l'ouverture de la conversation) ; horodatage des messages à l'heure réelle.
- **2026-10-29 (soir)** : notifications visibles (toasts) sur toutes les actions du compte et des formulaires ; redirection vers le site après la création du compte, avec message de bienvenue ; informations du client (nom, téléphone, adresse) enregistrées automatiquement ; alertes en direct pour le restaurant (nouvelle commande, réservation, message) avec son et notification du navigateur ; police Poppins enfin appliquée (règle `font-family: calc()` invalide supprimée) ; chemin d'image erroné `./image/d1.jpg` retiré ; `is_admin()` retirée aux visiteurs ; chargement différé des images.
- **2026-10-29** : messagerie directe pour les clients connectés (temps réel) et boîte de réponse dans l'administration ; commandes et réservations sans WhatsApp pour les clients connectés ; flèche « retour en haut » masquée sur mobile.
- **2026-10-28** : comptes clients (inscription, connexion, historique, préremplissage des formulaires) ; fusion de `admin.css` dans `style.css` ; diagnostic de l'inscription (les inscriptions étaient désactivées dans Supabase).
- **2026-10-27** : version statique avec WhatsApp, puis connexion à Supabase (commandes, réservations, contact, tableau de bord administrateur) ; menu cliquable, page messagerie, retouches de l'interface (photos arrondies, descriptions, section contact, carte verrouillée, pied de page).

---

## À faire / idées

- Renseigner le nom d'utilisateur Instagram (lien actuel : `https://www.instagram.com/`).
- Activer « Leaked password protection » dans Supabase (Authentication → Sign In / Providers → Email → Password security) : refuse les mots de passe déjà piratés. Cette option peut être réservée aux offres payantes.
- Recevoir les alertes même quand la page d'administration est fermée (e-mail ou WhatsApp automatique via une fonction Supabase).
- Remplacer les descriptions provisoires (chefs, Veyi, Pokoumè).
- Paiement mobile (Mobile Money).

---

*Projet de Jmc AGBOH.*
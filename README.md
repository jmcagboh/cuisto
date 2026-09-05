# Cuisto

## Lancer le serveur

Node.js 18 ou plus récent est nécessaire.

```powershell
$env:ADMIN_EMAIL = "admin@cuisto.local"
$env:ADMIN_PASSWORD = "CuistoAdmin2026!"
$env:NOTIFICATION_EMAIL = "votre-adresse@email.com"
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "votre-adresse@email.com"
$env:SMTP_PASSWORD = "mot-de-passe-d-application"
npm start
```

Puis ouvrir http://localhost:3000.

Une notification est envoyée à `NOTIFICATION_EMAIL` après chaque réservation lorsque les variables SMTP sont configurées. Avec Gmail, utilise un mot de passe d'application, pas ton mot de passe habituel. Sans configuration SMTP, les réservations continuent d'être enregistrées normalement dans le tableau de bord.

Le compte administrateur est défini par `ADMIN_EMAIL` et `ADMIN_PASSWORD`. Il est recommandé de toujours définir ces variables avant le démarrage. Les comptes et réservations sont enregistrés dans `data/cuisto.json`, créé automatiquement au premier lancement.

## Parcours

- `login.html` : inscription et connexion client.
- `index.html#reservation` : création d’une réservation après connexion.
- `admin.html` : suivi et changement de statut des réservations.

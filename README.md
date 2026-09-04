# Cuisto

## Lancer le serveur

Node.js 18 ou plus récent est nécessaire.

```powershell
$env:ADMIN_EMAIL = "admin@cuisto.local"
$env:ADMIN_PASSWORD = "ChangeMoiAvecUnMotDePasseFort"
npm start
```

Puis ouvrir http://localhost:3000.

Le compte administrateur est défini par `ADMIN_EMAIL` et `ADMIN_PASSWORD`. Il est recommandé de toujours définir ces variables avant le démarrage. Les comptes et réservations sont enregistrés dans `data/cuisto.json`, créé automatiquement au premier lancement.

## Parcours

- `login.html` : inscription et connexion client.
- `index.html#reservation` : création d’une réservation après connexion.
- `admin.html` : suivi et changement de statut des réservations.

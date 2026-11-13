# Observabilité

## Sondes

- `GET /api/v1/health` : le processus répond (vivacité).
- `GET /api/v1/health/ready` : la base PostgreSQL répond aussi en moins de 3 s (disponibilité). Renvoie 503 `SERVICE_UNAVAILABLE` sinon. C'est le healthcheck Railway du service `pencmi` depuis le 13 novembre 2026 : un déploiement dont la base est injoignable n'est pas mis en service.

## Logs

En production, chaque ligne de log est un objet JSON (`level`, `pid`, `timestamp`, `context`, `message`), filtrable dans Railway. `LOG_FORMAT=text` rétablit le format lisible ; c'est le défaut hors production.

## Erreurs serveur

Chaque réponse d'erreur porte un `requestId`, aussi renvoyé dans l'en-tête `x-request-id`. Il reprend `x-request-id` ou `x-railway-request-id` de la requête s'il est valide, sinon un UUID est généré.

Chaque erreur 500 ou plus écrit une ligne dans les logs (contexte `HttpErrors`) : `requestId`, méthode, chemin sans paramètres, statut, nom et code de l'erreur (par exemple `P2028` pour Prisma) et ses 8 premiers appels. Le message de l'erreur n'est pas écrit, car il peut citer des données client. Pour retrouver une erreur signalée par un utilisateur, chercher son `requestId` dans `railway logs`.

## Workers

Les traitements périodiques (calendriers iCal, webhooks partenaires, alertes) tournent dans le service API quand `HOTEL_SYNC_PROCESSOR_ENABLED=true`. Ils écrivent un message d'erreur sans données personnelles en cas d'échec et reprennent au passage suivant. Le worker emails (`npm run start:emails`) est un service séparé, à déployer quand l'envoi d'emails sera activé.

## Sauvegardes

Les sauvegardes planifiées de Railway demandent un abonnement Pro. En attendant, `scripts/backup-railway-scheduled.ps1` lance `backup-railway-postgres.ps1` (archive PostgreSQL chiffrée par DPAPI dans `%LOCALAPPDATA%\Pencmi\backups`), garde les 14 dernières et écrit une ligne par passage dans `backup.log`. Il s'exécute depuis le Planificateur de tâches Windows, une fois par jour ; une exécution manquée PC éteint est rattrapée au démarrage suivant.

`restore-railway-test-backup.ps1` restaure une archive dans une base `_test` neuve d'un **autre** environnement Railway, jamais en production. Le 13 novembre 2026, une archive de production a été restaurée ainsi, les migrations appliquées et `migration-readiness-postgres.spec.ts` est passé sur la copie ; l'environnement temporaire a ensuite été supprimé.

## Pas encore en place

- Redis : aucun service, le code ne l'utilise pas ; les traitements de fond reposent sur PostgreSQL.
- Emails : désactivés tant que le domaine d'envoi n'existe pas ; le worker emails sera alors un service Railway séparé.
- Suivi d'erreurs externe (Sentry ou équivalent) : à brancher sur les erreurs 500 déjà journalisées, quand un compte existera.

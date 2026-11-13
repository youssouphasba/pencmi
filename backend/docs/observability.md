# Observabilité

## Sondes

- `GET /api/v1/health` : le processus répond (vivacité). C'est le healthcheck Railway actuel.
- `GET /api/v1/health/ready` : la base PostgreSQL répond aussi en moins de 3 s (disponibilité). Renvoie 503 `SERVICE_UNAVAILABLE` sinon. Peut remplacer le healthcheck Railway pour qu'un déploiement dont la base est injoignable ne soit pas mis en service.

## Erreurs serveur

Chaque réponse d'erreur porte un `requestId`, aussi renvoyé dans l'en-tête `x-request-id`. Il reprend `x-request-id` ou `x-railway-request-id` de la requête s'il est valide, sinon un UUID est généré.

Chaque erreur 500 ou plus écrit une ligne JSON dans les logs (contexte `HttpErrors`) : `requestId`, méthode, chemin sans paramètres, statut, nom et code de l'erreur (par exemple `P2028` pour Prisma) et ses 8 premiers appels. Le message de l'erreur n'est pas écrit, car il peut citer des données client. Pour retrouver une erreur signalée par un utilisateur, chercher son `requestId` dans `railway logs`.

## Workers

Les traitements périodiques (calendriers iCal, webhooks partenaires, alertes) tournent dans le service API quand `HOTEL_SYNC_PROCESSOR_ENABLED=true`. Ils écrivent un message d'erreur sans données personnelles en cas d'échec et reprennent au passage suivant. Le worker emails (`npm run start:emails`) est un service séparé, à déployer quand l'envoi d'emails sera activé.

# Statistiques annonceurs

`GET /api/v1/dashboard/stats/report?module=&period=&listingId=` alimente les pages Statistiques des quatre dashboards et la vue d'ensemble immobilier. Aucune migration.

- `module` : `real_estate`, `hotels`, `vehicles` ou `trips`. Obligatoire. Le rôle doit gérer cet univers, sinon 403.
- `period` : `today`, `7`, `30` (par défaut) ou `90`. Jours calendaires à Africa/Dakar (UTC+0 toute l'année), aujourd'hui compris.
- `listingId` : facultatif. Une annonce d'un autre annonceur donne 404.

Le propriétaire vient toujours de la session. Un paramètre `ownerUserId` est refusé. L'accès anonyme donne 401, un compte client 403.

`GET /dashboard/stats` reste disponible : `trackingEvents` et `contacts` ne comptent plus que les annonces du propriétaire.

## Définitions

| Métrique | Source | Période | Définition |
| --- | --- | --- | --- |
| Annonces par statut | Table de l'univers | État actuel | Hors supprimées, comptées à part |
| Demandes par statut et type | Demandes de visite, réservation, location, chauffeur, place | `createdAt` | Annonces supprimées comprises, leur historique reste attribuable |
| Demandes acceptées | Mêmes tables | `createdAt` | `accepted` et `completed`. Ce ne sont pas des transactions réalisées |
| À traiter | Mêmes tables | `createdAt` | `new`, `pending`, `requires_more_info` |
| Taux d'acceptation | Acceptées / reçues | `createdAt` | `null` sans demande |
| Contacts directs | `ContactEvent` : `form`, `whatsapp`, `phone`, `email` | `createdAt` | Les événements sans `ownerUserId` sont rattachés par l'annonce |
| Conversations ouvertes | `Conversation` | `createdAt` | Annonce possédée et participation |
| Messages reçus | `Message` | `createdAt` | Hors messages de l'annonceur et messages masqués |
| Favoris reçus | `Favorite` | `createdAt`, et total | Annonces du propriétaire. Totaux seulement, jamais le compte qui a enregistré |
| Chambres | `HotelRoom` | État actuel | Total et actives |
| Nuitées allouées | `HotelStockAllocation` | `date` | `units` non libérées. Jamais déduites des demandes |
| Places demandées | `TripSeatRequest.requestedSeats` | `createdAt` | Déclarées par les clients |
| Places allouées | `TripSeatRequest.allocatedSeats` | `createdAt` | Demandes acceptées seulement, distinctes des places demandées |

Une demande n'est comptée qu'une fois : les événements `visit_request`, `reservation_request`, `rental_request`, `chauffeur_request` et `seat_request` ne s'ajoutent pas aux contacts. `internal_message` n'y entre pas non plus, les conversations ayant leur propre compteur.

Le classement des annonces se fait sur les demandes reçues, puis les contacts, puis les messages.

## Mesures indisponibles

Elles figurent dans `unavailable` et s'affichent « Donnée indisponible », jamais 0.

| Mesure | Raison |
| --- | --- |
| Vues, clics détails, clics WhatsApp, téléphone et email | Aucune page n'envoie d'événement. `POST /tracking/events` est public et sans contrôle : ses données ne sont pas fiables |
| Taux vue → contact | Les vues ne sont pas mesurées |
| Délai moyen de réponse | Non calculé |
| Taux d'occupation (hôtels) | Le stock déclaré ne fournit pas de total fiable de chambres-nuits |

## Voyages

`GET /dashboard/voyages/statistics` garde son contrat et alimente la vue d'ensemble voyages. La page Statistiques utilise le rapport commun, qui ajoute les filtres. Ses `confirmedSeats` viennent des départs (`TripOccurrence`), tandis que les places allouées du rapport suivent les demandes de la période : les deux chiffres peuvent différer.

## Tests

- `backend/src/modules/statistics/statistics-api.spec.ts` : HTTP réel avec guards et validation, sur un Prisma en mémoire.
- `backend/src/modules/statistics/statistics-postgres.spec.ts` : requêtes réelles. Exige `TEST_DATABASE_URL` vers une base isolée dont le nom finit par `_test`.
- `tests/statistics.browser.test.mjs` : navigateur réel et API contrôlée, à 360, 390, 768 et 1280 px.

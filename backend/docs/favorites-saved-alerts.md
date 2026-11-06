# Favoris et alertes

Aucune migration : les tables `Favorite`, `SavedAlert`, `Notification` et `IdempotencyKey` existaient déjà. Le compte vient toujours de la session : `userId` envoyé par le navigateur est refusé (400).

## Favoris

| Route (sous `/api/v1`) | Rôle |
| --- | --- |
| `GET /favorites?module=&page=&limit=` | Favoris du compte, paginés |
| `GET /favorites/check?module=&ids=a,b` | Lesquels de ces identifiants sont en favoris (100 au maximum) |
| `PUT /favorites/:module/:listingId` | Ajout idempotent. 404 si l'annonce n'est pas publique |
| `DELETE /favorites/:module/:listingId` | Retrait idempotent |

- Un favori devenu indisponible reste listé avec `available: false` et son identifiant seulement, sans titre, prix ni lien. Il peut être retiré.
- Voyages : le favori porte sur le `TripListing`. Le lien et `nextDeparture` viennent du prochain départ réel à venir, sans nombre de places.
- Une photo n'est renvoyée que si son adresse est sûre.

## Alertes

| Route (sous `/api/v1`) | Rôle |
| --- | --- |
| `GET /saved-alerts?module=&page=&limit=` | Alertes du compte |
| `POST /saved-alerts` | `module`, `name`, `filters`, `active` |
| `GET`, `PATCH`, `DELETE /saved-alerts/:id` | Celle d'un autre compte n'existe pas (404). La suppression est idempotente |
| `GET /saved-alerts/:id/matches?page=&limit=` | Annonces publiques correspondantes, filtrées et paginées par PostgreSQL |
| `GET /saved-alerts/capabilities` | Canaux réellement actifs |

Limite : 30 alertes par compte. Un doublon exact donne 409. Format stocké dans `criteria` : `{ version: 1, name, filters, since }`. Une alerte d'un autre format reste lisible et supprimable, sans être interprétée.

| Univers | Critères |
| --- | --- |
| `real_estate` | `transaction`, `propertyType`, `city`, `minPrice`, `maxPrice`, `minSurface` |
| `hotels` | `city`, `propertyType`. **Pas de prix ni de dates** : le stock ne permet pas de comparaison fiable, ils sont refusés (400) |
| `vehicles` | `vehicleMode`, `brand`, `model`, `city`, `minPrice`, `maxPrice`, `minYear`, `fuel`, `gearbox` |
| `trips` | `departureCity`, `arrivalCity`, `date`, `passengers`, `minPrice`, `maxPrice`, `vehicleType`, `timeOfDay`. Exige un vrai départ à venir avec assez de places |

Il n'y a pas de fréquence : ni « immédiatement », ni « chaque jour », ni email. « Enregistrer cette recherche » reprend uniquement les paramètres de l'adresse de la recherche. La recherche libre `query`, le filtre « meublé » et les filtres propres à une page ne sont pas repris.

## Notifications internes

`SavedAlertsProcessor` tourne dans le processus web, toutes les minutes, **seulement si `SAVED_ALERTS_PROCESSOR_ENABLED=true`**. **Par défaut il est arrêté**, et l'interface l'annonce (`capabilities.internalNotifications`).

**Pourquoi il ne s'accroche pas à la modération** : seule la route voyages passe une annonce à `active`. L'immobilier, les hôtels et les voitures n'ont aucune transition vers `active` dans le code. Lire les annonces actives couvre tous les chemins, sans toucher à une transaction de modération.

- **Curseur par univers** : ligne `IdempotencyKey` (`saved-alerts:cursor:<module>`), enregistrée après le traitement. Chaque passage relit 5 minutes en arrière, pour une transaction validée après la date qu'elle a écrite.
- **Après un crash** : le passage suivant relit les mêmes annonces.
- **Au plus une fois** : l'identifiant de `Notification` dérive du couple (alerte, annonce), avec `skipDuplicates`. Une annonce réactivée ne notifie donc pas une seconde fois la même alerte.
- **Pas d'envoi rétroactif** : le premier passage d'un univers ne fait que poser le curseur. Une annonce doit avoir été mise à jour après `since`, date de création de l'alerte, de son dernier changement de critères ou de sa réactivation.
- **Exclusions** : annonce non publique, alerte en pause, propriétaire de l'annonce.

**Limite connue** : le critère est `updatedAt`. Une annonce déjà active et modifiée sans repasser en validation peut donc notifier une alerte plus récente qu'elle. Il n'existe pas de date d'activation en base.

Aucune préférence de notification n'est enregistrée aujourd'hui, donc rien à respecter de plus que l'état de l'alerte. Aucun email n'est envoyé.

### Avant de l'activer

1. Lancer `messaging-postgres`, `statistics-postgres` et `favorites-alerts-postgres.spec.ts` avec `TEST_DATABASE_URL` vers une base isolée dont le nom finit par `_test`.
2. Mettre `SAVED_ALERTS_PROCESSOR_ENABLED=true` sur Railway.
3. Vérifier une activation réelle sur un environnement de recette, puis un redémarrage.

## Tests

- `backend/src/modules/saved-alerts/favorites-alerts-api.spec.ts` : HTTP réel avec guards et validation, processeur compris, sur un Prisma en mémoire.
- `backend/src/modules/saved-alerts/favorites-alerts-postgres.spec.ts` : requêtes JSON réelles et concurrence. Exige `TEST_DATABASE_URL`.
- `tests/saved.browser.test.mjs` : navigateur réel et API contrôlée, à 360, 390, 768 et 1280 px.

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
- Si tous les départs sont passés ou annulés, le favori devient indisponible. Les anciens trajets sans occurrence ne restent accessibles que si leur date et heure de départ sont encore à venir, comme la fiche publique.
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

Les créations, modifications et suppressions sont sérialisées par compte dans une transaction PostgreSQL avec verrou de ligne sur `User`. Le quota et le contrôle des doublons restent valides entre plusieurs instances API et plusieurs onglets.

Pour les voyages, le prix, la date et le lien des résultats et des notifications proviennent du départ qui satisfait effectivement tous les critères, pas systématiquement du premier départ du trajet. Une notification reste unique par alerte et trajet.

Si un critère n'est pas pris en charge par la page de recherche publique (`minSurface`, `minPrice` immobilier ou `minYear` automobile), `searchUrl` vaut `null` : seul « Voir les résultats », filtré en base avec tous les critères, est proposé. Aucun lien ne supprime silencieusement un filtre.

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
2. Mettre `SAVED_ALERTS_PROCESSOR_ENABLED=true` sur une recette isolée et vérifier les notifications après une publication, puis après un redémarrage.
3. Activer ensuite explicitement ce paramètre en production après validation. Ne pas l'activer automatiquement lors d'un déploiement de code. Le fichier `.env.example` conserve `false`.

## Tests

- `backend/src/modules/saved-alerts/favorites-alerts-api.spec.ts` : HTTP réel avec guards et validation, processeur compris, sur un Prisma en mémoire.
- `backend/src/modules/saved-alerts/favorites-alerts-postgres.spec.ts` : requêtes JSON réelles et concurrence. Exige `TEST_DATABASE_URL`.
- `tests/saved.browser.test.mjs` : navigateur réel et API contrôlée, à 360, 390, 768 et 1280 px.

## Reprise et validation du 6 novembre 2026

Le travail initial était déjà poussé dans `0ad3aa6`. Aucun changement source local non poussé n'a été trouvé à la reprise ; le dossier `.codex-attachments` est conservé et exclu du commit. Le fichier de consignes original de l'étape 15 n'a pas été retrouvé : le présent contrat, le commit initial et les parcours existants ont servi de référence.

Les plantages WSL ont été contournés sans modifier WSL : PostgreSQL 18.6 natif Windows, écoute sur `127.0.0.1:55432`, base isolée `pencmi_step15_test`, fuseau `Africa/Dakar`. Les sept migrations du dépôt ont été appliquées uniquement à cette base. Audit des migrations : aucun problème, schéma synchronisé. Aucune nouvelle migration n'est nécessaire.

Commandes exécutées depuis `backend`, avec `DATABASE_URL` et `TEST_DATABASE_URL` pointant explicitement vers cette base locale :

```powershell
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js validate
node scripts/audit-migrations.cjs
node --max-old-space-size=640 node_modules/jest/bin/jest.js --runInBand --globals '{"ts-jest":{"isolatedModules":true}}' --silent
node --max-old-space-size=2048 node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false
node node_modules/eslint/bin/eslint.js 'src/**/*.ts'
node --max-old-space-size=2048 node_modules/@nestjs/cli/bin/nest.js build
node --test scripts/audit-migrations.test.cjs scripts/database-fingerprint.test.cjs scripts/security-dependencies.test.cjs
```

Les suites `messaging-postgres`, `statistics-postgres` et `favorites-alerts-postgres` ne sont plus bloquées. La dernière couvre les quatre univers, les notifications et leur isolation, les doublons, le quota concurrent et les modifications concurrentes. Les trois défauts de concurrence/lien ont été reproduits avant correction sur PostgreSQL réel.

Les tests frontend sont exécutés depuis la racine avec `PENCMI_PLAYWRIGHT_MODULE` vers Playwright installé et Edge : `node --test --test-concurrency=1 tests/*.test.mjs`. Ils couvrent notamment les favoris, alertes, notifications, erreurs réseau, injection HTML, reprise de session et absence de débordement aux quatre largeurs. Le parcours alertes est relancé après correction du bouton « Voir les résultats », qui restait désactivé après le premier clic.

Résultats : 508 tests backend réussis (31 suites), trois tests de stockage distant ignorés ; 17 tests d'outillage réussis ; 53 tests frontend réussis, un test de recette Railway ignoré. La relance navigateur ciblée favoris/alertes après correction du bouton est également réussie. TypeScript, lint, build et validation Prisma passent. Les avertissements de dépréciation de la configuration `ts-jest` restent sans mise à jour de dépendances dans ce chantier.

Limites de cette validation : les tests navigateur utilisent une API contrôlée ; la persistance et la concurrence sont vérifiées séparément sur PostgreSQL réel. Le test navigateur de publication voyages lié à une ancienne recette Railway et trois tests de stockage distant R2 ne sont pas exécutés ici. Aucun test ni seed n'a utilisé les données Railway de production. Aucun email n'est envoyé. Le processeur reste un traitement périodique dans le processus web, avec la limite `updatedAt` décrite ci-dessus.

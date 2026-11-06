# Espace client : demandes et suivi (étape 16)

## Périmètre

Les cinq parcours sont reliés aux tables existantes : réservation hôtel, visite immobilière, location automobile, demande avec chauffeur et demande de places. Aucun second moteur de réservation, paiement ou rattachement rétroactif par coordonnées n'est ajouté. Les favoris, alertes et conversations des étapes précédentes sont conservés.

Base de reprise : `a1889c02ff2ca9ae32fb0c8378a921bc457fed70`, synchronisée avec `origin/main` avant modification. Aucune modification source locale non poussée n'était présente ; `.codex-attachments` reste hors du commit.

## Création : invité et compte connecté

Les endpoints existants restent publics :

| Type | POST sous `/api/v1` |
| --- | --- |
| `hotel` | `/hotels/:id/reservation-requests` |
| `visit` | `/immobilier/:id/visit-requests` |
| `rental` | `/voitures/:id/rental-requests` |
| `chauffeur` | `/voitures/:id/chauffeur-requests` |
| `trip` | `/voyages/:id/seat-requests` |

`@OptionalAuthentication()` ajoute une authentification facultative strictement délimitée à ces cinq actions :

- Sans en-tête `Authorization`, le parcours invité est inchangé et `clientUserId` reste nul.
- Avec cet en-tête, le guard JWT existant vérifie signature, compte actif et session non révoquée. Un token invalide n'est jamais traité comme un visiteur anonyme.
- Le contrôleur transmet uniquement l'identifiant fourni par ce guard au service métier. `clientUserId`, `ownerUserId`, `status`, prix et allocations dans le body sont refusés par les DTO et la validation globale.
- Les API partenaires hôtelières conservent leur authentification dédiée ; elles ne sont pas marquées comme facultatives.

Les comptes professionnels actifs peuvent eux aussi agir comme clients pour leurs propres demandes. Aucun rôle, y compris administrateur, ne contourne l'isolation des nouveaux endpoints de consultation. Les permissions de gestion des annonceurs restent distinctes.

### Idempotence

- Hôtels : conservation de `requestId`, `idempotencyKey`, fingerprint et verrou sur l'établissement. Le fingerprint des nouvelles demandes authentifiées inclut l'identité vérifiée. Le contrôle de replay compare également `clientUserId`. Le format des fingerprints invités existants n'est pas changé.
- Voyages : conservation de l'identifiant dérivé du trajet et de `requestId`, des verrous trajet/départ et des comparaisons métier. Le replay doit aussi appartenir à la même identité, y compris l'identité anonyme.
- Visites, locations et chauffeur : ajout d'un `requestId` UUID facultatif pour les anciens consommateurs ; les formulaires actuels le fournissent. L'identifiant serveur dérive du type, de l'annonce et de cet UUID. Sous le verrou de l'annonce, un replay retourne la demande existante seulement si toutes les données et l'identité correspondent ; sinon 409. La clé primaire existante garantit l'unicité sans migration.
- Sans UUID sur ces trois anciens parcours, seules les données strictement identiques du même client (ou invité), de la même annonce, envoyées dans les deux dernières minutes, sont dédupliquées sous le même verrou. La garantie durable repose sur l'UUID fourni par les formulaires actuels.
- Rejouer après connexion une ancienne demande invitée donne 409 et ne la rattache pas au compte. Les demandes historiques sans `clientUserId` restent anonymes.

La réception d'une demande ne consomme aucun stock. Les validations de chambres, dates, capacités, tarifs, restrictions, source externe et allocations restent dans les services hôtels/voyages existants.

## Consultation authentifiée

| GET sous `/api/v1` | Contrat |
| --- | --- |
| `/compte/requests?type=hotel\|visit\|rental\|chauffeur\|trip&page=1&limit=20` | Liste d'un type ; `type` obligatoire, page positive, limite maximale 100 |
| `/compte/requests/summary` | Totaux réels des cinq tables filtrées sur le compte, plus total global |
| `/compte/requests/:type/:id` | Détail d'une demande du même compte, sinon 404 |

Chaque lecture est filtrée en SQL par `clientUserId` issu de la session. Le tri est `createdAt DESC, id ASC` ; le total vient de `count`, pas de la taille de la page. Les filtres inconnus sont refusés sur la liste. Sans session : 401. Les actions annonceur restent soumises à leurs permissions et ownership ; un client ne peut pas changer son statut par cette API.

Une réponse contient uniquement : référence, type, statut, dates de création/mise à jour, référence et titre public de l'annonce (ou repli neutre), coordonnées saisies par ce client, message, données métier enregistrées et liens locaux autorisés. Les métadonnées des annonces, coordonnées privées de l'annonceur, fingerprints, notes de modération et secrets ne sont pas sélectionnés.

Champs spécifiques :

- Hôtel : chambre si publique, arrivée/départ, voyageurs, unités demandées et nombre de nuits avec allocation encore active. Aucun total tarifaire n'est inventé : l'estimation initiale n'est pas enregistrée dans la demande.
- Visite : date souhaitée uniquement. Aucune date proposée ni heure fictive.
- Location : début et fin enregistrés. Pas de caution ni de prix estimé provenant de tarifs actuels non figés.
- Chauffeur : date, lieu de départ et destination lorsqu'ils existent dans la demande historique. Pas de chauffeur attribué fictivement.
- Voyage : départ réellement sélectionné, places demandées, places allouées et prix par personne figé dans la demande. Une allocation historique nulle reste inconnue, pas zéro inventé.

Une annonce suspendue ou supprimée logiquement n'efface pas la demande du compte : titre neutre et aucun lien public. Un départ annulé ou passé ne donne pas de faux lien vers un autre départ. Le détail ne propose une conversation que si le client en est déjà participant, avec renvoi vers la messagerie existante.

## Frontend

Les cinq tableaux constants ont été supprimés de `compte/client-space.js`. Le module partagé `compte/requests-page.mjs` gère listes, détails, pagination, chargement, erreurs, nouvelle tentative et connexion requise. Le détail utilise `?id=` sur chacune des cinq pages existantes. Les totaux de l'accueil du compte sont chargés indépendamment des autres modules et les anciens badges statiques à zéro ont été retirés.

Les cinq pages chargent maintenant la configuration API d'exécution. `compte/request-api.mjs` choisit explicitement le transport authentifié existant (avec renouvellement JWT single-flight) ou le transport invité. Un échec d'authentification ne déclenche pas un deuxième POST anonyme. Les formulaires conservent leurs champs après erreur ; le lien « Suivre ma demande » n'apparaît qu'après un vrai reçu et uniquement pour un envoi authentifié.

Les valeurs des demandes sont rendues avec `textContent`. Les liens de consultation restent locaux. Les libellés et champs communs sont regroupés dans `compte/request-copy.mjs` ; types et destinations backend sont centralisés dans `common/constants/client-requests.ts`.

Les formulaires profil/paramètres non raccordés ont été désactivés explicitement : ils n'affichent plus de faux succès. Leur raccordement n'est pas inclus dans cette étape.

## Statuts et notifications

Les statuts métier existants ne sont pas requalifiés en paiement ou réservation garantie. Les décisions annonceur sur les cinq types et l'annulation d'un départ voyage écrivent une notification `request_status_changed` pour le client identifié, dans la même transaction que la décision et les éventuelles allocations/libérations. Le type, la demande, la version antérieure et la transition déterminent une clé de notification idempotente. Répéter le même état ne produit pas de deuxième notification. Les demandes invitées ne génèrent pas de notification client attribuée arbitrairement.

Aucun email, SMS ou push n'est ajouté. Pas de bouton d'annulation client : il n'existe pas encore de parcours client de modification sûr, et les actions de gestion existantes restent du côté annonceur.

Le processeur de recherches sauvegardées (`saved_alert_match`) est indépendant des notifications de demandes. Vérification Railway en lecture seule le 6 novembre 2026 : `SAVED_ALERTS_PROCESSOR_ENABLED` absent des variables du service et expression d'activation évaluée à `false` dans le conteneur. Il n'a pas été activé. En recette locale : démarrage arrêté par défaut, initialisation avec flag activé, passage réel, arrêt, réinitialisation et relecture du curseur PostgreSQL ont été testés. Le passage est invoqué explicitement dans le test, sans attendre la minute du timer.

## Schéma et déploiement

Aucun changement de schéma Prisma, aucune nouvelle migration, aucune suppression de données ou d'index. Les cinq colonnes `clientUserId` existaient déjà. Les index/clés primaires existants sont réutilisés pour l'idempotence. Sur de très gros historiques, des index dédiés `(clientUserId, createdAt, id)` pourront être ajoutés après mesure et revue de migration ; ils ne conditionnent pas la pagination ni l'isolation fonctionnelles testées ici.

Audit de la base locale isolée : sept migrations appliquées, checksums et artefacts vérifiés, zéro problème, schéma `in_sync`. Aucun test, seed ou upload n'utilise la production Railway. Le push n'est effectué qu'après validation ; le statut de déploiement et le SHA final sont communiqués séparément après observation Railway.

## Vérifications et reproduction

PostgreSQL natif Windows 18.6 existant réutilisé après contrôle du serveur, sans WSL. La suite ajoutée refuse une cible non locale ou dont le nom ne finit pas par `_test`. Les comptes, annonces, demandes et sessions de recette sont créés avec des identifiants uniques et nettoyés dans cette seule base.

Depuis `backend`, fournir `TEST_DATABASE_URL` et `DATABASE_URL` vers cette recette. Pour les anciennes suites, fournir également le marqueur `PRODUCTION_CLUSTER_ID` utilisé par leurs garde-fous, sans jamais pointer sur la base de production. Pour le navigateur, `PENCMI_PLAYWRIGHT_MODULE` désigne le module Playwright local avec Edge installé.

```powershell
node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js validate
node scripts/audit-migrations.cjs
node --max-old-space-size=640 node_modules/jest/bin/jest.js --runInBand --globals '{"ts-jest":{"isolatedModules":true}}' --silent
node node_modules/eslint/bin/eslint.js 'src/**/*.ts'
node --max-old-space-size=2048 node_modules/typescript/bin/tsc -p tsconfig.json --noEmit --incremental false
node --max-old-space-size=2048 node_modules/@nestjs/cli/bin/nest.js build
node --test scripts/audit-migrations.test.cjs scripts/database-fingerprint.test.cjs scripts/security-dependencies.test.cjs
```

Depuis la racine : `node --test --test-concurrency=1 tests/*.test.mjs` avec le module Playwright configuré.

Résultats obtenus :

- 525 tests backend réussis, 32 suites ; deux tests R2 distants ignorés, faute de stockage de recette configuré. Aucun échec.
- La nouvelle suite comporte 16 tests, avec vrais JWT/sessions, HTTP NestJS et requêtes PostgreSQL : cinq types, clients A/B, professionnel, administrateur sans bypass client, invité, compte suspendu, entrées forgées, replay inter-identités, concurrence, 105 lignes par type, annonces suspendues/supprimées et conversation privée.
- Le test navigateur de cette suite utilise le vrai backend et PostgreSQL isolé : les cinq formulaires publics puis leurs détails client, aux largeurs 360/390/768/1280 ; reconnexion, pagination de 105 visites, session révoquée, erreur réseau en lecture et perte de réponse après un POST déjà validé. Les valeurs XSS restent du texte ; contrôle d'absence de débordement et captures inspectées mobile/desktop.
- 53 tests frontend existants réussis ; seul l'ancien test live de publication voyages lié à une recette Railway n'est pas lancé. Il n'est pas confondu avec le nouveau test navigateur/SQL local, effectivement exécuté.
- 17 tests d'outillage réussis. Lint, TypeScript, build, Prisma generate/validate et audit des migrations passent.
- Un test hôtelier existant dépendait de l'ordre non garanti de deux chambres ; il cible désormais l'identifiant stable de la chambre, sans changer le service métier ni les données.

Les avertissements de dépréciation `ts-jest` restent connus. Les limites volontaires demeurent : pas d'annulation client, pas de prix historique hôtel/location non stocké, pas d'email automatique et pas d'activation du processeur d'alertes en production.

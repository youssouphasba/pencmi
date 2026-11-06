# Publication des voyages interurbains — étape 10

## Périmètre opérationnel

Le formulaire existant conserve ses dix étapes. Il utilise `TripListing`, `TripSeatRequest`, le client de publication et la coordination JWT existants. Aucun moteur parallèle, paiement, billet ou allocation de sièges n'est créé.

- Brouillons incomplets persistés dans PostgreSQL, reprise par identifiant depuis le dashboard, modification et suppression logique.
- Création idempotente : UUID `requestId` obligatoire, identifiant serveur dérivé du propriétaire et de cet UUID ; un retry ne réécrit pas le brouillon déjà créé. Slug unique généré côté serveur.
- Itinéraire, points de rendez-vous, horaires, informations véhicule, capacité, places déclarées, prix et supplément bagage entiers FCFA, bagages inclus, négociabilité, conditions, description et contacts conservés dans une publication JSON strictement validée.
- Soumission complète vers `pending_review`. Aucun champ de formulaire ne permet d'activer une annonce. Une modification d'une annonce active exige une publication complète et la remet en validation ; les annonces suspendues, expirées ou supprimées ne sont pas éditables arbitrairement.
- Validation, refus, suspension et réactivation réservés aux administrateurs, sous verrou PostgreSQL, avec écriture d'audit atomique. Un refus ou une suspension nécessite un motif ; une activation revalide intégralement le trajet.
- Recherche et filtres appliqués avant pagination SQL : villes, texte, date, passagers, transport, prix et période de la journée. Sept codes canoniques, correspondance explicite des anciens libellés, sans réécriture des données historiques.
- Seuls les trajets actifs, non supprimés, avec départ futur et horaire renseigné sont publics. Les profils annonceurs appliquent la même projection publique : pas de métadonnées internes, d'immatriculation ou d'email de notification.
- Demandes de place idempotentes, contact obligatoire, type/format/longueur contrôlés, vérification du trajet et de sa capacité déclarée, limitation à cinq tentatives par minute. Une réception n'est jamais présentée comme une réservation confirmée.
- Dashboard : annonces réelles, reprise/édition, soumission, suppression, pagination, prix, dates, demandes réellement reçues et changements de statut autorisés. Les contacts se configurent désormais dans chaque trajet, plutôt que via un faux bouton de sauvegarde global.
- Échappement des valeurs HTML, données conservées en mémoire après erreur réseau, boutons désactivés pendant les requêtes, modales refermables et attributs d'accessibilité cohérents.

## Contrats API

Préfixe actuel conservé : `/api/v1`.

| Opération | Route |
| --- | --- |
| Créer un brouillon | `POST /dashboard/voyages` avec `{ requestId, publication }` |
| Liste propriétaire paginée | `GET /dashboard/voyages` |
| Reprendre | `GET /dashboard/voyages/:id` |
| Modifier | `PATCH /dashboard/voyages/:id` avec `{ publication }` |
| Soumettre | `POST /dashboard/voyages/:id/submit` |
| Supprimer logiquement | `DELETE /dashboard/voyages/:id` |
| Recherche publique paginée | `GET /voyages` |
| Fiche publique | `GET /voyages/:id` |
| Demande de place | `POST /voyages/:id/seat-requests` avec UUID `requestId`, contact et places |
| Demandes propriétaire | `GET /dashboard/voyages/seat-requests` |
| Traitement sans allocation | `PATCH /dashboard/voyages/seat-requests/:id/status` |
| File admin paginée | `GET /admin/listings/trips` |
| Décision admin | `PATCH /admin/listings/trips/:id/status` avec `{ status, reason? }` |

Les permissions `publish_trip`, `manage_trips` et `access_admin` restent issues du mapping de rôles existant. Un administrateur peut modérer, mais une route propriétaire ne lui donne pas implicitement accès aux données d'un autre propriétaire.

La publication JSON est remplacée explicitement lors d'une modification ; les métadonnées historiques étrangères à cette publication sont conservées. La lecture propriétaire les conserve, la lecture publique utilise une liste blanche.

## Horaires et places

Les horaires sont saisis en `Africa/Dakar`, actuellement UTC+00:00. Une arrivée estimée antérieure à l'heure de départ est affichée le lendemain ; le choix explicite « lendemain » est également conservé. Aucun temps de parcours ou itinéraire géographique n'est calculé.

`availableSeats` représente le stock **déclaré**, jamais un stock transactionnel garanti. Une demande ne le décrémente pas. Les nouvelles acceptations/completions ne sont pas proposées : sans allocation transactionnelle, elles seraient trompeuses. Les anciennes demandes acceptées restent conservées ; aucune allocation historique n'est inventée.

Transitions de traitement : `new` → `pending`, `requires_more_info`, `refused`, `cancelled` ; `pending` → `requires_more_info`, `refused`, `cancelled` ; `requires_more_info` → `pending`, `refused`, `cancelled`. Une ancienne demande `accepted` peut être annulée. Une transition concurrente ne réécrit pas un statut déjà modifié.

## Fonctions non implémentées

- Départs récurrents et occurrences : option désactivée ; seule une date réellement enregistrée peut recevoir une demande.
- Réservation instantanée, allocation automatique de places, billets, QR codes, paiements et GPS.
- Notifications email, formulaire de messagerie supplémentaire et envoi interne depuis ce formulaire : canaux non activables, aucun faux envoi.
- Carte interactive : aucun composant prétendant afficher un itinéraire sans coordonnées.

Les conditions et libellés éditoriaux initiaux sont regroupés dans `voyages/trip-content.mjs`, remplaçable par un fournisseur de contenu administrable. Cela ne constitue pas encore une interface CMS pour ces valeurs.

## Schéma et déploiement

Aucune migration nouvelle : les colonnes et relations existantes suffisent. Aucun utilisateur, trajet, demande ou fichier de production n'est supprimé. Le pré-déploiement Railway existant `prisma migrate deploy` reste inchangé.

La recette utilise un **cluster PostgreSQL distinct**, avec un nom de base se terminant par `_test`. Les tests et fixtures refusent explicitement l'identité du cluster de production. Les fixtures ne sont jamais chargées au démarrage normal du backend et aucun secret n'est fourni dans le dépôt.

`scripts/prepare-isolated-fixtures.cjs` prépare uniquement les données minimales attendues par les anciens tests de migration sur une base vide. Un administrateur de navigateur n'est créé qu'avec un mot de passe de recette fourni par variable d'environnement. L'environnement et ses services temporaires doivent être supprimés après validation pour arrêter leur consommation.

## Vérifications du 6 novembre 2026

- Build NestJS local réussi ; TypeScript `--noEmit` réussi. Build, génération Prisma, validation du schéma et audit des migrations également réussis en recette Railway.
- Recette PostgreSQL : **365 tests backend réussis**, 22 suites réussies ; trois tests exclus : navigateur immobilier Windows et deux tests de stockage distant R2 hors de ce périmètre. Aucune dépendance de stockage voyages nouvelle.
- Tests frontend locaux : **50 réussis**, zéro échec ; le test live, conditionnel dans le lancement général, est exécuté séparément.
- Parcours live : **un test réussi**, couvrant mobile 390 px et desktop 1280 px contre NestJS et PostgreSQL de recette réels, avec JWT réel : brouillon sauvegardé/repris, soumission, invisibilité avant validation, validation via le vrai écran admin, lecture publique, filtres, demande de place persistée, traitement par le propriétaire et suppression logique.
- Tests navigateur supplémentaires : 360, 390, 768 et 1280 px avec API contrôlée pour les erreurs réseau, XSS, doubles soumissions, reprise, prévisualisation, recherches et actions dashboard. Les suites immobilier, hôtels, allocations, automobile et authentification sont exécutées sans modifier leurs règles métier.
- Outils d'audit et d'empreinte : **11 tests réussis** en recette. Première recette arrêtée sur trois fixtures manquantes, puis corrigée ; un test d'authentification frontend a révélé un accès global à `location`, corrigé avant la relance complète.
- Backend local avec navigateur immobilier activé : **345 tests réussis**, 23 exclus faute de PostgreSQL local ou de stockage distant de recette ; les tests PostgreSQL correspondants sont exécutés séparément sur Railway. Les totaux locaux et distants se recouvrent et ne doivent pas être additionnés.
- Recette finale Railway `83cddcc5-3b75-47fe-9e28-478c23f134cd` réussie ; le parcours live est relancé avec succès contre cette version finale. Après validation, l'environnement temporaire et ses deux services sont supprimés, puis leur absence est vérifiée. Seuls l'environnement de production et ses services originaux `pencmi` et `Postgres` subsistent.
- `npm audit --omit=dev` : **7 alertes héritées**, dont une critique, cinq élevées et une modérée. Aucune mise à jour majeure ni modification du lockfile dans cette étape. Le build de recette signale 25 alertes avec les dépendances de développement.

Empreinte de production relevée en lecture seule avant push : `ffe9fb9076fc43e14ca91e9ebb8daadf0d87f6a4d85479da34042146eee72752` ; six utilisateurs, deux trajets, deux demandes de place et trois annonces automobiles conservés. Le résultat du déploiement et le SHA sont à vérifier après le push, et non déduits des tests de recette.

## Fichiers concernés

- `backend/src/modules/trips/` : contrôleur, DTO, services, schéma métier, module et trois suites de tests.
- `backend/src/modules/professional-profiles/professional-profiles.service.ts` : projection publique limitée aux voyages.
- `backend/scripts/prepare-isolated-fixtures.cjs` : fixtures de recette protégées.
- `publier/trip-publish.js`, `publier/publish.css` : dix étapes reliées au backend et adaptation mobile.
- `voyages/trip-content.mjs`, `voyages/trip-types.d.ts`, `voyages/trips.js`, `voyages/trips.css`, `voyages/detail/detail.js` : données publiques, filtres, formulaires, sécurité HTML et types.
- `dashboard/voyages/dashboard-trips.js` et les pages `index.html`, `trajets`, `reservations`, `contacts`, `messages`, `statistiques`, `contact-settings` : actions réelles, erreurs et configuration API.
- `admin/admin.js`, `admin/listings/voyages/index.html` : file de modération voyages et décisions réelles.
- `tests/trip-publication.test.mjs`, `tests/trip-publication.browser.test.mjs`, `tests/trip-publication.live.test.mjs` : tests de structure, navigateur contrôlé et API/PostgreSQL réels.

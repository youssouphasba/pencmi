# Publication automobile

## Périmètre

Les douze étapes de `/publier/?category=voiture` utilisent les API authentifiées existantes. Les modes restent `sale`, `rental` et `chauffeur`. Aucun paiement, contrat automatique, moteur de disponibilité, réservation instantanée ou affectation de chauffeur n'est ajouté.

## Données et statuts

- `VehicleListing` est réutilisé sans nouvelle migration. Les six migrations précédentes restent nécessaires.
- Le prix principal et la ville sont persistés dans les colonnes dédiées. Les sections validées sont conservées dans `metadata.publication` : `identity`, `info`, `location`, `pricing`, `equipment`, `documents`, `conditions`, `contactPreferences`.
- Les prix des trois modes sont conservés lors d'un changement de mode. Seul le prix correspondant au mode sélectionné alimente `VehicleListing.price` et l'affichage public. Les montants sont des entiers FCFA ; les montants facultatifs peuvent être effacés explicitement avec `null`.
- Les brouillons incomplets sont autorisés. Un `requestId` UUID génère un identifiant stable côté serveur, limité au propriétaire. Une répétition de création ne remplace pas un brouillon déjà modifié. Le frontend réapplique ensuite les données courantes avec PATCH, y compris après une réponse de création perdue.
- Les modifications et la gestion des photos sont sérialisées par annonce et remettent l'annonce en `draft`. Une annonce active modifiée doit donc être réexaminée avant de redevenir publique.
- La soumission valide les champs requis et place l'annonce en `pending_review`. Le formulaire ne peut attribuer ni `active`, ni propriétaire, ni slug, ni privilège administratif.
- Les annonces suspendues, expirées ou supprimées ne sont pas modifiables via la publication. Le changement de mode est refusé tant qu'une demande acceptée dépend de l'ancien mode.
- Les informations anciennes sont reprises depuis les métadonnées existantes lorsque la structure de publication n'existe pas encore.

## API

Toutes les routes ci-dessous sont relatives au préfixe API configuré, actuellement `/api/v1`.

| Méthode | Route | Usage |
| --- | --- | --- |
| POST | `/dashboard/voitures` | Création idempotente, permission `publish_vehicle` |
| GET | `/dashboard/voitures/:id` | Reprise propriétaire, permission `manage_vehicles` |
| PATCH | `/dashboard/voitures/:id` | Mise à jour du brouillon propriétaire |
| POST | `/dashboard/voitures/:id/submit` | Soumission à validation |
| POST | `/dashboard/voitures/:id/photos` | Multipart `photo`, `uploadId` UUID, `replacePhotoId` facultatif |
| PATCH | `/dashboard/voitures/:id/photos/order` | Ordre complet des `photoIds`, sans doublon |
| DELETE | `/dashboard/voitures/:id/photos/:photoId` | Retrait d'une photo propriétaire |
| DELETE | `/dashboard/voitures/:id` | Suppression logique propriétaire |
| GET | `/voitures` | Recherche et filtres publics paginés |
| GET | `/voitures/:id` | Fiche active non supprimée |
| POST | `/voitures/:id/contact` | Formulaire de contact réellement enregistré |
| POST | `/voitures/:id/rental-requests` | Demande de location sur une annonce `rental` active |
| POST | `/voitures/:id/chauffeur-requests` | Demande de service sur une annonce `chauffeur` active |

Filtres publics : `vehicleMode`, `city`, `query`, `brand`, `model`, `fuel`, `gearbox`, `minPrice`, `maxPrice`, `page`, `limit`. Les anciennes métadonnées et les nouvelles sections sont recherchées côté serveur ; le navigateur ne filtre plus seulement une première page de résultats.

Les réponses publiques utilisent une projection explicite. L'adresse indicative privée, l'email de notification, les paramètres internes et les documents privés ne sont pas exposés. Une annonce active sans photo reste visible avec un état neutre.

## Photos et stockage

- Adaptateur commun local/S3/R2, sans deuxième système de stockage.
- 30 photos par annonce, 5 Mo réels par fichier, 25 millions de pixels maximum, quota de 150 Mo par propriétaire pour le module automobile. Les anciens objets en attente de purge continuent à compter dans le quota.
- JPEG, PNG et WebP contrôlés par signature et décodage Sharp, puis réencodés. SVG, contenus invalides, images animées et dépassements sont refusés par les protections communes.
- Réorganisation, couverture, remplacement et suppression utilisent des références persistées. Les aperçus `blob:` restent locaux au navigateur et ne sont jamais enregistrés comme URL définitive.
- Les nouveaux fichiers passent par `/files/public/:id` uniquement si l'annonce associée est active et non supprimée. Le propriétaire peut utiliser `/files/:id/content` avec son JWT pour les aperçus privés.
- Les photos externes historiques sont conservées. Péncmi ne peut pas rendre privé un fichier déjà hébergé publiquement ailleurs : son retrait supprime uniquement la référence dans l'annonce.
- `STORAGE_DRIVER=local` est réservé au développement. La production exige un stockage persistant configuré ; un stockage absent ou invalide provoque une erreur explicite, sans repli silencieux sur le disque du conteneur.
- Pour des frontends et API sur des origines différentes, configurer `BACKEND_URL` avec l'origine réelle du backend. Les URLs de fichiers relatives à l'API sont également prises en charge par la présentation automobile.

## Contacts et demandes

Le formulaire de vente crée un véritable `ContactEvent` propriétaire, affiché dans les contacts du dashboard. Les boutons téléphone, WhatsApp et email ouvrent le moyen de contact activé ; ils n'affichent pas un faux accusé d'envoi.

Les demandes location/chauffeur exigent un nom, au moins un contact exploitable et une date non passée. Une location exige une fin strictement postérieure au début. Les dates sont évaluées en `Africa/Dakar`. Le nom, les coordonnées et le message ne sont pas renvoyés publiquement dans l'accusé de réception. Les routes publiques d'envoi sont limitées à cinq requêtes par minute et par politique de limitation existante.

La création de la demande et de son événement de contact est transactionnelle. L'annonce est verrouillée puis son état et son mode sont revérifiés avant l'insertion. Les changements de statut sont limités au propriétaire et aux transitions explicites ; une demande terminale ne peut pas être arbitrairement rouverte. L'acceptation reste une décision manuelle, pas une garantie de stock ni une affectation de chauffeur.

## Interface

- Reprise via `?category=voiture&id=...`, ou bouton Modifier/Reprendre du dashboard.
- Enregistrement et soumission attendent une confirmation serveur ; les erreurs conservent les données saisies.
- Les champs en erreur renvoient à l'étape correspondante. Les boutons sont désactivés pendant les requêtes.
- Les appels privés réutilisent le renouvellement JWT single-flight existant.
- Le dashboard charge les pages API d'annonces et de demandes, offre l'édition et la suppression réelle, et ne simule plus l'enregistrement des moyens de contact.
- Les valeurs non fiables réaffichées sont échappées. Le logo officiel est affiché sans recadrage.
- Les textes de prévention et messages métier partagés se trouvent dans `voitures/vehicle-content.mjs`, remplaçables par le futur contenu administrable/traduit. Les choix du formulaire sont regroupés dans `publier/vehicle-publication.mjs`.

## Vérifications et déploiement

La recette PostgreSQL est distincte de la production et utilise une base explicitement nommée `vehicle_publication_test`. Le lanceur `scripts/test-isolated-backend.cjs` refuse le cluster de production, contrôle les migrations, vérifie TypeScript et Prisma, puis lance les tests backend et les outils d'audit.

Les tests PostgreSQL utilisent les vrais services et le stockage binaire ; le test distant utilise R2 avec des identifiants de recette uniques et nettoie uniquement ses propres objets. Les tests navigateur utilisent une API de test contrôlée et vérifient les requêtes, erreurs, photos et mises en page, séparément des tests PostgreSQL réels. Le parcours immobilier navigateur existant est également exécuté localement.

La préparation de recette a restauré une sauvegarde PostgreSQL chiffrée localement avec Windows DPAPI ; son empreinte est vérifiée avant et après transport. Aucun reset, effacement ou migration nouvelle n'est nécessaire en production pour cette étape. Le push sur main déclenche le déploiement habituel et son contrôle `prisma migrate deploy`.

Les résultats définitifs, le SHA et la vérification du déploiement sont consignés dans le compte rendu de livraison. Un échec de contrôle interdit de déclarer le déploiement validé.

## Limites explicites

- Dépôt documentaire privé et vérification administrative automatique non implémentés. Les documents cochés sont des déclarations, pas des documents vérifiés.
- Aucun email ou notification automatique nouveau n'est envoyé par ces formulaires. Ils ne créent pas une conversation interne fictive ; les messages du formulaire sont consultables dans Contacts.
- Aucun calendrier de réservation automobile ni prévention transactionnelle des doubles locations n'est ajouté. Les dates et conditions doivent être confirmées par l'annonceur.
- Les contacts du formulaire utilisent l'endpoint transversal existant, limité aux 100 derniers événements. Les annonces et demandes du dashboard parcourent, elles, la pagination API.
- Le stockage R2 est vérifié depuis une nouvelle instance d'adaptateur, sans ajouter de fichier de test à la base de production. Un redémarrage réel de la production avec un nouvel upload automobile n'est pas simulé.
- `npm audit --omit=dev` relève 7 alertes héritées : 1 critique (`proxy-addr`), 5 élevées (`body-parser`, `js-yaml`, `prisma`, `@prisma/config`, `deepmerge-ts`) et 1 modérée (`qs`). Aucune dépendance n'est mise à jour dans cette étape ; une mise à niveau Prisma majeure n'est pas appliquée sans chantier dédié. L'installation complète de recette signale aussi des dépendances de développement vulnérables (20 alertes au total).
- Les anciens fichiers immobiliers déjà signalés introuvables ne sont pas recréés par cette étape.

## Correction de non-régression immobilière

Le test PostgreSQL existant a révélé une course dans l'upsert de création : un conflit de clé primaire peut survenir lorsque le même brouillon est créé simultanément. La correction récupère uniquement le brouillon du même propriétaire lors d'un `P2002` visant précisément `id`. Les autres erreurs et contraintes ne sont pas masquées. Aucun parcours immobilier, modèle ou historique n'est refondu.

## Résultats de recette du 29 octobre 2026

- Backend sur Railway isolé : 20 suites réussies, 326 tests réussis et un test navigateur exclu du lancement Linux. Ce test navigateur immobilier est exécuté séparément sur Windows dans un lancement ciblé de 57 tests réussis.
- Frontend : 46 tests réussis, aucun ignoré. Les parcours navigateur couvrent les largeurs 360, 390, 768 et 1280 pixels, les photos, les recherches/filtres, les trois modes, les erreurs réseau et les actions du dashboard.
- Outils d'audit et d'empreinte : 11 tests réussis.
- Génération Prisma, validation du schéma, build NestJS et contrôle TypeScript complet réussis en recette Railway. Le contrôle de schéma confirme les six migrations appliquées, des empreintes SQL conformes, aucun index invalide et aucune dérive.
- Les tentatives de contrôle TypeScript sur ce poste ont aussi rencontré des limites de mémoire ; les validations finales du backend sont celles exécutées sur Railway, pas une compilation locale supposée réussie.
- Les premières recettes ont été arrêtées sur des erreurs de tests ou de typage, puis corrigées. Les vérifications finales passent sans masquer de test en échec.

## Fichiers concernés

- `app.js`
- `backend/src/files/files.service.ts`
- `backend/src/modules/real-estate/publication.spec.ts`
- `backend/src/modules/real-estate/real-estate.service.ts`
- `backend/src/modules/vehicles/vehicles.controller.ts`
- `backend/src/modules/vehicles/vehicles.dto.ts`
- `backend/src/modules/vehicles/vehicles.module.ts`
- `backend/src/modules/vehicles/vehicles.service.ts`
- `config/public-helpers.js`
- `dashboard/voitures/annonces/index.html`
- `dashboard/voitures/contact-settings/index.html`
- `dashboard/voitures/contacts/index.html`
- `dashboard/voitures/dashboard-vehicles.js`
- `dashboard/voitures/index.html`
- `dashboard/voitures/messages/index.html`
- `dashboard/voitures/statistiques/index.html`
- `publier/publish.css`
- `publier/vehicle-publish.js`
- `voitures/detail/detail.js`
- `voitures/vehicles.css`
- `voitures/vehicles.js`
- `backend/docs/vehicle-publication.md`
- `backend/scripts/test-isolated-backend.cjs`
- `backend/src/modules/vehicles/vehicle-publication-api.spec.ts`
- `backend/src/modules/vehicles/vehicle-publication-postgres.spec.ts`
- `backend/src/modules/vehicles/vehicle-publication.schema.ts`
- `backend/src/modules/vehicles/vehicle-publication.service.ts`
- `backend/src/modules/vehicles/vehicle-publication.spec.ts`
- `backend/src/modules/vehicles/vehicle-publication.test-data.ts`
- `publier/vehicle-publication.mjs`
- `tests/vehicle-publication.browser.test.mjs`
- `tests/vehicle-publication.test.mjs`
- `voitures/vehicle-content.mjs`

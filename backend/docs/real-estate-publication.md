# Publication immobilière : étape 6

## Parcours livré

Le formulaire existant à 12 étapes appelle les contrôleurs et services NestJS,
qui écrivent les annonces et les références de fichiers avec Prisma.
La page de modification réutilise ce même formulaire, sans deuxième modèle de saisie.
Les listes de l'annonceur ouvrent le brouillon par son identifiant enregistré.

- Enregistrement incomplet autorisé avec le statut `draft`.
- Reprise par `GET /dashboard/immobilier/:id`, réservée au propriétaire.
- Enregistrement des modifications par `PATCH`, avec retour de l'annonce réelle.
- Soumission explicite par `POST /dashboard/immobilier/:id/submit`.
- Une soumission valide devient `pending_review`, jamais `active`.
- Une modification d'annonce active ou en attente la remet en brouillon.
- Les annonces suspendues, expirées ou supprimées ne sont pas modifiables par ce parcours.
- Les annonces refusées peuvent être corrigées puis soumises de nouveau.

Les champs obligatoires du parcours existant sont conservés : transaction, type de bien,
région, ville, prix positif, titre et au moins un moyen de contact.
Les numéros et emails sont également vérifiés quand leur canal est activé.
Les photos et la description restent facultatives ; aucun nouveau blocage commercial
de ces parcours n'est introduit. Les données facultatives fournies restent validées.

## Inventaire des 12 étapes

| Étape | Champs conservés | Destination |
| --- | --- | --- |
| Type d'annonce | location, vente, achat | `transaction` |
| Type de bien | appartement, maison, villa, terrain, studio, chambre, bureau, commerce | `propertyType` |
| Localisation | pays SN, région, département, ville, quartier, indication d'adresse, latitude, longitude, position approximative | `metadata.publication.location`, avec ville et quartier aussi dans les colonnes existantes |
| Prix | montant entier FCFA, période, négociable | `price`, `currency`, `metadata.publication.pricing` |
| Caractéristiques | surface, pièces, chambres, salles de bain, étage, nombre d'étages, meublé, parking, balcon, terrasse, piscine, climatisation, gardien, groupe électrogène, compteur individuel, eau | `metadata.publication.features` |
| Photos | références des fichiers, ordre, photo principale | `FileAsset`, `FileUsage`, `metadata.photoIds`, `metadata.photoOrder`, `metadata.photos`, `metadata.coverPhoto` |
| Description | titre, description limitée à 1 200 caractères | `title`, `description` |
| Conditions | caution, avance, commission, charges, frais, date de disponibilité, absence de commission, charges incluses, disponibilité immédiate | `metadata.publication.conditions` |
| Documents | disponibilité déclarée par type | `metadata.publication.documents` |
| Contacts | canaux activés, numéros, email de contact, email de notification, notifications email | `metadata.publication.contactPreferences` |
| Prévisualisation | valeurs saisies et photos réellement récupérées | affichage local, pas de faux favori |
| Soumission | validation serveur et statut retourné | `status = pending_review` |

La structure `metadata.publication` est validée strictement avec Zod.
Les champs inconnus, y compris dans les objets imbriqués, sont refusés.
Les anciennes métadonnées internes sont conservées lors de la modification,
mais ne sont pas acceptées depuis le navigateur ni exposées publiquement.
Une section de métadonnées envoyée par PATCH remplace cette section ; une section
absente est conservée. Le formulaire transmet ses sections complètes.

## Contrats API

Les réponses utilisent l'enveloppe API existante `{ success, data, meta? }`.
Les erreurs de saisie métier incluent `error.details.fields` avec `path` et `message`.

| Méthode et chemin relatif à l'API | Fonction |
| --- | --- |
| `POST /dashboard/immobilier` | créer un brouillon, avec `requestId` UUID réutilisé après une tentative incertaine |
| `GET /dashboard/immobilier` | lister ses annonces |
| `GET /dashboard/immobilier/:id` | charger son annonce et ses références photo |
| `PATCH /dashboard/immobilier/:id` | enregistrer les champs autorisés |
| `POST /dashboard/immobilier/:id/submit` | soumettre les données déjà enregistrées |
| `POST /dashboard/immobilier/:id/photos` | multipart : `photo`, `uploadId` UUID, `replacePhotoId` facultatif |
| `PATCH /dashboard/immobilier/:id/photos/order` | transmettre la liste complète et unique des `photoIds` |
| `DELETE /dashboard/immobilier/:id/photos/:photoId` | retirer une photo et nettoyer le fichier détenu par Péncmi |
| `GET /files/:id/content` | récupérer le contenu photo comme propriétaire authentifié |
| `GET /files/public/:id` | récupérer une photo seulement si son annonce est active et non supprimée |

Les routes existantes de demandes de visite et les permissions du module sont conservées.
Une demande de visite sur un brouillon ou une annonce indisponible est refusée ;
la désactivation explicite des visites est respectée côté serveur et sur la fiche publique.
Les autres workflows de messagerie/contact ne sont pas refondus dans cette étape.
Les préférences et l'email de notification sont persistés, pas une promesse d'envoi d'email.

## Photos et sécurité

- JPEG, PNG et WebP : signature binaire, décodage complet puis réencodage avec Sharp.
- SVG, faux fichiers image, images tronquées et animations refusés.
- Limites centralisées : 5 Mo par fichier, 25 millions de pixels, 12 photos par annonce,
  100 Mo de stockage photo immobilier par propriétaire.
- Extension et type MIME définitifs déterminés par le contenu, pas par le nom fourni.
- Les métadonnées intégrées aux images ne sont pas recopiées.
- Prévisualisations authentifiées avec URL Blob temporaire, jamais enregistrée comme URL définitive.
- Ordre, remplacement et suppression réellement enregistrés.
- Les anciennes photos externes sont conservées et gérables par des références calculées
  côté serveur ; leur URL n'est jamais fournie librement par le formulaire.
- Le retrait d'une ancienne photo externe retire sa référence, pas le fichier hébergé par un tiers.
- Le stockage réutilise l'adaptateur existant local / S3 / R2.
- Le bucket R2/S3 doit rester privé : aucun domaine public ni URL de développement publique
  ne doit contourner le contrôle de visibilité de l'API.

L'identifiant de création est dérivé du propriétaire et de `requestId` ; les retries
du formulaire ne créent pas une deuxième annonce. Le slug est généré côté serveur
et bénéficie de la contrainte unique existante.
Une photo possède également un identifiant logique stable pour `uploadId`.
Les mutations de l'annonce utilisent des transactions et un verrou de ligne PostgreSQL.
Les uploads verrouillent aussi le propriétaire pour contrôler le quota concurrent.

Chaque tentative d'écriture binaire a sa propre clé de stockage. En cas de rollback,
un nettoyage compensatoire vérifie sous verrou que le fichier n'a pas été effectivement
validé avant de l'effacer. Un accusé de transaction perdu ne détruit donc pas la photo
confirmée en base. Une panne simultanée du stockage et de la base peut encore nécessiter
un nettoyage opérateur : l'échec est journalisé, aucun worker de réconciliation fictif
n'est annoncé. Une suppression physique échouée conserve sa consommation de quota.

Les photos retirées sont immédiatement inaccessibles via l'API. La suppression physique
est tentée après la transaction. Les lignes d'historique sont conservées.

## Confidentialité et frontend

Les réponses publiques ne renvoient pas l'objet de saisie, les déclarations documentaires,
l'adresse précise ni l'email de notification. Les informations de contact propres à
l'annonce ne sont exposées que pour les canaux activés. Les brouillons et annonces
en attente restent exclus des recherches et fiches publiques.

Les valeurs saisies sont échappées au réaffichage dans le formulaire et dans les surfaces
immobilières concernées (liste annonceur, accueil, résultats et fiche détail).
Les boutons sont désactivés pendant les opérations ; une erreur conserve les valeurs
en mémoire et n'affiche jamais un succès simulé. Un échec de chargement bloque
l'enregistrement pour éviter d'écraser une annonce avec un formulaire vide.
La reconnexion proposée s'ouvre dans un autre onglet pour conserver le formulaire.
La rotation des tokens réutilise `auth/token-session.mjs`, sans nouvelle implémentation concurrente.
La configuration API vient du fichier runtime existant, pas d'une nouvelle URL codée dans le module.

## Schéma, déploiement et limites

Le schéma Prisma existant suffit : aucune migration, suppression de données ou
modification des utilisateurs existants. Les prix restent limités à l'entier PostgreSQL
existant. Les montants dépassant cette capacité sont refusés avant écriture.

1. Déployer le backend avec le lockfile mis à jour : `npm ci`, puis `npm run build`.
2. Conserver les variables de connexion, de stockage et d'authentification existantes.
3. Vérifier `BACKEND_URL` et les variables `S3_*` utilisées aussi pour R2 ; bucket privé obligatoire.
4. Déployer les fichiers frontend du même commit, notamment les modules `.mjs` et le runtime.
5. Utiliser HTTPS pour le renouvellement sécurisé des tokens multi-onglets.
6. Vérifier le parcours sur une base et un bucket de recette avant une utilisation réelle.

Non inclus : téléversement documentaire, vérification documentaire, nouvelle procédure
de modération admin, autres univers, paiements ou nouveaux envois d'email.
Aucun badge documentaire vérifié n'est créé.

## Vérifications

- Suite backend complète, avec le navigateur activé : 191 tests réussis,
  2 tests PostgreSQL explicitement ignorés faute de `TEST_DATABASE_URL`.
- Tests HTTP avec les vrais contrôleurs/services NestJS et adaptateur Prisma de test en mémoire.
- Fichiers binaires réellement décodés, enregistrés et relus dans un répertoire temporaire isolé.
- Parcours Edge automatisé sur les 12 étapes : brouillon, reprise par la route d'édition,
  photo, XSS, erreur réseau sans faux succès et soumission ; vues mobile et desktop.
- Tests frontend Node : 26 tests réussis pour le roundtrip des sections, les erreurs
  par étape, les UUID sécurisés sur téléphone en HTTP local et la rotation des tokens.
- Régression Edge multi-onglets de la rotation des tokens : 1 test réussi.
- Build NestJS, syntaxe JavaScript et validation Prisma.
- Test PostgreSQL préparé dans `publication-postgres.spec.ts`, non exécuté sans
  `TEST_DATABASE_URL` pointant vers une base dont le nom contient explicitement `test`.
  Il teste la persistance et les retries concurrents sans utiliser `DATABASE_URL`.
- Aucun appel de test ne vise la base ou le bucket de production. R2 réel reste non testé ici.
- L'audit npm de production signale encore 7 alertes préexistantes : 1 modérée,
  5 élevées et 1 critique (`proxy-addr` notamment). Le correctif de publication met à
  jour Sharp, Zod et Multer ; une mise à jour globale des dépendances reste une tâche distincte.

## Fichiers livrés

```text
app.js
backend/package.json
backend/package-lock.json
backend/tsconfig.build.json
backend/src/files/files.controller.ts
backend/src/files/files.service.ts
backend/src/files/listing-photo.constants.ts
backend/src/modules/real-estate/real-estate.controller.ts
backend/src/modules/real-estate/real-estate.dto.ts
backend/src/modules/real-estate/real-estate.module.ts
backend/src/modules/real-estate/real-estate.service.ts
backend/src/modules/real-estate/publication.schema.ts
backend/src/modules/real-estate/publication.fixture.ts
backend/src/modules/real-estate/publication.spec.ts
backend/src/modules/real-estate/publication-postgres.spec.ts
dashboard/immobilier/annonces/index.html
dashboard/immobilier/annonces/listings.js
dashboard/immobilier/annonces/edit/index.html
dashboard/immobilier/annonces/edit/edit.js
immobilier/immobilier.js
immobilier/annonce/detail.js
publier/index.html
publier/publish.js
publier/publish.css
publier/real-estate-api.mjs
tests/real-estate-publication.test.mjs
backend/docs/real-estate-publication.md
```

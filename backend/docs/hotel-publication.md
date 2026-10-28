# Publication hôtelière

## Parcours et API

Le formulaire `/publier/?category=hotel` conserve ses 13 étapes. Les valeurs initiales et labels remplaçables sont regroupés dans `publier/hotel-publication.mjs`.

- `POST /api/v1/dashboard/hotels` crée un brouillon. Le client fournit un `requestId` UUID. L'identifiant serveur dépend du propriétaire et de cet UUID ; une insertion PostgreSQL `ON CONFLICT DO NOTHING` empêche les doublons, même en concurrence. Un retry ne remplace pas un brouillon déjà modifié.
- `GET /api/v1/dashboard/hotels/:id` reprend les valeurs, chambres et photos du propriétaire.
- `PATCH /api/v1/dashboard/hotels/:id` enregistre les champs et catégories de chambres dans une transaction. Les chambres nouvelles portent un `clientId` UUID stable ; les suivantes utilisent leur identifiant serveur.
- `POST /api/v1/dashboard/hotels/:id/submit` valide les valeurs persistées et place l'établissement en `pending_review`.
- `POST /api/v1/dashboard/hotels/:id/photos` accepte un multipart `photo`, `uploadId`, et éventuellement `roomId` ou `replacePhotoId`.
- `PATCH /api/v1/dashboard/hotels/:id/photos/order` reçoit les `photoIds` exacts de la galerie.
- `DELETE /api/v1/dashboard/hotels/:id/photos/:photoId` retire uniquement une photo de cet établissement.

La permission `publish_hotel` contrôle la création ; `manage_hotels` et l'appartenance contrôlent les autres opérations. Les DTO et schémas stricts refusent les champs inconnus, `ownerUserId`, `slug`, `status` et les valeurs administratives. Le slug est produit côté serveur. Toute modification éditoriale ou photo repasse en brouillon ; une nouvelle soumission est nécessaire avant une éventuelle validation administrative. Aucun formulaire ne peut activer un établissement.

Le dashboard donne accès à la reprise, à l'édition, aux tarifs, aux contacts et aux disponibilités. Le calendrier affiche les données persistées et renvoie vers la même étape d'édition, plutôt que d'exposer des boutons sans effet.

## Persistance

- `HotelProperty` conserve les champs principaux. Les informations complémentaires validées sont dans `contactSettings.publication`, sans écraser les valeurs historiques voisines.
- `HotelRoom.metadata` conserve adultes, enfants, lits, équipements, quantité, prix de base et devise FCFA. Les périodes saisies sont conservées dans `draftRates` et `draftCalendar`, y compris une période encore incomplète en brouillon.
- Les tarifs datés complets alimentent `HotelRoomRate` avec `ratePlan=manual`. Les autres plans ne sont pas effacés.
- Les périodes complètes alimentent `HotelRoomAvailability` et `HotelRestriction`. Les bornes sont inclusives, en dates civiles du Sénégal, converties à minuit UTC (`Africa/Dakar`). Les séjours minimum/maximum et `stopSell` sont conservés.
- Une quantité négative, supérieure au stock de la catégorie ou positive sur une période fermée/complète/en maintenance est refusée. Le nombre de chambres déclaré doit couvrir les catégories actives lorsqu'il est renseigné.
- Limites : 100 catégories, 366 jours par période, 366 périodes de chaque nature par catégorie, 5 000 journées développées au total par enregistrement.
- Une catégorie avec tarifs, calendrier, restrictions, photos ou mapping externe ne peut pas être supprimée silencieusement. Pour les catégories avec historique, utiliser la désactivation ; les mappings externes restent protégés.

Les brouillons peuvent manquer d'informations. La soumission exige nom, type, ville, description, au moins une catégorie active avec capacité/adultes/lits/stock/prix de base, des périodes complètes et un moyen de contact. Les notifications email seules ne comptent pas comme moyen de contact. Les coordonnées activées sont validées. Les photos ne sont pas obligatoires.

## Photos et stockage

L'adaptateur existant local/S3/R2 est réutilisé. Il contrôle les signatures, décode et réencode réellement les images avec Sharp, limite les pixels et refuse SVG, animations et contenus invalides. Formats : JPEG, PNG, WebP ; maximum 5 Mo et 25 millions de pixels par fichier ; 30 photos établissement et chambres confondus ; quota hôtel de 150 Mo par propriétaire, y compris les fichiers dont le nettoyage reste à effectuer.

Les références et leur ordre sont persistés. Les photos de chambres peuvent être associées à un `roomId` de l'établissement. Un `uploadId` assure l'idempotence ; le remplacement produit un nouvel objet puis retire l'ancien dans la transaction. En cas de rollback, le nettoyage vérifie si le binaire a réellement été validé en base avant de l'effacer. Une suppression distante échouée garde le fichier comptabilisé dans le quota.

Le propriétaire utilise `/api/v1/files/:id/content` avec son token. L'URL publique vérifie aussi que l'établissement est actif et non supprimé. Un brouillon ou une soumission en attente ne donne pas accès aux photos publiques. Les URL historiques sont conservées ; leur disponibilité dépend toujours de leur hébergeur d'origine.

`STORAGE_DRIVER=local` est réservé au développement. En production il faut `r2` ou `s3` et un stockage valide. Pour R2 : `S3_ENDPOINT` HTTPS sans chemin de bucket, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` ; région `auto`. Ne jamais publier un bucket contenant des documents privés.

## Lecture publique et intégrations

Seuls les établissements actifs et non supprimés sont retournés. La réponse est une projection explicite : aucun paramètre partenaire, hash, email de notification, adresse privée ou propriétaire interne n'est retourné. Les chambres désactivées sont exclues. Le prix « à partir de » provient d'un prix de base enregistré avec son identifiant de chambre ; les prix historiques déjà enregistrés restent un repli identifié par l'établissement. Aucun prix moyen ou remise n'est créé. Les photos absentes ont un placeholder sur l'accueil, les résultats et le détail.

Une date absente reste non confirmée. Les périodes fermées, complètes, en maintenance ou en stop-sell sont indiquées. Une donnée externe n'est exploitable que si l'intégration est active et sa fiabilité date est encore valide. L'interface parle de demande de réservation, jamais de confirmation automatique.

Les modifications verrouillent l'établissement et son intégration. Si `sourceOfTruth=external_system`, les chambres, prix, stocks et restrictions ne peuvent pas être modifiés manuellement, même pour une intégration inactive. Les champs principaux actuellement synchronisables (nom, type, ville, région) ne peuvent pas être écrasés. Tout mapping de champs externes additionnel bloque conservativement les écritures manuelles de publication jusqu'à vérification de sa configuration. Les mappings de chambres ne sont jamais supprimés par ce parcours. Clés API, journaux et guard `X-API-Key` restent inchangés.

## Limites assumées

- Pas de réservation instantanée, verrou temporaire de stock, encaissement ou remboursement.
- Modes semi-automatique et automatique désactivés. Accepter une demande ne décrémente pas automatiquement le stock.
- Le formulaire persiste les préférences de messagerie, formulaire et email ; il ne crée pas un moteur d'envoi d'emails ni une nouvelle messagerie.
- Le catalogue historique des chambres peut nécessiter d'être complété avant une nouvelle soumission.
- Les références anciennes sans binaire ne sont pas remplacées par des fichiers fictifs. L'audit a identifié cinq références à taille nulle, absentes de R2, du conteneur et des répertoires locaux d'uploads ; il ne permet pas d'affirmer qu'un binaire avait effectivement été enregistré auparavant.
- Les données non enregistrées restent dans le formulaire après une erreur réseau, pas après fermeture forcée du navigateur ; une alerte de départ protège les modifications non sauvegardées.

## Migration et déploiement

Migration additive `20261029000000_hotel_publication` : colonne JSONB `HotelRoom.metadata`, colonne texte `HotelRoomAvailability.status` initialisée à `open`, contrainte de non-négativité pour les nouvelles écritures. La contrainte est `NOT VALID` afin de ne pas modifier ni bloquer d'éventuelles anciennes lignes non conformes ; sa validation intégrale pourra être planifiée après audit des anciennes données. Aucune table ou ligne existante n'est supprimée.

Ordre : sauvegarde logique chiffrée, restauration vérifiée sur un cluster distinct, migration et tests en recette, comparaison du schéma, déploiement avec `npm run prisma:deploy` en pré-déploiement, puis `npm run start:prod`. Le backend précédent reste compatible avec ces ajouts. Un rollback du code ne doit pas supprimer les nouvelles colonnes.

Les scripts `backup-railway-postgres.ps1`, `restore-railway-test-backup.ps1` et `audit-migrations.cjs` doivent recevoir une cible explicite. Les tests PostgreSQL requièrent `TEST_DATABASE_URL` vers une base nommée `_test` et `PRODUCTION_CLUSTER_ID`. Le test R2 requiert en plus `HOTEL_REMOTE_STORAGE_TEST=true` et les variables S3/R2 en environnement, jamais dans Git. Le navigateur utilise `PENCMI_PLAYWRIGHT_MODULE` et Edge ; les tests frontend n'ont pas besoin des credentials de production.

## Vérifications effectuées le 28 octobre 2026

- 252 tests backend réussis, 15 suites, aucun test ignoré : permissions HTTP, transactions réelles PostgreSQL, concurrence des créations et uploads, renouvellement/rotation JWT, sécurité partenaire, immobilier et contrôles du stockage R2 inclus.
- 39 tests frontend réussis, dont les vrais navigateurs Edge : coordination multi-onglets, 13 étapes hôtelières, reprise, prix/calendrier, upload multipart, remplacement/ordre/suppression des photos, échec réseau sans faux succès, résultats et détail publics, absence de débordement horizontal à 360, 390, 768 et 1280 pixels. Les tests navigateur utilisent une API contrôlée ; les écritures réelles Prisma/PostgreSQL sont testées séparément, sans prétendre avoir réalisé un parcours avec un compte de production.
- 11 tests des outils d'audit et d'empreinte réussis ; TypeScript sans émission, build NestJS et validation Prisma réussis.
- La sauvegarde logique `pencmi-20261028-210345.dump.dpapi` a été restaurée sur deux bases d'un cluster distinct. La migration y est appliquée ; les cinq migrations ont leurs checksums conformes et le diff Prisma est vide.
- L'empreinte des données préexistantes est identique avant et après migration : `ffe9fb9076fc43e14ca91e9ebb8daadf0d87f6a4d85479da34042146eee72752`. Cette comparaison exclut les colonnes additives documentées par l'outil d'empreinte ; elle ne suppose pas que l'absence de dérive de schéma démontre l'absence de perte de données.
- Le test R2 utilise un seul objet et des enregistrements temporaires de recette ; il vérifie l'écriture, la relecture avec une nouvelle instance de stockage et leur nettoyage. Aucun document ni annonce de production n'est modifié par ce test.
- Les contrôles de migration, santé et lecture publique doivent être rejoués après le déploiement Railway. Une restauration logique de PostgreSQL ne constitue pas une sauvegarde des fichiers R2.

Le serveur de consultation local `node scripts/serve-frontend.cjs` accepte les modules JavaScript et exclut le backend, les fichiers cachés, les uploads et les scripts. `PENCMI_FRONTEND_PORT` et `PENCMI_FRONTEND_HOST` permettent de choisir le port et l'interface ; l'écoute par défaut reste sur localhost.

## Fichiers livrés

```text
app.js
backend/prisma/schema.prisma
backend/prisma/migrations/20261029000000_hotel_publication/migration.sql
backend/scripts/audit-migrations.cjs
backend/scripts/database-fingerprint.cjs
backend/src/files/files.service.ts
backend/src/modules/hotels/hotels.controller.ts
backend/src/modules/hotels/hotels.dto.ts
backend/src/modules/hotels/hotels.module.ts
backend/src/modules/hotels/hotels.service.ts
backend/src/modules/hotels/hotel-publication.schema.ts
backend/src/modules/hotels/hotel-publication.service.ts
backend/src/modules/hotels/hotel-publication.spec.ts
backend/src/modules/hotels/hotel-publication-api.spec.ts
backend/src/modules/hotels/hotel-publication-postgres.spec.ts
backend/src/modules/hotels/hotel-storage-postgres.spec.ts
backend/docs/hotel-publication.md
dashboard/hotels/dashboard-hotels.js
hotels/hotels.js
hotels/detail/detail.js
publier/hotel-publication.mjs
publier/hotel-publish.js
publier/publish.css
scripts/serve-frontend.cjs
tests/hotel-publication.test.mjs
tests/hotel-publication.browser.test.mjs
```

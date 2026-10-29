# Demandes et confirmations hôtelières

## Stock et concurrence

`HotelRoomAvailability.available` est le **stock initial vendable**, pas le stock restant. Il ne faut pas y saisir une quantité déjà diminuée des réservations Péncmi. Le stock restant est cette quantité moins les `HotelStockAllocation` non libérées pour la nuit concernée. La date de départ ne consomme aucune nuit.

Une demande `new` ne bloque rien. L'acceptation manuelle crée une allocation par nuit dans la même transaction que le changement de statut et son historique. La contrainte unique `(requestId, date)` interdit les doublons. Le verrou PostgreSQL de l'établissement, puis de l'intégration et de la demande, sérialise les confirmations et les écritures de calendrier. Le stock et les restrictions sont relus après acquisition des verrous. Deux demandes de la dernière unité ne peuvent pas être acceptées toutes deux.

Une nouvelle acceptation de la même demande déjà acceptée est sans effet uniquement si ses allocations sont complètes. Une annulation ou un refus après acceptation renseigne `releasedAt` une seule fois. Aucun incrément du stock initial n'est effectué. Les autres réservations ne sont jamais modifiées pour résoudre un conflit.

Une ancienne demande acceptée sans allocations complètes bloque aussi une nouvelle confirmation lorsque ses dates et sa catégorie peuvent se chevaucher. Si ses dates ou sa catégorie manquent, le contrôle est conservateur. Le propriétaire doit d'abord rapprocher et traiter cet historique ; aucune chambre ni allocation n'est inventée pour le régulariser. Une ancienne demande refusée ou sans chevauchement n'immobilise pas arbitrairement le nouveau stock.

La modification d'une catégorie vérifie ses allocations à venir avant toute écriture : désactivation, capacité insuffisante, suppression de dates, stock inférieur aux allocations, fermeture ou maintenance sont refusés. Pour arrêter de nouvelles demandes sans invalider les séjours confirmés, conserver le stock initial et utiliser `stopSell`. Les allocations et événements historiques restent conservés.

## API et validation

- `POST /api/v1/hotels/:id/stay-quote` reçoit `roomId`, `checkIn`, `checkOut`, `guests`, `units`. Lecture cohérente `RepeatableRead`, sans création ni allocation.
- `POST /api/v1/hotels/:id/reservation-requests` reçoit ces champs, un UUID `requestId`, `clientName` et au moins `clientPhone` ou `clientEmail` utilisable, plus `message` facultatif.
- `GET /api/v1/dashboard/hotels/reservations` est réservé au propriétaire authentifié disposant de `manage_hotels`, avec pagination.
- `PATCH /api/v1/dashboard/hotels/reservations/:id/status` accepte `status` et une `note` facultative ; contrôle du propriétaire dans la transaction.

Dates civiles `Africa/Dakar`, arrivée non passée, départ strictement ultérieur, séjour de 90 nuits maximum. Limites : 10 unités, 100 voyageurs, nom 120 caractères, message 2 000, note de suivi 1 000. Les capacités, catégories actives, stocks physiques et restrictions sont vérifiés. Aucun champ administratif ou identifiant propriétaire n'est accepté dans les DTO publics.

La clé d'idempotence dépend de l'établissement et du UUID client ; seule son empreinte est stockée. Même UUID avec un contenu différent : conflit. Même contenu dans les 120 secondes : réception existante. Une nouvelle demande est limitée à trois par contact et établissement par minute, plus cinq appels publics par IP par minute. La vérification de séjour est limitée à 30 appels par minute.

La réception publique ne contient que `id`, `status`, `createdAt`, `received`, jamais les coordonnées d'un voyageur. Le prix estimatif additionne uniquement les tarifs manuels persistés, ou le tarif de base enregistré lorsqu'aucun tarif daté n'existe pour la nuit. Une nuit sans prix connu donne une estimation nulle, pas un montant inventé. Une date sans stock connu ou périmé reste non confirmée et interdit l'acceptation ; elle n'empêche pas une demande à vérifier. Une période connue fermée, complète, insuffisante ou interdite par restriction refuse la demande.

## Transitions

| État | Actions possibles |
| --- | --- |
| `new` | attente, informations, acceptation conditionnelle, refus, annulation, expiration |
| `pending` | informations, acceptation conditionnelle, refus, annulation, expiration |
| `requires_more_info` | attente, acceptation conditionnelle, refus, annulation, expiration |
| `accepted` | refus, annulation, terminaison après départ |
| `refused`, `cancelled`, `expired`, `completed` | états terminaux |

Une répétition du même état n'ajoute ni événement ni allocation. Le dashboard utilise les actions retournées par le serveur, affiche les erreurs réelles et recharge demandes et calendrier après succès. Les anciennes demandes sans chambre restent lisibles et ne reçoivent aucune allocation inventée ; une acceptation ne peut pas leur garantir de stock. Aucun historique ancien n'est réécrit.

## Sources externes et limites

Si `sourceOfTruth=external_system`, une confirmation locale est interdite, même si l'intégration est inactive ou un stock positif existe. Aucune disponibilité externe n'est décrémentée ; aucune confirmation PMS n'est fabriquée. Les clés, mappings et journaux restent inchangés. Les demandes restent à confirmer dans le logiciel externe ; aucun nouveau connecteur de synchronisation n'est livré.

Pas de paiement, remboursement, préautorisation, réservation instantanée, verrou temporaire client ou nouveau moteur de notifications. « Demander des informations » conserve un état de suivi ; cette étape n'envoie pas d'email automatique. Le formulaire conserve ses données après échec réseau et réutilise son UUID ; il ne conserve pas les coordonnées en stockage navigateur. Les données ne sont pas promises après fermeture/rechargement du formulaire. Une nouvelle demande après réception nécessite l'action explicite correspondante.

Les modifications du formulaire de publication conservent le parcours de validation de l'étape 7 : elles repassent en brouillon, même pour le calendrier. Les confirmations de nouvelles demandes exigent donc un établissement à nouveau actif. Cette étape ne contourne pas la validation administrative existante.

## Migration et déploiement

`20261029010000_hotel_reservation_allocations` est additive : chambre, unités et empreintes facultatives sur les demandes historiques ; nouvelles tables d'allocations et d'événements ; index et clés étrangères. Aucun utilisateur, annonce ou historique n'est supprimé. La contrainte de séjour est `NOT VALID` pour préserver l'historique ; elle s'applique aux nouvelles écritures. Une demande ancienne sans chambre n'acquiert ni chambre ni nombre d'unités par défaut.

Ordre obligatoire : vérifier projet/environnement/service/base, sauvegarde chiffrée, restauration sur un cluster distinct, migration en recette, tests transactionnels concurrents, diff Prisma et empreinte des données préexistantes. Après autorisation explicite, interrompre l'ancien backend pendant cette bascule contrôlée : ses acceptations ne créent pas d'allocations. Déployer avec `npm run prisma:deploy` en pré-déploiement Railway avant démarrage du nouveau backend, puis déployer le frontend. Ne jamais utiliser `migrate reset` ou supprimer les nouvelles tables pour revenir en arrière. Ne pas restaurer un ancien backend autorisant l'acceptation sans allocations une fois ce parcours ouvert : cela contournerait la protection de stock.

Les tests PostgreSQL exigent `TEST_DATABASE_URL` vers une base `_test` et `PRODUCTION_CLUSTER_ID` différent. Les tests navigateur utilisent une API contrôlée et quatre largeurs : 360, 390, 768, 1280 pixels. Ils ne constituent pas un test de réservation avec des clients réels en production.

## Vérifications du 29 octobre 2026

- 285 tests backend, 17 suites, aucun test ignoré. Les contrôles PostgreSQL utilisent la copie restaurée de production sur un cluster distinct : concurrence des acceptations, idempotence, allocation par nuit, annulation et refus, protection du calendrier, isolation entre propriétaires, anciennes demandes, blocage des anciens séjours acceptés sans allocations fiables, source externe, régressions JWT et immobilier. Le test R2 réel écrit et nettoie uniquement son propre objet associé à la recette.
- 40 tests frontend réussis. Les parcours de demande, erreur réseau, réutilisation du UUID, fermeture, pagination, note de suivi, erreur de stock, acceptation et annulation du dashboard sont testés sous Edge aux quatre largeurs. Les valeurs HTML hostiles restent du texte ; aucun débordement horizontal global n'est observé.
- 11 tests des outils d'audit et d'empreinte réussis. Prisma valide le schéma ; compilation TypeScript et build NestJS vérifiés.
- Sauvegarde `pencmi-20261029-052455.dump.dpapi`, empreinte SHA-256 `61E7D5B2E4B581E4292B1C8033B1569F4798D617E8E5EDF4869ED482706595E1`, restaurée sur PostgreSQL 18.6 isolé. La migration additive y est réellement appliquée, les six checksums sont conformes, aucun artefact manquant, diff Prisma vide. L'empreinte des données préexistantes avant/après migration reste `ffe9fb9076fc43e14ca91e9ebb8daadf0d87f6a4d85479da34042146eee72752`.
- L'audit npm de production signale encore sept alertes héritées : une critique, cinq élevées, une modérée. Aucune dépendance ni lockfile n'est modifié dans cette étape. Leur correction doit être traitée séparément, notamment `proxy-addr`, sans imposer une migration majeure Prisma non testée.

La réussite de ces contrôles de recette ne vaut pas validation automatique du déploiement : l'historique, le diff, la santé et les lectures publiques doivent être revérifiés après la bascule Railway. Les comptes existants ne sont pas utilisés pour créer de fausses réservations en production.

La première bascule du 29 octobre a appliqué `20261029010000_hotel_reservation_allocations` en pré-déploiement après arrêt de l'ancien backend. Les six migrations de production ont des checksums conformes, sans artefact manquant et sans diff Prisma. L'empreinte des données préexistantes est inchangée. Les lectures santé/hôtels/immobilier/voitures/voyages répondent 200, les ressources privées et partenaires sans authentification répondent 401, un formulaire de demande invalide répond 400. Le renforcement des anciennes acceptations ne nécessite aucune migration supplémentaire.

# Voyages : occurrences et confirmations

## Modèle et horaires

Le parcours existant conserve ses dix étapes, `TripListing` et `TripSeatRequest`. La publication JSON strictement validée porte désormais les arrêts ordonnés, les points de rendez-vous structurés, une durée estimée facultative et le programme récurrent. Les coordonnées et immatriculations privées ne sont pas ajoutées aux réponses publiques.

Un trajet ponctuel produit un départ. Un programme régulier définit une période explicite de **90 jours calendaires maximum, bornes incluses**, des jours de semaine, une fréquence de 1 à 4 semaines ancrée au début de période et des exceptions datées. La date de début peut être choisie dans le futur ; la borne de 90 jours est la longueur du programme, non une génération glissante à partir d'aujourd'hui. Aucun job ne prolonge silencieusement cette période. Le transporteur doit modifier puis soumettre le programme pour le prolonger.

Les occurrences futures sont matérialisées uniquement lors d'une activation administrative validée. Leurs identifiants sont dérivés du trajet, de la date et de l'heure de départ ; les validations répétées ne les dupliquent pas. Un changement d'heure retire l'ancien départ et annule ses demandes non confirmées, sans les déplacer vers une nouvelle occurrence. Un départ explicitement annulé n'est jamais réactivé implicitement.

Les dates de service sont des `DATE` et les instants sont calculés en UTC, correspondant à Africa/Dakar. Une arrivée plus tôt que le départ désigne le lendemain ; un choix explicite lendemain est également accepté. Une durée peut fournir l'arrivée en l'absence d'heure. Si durée et heure sont renseignées, elles doivent concorder. Aucun calcul géographique ou temps de trajet externe n'est inventé. Les horaires des arrêts doivent être ordonnés et compris entre départ et arrivée lorsqu'elle est connue.

## Places et transitions

Chaque `TripOccurrence` conserve capacité totale, places proposées, confirmées, restantes et prix. PostgreSQL impose des compteurs non négatifs et `confirmées + restantes = proposées <= capacité`. Les places du modèle de trajet restent déclaratives ; la projection publique utilise exclusivement le stock de l'occurrence sélectionnée. Un ancien trajet sans occurrence reste lisible si futur, avec disponibilité non confirmée, mais ne reçoit pas de nouvelle demande avant remise en validation.

Une nouvelle demande exige `occurrenceId`, un UUID `requestId`, un contact valide et une quantité positive. Elle conserve le tarif au moment de la demande et ne consomme aucune place. L'identifiant serveur stable permet de rejouer une même soumission sans doubler demande, contact ou audit ; modifier son contenu ou son occurrence sous le même UUID renvoie 409.

L'acceptation verrouille le trajet puis l'occurrence dans une transaction : vérification du propriétaire, du statut actif, du départ futur, du tarif inchangé et du stock, allocation conditionnelle et audit. Deux confirmations concurrentes de la dernière place ne peuvent pas réussir ensemble. Une deuxième acceptation retourne 409. Un tarif modifié exige une nouvelle demande, sans acceptation silencieuse du nouveau montant.

Transitions : `new/pending/requires_more_info` vers les états de traitement autorisés, dont `accepted/refused/cancelled` ; `accepted` vers `cancelled` avant départ ou `completed` après départ. Une annulation rend les places une seule fois ; les places consommées par une demande terminée ne sont pas recréditées. Une annulation de départ annule ses demandes ouvertes/acceptées et libère leurs allocations atomiquement. Les modifications de route, programme, capacité ou tarification et la suppression sont bloquées en présence de demandes acceptées.

Les demandes historiques gardent `occurrenceId`, `allocatedSeats` et `quotedPricePerSeat` à NULL. Aucun stock historique n'est déduit de leur statut. Une ancienne demande acceptée bloque la mise en service et les modifications critiques tant qu'elle n'a pas été explicitement clôturée ou annulée ; ces décisions sont auditées sans crédit fictif. **Aucun outil de réconciliation comptable historique n'est fourni** : une attribution manuelle à une occurrence nécessite une procédure métier séparée, non une correction SQL improvisée.

## API et dashboard

Préfixe `/api/v1`, routes de publication antérieures conservées.

| Opération | Route |
| --- | --- |
| Recherche paginée par occurrence | `GET /voyages` |
| Fiche et sélection d'un départ | `GET /voyages/:id?occurrenceId=...` |
| Demande idempotente | `POST /voyages/:id/seat-requests` |
| Traitement propriétaire | `PATCH /dashboard/voyages/seat-requests/:id/status` |
| Annuler un départ et ses demandes | `POST /dashboard/voyages/:id/occurrences/:occurrenceId/cancel` avec motif |
| Contacts réels paginés | `GET /dashboard/voyages/contacts` |
| Conversations des trajets possédés | `GET /dashboard/voyages/conversations` |
| Statistiques | `GET /dashboard/voyages/statistics` |

Les confirmations utilisent `manage_trips` et l'identité du propriétaire, jamais un owner transmis par le client. Les décisions administratives utilisent les permissions existantes. Le dernier motif de refus/suspension est restitué au seul propriétaire, sans l'audit complet. Les actions sensibles et décisions sur les places sont tracées dans `AuditLog`.

Le dashboard charge toutes les pages API, propose une pagination visuelle des trajets, affiche occurrences et allocations, traite les demandes et permet d'annuler un départ. Les conversations sont limitées aux annonces du propriétaire et à sa participation. Lecture et réponse utilisent le module de messagerie existant ; un UUID de réponse évite le doublon après retry. Aucune création de conversation ni notification d'email n'est simulée.

Les statistiques comptent les demandes et leurs statuts, les places demandées, les allocations réellement enregistrées, les contacts directs par source et les messages entrants. Les événements `seat_request` ne sont pas recomptés comme contacts directs. Les contacts affichent cependant tous les événements existants. Les vues, conversions et délais de réponse restent indisponibles : cette étape n'invente ni collecte ni consentement de tracking. Les canaux de contact du trajet sont persistés ; les transports de notification non implémentés restent désactivés.

## Migration et déploiement

Migration additive `20261106000000_trip_occurrences` : nouvelle table, champs nullable sur les demandes, index, clés étrangères RESTRICT et contraintes de stock/prix. Aucun backfill, suppression de données ou modification des migrations déjà appliquées. L'audit doit vérifier les checksums, les artefacts et l'absence de dérive Prisma avant tout déploiement.

Ordre : sauvegarde chiffrée DPAPI, restauration sur cluster PostgreSQL isolé, vérification d'identité et empreinte des données avant/après migration, tests, puis `prisma migrate deploy` en pré-déploiement de production avant démarrage du nouveau backend. La migration reste compatible avec l'ancien binaire ; celui-ci ne connaît pas les occurrences. Ne pas activer d'anciens départs avec des réservations historiques non réconciliées.

Sauvegardes restaurées le 6 novembre 2026 : première archive `pencmi-20261106-133517.dump.dpapi`, puis archive fraîche `pencmi-20261106-155032.dump.dpapi`, SHA-256 `6CF057F172CFD76996AB79634C86CE4BC125A85ED5ABB531DDCE6C4B1F10AD50`. Archive et secrets restent hors Git. La seconde restauration a utilisé un cluster distinct et une nouvelle base `pencmi_final_restore_test`, jamais une restauration en production. Empreinte historique identique avant et après migration : `ffe9fb9076fc43e14ca91e9ebb8daadf0d87f6a4d85479da34042146eee72752`. La comparaison exclut les nouvelles structures dérivées ; l'audit séparé confirme leurs contraintes, checksums et l'absence de dérive Prisma.

## Vérifications du 6 novembre 2026

- Recette finale `f21a8ace-466e-4d17-90db-2ac18a1eaafc` : **379 tests backend réussis, 24 suites**, 3 tests ignorés (navigateur immobilier Windows et deux tests R2 distants hors périmètre). PostgreSQL est réel et isolé. Les tests couvrent notamment la dernière place en concurrence, double acceptation, annulation concurrente, absence de recrédit après completion, retries, changement d'occurrence et de tarif, protection des demandes historiques et pagination au-delà de 100 trajets/demandes.
- Les suites auth/rotation JWT, API partenaires, support, immobilier, hôtels/allocations et véhicules sont incluses dans ce lancement ; aucun total de suite recouvrante n'est additionné.
- **11 tests des outils d'audit/empreinte réussis**, séparés de Jest. Prisma generate/validate, migrate deploy sur deux bases isolées, audit sans dérive, lint configuré, compilation TypeScript et build NestJS réussis.
- Frontend : **50 tests réussis**, zéro échec, un test live ignoré dans le lancement général et exécuté séparément. Les tests navigateur contrôlés couvrent 360/390/768/1280 px, erreurs réseau, XSS, reprise, filtres, plus de 100 éléments, réponses aux messages et statistiques. Ils utilisent une API simulée et ne prouvent pas la persistance PostgreSQL.
- Le parcours navigateur connecté à NestJS/PostgreSQL de recette est exécuté séparément en 390 et 1280 px : vraie inscription, sauvegarde, déconnexion, ancien token refusé, reconnexion/reprise, programme régulier et exceptions, arrêts/rendez-vous, validation administrative, recherche publique, choix exact du départ, demande, acceptation, stock diminué puis restitué à l'annulation et suppression logique. Des captures sont conservées localement hors Git.
- Des exécutions intermédiaires ont été arrêtées sur une divergence RESTRICT/SetNull et une erreur de typage dans un test ; ces défauts sont corrigés avant la recette finale. Le premier lancement npm local a épuisé la mémoire en lançant plusieurs workers ; les vérifications suivantes utilisent un seul worker. Deux sélecteurs du test live ont été rendus stables après annulation ou présence de plusieurs trajets de recette.

Contrôle post-push : déploiement de production `5c30a9b6-67b5-4652-aede-6233c602a9c6`, commit `c2b6c5b890805993c652c4a6de2e0a662d8c7850`, état Railway **SUCCESS**. Les sept migrations sont appliquées avec checksums conformes, audit sans problème et schéma `in_sync`. L'empreinte historique, les six utilisateurs, deux trajets et deux demandes de place sont inchangés. Aucun seed ni parcours créant des données n'a été exécuté en production.

Sondes de production : `/health` 200, `/voyages` 200, fourchette de prix inversée 400 ; statistiques, contacts et conversations privés 401 sans authentification. Les confirmations réelles et la reconnexion ont été testées en recette, pas avec des réservations de production. Les deux services temporaires et l'environnement de recette ont été supprimés ; les sauvegardes locales sont conservées. Le CLI Railway est relié de nouveau à `production/pencmi`.

Un correctif frontend complémentaire restitue le véritable message d'erreur de confirmation (stock ou autorisation notamment), sans le remplacer systématiquement par un diagnostic réseau. Le test navigateur vérifie ce retour en 390 et 1280 px ; aucun changement backend ou de migration supplémentaire.

## Audit npm du 6 novembre 2026

`npm audit --omit=dev` retourne **7 alertes : 1 critique, 5 élevées, 1 modérée**. Aucune dépendance d'exécution n'a été mise à jour pour ce lot ; seul le parseur TypeScript ESLint 8.72.1 de développement est ajouté, avec configuration de lint. Les versions d'exécution du lockfile sont inchangées.

| Paquet installé | Gravité | Correctif indiqué | Risque |
| --- | --- | --- | --- |
| proxy-addr 2.0.7 | critique | >=2.0.8 | Usurpation IP avec sous-réseau IPv4-mapped IPv6 de proxy de confiance, GHSA-jqcg-44mw-7w3h |
| body-parser 2.3.0 | élevée | >=2.4.0 | Déni de service sur corps compressés, GHSA-27r3-jxmh-p828 |
| js-yaml 5.1.0 | élevée | >5.4.0 | Déni de service de parsing YAML, GHSA-g796-fgmg-93mv, GHSA-724g-mxrg-4qvm, GHSA-pm4m-ph32-ghv5, GHSA-r3ph-w7gj-g6xm |
| qs 6.15.3 | modérée | >6.16.0 | Contournement limites de tableaux / déni de service, GHSA-x5fp-wj9c-mxmx, GHSA-4mjr-xmp4-gh2g, GHSA-6pq8-jhm2-2vcw |
| deepmerge-ts 7.1.5 | élevée | >=8.0.0 | Épuisement de pile avec graphes récursifs, GHSA-ggr8-5vv4-36mx |
| prisma 6.19.3 et @prisma/config 6.19.3 | élevée | Prisma 7.10.1, majeure | Dépendance transitive deepmerge-ts ; migration Prisma majeure à préparer séparément |

Les quatre correctifs non majeurs sont disponibles mais n'ont pas été installés ni validés dans ce lot. L'exposition dépend des chemins utilisés et de la configuration du proxy ; les alertes ne prouvent pas une exploitation mais restent des risques ouverts. Ne pas lancer `npm audit fix --force` en production.

## Billets et embarquement

À l'acceptation d'une demande de places, un code de billet de 10 caractères est attribué (`TripSeatRequest.ticketCode`, unique, alphabet sans 0/O ni 1/I). Les places confirmées avant cette fonctionnalité reçoivent un code par la migration `20261113006000_trip_tickets`. Le client voit son billet (code, trajet, départ, places, statut d'embarquement) dans son espace et peut l'imprimer ; un billet annulé n'est plus affiché.

Le transporteur ouvre `/dashboard/voyages/embarquement`, choisit le trajet et le départ, puis :
- `GET /dashboard/voyages/:id/occurrences/:occurrenceId/manifest` : passagers confirmés, places, bagages, code, statut ; totaux embarqués et absents.
- `POST /dashboard/voyages/:id/occurrences/:occurrenceId/boarding` `{ ticketCode | requestId, status: boarded | no_show | pending }` : contrôle par code (espaces, tirets et casse ignorés) ou depuis la liste. Refusé pour un billet d'un autre départ, annulé ou déjà utilisé, pour un départ annulé, et hors de la fenêtre d'embarquement (24 h avant le départ à 12 h après). Chaque action est journalisée (`trip.boarding.*`).

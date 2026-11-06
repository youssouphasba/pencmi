# Messagerie et contacts

Une conversation relie un client à l'annonceur d'une annonce, dans l'un des quatre univers (`real_estate`, `hotels`, `vehicles`, `trips`). Aucune migration n'a été nécessaire : les modèles `Conversation`, `ConversationParticipant`, `Message` et `ContactEvent` existaient déjà.

## Routes

Toutes sont sous `/api/v1` et exigent une session.

| Route | Rôle |
| --- | --- |
| `POST /messages/conversations` | Ouvre ou retrouve la conversation, avec son premier message. Corps : `module`, `listingId`, `requestId`, `body` |
| `GET /messages/conversations/by-listing?module=&listingId=` | Conversation de l'utilisateur sur cette annonce, ou `null`. Ne crée rien |
| `GET /messages/conversations` | Conversations de l'utilisateur. Paginée, filtre `module` |
| `GET /messages/conversations?scope=owner&module=` | Boîte de réception d'un annonceur dans un univers. Filtres `q` (titre) et `listingId` |
| `GET /messages/conversations/:id?limit=&before=` | Conversation et messages, du plus récent, avec `hasOlderMessages` |
| `POST /messages/conversations/:id/messages` | Envoi, idempotent avec `requestId` |
| `PATCH /messages/conversations/:id/read` | Marque comme lu |
| `GET /dashboard/contacts?module=&source=&listingId=&page=&limit=` | Contacts de l'annonceur, paginés (100 maximum par page) |

La route `/dashboard/voyages/conversations` reste disponible. L'interface voyages utilise désormais la boîte partagée.

## Règles

- **Ouverture** : annonce réelle, `active`, non supprimée, propriétaire actif, et `internalMessagingEnabled === true`. Sinon 404 ou 409. Une annonce sans choix explicite n'a pas de messagerie. Écrire sur sa propre annonce donne 403.
- **Un seul fil** : l'identifiant dérive du client, de l'univers et de l'annonce. Deux ouvertures simultanées aboutissent à la même conversation grâce à la clé primaire. Une conversation ancienne entre les mêmes personnes est réutilisée.
- **Un seul message** : l'identifiant dérive de la conversation, de l'expéditeur et de `requestId`. Un même `requestId` avec un autre texte donne 409.
- **Annonce fermée après coup** : le client ne peut plus écrire (409), l'annonceur peut encore répondre, et l'historique reste lisible.
- **Accès** : un non-participant reçoit 403. La boîte annonceur exige la participation et la propriété de l'annonce.
- **Identités** : nom affiché seulement, jamais d'email ni de téléphone dans les conversations.
- **Messages masqués** (`hiddenAt`) : conservés en base, jamais renvoyés.

## Contacts

| Source | Créée par | Détails affichés |
| --- | --- | --- |
| `internal_message` | Création de la conversation, une seule fois | Nom du client, lien vers la conversation |
| `form` | Formulaire voitures | Coordonnées et message saisis |
| `visit_request` | Demande de visite | Demande liée |
| `reservation_request` | Réservation hôtel | Demande liée |
| `rental_request`, `chauffeur_request` | Demandes voitures | Demande liée |
| `seat_request` | Demande de place | Demande liée |

Les détails ne sont lus que si la demande appartient à la même annonce que l'événement.

Les événements de visite et de réservation créés avant ce lot n'ont pas de `ownerUserId`. La liste des contacts les rattache par l'annonce. Ils ne sont pas réécrits, donc `GET /statistics` (filtré sur `ownerUserId`) ne les compte pas.

Les appels et les ouvertures de WhatsApp ou d'email ne sont pas comptés, faute d'instrumentation serveur. Dans les statistiques voyages, `directContacts` exclut `internal_message`, déjà compté dans `inboundMessages`.

## Interface

Modules partagés dans `messaging/` : `listing-messaging.mjs` (fiches), `inbox.mjs` (boîtes annonceur et client), `contacts-panel.mjs`. Le texte passe uniquement par `textContent`.

## Tests

- `backend/src/modules/conversations/messaging-api.spec.ts` : HTTP réel avec contrôleurs, service, guards et validation, sur un Prisma en mémoire (`fake-prisma.fixture.ts`).
- `backend/src/modules/conversations/messaging-postgres.spec.ts` : requêtes réelles et concurrence. Exige `TEST_DATABASE_URL` vers une base isolée dont le nom finit par `_test`.
- `tests/messaging.browser.test.mjs` : navigateur réel et API contrôlée, à 360, 390, 768 et 1280 px. Exige `PENCMI_PLAYWRIGHT_MODULE` et Edge.

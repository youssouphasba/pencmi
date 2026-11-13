# Synchronisation des hôtels : calendriers iCal et channel manager

Objectif : un hôtel équipé d'un logiciel (PMS comme Opera, ou channel manager) n'a pas à se connecter chaque jour à Péncmi. Ses disponibilités arrivent seules, et les réservations Péncmi repartent seules vers son logiciel.

L'hôtelier choisit un mode dans `/dashboard/hotels/integration/sync-settings` :

| Mode | Ce qui arrive sur Péncmi | Ce qui repart vers l'hôtel | Délai |
|---|---|---|---|
| `none` | Saisie manuelle dans Péncmi | Rien | — |
| `ical` | Nuits occupées, par chambre | Nuits réservées sur Péncmi, par chambre | 15 min côté Péncmi, plus le délai de lecture du logiciel de l'hôtel |
| `channel_manager` | Disponibilités et prix par date | Réservations et annulations, avec les coordonnées du client | Celui du channel manager |

## Confirmation automatique

Option `autoConfirm`, désactivée par défaut. Une demande est acceptée à sa création, sans attendre l'hôtelier, si toutes ces conditions sont réunies :

- le mode est actif (`status=active`, `syncMode` différent de `none`) ;
- le devis calculé avec le stock synchronisé permet la confirmation (`canConfirm`) ;
- en iCal, **tous** les calendriers actifs de la chambre ont été lus avec succès il y a moins de 3 h ;
- aucune ancienne réservation non rapprochée ne chevauche le séjour.

Sinon la demande suit le parcours habituel : l'hôtelier accepte ou refuse.

## Calcul du stock

- **iCal, calendrier à jour** : une nuit sans ligne de disponibilité est ouverte sur tout le stock déclaré (`totalUnits`). On retire les nuits occupées lues dans les calendriers (`HotelExternalBlock`) et les allocations Péncmi.
- **iCal, calendrier trop ancien** (plus de 3 h) : seules les disponibilités saisies dans Péncmi comptent. Les nuits bloquées lors de la dernière lecture restent déduites, par prudence.
- **Channel manager** : la disponibilité envoyée est le stock vendable, sans plafond `totalUnits`. Une allocation Péncmi n'est plus déduite d'une nuit dès que le channel manager a envoyé cette nuit **après** avoir accusé réception de la réservation (`channelAckedAt <= updatedAt`). Avant, elle est déduite. Une réservation n'est donc jamais comptée deux fois, et jamais oubliée.
- Les prix envoyés par le channel manager (plan `channel`) remplacent les prix saisis dans Péncmi.

## iCal

**Export.** Un lien secret par chambre, `GET /api/v1/hotel-calendars/<jeton>.ics`, sans authentification. Il contient un événement par unité réservée (allocations non libérées, de la veille jusqu'à 730 jours). Il ne contient aucune donnée client. Générer un nouveau lien invalide l'ancien.

**Import.** Jusqu'à 5 calendriers par chambre. Chaque événement bloque `unitsPerEvent` unité(s) par nuit, de son début jusqu'à la veille de sa fin. Les événements annulés (`STATUS:CANCELLED`) et libres (`TRANSP:TRANSPARENT`) sont ignorés. Une récurrence (`RRULE`) ne bloque que sa première occurrence.

- Le calendrier est lu dès son ajout, puis toutes les 15 min par `HotelIcalProcessor`, si `HOTEL_SYNC_PROCESSOR_ENABLED=true`. Chaque calendrier est réservé avant lecture, ce qui permet de faire tourner plusieurs serveurs.
- Si une lecture échoue, les nuits de la lecture précédente sont conservées et l'erreur est affichée à l'hôtelier.
- **Sécurité** : seuls les liens http(s) vers un hôte public, sur un port standard et sans identifiants, sont acceptés. L'adresse IP est vérifiée au moment de la connexion (protection contre le DNS rebinding) et après chaque redirection (3 au maximum). Délai maximal 15 s, taille maximale 2 Mo, 5 000 événements au plus. Le lien d'export Péncmi lui-même est refusé, pour éviter une boucle.

## API partenaire (channel manager ou éditeur de logiciel)

C'est la seule API d'intégration de Péncmi. Un channel manager l'utilise pour tous ses hôtels ; un éditeur de logiciel hôtelier (PMS) ou un groupe hôtelier équipé de développeurs l'utilise de la même façon, en se faisant créer comme partenaire.

Un partenaire est créé par un admin dans `/admin/hotel-integrations/partners`. Le secret est affiché une seule fois, et peut être régénéré ou désactivé. Un même identifiant sert pour tous les hôtels qui ont choisi ce partenaire. Un hôtel n'est servi qu'au partenaire qu'il a sélectionné, et seulement en mode `channel_manager`.

En-têtes : `X-Channel-Partner: <code>` et `X-Channel-Secret: pcmcm_<64 hex>`. Base : `/api/v1/channel-manager/hotels/<hotelCode>`. Le code établissement (`PCM…`) est affiché à l'hôtelier, avec le code de chaque chambre. Les réponses suivent l'enveloppe habituelle `{ success, data }`.

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/rooms` | Chambres : `roomCode`, nom, capacité, `bookable`. Plan tarifaire `channel`, devise FCFA |
| POST | `/inventory` | Disponibilités et prix par plage de dates |
| GET | `/reservations` | Réservations et annulations pas encore acquittées, des plus anciennes aux plus récentes, 100 au plus |
| POST | `/reservations/ack` | `{ "eventIds": [...] }` : acquitte les événements reçus |

`POST /inventory` :

```json
{ "items": [
  { "roomCode": "<id>", "start": "2026-12-01", "end": "2026-12-15", "available": 3 },
  { "roomCode": "<id>", "start": "2026-12-24", "end": "2026-12-26", "closed": true },
  { "roomCode": "<id>", "start": "2026-12-01", "end": "2026-12-31", "price": 45000, "currency": "XOF" },
  { "roomCode": "<id>", "start": "2026-12-20", "end": "2027-01-02", "minStay": 3, "stopSell": false },
  { "roomCode": "<id>", "start": "2027-01-03", "end": "2027-01-03", "minStay": null, "maxStay": null }
] }
```

- Les deux bornes sont incluses. Les jours passés sont ignorés, et une date au-delà de 730 jours est refusée.
- 200 plages au plus par appel. Un appel est appliqué entièrement ou pas du tout.
- `available` est le nombre d'unités encore vendables, réservations Péncmi déjà acquittées comprises.
- Restrictions, par nuit : `stopSell` refuse tout séjour qui comprend cette nuit ; `minStay` et `maxStay` (1 à 90 nuits) bornent la durée de tout séjour qui la comprend. `null` lève une limite ; un champ absent la laisse inchangée. Chaque champ peut être envoyé seul.

`GET /reservations` renvoie des événements `commit` (nouvelle réservation, avec client, message et total quand chaque nuit a un prix `channel`) et `cancel`. Un événement est marqué livré au moment où il est lu. Si Péncmi annule une réservation jamais lue, celle-ci est simplement retirée de la file et aucun `cancel` n'est envoyé. Les événements restent renvoyés tant qu'ils ne sont pas acquittés.

Quand un hôtel passe en mode channel manager, ou change de partenaire, toutes ses réservations à venir sont mises en file pour le nouveau partenaire.

Limite de débit : 1 200 requêtes par minute et par adresse IP pour cette API.

## Webhooks

Optionnels. Sans webhook, le partenaire lit `GET /reservations` à son rythme. Avec, il est prévenu en quelques secondes de chaque réservation et de chaque annulation, puis lit `GET /reservations` comme d'habitude.

**Configuration.** Un admin saisit l'adresse du partenaire dans `/admin/hotel-integrations/partners` : https uniquement, vers un hôte public, sur le port 443. Péncmi génère alors un secret de signature `whsec_…`, affiché une seule fois. Le secret est conservé chiffré (AES-256-GCM, clé `HOTEL_WEBHOOK_ENCRYPTION_KEY`, 64 caractères hexadécimaux), car Péncmi en a besoin pour signer. Remplacer l'adresse génère un nouveau secret. Le bouton « Tester » envoie un `ping`. Le journal montre les 50 derniers envois.

**Requête.** `POST`, `Content-Type: application/json`, sans donnée client :

```json
{ "id": "<id de la notification>", "type": "reservation.commit", "createdAt": "2026-12-01T10:00:00.000Z",
  "data": { "hotelCode": "PCM…", "eventId": "<id de l'événement>", "reservationId": "<id de la demande>" } }
```

Types : `reservation.commit`, `reservation.cancel`, `ping` (avec `data` vide).

| En-tête | Contenu |
|---|---|
| `X-Pencmi-Event-Id` | Identifiant de la notification, le même à chaque essai : sert à ignorer les doublons |
| `X-Pencmi-Timestamp` | Heure d'envoi, en secondes Unix |
| `X-Pencmi-Signature` | `v1=` suivi du HMAC-SHA256 hexadécimal de `<timestamp>.<corps brut>`, avec le secret |
| `X-Pencmi-Attempt` | Numéro de l'essai, à partir de 1 |

Le partenaire vérifie la signature sur le corps brut, refuse un horodatage de plus de 5 minutes, et répond 2xx rapidement (délai maximal 10 s).

**Envoi.** Par le worker (`HotelWebhookProcessor`, toutes les 10 s si `HOTEL_SYNC_PROCESSOR_ENABLED=true`), jamais par la requête qui crée la réservation. Une notification est créée dans la même transaction que l'événement de réservation, et supprimée avec lui si une réservation jamais lue est retirée. Chaque notification est réservée avant l'envoi, ce qui permet de faire tourner plusieurs serveurs. Les redirections ne sont pas suivies, et l'adresse IP est vérifiée à la connexion.

Statuts : `pending`, `sending`, `retrying`, `sent`, `failed`, `skipped`. Après un échec (réponse autre que 2xx, délai dépassé, hôte injoignable), de nouveaux essais ont lieu après 1 min, 5 min, 15 min, 1 h, 6 h et 24 h, puis la notification passe en `failed`. Elle passe en `skipped` si le partenaire a déjà acquitté l'événement par lecture, si le webhook est retiré ou si le partenaire est désactivé. Sans clé de chiffrement sur le serveur, l'envoi est reporté de 15 min sans compter d'essai.

## Limites connues

- iCal ne transporte ni prix, ni quantités : `unitsPerEvent` compense pour les types de chambre à plusieurs unités. Le délai de lecture du logiciel de l'hôtel peut laisser passer une double vente. La confirmation automatique en iCal reste donc un choix de l'hôtelier.
- L'API reprend les échanges du standard OpenTravel (disponibilités, tarifs, réservations) au format JSON. Un channel manager qui ne parle que l'OTA XML aura besoin d'un adaptateur.
- Aucun partenariat channel manager n'est signé à ce jour : il faut en négocier un avant que des hôtels puissent choisir ce mode.

## Déploiement

Migrations additives `20261112002000_hotel_sync` et `20261113001000_hotel_channel_webhooks`, puis `20261113002000_drop_retired_hotel_partner_api`, qui supprime les tables vides de l'ancienne API par établissement (voir `hotel-partner-security.md`). Activer `HOTEL_SYNC_PROCESSOR_ENABLED=true` sur **un** service backend au moins, pour la relecture périodique des calendriers. Définir `HOTEL_WEBHOOK_ENCRYPTION_KEY` (`openssl rand -hex 32`) sur tous les services backend avant d'enregistrer un webhook ; la changer rend illisibles les secrets existants, qu'il faut alors régénérer. Définir `BACKEND_URL` permet d'afficher le lien d'export complet ; sans lui, le lien est construit à partir de l'adresse de l'API côté navigateur.

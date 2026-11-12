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

## API channel manager

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
  { "roomCode": "<id>", "start": "2026-12-01", "end": "2026-12-31", "price": 45000, "currency": "XOF" }
] }
```

- Les deux bornes sont incluses. Les jours passés sont ignorés, et une date au-delà de 730 jours est refusée.
- 200 plages au plus par appel. Un appel est appliqué entièrement ou pas du tout.
- `available` est le nombre d'unités encore vendables, réservations Péncmi déjà acquittées comprises.

`GET /reservations` renvoie des événements `commit` (nouvelle réservation, avec client, message et total quand chaque nuit a un prix `channel`) et `cancel`. Un événement est marqué livré au moment où il est lu. Si Péncmi annule une réservation jamais lue, celle-ci est simplement retirée de la file et aucun `cancel` n'est envoyé. Les événements restent renvoyés tant qu'ils ne sont pas acquittés.

Quand un hôtel passe en mode channel manager, ou change de partenaire, toutes ses réservations à venir sont mises en file pour le nouveau partenaire.

Limite de débit : 1 200 requêtes par minute et par adresse IP pour cette API.

## Limites connues

- iCal ne transporte ni prix, ni quantités : `unitsPerEvent` compense pour les types de chambre à plusieurs unités. Le délai de lecture du logiciel de l'hôtel peut laisser passer une double vente. La confirmation automatique en iCal reste donc un choix de l'hôtelier.
- L'API reprend les échanges du standard OpenTravel (disponibilités, tarifs, réservations) au format JSON. Un channel manager qui ne parle que l'OTA XML aura besoin d'un adaptateur.
- Aucun partenariat channel manager n'est signé à ce jour : il faut en négocier un avant que des hôtels puissent choisir ce mode.

## Déploiement

Migration additive `20261112002000_hotel_sync`. Elle remet aussi à `pencmi` la source de vérité des intégrations inactives. Activer `HOTEL_SYNC_PROCESSOR_ENABLED=true` sur **un** service backend au moins, pour la relecture périodique des calendriers. Définir `BACKEND_URL` permet d'afficher le lien d'export complet ; sans lui, le lien est construit à partir de l'adresse de l'API côté navigateur.

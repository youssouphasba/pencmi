# API partenaire hôtelière par établissement (retirée)

L'ancienne API `/api/hotel-partner/v1`, avec une clé `X-API-Key` par établissement, a été retirée le 13 novembre 2026. Elle n'avait jamais été utilisable : aucun parcours ne permettait d'activer l'intégration ni de relier l'identifiant externe d'un établissement, seules 3 routes sur 17 existaient, et le réglage `sourceOfTruth=external_system` empêchait toute confirmation, sur Péncmi comme par l'API.

Elle faisait doublon avec l'API partenaire décrite dans `hotel-sync.md`, utilisée par les channel managers comme par les éditeurs de logiciels hôteliers. Un éditeur ne développe une connexion directe que pour les grandes plateformes ; pour les autres, il passe par un channel manager.

Ses tables (`HotelApiKey`, `HotelWebhook`, `HotelWebhookDelivery`, `HotelSyncLog`, `HotelSyncConflict`, `HotelExternalMapping`, `HotelFieldMapping`) et la colonne `HotelIntegration.sourceOfTruth` ont été supprimées par la migration `20261113002000_drop_retired_hotel_partner_api`, après une sauvegarde chiffrée de la production (`scripts/backup-railway-postgres.ps1`) et la vérification qu'elles étaient vides. La migration refuse de s'appliquer si l'une d'elles contient des données.

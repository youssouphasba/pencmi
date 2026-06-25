type HotelIntegrationType =
  | "direct_api"
  | "file_import"
  | "webhook_only"
  | "controlled_sync";

type HotelIntegrationStatus =
  | "not_configured"
  | "draft"
  | "testing"
  | "active"
  | "paused"
  | "error"
  | "suspended";

type HotelSourceOfTruth =
  | "hotel_internal_software"
  | "pencmi"
  | "manual_confirm_required";

type HotelSyncDirection =
  | "hotel_to_pencmi"
  | "pencmi_to_hotel"
  | "two_way_controlled";

type HotelSyncFrequency =
  | "realtime"
  | "every_5_minutes"
  | "every_15_minutes"
  | "every_30_minutes"
  | "hourly"
  | "daily"
  | "manual";

type HotelSyncedObjectType =
  | "property"
  | "room"
  | "rate"
  | "availability"
  | "restriction"
  | "reservation_request"
  | "message"
  | "contact"
  | "webhook_event";

type HotelSyncStatus =
  | "pending"
  | "success"
  | "failed"
  | "ignored"
  | "conflict"
  | "retrying";

type HotelConflictResolutionStrategy =
  | "hotel_system_wins"
  | "pencmi_wins_if_allowed"
  | "manual_review"
  | "show_confirm_required"
  | "hide_until_resolved";

type HotelIntegrationConnection = {
  id: string;
  hotelId: string;
  partnerUserId: string;
  type: HotelIntegrationType;
  status: HotelIntegrationStatus;
  sourceOfTruth: HotelSourceOfTruth;
  syncDirection: HotelSyncDirection;
  syncFrequency: HotelSyncFrequency;
  conflictResolution: HotelConflictResolutionStrategy;
  lastSyncAt?: string;
  nextSyncAt?: string;
  createdAt: string;
  updatedAt?: string;
};

type HotelPartnerApiPermission =
  | "hotel.property.write"
  | "hotel.rooms.write"
  | "hotel.rates.write"
  | "hotel.availability.write"
  | "hotel.restrictions.write"
  | "hotel.requests.read"
  | "hotel.messages.read"
  | "hotel.webhooks.manage";

type HotelPartnerApiKey = {
  id: string;
  hotelId: string;
  label: string;
  maskedKey: string;
  permissions: HotelPartnerApiPermission[];
  status: "active" | "revoked";
  lastUsedAt?: string;
  createdAt: string;
};

type HotelWebhookEventType =
  | "hotel.reservation_request.created"
  | "hotel.reservation_request.cancelled"
  | "hotel.message.created"
  | "hotel.contact.created"
  | "hotel.sync.warning"
  | "hotel.listing.approved"
  | "hotel.listing.refused"
  | "hotel.report.created"
  | "hotel.verification.approved"
  | "hotel.verification.refused";

type HotelPartnerWebhook = {
  id: string;
  hotelId: string;
  url: string;
  events: HotelWebhookEventType[];
  secretMasked: string;
  status: "active" | "paused" | "error";
  lastSuccessAt?: string;
  lastFailureAt?: string;
  createdAt: string;
};

type HotelExternalMapping = {
  id: string;
  hotelId: string;
  externalPropertyId: string;
  pencmiPropertyId?: string;
  externalRoomId?: string;
  pencmiRoomId?: string;
  objectType: "property" | "room" | "rate" | "availability" | "restriction";
  lastSyncAt?: string;
  status: "active" | "missing" | "conflict" | "archived";
};

type HotelFieldMapping = {
  id: string;
  integrationId: string;
  partnerField: string;
  pencmiField: string;
  required: boolean;
  dataType: "string" | "number" | "boolean" | "date" | "datetime" | "array" | "object";
  transformRule?: string;
};

type HotelSyncLog = {
  id: string;
  integrationId: string;
  hotelId: string;
  direction: HotelSyncDirection;
  objectType: HotelSyncedObjectType;
  objectId?: string;
  externalId?: string;
  status: HotelSyncStatus;
  message?: string;
  durationMs?: number;
  createdAt: string;
};

type HotelSyncConflict = {
  id: string;
  integrationId: string;
  hotelId: string;
  objectType: HotelSyncedObjectType;
  objectId?: string;
  externalId?: string;
  fieldName: string;
  pencmiValue?: string;
  hotelSystemValue?: string;
  resolution: HotelConflictResolutionStrategy;
  status: "open" | "resolved" | "ignored";
  createdAt: string;
  resolvedAt?: string;
};

type HotelPublicSyncState = {
  hotelId: string;
  roomId?: string;
  isSynced: boolean;
  lastSyncAt?: string;
  reliability:
    | "fresh"
    | "stale"
    | "error"
    | "unknown";
  publicLabel:
    | "availability_synced"
    | "updated_recently"
    | "confirm_required"
    | "sync_unavailable";
};

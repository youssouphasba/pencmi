type PencmiModule =
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "vehicle_sale"
  | "vehicle_rental"
  | "vehicle_chauffeur"
  | "trips"
  | "general"
  | "system";

type UserRole =
  | "client"
  | "advertiser_individual"
  | "real_estate_agency"
  | "hotel_manager"
  | "vehicle_renter"
  | "vehicle_dealer"
  | "chauffeur"
  | "transport_provider"
  | "admin";

type GlobalStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "inactive"
  | "verified"
  | "refused"
  | "suspended"
  | "expired"
  | "deleted";

type VisibilityStatus =
  | "public"
  | "private"
  | "index"
  | "noindex";

type RouteAccess =
  | "public"
  | "authenticated"
  | "advertiser"
  | "admin";

type ContactChannel =
  | "whatsapp"
  | "phone"
  | "email"
  | "internal_message"
  | "form"
  | "visit_request"
  | "reservation_request"
  | "rental_request"
  | "chauffeur_request"
  | "seat_request";

type Permission =
  | "publish_real_estate"
  | "publish_hotel"
  | "publish_vehicle"
  | "publish_trip"
  | "manage_real_estate"
  | "manage_hotels"
  | "manage_vehicles"
  | "manage_trips"
  | "manage_messages"
  | "manage_contacts"
  | "manage_notifications"
  | "access_admin";

type ReportStatus =
  | "new"
  | "in_progress"
  | "correction_requested"
  | "resolved"
  | "rejected"
  | "archived";

type ReportPriority =
  | "low"
  | "normal"
  | "important"
  | "urgent";

type PencmiRouteDefinition = {
  path: string;
  access: RouteAccess;
  module?: PencmiModule;
  indexable: boolean;
};

type PencmiDashboardModule = {
  module: PencmiModule;
  label: string;
  href: string;
  permission: Permission;
};

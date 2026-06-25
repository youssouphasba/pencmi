type ReportModule =
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "vehicle_sale"
  | "vehicle_rental"
  | "vehicle_chauffeur"
  | "trips"
  | "messages"
  | "users"
  | "system";

type ReportTargetType =
  | "listing"
  | "user"
  | "advertiser"
  | "message"
  | "conversation"
  | "document"
  | "other";

type ReportReason =
  | "suspicious_listing"
  | "wrong_price"
  | "fake_photos"
  | "misleading_content"
  | "bad_contact"
  | "unavailable"
  | "abusive_behavior"
  | "fraud_attempt"
  | "suspicious_payment_request"
  | "inappropriate_message"
  | "identity_impersonation"
  | "fake_property"
  | "fake_vehicle"
  | "fake_hotel"
  | "fake_trip"
  | "documents_suspicious"
  | "other";

type PencmiReport = {
  id: string;
  module: ReportModule;
  targetType: ReportTargetType;
  targetId: string;
  reporterUserId?: string;
  advertiserId?: string;
  reason: ReportReason;
  message?: string;
  priority: ReportPriority;
  status: ReportStatus;
  createdAt: string;
  updatedAt?: string;
};

type ModerationDecision = {
  id: string;
  reportId?: string;
  adminUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  action:
    | "warn"
    | "request_correction"
    | "hide_listing"
    | "suspend_listing"
    | "reactivate_listing"
    | "suspend_user"
    | "reactivate_user"
    | "resolve_report"
    | "reject_report"
    | "archive_report";
  reason?: string;
  messageToUser?: string;
  internalNote?: string;
  createdAt: string;
};

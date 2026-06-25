type AdminModule =
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "vehicle_sale"
  | "vehicle_rental"
  | "vehicle_chauffeur"
  | "trips"
  | "system";

type AdminListingStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "refused"
  | "suspended"
  | "expired"
  | "deleted";

type AdminUserStatus =
  | "active"
  | "pending_verification"
  | "suspended"
  | "deleted";

type AdminUserSummary = {
  id: string;
  role: string;
  status: AdminUserStatus;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  city?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  professionalVerified: boolean;
  createdAt: string;
};

type AdminListingSummary = {
  id: string;
  module: AdminModule;
  title: string;
  advertiserId: string;
  advertiserName?: string;
  city?: string;
  status: AdminListingStatus;
  reportsCount: number;
  views?: number;
  contacts?: number;
  createdAt: string;
  updatedAt?: string;
};

type AdminReport = {
  id: string;
  module: AdminModule;
  targetType: "listing" | "user" | "message" | "conversation";
  targetId: string;
  reporterUserId?: string;
  reason: string;
  message?: string;
  status: ReportStatus;
  priority: ReportPriority;
  createdAt: string;
  updatedAt?: string;
};

type AdminDecision = {
  id: string;
  adminUserId: string;
  targetType: "listing" | "user" | "report";
  targetId: string;
  action:
    | "approve"
    | "refuse"
    | "suspend"
    | "reactivate"
    | "delete"
    | "request_changes"
    | "resolve_report"
    | "reject_report";
  reason?: string;
  message?: string;
  createdAt: string;
};

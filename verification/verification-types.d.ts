type VerificationStatus =
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "refused"
  | "expired"
  | "suspended";

type VerificationTargetType =
  | "user"
  | "advertiser"
  | "listing"
  | "document";

type VerificationModule =
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "vehicle_sale"
  | "vehicle_rental"
  | "vehicle_chauffeur"
  | "trips"
  | "general";

type VerificationDocumentType =
  | "identity"
  | "address_proof"
  | "business_registration"
  | "ninea"
  | "professional_card"
  | "property_title"
  | "lease"
  | "deliberation"
  | "nicad"
  | "vehicle_registration"
  | "insurance"
  | "technical_inspection"
  | "customs_clearance"
  | "driving_license"
  | "transport_authorization"
  | "hotel_operation_document"
  | "other";

type VerificationBadge =
  | "profile_verified"
  | "advertiser_verified"
  | "professional_verified"
  | "listing_verified"
  | "documents_verified"
  | "property_verified"
  | "agency_verified"
  | "hotel_verified"
  | "availability_tracked"
  | "vehicle_verified"
  | "garage_verified"
  | "renter_verified"
  | "chauffeur_verified"
  | "transport_provider_verified"
  | "trip_verified";

type VerificationRequest = {
  id: string;
  targetType: VerificationTargetType;
  targetId: string;
  module: VerificationModule;
  requesterUserId: string;
  status: VerificationStatus;
  documentsCount: number;
  badgesRequested: VerificationBadge[];
  badgesGranted: VerificationBadge[];
  trustScore?: number;
  adminMessage?: string;
  createdAt: string;
  updatedAt?: string;
};

type VerificationDocument = {
  id: string;
  requestId: string;
  documentType: VerificationDocumentType;
  label: string;
  fileUrl?: string;
  status: VerificationStatus;
  adminMessage?: string;
  createdAt: string;
  updatedAt?: string;
};

type VerificationDecision = {
  id: string;
  requestId: string;
  adminUserId: string;
  action: "approve" | "refuse" | "request_changes" | "suspend";
  reason?: string;
  message?: string;
  badgesGranted?: VerificationBadge[];
  createdAt: string;
};

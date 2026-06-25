type AccountStatus =
  | "active"
  | "pending_verification"
  | "suspended"
  | "deleted";

type ProfessionalType =
  | "real_estate_agency"
  | "hotel"
  | "auberge"
  | "residence"
  | "vehicle_renter"
  | "vehicle_dealer"
  | "chauffeur"
  | "transport_provider"
  | "other";

type UserAccount = {
  id: string;
  role: UserRole;
  status: AccountStatus;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  professionalVerified: boolean;
  createdAt: string;
  updatedAt?: string;
};

type ProfessionalProfile = {
  id: string;
  userId: string;
  professionalType: ProfessionalType;
  businessName: string;
  city?: string;
  address?: string;
  description?: string;
  logoUrl?: string;
  professionalPhone?: string;
  professionalEmail?: string;
  whatsappNumber?: string;
  website?: string;
  verified: boolean;
  createdAt: string;
  updatedAt?: string;
};

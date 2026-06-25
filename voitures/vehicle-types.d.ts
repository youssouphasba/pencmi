type VehicleListingType = "vente" | "location" | "chauffeur";

type VehicleStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "suspended"
  | "expired"
  | "deleted";

type FuelType =
  | "essence"
  | "diesel"
  | "hybride"
  | "electrique"
  | "gpl";

type GearboxType =
  | "manuelle"
  | "automatique";

type VehicleCategory =
  | "citadine"
  | "berline"
  | "suv"
  | "4x4"
  | "pickup"
  | "monospace"
  | "utilitaire"
  | "camion"
  | "bus"
  | "minibus"
  | "moto"
  | "autre";

type VehicleAdvertiserType =
  | "particulier"
  | "garage"
  | "agence_location"
  | "chauffeur_professionnel";

type VehicleContactPreferences = {
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  emailEnabled: boolean;
  internalMessagingEnabled: boolean;
  contactFormEnabled: boolean;
  emailNotificationsEnabled: boolean;
  whatsappNumber?: string;
  phoneNumber?: string;
  contactEmail?: string;
  notificationEmail?: string;
  preferredContactMethod?: "whatsapp" | "phone" | "email" | "internal_message" | "form";
};

type VehicleListing = {
  id: string;
  title: string;
  listingType: VehicleListingType;
  brand: string;
  model: string;
  version?: string;
  year?: number;
  mileage?: number;
  fuel?: FuelType;
  gearbox?: GearboxType;
  category?: VehicleCategory;
  seats?: number;
  color?: string;
  price?: number;
  pricePerDay?: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  currency: "FCFA";
  region?: string;
  city?: string;
  district?: string;
  photos?: string[];
  status: VehicleStatus;
  advertiserType?: VehicleAdvertiserType;
  contactPreferences: VehicleContactPreferences;
  createdAt: string;
  updatedAt?: string;
};

type VehicleContact = {
  id: string;
  listingId: string;
  source: "whatsapp" | "phone" | "email" | "internal_message" | "form";
  status: "new" | "read" | "replied" | "closed";
  createdAt: string;
};

type VehicleAlert = {
  id: string;
  userId: string;
  listingType?: VehicleListingType;
  brand?: string;
  model?: string;
  city?: string;
  maxPrice?: number;
  minYear?: number;
  maxMileage?: number;
  fuel?: FuelType;
  gearbox?: GearboxType;
  enabled: boolean;
  createdAt: string;
};

type VehicleStats = {
  views: number;
  detailClicks: number;
  favorites: number;
  contacts: number;
  messages: number;
  whatsappClicks: number;
  phoneClicks: number;
  emailClicks: number;
  viewToContactRate: number;
  averageResponseTimeMinutes?: number;
};

type RealEstateTransaction = "location" | "achat" | "vente";
type RealEstatePropertyType = "appartement" | "maison" | "villa" | "terrain" | "studio" | "chambre" | "bureau" | "commerce";
type RealEstateAdvertiserType = "particulier" | "agence" | "promoteur";
type ContactSource = "whatsapp" | "phone" | "email" | "internal_message" | "form" | "visit_request";
type LeadStatus = "new" | "read" | "replied" | "closed";
type ListingStatus = "draft" | "pending_review" | "pending_validation" | "active" | "suspended" | "expired" | "deleted";
type VisitStatus = "new" | "proposed" | "confirmed" | "cancelled" | "completed";
type VisitRequestStatus = VisitStatus;
type MessageStatus = "new" | "read" | "replied" | "archived";
type SenegalRegion =
  | "Dakar"
  | "Diourbel"
  | "Fatick"
  | "Kaffrine"
  | "Kaolack"
  | "Kédougou"
  | "Kolda"
  | "Louga"
  | "Matam"
  | "Saint-Louis"
  | "Sédhiou"
  | "Tambacounda"
  | "Thiès"
  | "Ziguinchor";
type RadiusOption = 5 | 10 | 15 | 20 | 25 | 30 | 40 | 50 | 75 | 100 | "all" | null;

interface SenegalLocation {
  region: SenegalRegion;
  departments: string[];
  cities: string[];
}

interface LocationFilters {
  country?: "SN";
  region?: SenegalRegion | string;
  department?: string;
  city?: string;
  district?: string;
  radius?: RadiusOption;
  nearMe?: boolean;
}

interface ContactPreferences {
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  emailEnabled: boolean;
  internalMessagingEnabled: boolean;
  contactFormEnabled: boolean;
  visitRequestEnabled: boolean;
  emailNotificationsEnabled: boolean;
  notificationEmail?: string;
  preferredContactMethod?: "whatsapp" | "phone" | "email" | "internal_message" | "form";
}

interface RealEstateAdvertiser {
  id: string;
  name: string;
  type: RealEstateAdvertiserType;
  avatarUrl?: string;
  city?: string;
  isVerified?: boolean;
  listingsCount?: number;
  joinedAt?: string;
  verified?: boolean;
  contactPreferences: ContactPreferences;
}

type PropertyDocument = {
  type: "titre_foncier" | "bail" | "deliberation" | "nicad" | "plan" | "building_permit" | "other";
  label: string;
  available: boolean;
};

interface RealEstateListing {
  id: string;
  title: string;
  description?: string;
  transaction: RealEstateTransaction;
  propertyType: RealEstatePropertyType;
  type: RealEstatePropertyType;
  price?: number;
  currency: "FCFA";
  pricePeriod?: "month" | "day" | "total";
  region?: string;
  department?: string;
  city?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  isApproximateLocation?: boolean;
  surface?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  totalFloors?: number;
  furnished?: boolean;
  parking?: boolean;
  balcony?: boolean;
  terrace?: boolean;
  pool?: boolean;
  airConditioning?: boolean;
  securityGuard?: boolean;
  generator?: boolean;
  individualElectricityMeter?: boolean;
  waterAvailable?: boolean;
  deposit?: number;
  advancePayment?: number;
  agencyFee?: number;
  charges?: number;
  negotiable?: boolean;
  availableFrom?: string;
  documents?: PropertyDocument[];
  photos?: string[];
  coverPhoto?: string;
  photoCount?: number;
  isVerified?: boolean;
  advertiser: RealEstateAdvertiser;
  contactPreferences: ContactPreferences;
  status?: ListingStatus;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface RealEstateFilters {
  transaction?: RealEstateTransaction;
  type?: RealEstatePropertyType;
  city?: string;
  district?: string;
  area?: string;
  minPrice?: number;
  maxPrice?: number;
  minSurface?: number;
  maxSurface?: number;
  bedrooms?: string[];
  bathrooms?: string[];
  housingOptions?: string[];
  senegalOptions?: string[];
  advertiserTypes?: RealEstateAdvertiserType[];
  verifiedOnly?: boolean;
  sort?: "recent" | "priceAsc" | "priceDesc" | "surfaceAsc" | "surfaceDesc";
}

type FavoriteItem = {
  id: string;
  userId: string;
  listingId: string;
  listingType: "real_estate";
  createdAt: string;
};

type SavedSearchAlert = {
  id: string;
  userId: string;
  name: string;
  transaction?: "location" | "vente" | "achat";
  propertyType?: string;
  city?: string;
  region?: string;
  maxPrice?: number;
  minSurface?: number;
  frequency: "immediate" | "daily" | "weekly";
  enabled: boolean;
  createdAt: string;
};

type SavedSearch = {
  id: string;
  userId: string;
  name: string;
  filters: RealEstateFilters;
  alertsEnabled: boolean;
  createdAt: string;
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  listingId: string;
  listingType: "real_estate";
  body: string;
  status: "sent" | "read" | "replied" | "archived";
  createdAt: string;
};

type Conversation = {
  id: string;
  listingId: string;
  listingType: "real_estate";
  clientUserId: string;
  advertiserId: string;
  lastMessage: string;
  unreadCountForAdvertiser: number;
  unreadCountForClient: number;
  status: "new" | "open" | "waiting" | "closed" | "archived";
  updatedAt: string;
};

type EmailNotification = {
  id: string;
  receiverId: string;
  conversationId?: string;
  listingId?: string;
  type: "new_message" | "new_visit_request" | "new_contact";
  sentTo: string;
  subject: string;
  preview: string;
  status: "pending" | "sent" | "failed";
  createdAt: string;
};

type VisitRequest = {
  id: string;
  listingId: string;
  listingTitle: string;
  clientUserId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  advertiserId: string;
  city?: string;
  district?: string;
  requestedDate?: string;
  requestedTime?: string;
  message?: string;
  status: VisitRequestStatus;
  conversationId?: string;
  createdAt: string;
};

type ListingReport = {
  id: string;
  listingId: string;
  userId?: string;
  reason: "suspicious" | "wrong_price" | "fake_photos" | "unavailable" | "wrong_contact" | "other";
  message?: string;
  status: "new" | "reviewed" | "closed";
  createdAt: string;
};

type ListingAnalyticsEvent = {
  id: string;
  listingId: string;
  eventType:
    | "view"
    | "detail_click"
    | "favorite_add"
    | "favorite_remove"
    | "whatsapp_click"
    | "phone_click"
    | "email_click"
    | "message_modal_open"
    | "message_sent"
    | "visit_request_open"
    | "visit_request_sent"
    | "share"
    | "report";
  userId?: string;
  createdAt: string;
};

type ListingCompletionScore = {
  total: number;
  photos: boolean;
  clearTitle: boolean;
  completeDescription: boolean;
  price: boolean;
  location: boolean;
  surface: boolean;
  bedrooms: boolean;
  conditions: boolean;
  contactPreferences: boolean;
  documents?: boolean;
};

type ListingPerformanceStats = {
  listingId: string;
  title: string;
  views: number;
  detailClicks: number;
  generatedContacts: number;
  messages: number;
  whatsappClicks: number;
  phoneClicks: number;
  emailClicks: number;
  visitRequests: number;
  favorites: number;
  contactRate: number;
  status: ListingStatus;
  city?: string;
  propertyType?: string;
  contacts: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  completionScore: number | ListingCompletionScore;
};

type ContactStats = {
  totalRequests: number;
  unreadContacts: number;
  openConversations: number;
  averageResponseTimeMinutes: number;
  whatsappClicks: number;
  phoneClicks: number;
  emailClicks: number;
  formsSent: number;
};

type RealEstateStats = {
  totalViews: number;
  detailClicks: number;
  contacts: number;
  messages: number;
  visitRequests: number;
  favorites: number;
  whatsappClicks: number;
  phoneClicks: number;
  emailClicks: number;
  viewToContactRate: number;
  detailToContactRate: number;
  averageResponseTimeMinutes?: number;
};

type RealEstateDashboardStats = {
  activeListings: number;
  pendingListings: number;
  expiredListings: number;
  totalViews: number;
  detailClicks: number;
  favorites: number;
  favoritesAdded: number;
  messages: number;
  contacts: number;
  requestsReceived: number;
  messagesReceived: number;
  visitRequests: number;
  whatsappClicks: number;
  phoneClicks: number;
  emailClicks: number;
  viewToContactRate: number;
  detailToContactRate: number;
  averageResponseTimeMinutes?: number;
  unreadConversations: number;
  contactStats?: ContactStats;
  listings: ListingPerformanceStats[];
  topListingsCount: number;
  listingsWithoutContactCount: number;
  listingsToImproveCount: number;
};

type AdvertiserMessage = {
  id: string;
  conversationId: string;
  listingId: string;
  listingTitle: string;
  clientName?: string;
  preview: string;
  status: MessageStatus;
  createdAt: string;
};

type AdvertiserContact = {
  id: string;
  listingId: string;
  listingTitle: string;
  source: ContactSource;
  status: LeadStatus;
  createdAt: string;
};

type AdvertiserVisitRequest = {
  id: string;
  listingId: string;
  listingTitle: string;
  clientName?: string;
  requestedDate?: string;
  requestedTime?: string;
  message?: string;
  status: VisitStatus;
  createdAt: string;
};

type RealEstateListingDraft = {
  id?: string;
  transaction?: "location" | "vente" | "achat";
  propertyType?: "appartement" | "maison" | "villa" | "terrain" | "studio" | "chambre" | "bureau" | "commerce";
  location?: {
    country: "SN";
    region?: string;
    department?: string;
    city?: string;
    district?: string;
    addressHint?: string;
    latitude?: number;
    longitude?: number;
    isApproximateLocation: boolean;
  };
  pricing?: {
    price?: number;
    currency: "FCFA";
    pricePeriod?: "month" | "day" | "total";
    negotiable: boolean;
  };
  features?: {
    surface?: number;
    rooms?: number;
    bedrooms?: number;
    bathrooms?: number;
    floor?: number;
    totalFloors?: number;
    furnished?: boolean;
    parking?: boolean;
    balcony?: boolean;
    terrace?: boolean;
    pool?: boolean;
    airConditioning?: boolean;
    securityGuard?: boolean;
    generator?: boolean;
    individualElectricityMeter?: boolean;
    waterAvailable?: boolean;
  };
  photos?: {
    id: string;
    url?: string;
    file?: File;
    isCover: boolean;
    order: number;
  }[];
  content?: {
    title?: string;
    description?: string;
  };
  conditions?: {
    deposit?: number;
    advancePayment?: number;
    agencyFee?: number;
    charges?: number;
    extraFees?: number;
    availableFrom?: string;
    noAgencyFee?: boolean;
    chargesIncluded?: boolean;
    availableImmediately?: boolean;
  };
  documents?: {
    type: "titre_foncier" | "bail" | "deliberation" | "nicad" | "plan" | "building_permit" | "other";
    label: string;
    available: boolean;
    fileUrl?: string;
  }[];
  contactPreferences?: {
    whatsappEnabled: boolean;
    phoneEnabled: boolean;
    emailEnabled: boolean;
    internalMessagingEnabled: boolean;
    contactFormEnabled: boolean;
    visitRequestEnabled: boolean;
    emailNotificationsEnabled: boolean;
    whatsappNumber?: string;
    phoneNumber?: string;
    contactEmail?: string;
    notificationEmail?: string;
    preferredContactMethod?: "whatsapp" | "phone" | "email" | "internal_message" | "form";
  };
  status: "draft" | "pending_review" | "active" | "suspended" | "expired" | "deleted";
  completionScore?: number;
  createdAt?: string;
  updatedAt?: string;
};

type ListingTransaction = "location" | "vente" | "achat";
type PropertyType = "appartement" | "maison" | "villa" | "terrain" | "studio" | "chambre" | "bureau" | "commerce";

type ListingQuickStats = {
  views: number;
  detailClicks: number;
  contacts: number;
  messages: number;
  favorites: number;
  visitRequests: number;
  whatsappClicks: number;
  phoneClicks: number;
  emailClicks: number;
  viewToContactRate: number;
  detailToContactRate: number;
  averageResponseTimeMinutes?: number;
};

type AdvertiserListingSummary = {
  id: string;
  title: string;
  status: ListingStatus;
  transaction: ListingTransaction;
  propertyType: PropertyType;
  city?: string;
  district?: string;
  region?: string;
  price?: number;
  currency: "FCFA";
  coverPhoto?: string;
  completionScore: number;
  quickStats: ListingQuickStats;
  recommendations?: string[];
  createdAt: string;
  updatedAt?: string;
};

type ListingFilters = {
  query?: string;
  status?: ListingStatus | "all";
  transaction?: ListingTransaction | "all";
  propertyType?: PropertyType | "all";
  region?: string;
  city?: string;
  period?: "today" | "7d" | "30d" | "90d" | "all";
  performance?: "all" | "most_viewed" | "most_contacted" | "no_contact" | "needs_improvement";
};

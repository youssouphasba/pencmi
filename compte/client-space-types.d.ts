type ClientActivityModule =
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "vehicle_rental"
  | "vehicle_chauffeur"
  | "trips";

type ClientRequestStatus =
  | "new"
  | "pending"
  | "accepted"
  | "refused"
  | "cancelled"
  | "completed"
  | "expired";

type ClientFavorite = {
  id: string;
  userId: string;
  module: ClientActivityModule;
  listingId: string;
  listingTitle: string;
  city?: string;
  price?: number;
  createdAt: string;
};

type ClientSavedAlert = {
  id: string;
  userId: string;
  module: ClientActivityModule;
  name: string;
  criteriaSummary: string;
  frequency: "immediate" | "daily" | "weekly";
  enabled: boolean;
  createdAt: string;
};

type ClientConversation = {
  id: string;
  userId: string;
  module: ClientActivityModule;
  listingId?: string;
  listingTitle?: string;
  advertiserName?: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: string;
};

type ClientRequestSummary = {
  id: string;
  userId: string;
  module: ClientActivityModule;
  listingId?: string;
  listingTitle?: string;
  advertiserName?: string;
  status: ClientRequestStatus;
  dateLabel?: string;
  priceEstimate?: number;
  createdAt: string;
};

type ClientNotificationPreferences = {
  internalNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  savedSearchAlerts: boolean;
  messageNotifications: boolean;
  requestStatusUpdates: boolean;
  reminders: boolean;
  recommendations: boolean;
  priceDropAlerts: boolean;
  marketingEmails: boolean;
};

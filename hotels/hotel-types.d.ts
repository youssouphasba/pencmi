type HotelType =
  | "hotel"
  | "auberge"
  | "residence"
  | "appartement_meuble"
  | "maison_hotes"
  | "villa"
  | "campement"
  | "chambre_habitant";

type HotelStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "suspended"
  | "expired"
  | "deleted";

type RoomAvailabilityStatus =
  | "available"
  | "limited"
  | "full"
  | "closed"
  | "maintenance"
  | "on_request";

type AvailabilityManagementMode =
  | "manual"
  | "semi_automatic"
  | "automatic";

type ReservationStatus =
  | "new"
  | "pending"
  | "accepted"
  | "refused"
  | "cancelled"
  | "completed"
  | "expired";

type HotelContactPreferences = {
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  emailEnabled: boolean;
  internalMessagingEnabled: boolean;
  contactFormEnabled: boolean;
  reservationRequestEnabled: boolean;
  emailNotificationsEnabled: boolean;
  whatsappNumber?: string;
  phoneNumber?: string;
  contactEmail?: string;
  notificationEmail?: string;
  preferredContactMethod?: "whatsapp" | "phone" | "email" | "internal_message" | "form";
};

type HotelAvailabilitySettings = {
  hotelId: string;
  mode: AvailabilityManagementMode;
  allowTemporaryLock: boolean;
  temporaryLockDurationMinutes?: 15 | 30 | 60 | 1440;
  updateStockOnAcceptedReservation: boolean;
  showRemainingRoomsToClients: boolean;
};

type HotelListing = {
  id: string;
  name: string;
  type: HotelType;
  description?: string;
  stars?: 1 | 2 | 3 | 4 | 5;
  status: HotelStatus;
  region?: string;
  city?: string;
  district?: string;
  priceFrom?: number;
  currency: "FCFA";
  photos?: string[];
  amenities?: string[];
  contactPreferences: HotelContactPreferences;
  availabilitySettings?: HotelAvailabilitySettings;
  createdAt: string;
  updatedAt?: string;
};

type HotelRoomOption = {
  id: string;
  hotelId: string;
  name: string;
  description?: string;
  capacity: number;
  adults?: number;
  children?: number;
  beds?: number;
  bedType?: "single" | "double" | "queen" | "king" | "twin" | "mixed";
  privateBathroom?: boolean;
  pricePerNight?: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  totalUnits: number;
  availableUnits?: number;
  amenities?: string[];
  status: RoomAvailabilityStatus;
};

type RoomAvailabilityByDate = {
  id: string;
  roomOptionId: string;
  date: string;
  totalUnits: number;
  availableUnits: number;
  bookedUnits: number;
  blockedUnits: number;
  pricePerNight?: number;
  status: RoomAvailabilityStatus;
};

type HotelReservationRequest = {
  id: string;
  hotelId: string;
  roomOptionId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  adults?: number;
  children?: number;
  roomsRequested?: number;
  estimatedPrice?: number;
  message?: string;
  status: ReservationStatus;
  availabilityLocked?: boolean;
  lockExpiresAt?: string;
  createdAt: string;
};

type HotelSavedAlert = {
  id: string;
  userId: string;
  name: string;
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  maxPrice?: number;
  hotelType?: HotelType;
  enabled: boolean;
  createdAt: string;
};

type HotelStats = {
  views: number;
  detailClicks: number;
  favorites: number;
  contacts: number;
  messages: number;
  reservationRequests: number;
  acceptedReservations: number;
  occupancyRate: number;
  viewToReservationRate: number;
  viewToContactRate: number;
  averageResponseTimeMinutes?: number;
};

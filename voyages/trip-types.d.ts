type TripVehicleType =
  | "bus"
  | "car"
  | "minibus"
  | "sept_places"
  | "voiture_particuliere"
  | "covoiturage"
  | "vehicule_avec_chauffeur";

type TripStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "full"
  | "cancelled"
  | "expired"
  | "deleted";

type TripAdvertiserType =
  | "particulier"
  | "chauffeur_professionnel"
  | "agence_transport"
  | "gare_routiere"
  | "transporteur";

type TripContactSource =
  | "whatsapp"
  | "phone"
  | "email"
  | "internal_message"
  | "form"
  | "reservation_request";

type TripReservationStatus =
  | "new"
  | "pending"
  | "accepted"
  | "refused"
  | "cancelled"
  | "completed";

type TripContactPreferences = {
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

type TripListing = {
  id: string;
  title: string;
  vehicleType: TripVehicleType;
  status: TripStatus;
  departureCity: string;
  arrivalCity: string;
  departurePoint?: string;
  arrivalPoint?: string;
  departureDate?: string;
  departureTime?: string;
  estimatedArrivalTime?: string;
  estimatedDuration?: string;
  pricePerSeat?: number;
  currency: "FCFA";
  availableSeats?: number;
  totalSeats?: number;
  luggageAllowed?: boolean;
  largeLuggageAllowed?: boolean;
  airConditioning?: boolean;
  directTrip?: boolean;
  limitedStops?: boolean;
  advertiserType?: TripAdvertiserType;
  contactPreferences: TripContactPreferences;
  createdAt: string;
  updatedAt?: string;
};

type TripReservationRequest = {
  id: string;
  tripId: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  requestedSeats: number;
  luggage?: boolean;
  message?: string;
  status: TripReservationStatus;
  createdAt: string;
};

type TripAlert = {
  id: string;
  userId: string;
  departureCity?: string;
  arrivalCity?: string;
  date?: string;
  passengers?: number;
  maxPrice?: number;
  vehicleType?: TripVehicleType;
  preferredTime?: "morning" | "afternoon" | "evening" | "night";
  enabled: boolean;
  createdAt: string;
};

type TripStats = {
  views: number;
  detailClicks: number;
  favorites: number;
  contacts: number;
  messages: number;
  reservationRequests: number;
  requestedSeats: number;
  whatsappClicks: number;
  phoneClicks: number;
  emailClicks: number;
  viewToRequestRate: number;
  viewToContactRate: number;
  averageResponseTimeMinutes?: number;
};

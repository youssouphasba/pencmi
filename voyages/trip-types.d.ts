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
  | "refused"
  | "suspended"
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
  | "seat_request"
  | "reservation_request";

type TripReservationStatus =
  | "new"
  | "pending"
  | "accepted"
  | "refused"
  | "cancelled"
  | "completed"
  | "expired"
  | "requires_more_info";

type TripOccurrence = {
  id: string;
  tripId?: string;
  serviceDate: string;
  departureAt: string;
  estimatedArrivalAt?: string | null;
  totalCapacity?: number;
  offeredSeats?: number;
  confirmedSeats?: number;
  remainingSeats: number;
  pricePerSeat: number;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
};

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
  occurrenceId?: string | null;
  occurrences?: TripOccurrence[];
  moderationReason?: string | null;
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
  availableSeats?: number | null;
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
  occurrenceId?: string | null;
  occurrence?: TripOccurrence | null;
  allocatedSeats?: number | null;
  quotedPricePerSeat?: number | null;
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
  totalRequests: number;
  requestedSeats: number;
  confirmedSeats: number;
  directContacts: number;
  inboundMessages: number;
  requestsByStatus: Partial<Record<TripReservationStatus, number>>;
  contactsBySource: Partial<Record<TripContactSource, number>>;
  historicalUnallocatedRequests: number;
  unavailableMetrics: string[];
};

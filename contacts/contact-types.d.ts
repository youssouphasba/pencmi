type ContactPreferences = {
  whatsappEnabled: boolean;
  phoneEnabled: boolean;
  emailEnabled: boolean;
  internalMessagingEnabled: boolean;
  contactFormEnabled: boolean;
  visitRequestEnabled?: boolean;
  reservationRequestEnabled?: boolean;
  seatRequestEnabled?: boolean;
  emailNotificationsEnabled: boolean;
  automaticEmailsEnabled: boolean;
  whatsappNumber?: string;
  phoneNumber?: string;
  contactEmail?: string;
  notificationEmail?: string;
  preferredContactMethod?: "whatsapp" | "phone" | "email" | "internal_message" | "form";
};

type ContactStatus =
  | "new"
  | "read"
  | "replied"
  | "closed";

type PencmiContact = {
  id: string;
  module: PencmiModule;
  listingId: string;
  listingTitle: string;
  advertiserId: string;
  clientUserId?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  source: ContactChannel;
  status: ContactStatus;
  message?: string;
  conversationId?: string;
  requestId?: string;
  emailNotificationId?: string;
  createdAt: string;
  updatedAt?: string;
};

type EmailTemplateModule =
  | "real_estate"
  | "hotels"
  | "vehicle_sale"
  | "vehicle_rental"
  | "vehicle_chauffeur"
  | "trips";

type EmailTemplateTrigger =
  | "request_received"
  | "request_accepted"
  | "request_refused"
  | "request_cancelled"
  | "request_expired"
  | "message_received"
  | "visit_proposed"
  | "visit_confirmed"
  | "visit_cancelled"
  | "arrival_reminder"
  | "departure_reminder"
  | "post_service_message"
  | "price_drop_alert"
  | "schedule_changed";

type AutomaticEmailTemplate = {
  id: string;
  advertiserId: string;
  module: EmailTemplateModule;
  trigger: EmailTemplateTrigger;
  enabled: boolean;
  subject: string;
  body: string;
  delayValue?: number;
  delayUnit?: "minutes" | "hours" | "days";
  sendBeforeOrAfter?: "before" | "after";
  replyToEmail?: string;
  includeWhatsappLink?: boolean;
  includePhoneNumber?: boolean;
  useDefaultTemplate?: boolean;
  createdAt: string;
  updatedAt?: string;
};

type EmailLog = {
  id: string;
  advertiserId?: string;
  clientUserId?: string;
  module: EmailTemplateModule;
  listingId?: string;
  requestId?: string;
  conversationId?: string;
  recipientEmail: string;
  subject: string;
  preview: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  createdAt: string;
  sentAt?: string;
};

type RealEstateEmailVariable =
  | "clientName"
  | "listingTitle"
  | "propertyType"
  | "transaction"
  | "city"
  | "district"
  | "price"
  | "visitDate"
  | "visitTime"
  | "advertiserName"
  | "advertiserPhone"
  | "advertiserWhatsapp"
  | "conversationLink";

type HotelEmailVariable =
  | "clientName"
  | "hotelName"
  | "roomName"
  | "checkIn"
  | "checkOut"
  | "nights"
  | "adults"
  | "children"
  | "roomsRequested"
  | "estimatedPrice"
  | "reservationStatus"
  | "availabilityStatus"
  | "hotelPhone"
  | "hotelWhatsapp"
  | "hotelEmail"
  | "reservationLink"
  | "conversationLink";

type VehicleSaleEmailVariable =
  | "clientName"
  | "vehicleTitle"
  | "brand"
  | "model"
  | "year"
  | "mileage"
  | "fuel"
  | "gearbox"
  | "price"
  | "city"
  | "sellerName"
  | "sellerPhone"
  | "sellerWhatsapp"
  | "listingLink"
  | "conversationLink";

type VehicleRentalEmailVariable =
  | "clientName"
  | "vehicleTitle"
  | "brand"
  | "model"
  | "pickupDate"
  | "returnDate"
  | "rentalDays"
  | "pricePerDay"
  | "estimatedPrice"
  | "deposit"
  | "includedMileage"
  | "pickupLocation"
  | "returnLocation"
  | "rentalStatus"
  | "renterPhone"
  | "renterWhatsapp"
  | "conversationLink";

type ChauffeurEmailVariable =
  | "clientName"
  | "vehicleTitle"
  | "driverName"
  | "serviceType"
  | "pickupLocation"
  | "destination"
  | "serviceDate"
  | "serviceTime"
  | "estimatedPrice"
  | "driverPhone"
  | "driverWhatsapp"
  | "requestStatus"
  | "conversationLink";

type TripEmailVariable =
  | "clientName"
  | "departureCity"
  | "arrivalCity"
  | "departurePoint"
  | "arrivalPoint"
  | "departureDate"
  | "departureTime"
  | "requestedSeats"
  | "pricePerSeat"
  | "estimatedPrice"
  | "luggage"
  | "transportProviderName"
  | "transportProviderPhone"
  | "transportProviderWhatsapp"
  | "tripStatus"
  | "reservationStatus"
  | "conversationLink";

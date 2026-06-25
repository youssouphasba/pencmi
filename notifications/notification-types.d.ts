type NotificationAudience = "advertiser" | "client";

type NotificationModule =
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "vehicle_sale"
  | "vehicle_rental"
  | "vehicle_chauffeur"
  | "trips"
  | "system";

type NotificationType =
  | "new_message"
  | "new_contact"
  | "new_visit_request"
  | "visit_proposed"
  | "visit_confirmed"
  | "visit_cancelled"
  | "new_reservation_request"
  | "reservation_accepted"
  | "reservation_refused"
  | "reservation_cancelled"
  | "reservation_expired"
  | "arrival_today"
  | "departure_today"
  | "availability_low"
  | "availability_full"
  | "availability_needs_update"
  | "new_rental_request"
  | "rental_accepted"
  | "rental_refused"
  | "rental_cancelled"
  | "rental_pickup_reminder"
  | "rental_return_reminder"
  | "new_chauffeur_request"
  | "chauffeur_accepted"
  | "chauffeur_refused"
  | "chauffeur_cancelled"
  | "chauffeur_service_reminder"
  | "new_seat_request"
  | "seat_request_accepted"
  | "seat_request_refused"
  | "trip_cancelled"
  | "trip_schedule_changed"
  | "trip_full"
  | "departure_reminder"
  | "listing_favorited"
  | "listing_incomplete"
  | "listing_pending_review"
  | "listing_expired"
  | "listing_suspended"
  | "email_failed"
  | "contact_settings_incomplete"
  | "verification_submitted"
  | "verification_accepted"
  | "verification_refused"
  | "verification_changes_requested"
  | "verification_document_refused"
  | "verification_badge_granted"
  | "verification_account_suspended"
  | "report_received"
  | "report_in_review"
  | "report_resolved"
  | "report_rejected"
  | "listing_reported"
  | "moderation_correction_requested"
  | "moderation_listing_suspended"
  | "moderation_listing_reactivated"
  | "moderation_account_suspended"
  | "moderation_verification_requested"
  | "urgent_report_created"
  | "multiple_reports_detected"
  | "message_reported"
  | "user_reported"
  | "saved_search_alert"
  | "system";

type NotificationPriority =
  | "low"
  | "normal"
  | "important"
  | "urgent";

type NotificationStatus =
  | "unread"
  | "read"
  | "archived";

type PencmiNotification = {
  id: string;
  audience: NotificationAudience;
  userId: string;
  module: NotificationModule;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  targetUrl?: string;
  relatedListingId?: string;
  relatedConversationId?: string;
  relatedRequestId?: string;
  createdAt: string;
  readAt?: string;
};

type NotificationBadgeSummary = {
  totalUnread: number;
  unreadMessages: number;
  unreadContacts: number;
  pendingReservations: number;
  pendingVisits: number;
  pendingSeatRequests: number;
  availabilityAlerts: number;
  incompleteListings: number;
  failedEmails: number;
};

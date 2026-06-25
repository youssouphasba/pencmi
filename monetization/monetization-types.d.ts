type MonetizationModule =
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "vehicle_sale"
  | "vehicle_rental"
  | "vehicle_chauffeur"
  | "trips"
  | "general";

type BillingPlanStatus =
  | "draft"
  | "active"
  | "inactive"
  | "archived";

type BillingPeriod =
  | "monthly"
  | "yearly"
  | "one_time";

type CurrencyCode =
  | "XOF"
  | "EUR"
  | "USD";

type BillingPlan = {
  id: string;
  name: string;
  description?: string;
  status: BillingPlanStatus;
  price: number;
  currency: CurrencyCode;
  period: BillingPeriod;
  includedModules: MonetizationModule[];
  maxActiveListings?: number;
  maxPhotosPerListing?: number;
  includesAdvancedStats: boolean;
  includesBoosts: boolean;
  includesPrioritySupport: boolean;
  features: string[];
  order: number;
  createdAt: string;
  updatedAt?: string;
};

type AdvertiserSubscriptionStatus =
  | "none"
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

type AdvertiserSubscription = {
  id: string;
  advertiserId: string;
  planId: string;
  status: AdvertiserSubscriptionStatus;
  startedAt?: string;
  endsAt?: string;
  renewalAt?: string;
};

type BoostStatus =
  | "draft"
  | "pending_payment"
  | "scheduled"
  | "active"
  | "ended"
  | "cancelled"
  | "refused";

type ListingBoost = {
  id: string;
  advertiserId: string;
  listingId: string;
  module: MonetizationModule;
  status: BoostStatus;
  durationDays: number;
  visibilityAreaType: "country" | "region" | "department" | "city" | "district";
  visibilityAreaSlug?: string;
  startsAt?: string;
  endsAt?: string;
  price?: number;
  currency?: CurrencyCode;
  createdAt: string;
};

type SponsoredPlacement =
  | "home"
  | "module_page"
  | "search_results_top"
  | "city_page"
  | "category_page"
  | "similar_listings";

type SponsoredListingStatus =
  | "draft"
  | "pending_review"
  | "pending_payment"
  | "active"
  | "ended"
  | "refused"
  | "suspended";

type SponsoredListing = {
  id: string;
  advertiserId: string;
  listingId: string;
  module: MonetizationModule;
  placement: SponsoredPlacement;
  status: SponsoredListingStatus;
  startsAt?: string;
  endsAt?: string;
  price?: number;
  currency?: CurrencyCode;
  adminMessage?: string;
  createdAt: string;
};

type PaymentProvider =
  | "stripe"
  | "wave"
  | "orange_money"
  | "free_money"
  | "paydunya"
  | "cinetpay"
  | "flutterwave"
  | "bank_transfer"
  | "manual";

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";

type BillingInvoice = {
  id: string;
  invoiceNumber: string;
  advertiserId: string;
  type: "subscription" | "boost" | "sponsored" | "premium_option" | "manual";
  amount: number;
  currency: CurrencyCode;
  status: PaymentStatus;
  provider?: PaymentProvider;
  issuedAt: string;
  paidAt?: string;
};

type PromotionStatus =
  | "draft"
  | "active"
  | "inactive"
  | "expired";

type Promotion = {
  id: string;
  name: string;
  code?: string;
  description?: string;
  status: PromotionStatus;
  type: "percentage" | "fixed_amount" | "free_period" | "free_boost";
  value: number;
  currency?: CurrencyCode;
  startsAt?: string;
  endsAt?: string;
  applicableModules: MonetizationModule[];
  applicablePlanIds?: string[];
};

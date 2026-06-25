type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "warning"
  | "link";

type ButtonSize = "sm" | "md" | "lg";

type BadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "verified"
  | "pending"
  | "inactive";

type LayoutContext =
  | "public"
  | "search"
  | "detail"
  | "dashboard"
  | "client"
  | "admin"
  | "legal"
  | "auth";

type NavigationItem = {
  label: string;
  href: string;
  icon?: string;
  badgeCount?: number;
  active?: boolean;
  children?: NavigationItem[];
};

type EmptyStateProps = {
  title: string;
  description?: string;
  primaryActionLabel?: string;
  primaryActionHref?: string;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
};

type SearchFiltersProps = {
  title?: string;
  content?: string;
  actions?: string;
};

type ListingCardProps = {
  title: string;
  subtitle?: string;
  meta?: [string, string][];
  badges?: { label: string; variant?: BadgeVariant }[];
  actions?: string;
  href?: string;
};

type StatusOption = {
  value: string;
  label: string;
  variant: BadgeVariant;
};

type DesignColorTokens = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
};

type DesignTypographyTokens = {
  h1: string;
  h2: string;
  h3: string;
  body: string;
  small: string;
  label: string;
};

type DesignSystemRoute = {
  key: string;
  href: string;
};

type DesignSystemFooterColumn = {
  title: string;
  links: NavigationItem[];
};

type ContactButtonType =
  | "whatsapp"
  | "phone"
  | "email"
  | "message"
  | "visit"
  | "reservation"
  | "seat"
  | "rental"
  | "chauffeur";

type DashboardSidebarContext =
  | "client"
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "trips"
  | "admin";

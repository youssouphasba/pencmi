type ContentStatus =
  | "draft"
  | "published"
  | "unpublished"
  | "needs_review";

type ContentPageSlug =
  | "conditions"
  | "confidentialite"
  | "mentions-legales"
  | "aide"
  | "contact"
  | "securite"
  | "regles-publication"
  | "conseils-anti-arnaque"
  | "support";

type ContentSectionType =
  | "paragraph"
  | "bullet_list"
  | "warning"
  | "tip"
  | "faq"
  | "button"
  | "link";

type ContentModule =
  | "general"
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "trips";

type AdminContentPage = {
  id: string;
  slug: ContentPageSlug;
  title: string;
  seoTitle?: string;
  seoDescription?: string;
  subtitle?: string;
  status: ContentStatus;
  sections: AdminContentSection[];
  updatedBy?: string;
  updatedAt?: string;
  createdAt: string;
};

type AdminContentSection = {
  id: string;
  pageId: string;
  type: ContentSectionType;
  title?: string;
  subtitle?: string;
  body?: string;
  items?: string[];
  linkLabel?: string;
  linkUrl?: string;
  order: number;
  status: ContentStatus;
};

type ContentVersion = {
  id: string;
  pageId: string;
  versionNumber: number;
  title: string;
  sections: AdminContentSection[];
  status: ContentStatus;
  note?: string;
  createdBy?: string;
  createdAt: string;
};

type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  module?: ContentModule;
  status: ContentStatus;
  order: number;
};

type SafetyTip = {
  id: string;
  title: string;
  body: string;
  module: ContentModule;
  importance: "info" | "important" | "urgent";
  status: ContentStatus;
  order: number;
};

type PublishingRule = {
  id: string;
  title: string;
  description: string;
  module: ContentModule;
  status: ContentStatus;
  order: number;
};

type AntiScamTip = {
  id: string;
  title: string;
  body: string;
  module: ContentModule;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: ContentStatus;
  order: number;
};

type SupportCategory = {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  order: number;
  destinationEmail?: string;
};

type FooterLink = {
  id: string;
  label: string;
  url: string;
  column: string;
  order: number;
  active: boolean;
};

type SupportTicketStatus =
  | "new"
  | "in_progress"
  | "waiting_user"
  | "resolved"
  | "closed";

type SupportTicketPriority =
  | "low"
  | "normal"
  | "important"
  | "urgent";

type SupportTicket = {
  id: string;
  userId?: string;
  subject: string;
  category: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  lastMessage?: string;
  assignedAdminId?: string;
  createdAt: string;
  updatedAt?: string;
};

type SupportMessage = {
  id: string;
  ticketId: string;
  senderRole: "user" | "support" | "admin" | "system";
  body: string;
  internalNote?: boolean;
  createdAt: string;
};

type GeoModule =
  | "platform"
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "trips"
  | "help"
  | "security"
  | "legal";

type GeoEntityType =
  | "platform"
  | "module"
  | "category"
  | "listing_type"
  | "location"
  | "region"
  | "department"
  | "city"
  | "district"
  | "station"
  | "vehicle_brand"
  | "vehicle_model"
  | "transport_type"
  | "hotel_type"
  | "property_type"
  | "guide"
  | "faq";

type GeoContentStatus =
  | "draft"
  | "published"
  | "unpublished"
  | "needs_review";

type GeoEntity = {
  id: string;
  name: string;
  slug: string;
  type: GeoEntityType;
  module?: GeoModule;
  shortDescription?: string;
  longDescription?: string;
  synonyms: string[];
  relatedPageUrls: string[];
  isPublic: boolean;
  isIndexable: boolean;
  status: GeoContentStatus;
  updatedAt?: string;
};

type GeoQuestion = {
  id: string;
  question: string;
  shortAnswer: string;
  detailedAnswer?: string;
  module: GeoModule;
  locationSlug?: string;
  relatedEntities: string[];
  relatedPageUrls: string[];
  status: GeoContentStatus;
  updatedAt?: string;
};

type GeoTemplate = {
  id: string;
  name: string;
  module: GeoModule;
  templateType:
    | "platform_summary"
    | "module_summary"
    | "category_summary"
    | "location_summary"
    | "route_summary"
    | "faq_answer"
    | "guide_intro"
    | "safety_block"
    | "comparison_block"
    | "contact_block";
  bodyTemplate: string;
  variables: string[];
  status: GeoContentStatus;
  updatedAt?: string;
};

type GeoGuidePage = {
  id: string;
  slug: string;
  title: string;
  module: GeoModule;
  intro: string;
  sections: GeoGuideSection[];
  relatedQuestions: string[];
  relatedEntities: string[];
  status: GeoContentStatus;
  updatedAt?: string;
};

type GeoGuideSection = {
  id: string;
  title: string;
  body: string;
  order: number;
};

type GeoPublicFile = {
  id: string;
  path: string;
  fileType:
    | "llms_txt"
    | "ai_txt"
    | "platform_summary_json"
    | "public_entities_json"
    | "public_routes_json";
  contentPreview?: string;
  lastGeneratedAt?: string;
  status: GeoContentStatus;
};

type GeoAuditIssue = {
  id: string;
  path?: string;
  entityId?: string;
  issueType:
    | "missing_geo_summary"
    | "missing_short_answer"
    | "missing_entity_description"
    | "missing_synonyms"
    | "missing_internal_links"
    | "private_content_exposed"
    | "outdated_geo_file"
    | "unpublished_important_content";
  severity: "low" | "medium" | "high";
  message: string;
};

type GeoAnswerFormat = {
  oneSentence: string;
  shortAnswer: string;
  detailedAnswer: string;
  keyServices: string[];
  importantLinks: string[];
  safetyNotes: string[];
};

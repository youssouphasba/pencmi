type SeoModule =
  | "home"
  | "real_estate"
  | "hotels"
  | "vehicles"
  | "trips"
  | "help"
  | "legal"
  | "security"
  | "support";

type SeoPageType =
  | "home"
  | "module"
  | "category"
  | "location"
  | "category_location"
  | "listing_detail"
  | "brand"
  | "brand_model"
  | "route"
  | "faq"
  | "article"
  | "legal"
  | "support";

type SeoIndexingStatus =
  | "index"
  | "noindex"
  | "auto";

type SeoCanonicalStrategy =
  | "self"
  | "parent"
  | "module"
  | "custom";

type SeoMeta = {
  id: string;
  module: SeoModule;
  pageType: SeoPageType;
  path: string;
  title: string;
  description: string;
  h1: string;
  canonicalUrl?: string;
  indexing: SeoIndexingStatus;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  schemaType?: string;
  updatedAt?: string;
};

type SeoTemplate = {
  id: string;
  name: string;
  module: SeoModule;
  pageType: SeoPageType;
  titleTemplate: string;
  descriptionTemplate: string;
  h1Template: string;
  introTemplate?: string;
  canonicalStrategy: SeoCanonicalStrategy;
  indexing: SeoIndexingStatus;
  variables: string[];
  active: boolean;
  updatedAt?: string;
};

type SeoSlug = {
  id: string;
  entityType:
    | "location"
    | "category"
    | "listing"
    | "brand"
    | "model"
    | "route"
    | "article";
  entityId: string;
  slug: string;
  previousSlugs?: string[];
  active: boolean;
};

type SeoLocationLevel =
  | "country"
  | "region"
  | "department"
  | "city"
  | "district"
  | "station";

type SeoLocation = {
  id: string;
  name: string;
  slug: string;
  level: SeoLocationLevel;
  parentId?: string;
  regionSlug?: string;
  departmentSlug?: string;
  citySlug?: string;
  districtSlug?: string;
  isIndexable: boolean;
};

type SeoRedirect = {
  id: string;
  fromPath: string;
  toPath: string;
  type: 301 | 302;
  active: boolean;
  createdAt: string;
};

type SitemapEntry = {
  path: string;
  lastModified?: string;
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
  indexable: boolean;
};

type SeoAuditIssue = {
  id: string;
  path: string;
  module: SeoModule;
  issueType:
    | "missing_title"
    | "missing_description"
    | "missing_h1"
    | "missing_canonical"
    | "duplicate_title"
    | "thin_content"
    | "noindex_unexpected"
    | "sitemap_missing"
    | "schema_missing";
  severity: "low" | "medium" | "high";
  message: string;
};

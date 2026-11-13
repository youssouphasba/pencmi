/** The editable public pages. Each one has default text in the frontend until an admin publishes a version. */
export const CONTENT_PAGE_SLUGS = [
  'conditions',
  'confidentialite',
  'mentions-legales',
  'securite',
  'regles-publication',
  'conseils-anti-arnaque',
] as const;
export type ContentPageSlug = (typeof CONTENT_PAGE_SLUGS)[number];

export const FAQ_CATEGORIES = [
  'account',
  'search',
  'contact',
  'saved',
  'real_estate',
  'hotels',
  'vehicles',
  'trips',
  'publish',
  'verification',
  'safety',
  'notifications',
] as const;

export const MAX_CONTENT_SECTIONS = 40;
export const MAX_SECTION_BODY = 8000;
export const MAX_FAQ_ITEMS = 300;
export const CONTENT_VERSIONS_KEPT = 30;

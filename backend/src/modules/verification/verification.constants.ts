import { UserRole } from '../../common/constants/roles';

export const VERIFICATION_DOCUMENT_TYPES = [
  'identity',
  'business_registration',
  'ninea',
  'professional_card',
  'address_proof',
  'hotel_operation_document',
  'driving_license',
  'vehicle_registration',
  'insurance',
  'transport_authorization',
  'other',
] as const;
export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export const VERIFICATION_DOCUMENT_LABELS: Record<VerificationDocumentType, string> = {
  identity: 'Pièce d’identité',
  business_registration: 'Registre de commerce (RCCM)',
  ninea: 'NINEA',
  professional_card: 'Carte professionnelle',
  address_proof: 'Justificatif d’adresse',
  hotel_operation_document: 'Autorisation d’exploitation hôtelière',
  driving_license: 'Permis de conduire',
  vehicle_registration: 'Carte grise',
  insurance: 'Attestation d’assurance',
  transport_authorization: 'Autorisation de transport',
  other: 'Autre document',
};

/** The documents an admin needs to vouch for each kind of professional. */
export const REQUIRED_VERIFICATION_DOCUMENTS: Partial<Record<UserRole, VerificationDocumentType[]>> = {
  advertiser_individual: ['identity'],
  real_estate_agency: ['identity', 'business_registration'],
  hotel_manager: ['identity', 'business_registration'],
  vehicle_renter: ['identity', 'business_registration'],
  vehicle_dealer: ['identity', 'business_registration'],
  chauffeur: ['identity', 'driving_license'],
  transport_provider: ['identity', 'business_registration', 'transport_authorization'],
};

export const MAX_VERIFICATION_DOCUMENTS = 6;
export const VERIFICATION_DECISIONS = ['accepted', 'refused', 'requires_more_info'] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];
export const VERIFICATION_REQUEST_TYPE = 'professional';

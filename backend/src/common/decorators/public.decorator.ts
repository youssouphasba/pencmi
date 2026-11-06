import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const OPTIONAL_AUTH_KEY = 'optionalAuthentication';
export const OptionalAuthentication = () => SetMetadata(OPTIONAL_AUTH_KEY, true);

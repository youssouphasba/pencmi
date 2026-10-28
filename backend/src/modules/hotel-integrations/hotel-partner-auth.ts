import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Request } from 'express';

export const HOTEL_PARTNER_PERMISSIONS = [
  'hotel.property.read', 'hotel.property.write', 'hotel.rooms.write',
  'hotel.rates.write', 'hotel.availability.write', 'hotel.restrictions.write',
  'hotel.requests.read', 'hotel.messages.read', 'hotel.webhooks.manage',
] as const;

export type HotelPartnerPermission = (typeof HOTEL_PARTNER_PERMISSIONS)[number];
export type HotelPartnerContext = { integrationId: string; propertyId: string };
export type HotelPartnerRequest = Request & { hotelPartner?: HotelPartnerContext };
export const HOTEL_PARTNER_PERMISSION = 'hotel-partner-permission';
export const RequireHotelPartnerPermission = (permission: HotelPartnerPermission) =>
  SetMetadata(HOTEL_PARTNER_PERMISSION, permission);
export const CurrentHotelPartner = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<HotelPartnerRequest>().hotelPartner,
);

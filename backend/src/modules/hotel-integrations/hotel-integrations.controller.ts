import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateHotelApiKeyDto, CreateHotelWebhookDto } from './hotel-integrations.dto';
import { HotelIntegrationsService } from './hotel-integrations.service';

@ApiTags('hotel-integrations')
@ApiBearerAuth()
@RequirePermissions('manage_hotels')
@Controller('dashboard/hotels/integrations')
export class HotelIntegrationsController {
  constructor(private readonly service: HotelIntegrationsService) {}

  @Get(':propertyId')
  findForProperty(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string) {
    return this.service.findForProperty(user.id, propertyId);
  }

  @Post(':propertyId/api-keys')
  createApiKey(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Body() dto: CreateHotelApiKeyDto) {
    return this.service.createApiKey(user.id, propertyId, dto);
  }

  @Post(':propertyId/webhooks')
  createWebhook(@CurrentUser() user: AuthenticatedUser, @Param('propertyId') propertyId: string, @Body() dto: CreateHotelWebhookDto) {
    return this.service.createWebhook(user.id, propertyId, dto);
  }
}

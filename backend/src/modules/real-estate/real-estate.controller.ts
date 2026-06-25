import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CreateRealEstateDto, CreateVisitRequestDto, RealEstateSearchDto, UpdateRealEstateDto } from './real-estate.dto';
import { RealEstateService } from './real-estate.service';

@ApiTags('real-estate')
@Controller()
export class RealEstateController {
  constructor(private readonly service: RealEstateService) {}

  @Public()
  @Get('immobilier')
  findPublic(@Query() query: RealEstateSearchDto) {
    return this.service.findPublic(query);
  }

  @Public()
  @Get('immobilier/:id')
  findPublicOne(@Param('id') id: string) {
    return this.service.findPublicOne(id);
  }

  @Public()
  @Post('immobilier/:id/visit-requests')
  createVisitRequest(@Param('id') id: string, @Body() dto: CreateVisitRequestDto) {
    return this.service.createVisitRequest(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Get('dashboard/immobilier')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationDto) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('publish_real_estate')
  @Post('dashboard/immobilier')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRealEstateDto) {
    return this.service.create(user.id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Patch('dashboard/immobilier/:id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRealEstateDto) {
    return this.service.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('manage_real_estate')
  @Delete('dashboard/immobilier/:id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.softDelete(user.id, id);
  }
}

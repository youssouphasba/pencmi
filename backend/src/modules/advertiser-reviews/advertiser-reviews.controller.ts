import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationDto } from '../../common/pagination/pagination.dto';
import { CreateAdvertiserReviewDto, UpdateAdvertiserReviewStatusDto } from './advertiser-reviews.dto';
import { AdvertiserReviewsService } from './advertiser-reviews.service';

@ApiTags('advertiser-reviews')
@Controller()
export class AdvertiserReviewsController {
  constructor(private readonly service: AdvertiserReviewsService) {}

  @Public()
  @Get('professional-profiles/public/:userId/reviews')
  getPublicReviews(@Param('userId') userId: string, @Query() pagination: PaginationDto) {
    return this.service.getPublicReviews(userId, pagination);
  }

  @Public()
  @Post('professional-profiles/public/:userId/reviews')
  createPublicReview(@Param('userId') userId: string, @Body() dto: CreateAdvertiserReviewDto) {
    return this.service.createPublicReview(userId, dto);
  }

  @ApiBearerAuth()
  @Get('dashboard/reviews')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationDto) {
    return this.service.findMine(user.id, pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('access_admin')
  @Get('admin/advertiser-reviews')
  findAllAdmin(@Query() pagination: PaginationDto) {
    return this.service.findAllAdmin(pagination);
  }

  @ApiBearerAuth()
  @RequirePermissions('access_admin')
  @Patch('admin/advertiser-reviews/:id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdvertiserReviewStatusDto,
  ) {
    return this.service.updateStatus(user.id, id, dto);
  }
}

import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Public()
  @Get('plans')
  findPublicPlans() {
    return this.service.findPublicPlans();
  }

  @ApiBearerAuth()
  @Get('dashboard/plans')
  findDashboardPlans() {
    return this.service.findPublicPlans();
  }
}

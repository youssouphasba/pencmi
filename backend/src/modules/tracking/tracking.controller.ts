import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CreateTrackingEventDto } from './tracking.dto';
import { TrackingService } from './tracking.service';

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  @Public()
  @Post('events')
  create(@Body() dto: CreateTrackingEventDto) {
    return this.service.create(dto);
  }
}

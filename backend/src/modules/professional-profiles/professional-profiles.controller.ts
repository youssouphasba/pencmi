import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UpsertProfessionalProfileDto } from './professional-profiles.dto';
import { ProfessionalProfilesService } from './professional-profiles.service';

@ApiTags('professional-profiles')
@ApiBearerAuth()
@Controller('professional-profiles')
export class ProfessionalProfilesController {
  constructor(private readonly service: ProfessionalProfilesService) {}

  @Public()
  @Get('public/:userId')
  findPublic(@Param('userId') userId: string) {
    return this.service.findPublic(userId);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findMine(user.id);
  }

  @Put('me')
  upsertMine(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertProfessionalProfileDto) {
    return this.service.upsertMine(user.id, dto);
  }

  @Post('me/logo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier image n’a été envoyé.');
    }
    return this.service.uploadLogo(user.id, file);
  }

  @Delete('me/logo')
  removeLogo(@CurrentUser() user: AuthenticatedUser) {
    return this.service.removeLogo(user.id);
  }
}

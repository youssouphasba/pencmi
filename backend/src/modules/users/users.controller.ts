import { BadRequestException, Body, Controller, Delete, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { BusinessEmailPreferenceDto, DeleteAccountDto, UpdateUserProfileDto } from './users.dto';
import { UsersService } from './users.service';
import { MAX_PHOTO_BYTES } from '../../files/listing-photo.constants';
import { Throttle } from '@nestjs/throttler';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('me/deletion-blockers')
  deletionBlockers(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deletionBlockers(user.id);
  }

  @Patch('me/business-email-preference')
  businessEmailPreference(@CurrentUser() user: AuthenticatedUser, @Body() dto: BusinessEmailPreferenceDto) {
    return this.usersService.setBusinessEmailPreference(user.id, dto.enabled);
  }

  @Post('me/delete-account')
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  deleteAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeleteAccountDto) {
    return this.usersService.deleteAccount(user.id, user.sessionId, dto.currentPassword);
  }

  @Post('me/avatar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 0 } }))
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier image n’a été envoyé.');
    }
    return this.usersService.uploadAvatar(user.id, file);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.removeAvatar(user.id);
  }
}

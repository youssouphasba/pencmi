import { BadRequestException, Body, Controller, Delete, Get, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { UpdateUserProfileDto } from './users.dto';
import { UsersService } from './users.service';

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

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
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

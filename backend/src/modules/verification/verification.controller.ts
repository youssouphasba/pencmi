import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { MAX_PHOTO_BYTES } from '../../files/listing-photo.constants';
import { MAX_VERIFICATION_DOCUMENTS } from './verification.constants';
import {
  AdminVerificationQuery,
  VerificationDecisionDto,
  VerificationDocumentParams,
  VerificationIdParams,
  VerificationRevokeDto,
  VerificationUserParams,
} from './verification.dto';
import { VerificationService, VerificationUpload } from './verification.service';

@ApiTags('verification')
@ApiBearerAuth()
@Controller('verification')
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.service.mine(user.id);
  }

  /** Multipart: one file per field, the field name being the document type. */
  @Post('requests')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_VERIFICATION_DOCUMENTS, fields: 0, parts: MAX_VERIFICATION_DOCUMENTS },
    }),
  )
  submit(@CurrentUser() user: AuthenticatedUser, @UploadedFiles() files: VerificationUpload[] = []) {
    return this.service.submit(user.id, files);
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('access_admin')
@Controller('admin/verification')
export class AdminVerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get('requests')
  list(@Query() query: AdminVerificationQuery) {
    return this.service.adminList(query);
  }

  @Get('requests/:id')
  detail(@Param() params: VerificationIdParams) {
    return this.service.adminDetail(params.id);
  }

  /** Served as a download, never rendered inline by the admin's browser. */
  @Get('requests/:id/documents/:documentId')
  async document(
    @Param() params: VerificationDocumentParams,
    @CurrentUser() admin: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const { asset, buffer, documentType } = await this.service.adminDocument(admin.id, params.id, params.documentId);
    const extension = asset.mimeType === 'application/pdf' ? 'pdf' : asset.mimeType.split('/')[1];
    response.setHeader('Content-Type', asset.mimeType);
    response.setHeader('Content-Length', String(buffer.length));
    response.setHeader('Content-Disposition', `attachment; filename="${documentType}.${extension}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    response.send(buffer);
  }

  @Patch('requests/:id')
  decide(@Param() params: VerificationIdParams, @Body() dto: VerificationDecisionDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.decide(admin.id, params.id, dto);
  }

  @Post('users/:userId/revoke')
  revoke(@Param() params: VerificationUserParams, @Body() dto: VerificationRevokeDto, @CurrentUser() admin: AuthenticatedUser) {
    return this.service.revoke(admin.id, params.userId, dto);
  }
}

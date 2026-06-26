import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { envSchema } from './config/env.schema';
import { PrismaModule } from './database/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfessionalProfilesModule } from './modules/professional-profiles/professional-profiles.module';
import { AdvertiserReviewsModule } from './modules/advertiser-reviews/advertiser-reviews.module';
import { FilesModule } from './files/files.module';
import { ContentModule } from './modules/content/content.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { HotelIntegrationsModule } from './modules/hotel-integrations/hotel-integrations.module';
import { RealEstateModule } from './modules/real-estate/real-estate.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { TripsModule } from './modules/trips/trips.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EmailsModule } from './modules/emails/emails.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SupportModule } from './modules/support/support.module';
import { SeoModule } from './modules/seo/seo.module';
import { GeoModule } from './modules/geo/geo.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { BillingModule } from './modules/billing/billing.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProfessionalProfilesModule,
    AdvertiserReviewsModule,
    FilesModule,
    ContentModule,
    HotelsModule,
    HotelIntegrationsModule,
    RealEstateModule,
    VehiclesModule,
    TripsModule,
    ConversationsModule,
    NotificationsModule,
    EmailsModule,
    ContactsModule,
    ReportsModule,
    SupportModule,
    SeoModule,
    GeoModule,
    StatisticsModule,
    TrackingModule,
    BillingModule,
    AdminModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}

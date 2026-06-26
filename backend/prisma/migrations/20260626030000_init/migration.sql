-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('client', 'advertiser_individual', 'real_estate_agency', 'hotel_manager', 'vehicle_renter', 'vehicle_dealer', 'chauffeur', 'transport_provider', 'admin');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'pending_verification', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "ProfessionalType" AS ENUM ('real_estate_agency', 'hotel', 'auberge', 'residence', 'vehicle_renter', 'vehicle_dealer', 'chauffeur', 'transport_provider', 'other');

-- CreateEnum
CREATE TYPE "PencmiModule" AS ENUM ('real_estate', 'hotels', 'vehicles', 'trips', 'messages', 'users', 'content', 'support', 'system');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('draft', 'pending_review', 'active', 'refused', 'suspended', 'expired', 'deleted');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('new', 'pending', 'accepted', 'refused', 'cancelled', 'expired', 'completed', 'requires_more_info');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('whatsapp', 'phone', 'email', 'internal_message', 'form', 'visit_request', 'reservation_request', 'rental_request', 'chauffeur_request', 'seat_request');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('unread', 'read', 'archived');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('low', 'normal', 'important', 'urgent');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('new', 'in_progress', 'correction_requested', 'resolved', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('low', 'normal', 'important', 'urgent');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('listing', 'user', 'advertiser', 'message', 'conversation', 'document', 'other');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('pending', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'pending', 'resolved', 'closed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "city" TEXT,
    "avatarUrl" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "professionalVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "professionalType" "ProfessionalType" NOT NULL,
    "businessName" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "openingDate" TIMESTAMP(3),
    "openingHours" TEXT,
    "professionalPhone" TEXT,
    "professionalEmail" TEXT,
    "whatsappNumber" TEXT,
    "website" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "targetType" "TargetType",
    "targetId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "module" "PencmiModule" NOT NULL,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'private',
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileUsage" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelProperty" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "address" TEXT,
    "description" TEXT,
    "contactSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HotelProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelRoom" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomType" TEXT,
    "capacity" INTEGER,
    "status" "ListingStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelRoomRate" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ratePlan" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'FCFA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRoomRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelRoomAvailability" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "available" INTEGER NOT NULL,
    "reliableUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRoomAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelRestriction" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "stopSell" BOOLEAN NOT NULL DEFAULT false,
    "minStay" INTEGER,
    "maxStay" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelReservationRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "clientUserId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "guests" INTEGER,
    "message" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelReservationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelIntegration" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "sourceOfTruth" TEXT NOT NULL DEFAULT 'external_system',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelApiKey" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "permissions" TEXT[],
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelWebhook" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "events" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "HotelWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelSyncLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelSyncConflict" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "localValue" JSONB,
    "externalValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "HotelSyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelExternalMapping" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "internalId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,

    CONSTRAINT "HotelExternalMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelFieldMapping" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalField" TEXT NOT NULL,
    "internalField" TEXT NOT NULL,
    "transform" JSONB,

    CONSTRAINT "HotelFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealEstateListing" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "transaction" TEXT,
    "propertyType" TEXT,
    "city" TEXT NOT NULL,
    "neighborhood" TEXT,
    "price" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'FCFA',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RealEstateListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealEstateVisitRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "clientUserId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "preferredDate" TIMESTAMP(3),
    "message" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealEstateVisitRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleListing" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "vehicleMode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "price" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'FCFA',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VehicleListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleRentalRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "clientUserId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "message" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleRentalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleChauffeurRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "clientUserId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "pickupCity" TEXT,
    "destinationCity" TEXT,
    "serviceDate" TIMESTAMP(3),
    "message" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleChauffeurRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripListing" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "departureCity" TEXT NOT NULL,
    "arrivalCity" TEXT NOT NULL,
    "departurePoint" TEXT,
    "arrivalPoint" TEXT,
    "departureDate" TIMESTAMP(3),
    "departureTime" TEXT,
    "pricePerSeat" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'FCFA',
    "availableSeats" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TripListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripSeatRequest" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "clientUserId" TEXT,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "requestedSeats" INTEGER NOT NULL,
    "luggage" BOOLEAN,
    "message" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripSeatRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "targetType" "TargetType",
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentIds" TEXT[],
    "hiddenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactEvent" (
    "id" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "source" "ContactSource" NOT NULL,
    "targetType" "TargetType",
    "targetId" TEXT,
    "ownerUserId" TEXT,
    "clientUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "type" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "status" "NotificationStatus" NOT NULL DEFAULT 'unread',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "targetUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "variables" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "criteria" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "advertiserId" TEXT,
    "reason" TEXT NOT NULL,
    "message" TEXT,
    "priority" "ReportPriority" NOT NULL DEFAULT 'normal',
    "status" "ReportStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "adminUserId" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "messageToUser" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'new',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "categoryId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSection" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL,
    "module" "PencmiModule",
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoMeta" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "canonical" TEXT,
    "structuredData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoRedirect" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoEntity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "module" "PencmiModule" NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetType" "TargetType",
    "targetId" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'FCFA',
    "features" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertiserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertiserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_revokedAt_idx" ON "RefreshToken"("sessionId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalProfile_userId_key" ON "ProfessionalProfile"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_module_targetType_targetId_idx" ON "AuditLog"("module", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "FileAsset_ownerUserId_module_idx" ON "FileAsset"("ownerUserId", "module");

-- CreateIndex
CREATE INDEX "FileUsage_targetType_targetId_idx" ON "FileUsage"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelProperty_slug_key" ON "HotelProperty"("slug");

-- CreateIndex
CREATE INDEX "HotelProperty_ownerUserId_status_idx" ON "HotelProperty"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "HotelProperty_city_status_idx" ON "HotelProperty"("city", "status");

-- CreateIndex
CREATE INDEX "HotelRoom_propertyId_status_idx" ON "HotelRoom"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomRate_roomId_date_ratePlan_key" ON "HotelRoomRate"("roomId", "date", "ratePlan");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomAvailability_roomId_date_key" ON "HotelRoomAvailability"("roomId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRestriction_roomId_date_key" ON "HotelRestriction"("roomId", "date");

-- CreateIndex
CREATE INDEX "HotelReservationRequest_propertyId_status_createdAt_idx" ON "HotelReservationRequest"("propertyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HotelIntegration_propertyId_key" ON "HotelIntegration"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelApiKey_keyHash_key" ON "HotelApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "HotelApiKey_integrationId_revokedAt_idx" ON "HotelApiKey"("integrationId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HotelWebhookDelivery_eventId_key" ON "HotelWebhookDelivery"("eventId");

-- CreateIndex
CREATE INDEX "HotelSyncLog_integrationId_createdAt_idx" ON "HotelSyncLog"("integrationId", "createdAt");

-- CreateIndex
CREATE INDEX "HotelExternalMapping_entityType_internalId_idx" ON "HotelExternalMapping"("entityType", "internalId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelExternalMapping_integrationId_entityType_externalId_key" ON "HotelExternalMapping"("integrationId", "entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelFieldMapping_integrationId_externalField_internalField_key" ON "HotelFieldMapping"("integrationId", "externalField", "internalField");

-- CreateIndex
CREATE UNIQUE INDEX "RealEstateListing_slug_key" ON "RealEstateListing"("slug");

-- CreateIndex
CREATE INDEX "RealEstateListing_ownerUserId_status_idx" ON "RealEstateListing"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "RealEstateListing_city_status_idx" ON "RealEstateListing"("city", "status");

-- CreateIndex
CREATE INDEX "RealEstateVisitRequest_listingId_status_createdAt_idx" ON "RealEstateVisitRequest"("listingId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleListing_slug_key" ON "VehicleListing"("slug");

-- CreateIndex
CREATE INDEX "VehicleListing_ownerUserId_status_idx" ON "VehicleListing"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "VehicleListing_vehicleMode_city_status_idx" ON "VehicleListing"("vehicleMode", "city", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TripListing_slug_key" ON "TripListing"("slug");

-- CreateIndex
CREATE INDEX "TripListing_ownerUserId_status_idx" ON "TripListing"("ownerUserId", "status");

-- CreateIndex
CREATE INDEX "TripListing_departureCity_arrivalCity_status_idx" ON "TripListing"("departureCity", "arrivalCity", "status");

-- CreateIndex
CREATE INDEX "TripSeatRequest_tripId_status_createdAt_idx" ON "TripSeatRequest"("tripId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_module_targetType_targetId_idx" ON "Conversation"("module", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderUserId_createdAt_idx" ON "Message"("senderUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactEvent_module_targetId_createdAt_idx" ON "ContactEvent"("module", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactEvent_ownerUserId_createdAt_idx" ON "ContactEvent"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_status_createdAt_idx" ON "Notification"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_module_targetId_key" ON "Favorite"("userId", "module", "targetId");

-- CreateIndex
CREATE INDEX "Report_module_status_priority_idx" ON "Report"("module", "status", "priority");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationDecision_reportId_createdAt_idx" ON "ModerationDecision"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCategory_slug_key" ON "SupportCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ContentSection_pageId_key_key" ON "ContentSection"("pageId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SeoMeta_path_key" ON "SeoMeta"("path");

-- CreateIndex
CREATE UNIQUE INDEX "SeoRedirect_source_key" ON "SeoRedirect"("source");

-- CreateIndex
CREATE UNIQUE INDEX "GeoEntity_slug_key" ON "GeoEntity"("slug");

-- CreateIndex
CREATE INDEX "TrackingEvent_module_targetId_createdAt_idx" ON "TrackingEvent"("module", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "TrackingEvent_eventType_createdAt_idx" ON "TrackingEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_slug_key" ON "BillingPlan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UserSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUsage" ADD CONSTRAINT "FileUsage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelProperty" ADD CONSTRAINT "HotelProperty_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "HotelProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoomRate" ADD CONSTRAINT "HotelRoomRate_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRoomAvailability" ADD CONSTRAINT "HotelRoomAvailability_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRestriction" ADD CONSTRAINT "HotelRestriction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservationRequest" ADD CONSTRAINT "HotelReservationRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "HotelProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelIntegration" ADD CONSTRAINT "HotelIntegration_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "HotelProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelApiKey" ADD CONSTRAINT "HotelApiKey_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "HotelIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelWebhook" ADD CONSTRAINT "HotelWebhook_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "HotelIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelWebhookDelivery" ADD CONSTRAINT "HotelWebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "HotelWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelSyncLog" ADD CONSTRAINT "HotelSyncLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "HotelIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelSyncConflict" ADD CONSTRAINT "HotelSyncConflict_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "HotelIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelExternalMapping" ADD CONSTRAINT "HotelExternalMapping_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "HotelIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFieldMapping" ADD CONSTRAINT "HotelFieldMapping_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "HotelIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealEstateListing" ADD CONSTRAINT "RealEstateListing_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealEstateVisitRequest" ADD CONSTRAINT "RealEstateVisitRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "RealEstateListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleListing" ADD CONSTRAINT "VehicleListing_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleRentalRequest" ADD CONSTRAINT "VehicleRentalRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VehicleListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleChauffeurRequest" ADD CONSTRAINT "VehicleChauffeurRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "VehicleListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripListing" ADD CONSTRAINT "TripListing_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripSeatRequest" ADD CONSTRAINT "TripSeatRequest_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedAlert" ADD CONSTRAINT "SavedAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "VerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSection" ADD CONSTRAINT "ContentSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ContentPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


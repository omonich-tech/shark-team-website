-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaTargetType" AS ENUM ('BRANCH', 'COACH', 'SPORT', 'GROUP', 'PAGE');

-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM (
  'MAIN',
  'FACADE',
  'ENTRANCE',
  'HALL',
  'TRAINING',
  'EQUIPMENT',
  'COACH_PROFILE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "MediaConsentStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'APPROVED',
  'REJECTED'
);

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('ADMIN', 'COACH', 'SYSTEM');

-- CreateTable
CREATE TABLE "ContentPage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "heroEyebrowRu" TEXT,
  "heroEyebrowUz" TEXT,
  "heroTitleRu" TEXT,
  "heroTitleUz" TEXT,
  "heroLeadRu" TEXT,
  "heroLeadUz" TEXT,
  "seoTitleRu" TEXT,
  "seoTitleUz" TEXT,
  "seoDescriptionRu" TEXT,
  "seoDescriptionUz" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
  "id" TEXT NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "branchId" TEXT,
  "sportId" TEXT,
  "questionRu" TEXT NOT NULL,
  "questionUz" TEXT NOT NULL,
  "answerRu" TEXT NOT NULL,
  "answerUz" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "targetType" "MediaTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "category" "MediaCategory" NOT NULL DEFAULT 'OTHER',
  "url" TEXT NOT NULL,
  "pathname" TEXT,
  "contentType" TEXT,
  "size" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "altRu" TEXT,
  "altUz" TEXT,
  "containsMinors" BOOLEAN NOT NULL DEFAULT false,
  "consentStatus" "MediaConsentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorType" "AuditActorType" NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");
CREATE INDEX "ContentPage_status_idx" ON "ContentPage"("status");
CREATE INDEX "FaqItem_status_sortOrder_idx" ON "FaqItem"("status", "sortOrder");
CREATE INDEX "FaqItem_branchId_idx" ON "FaqItem"("branchId");
CREATE INDEX "FaqItem_sportId_idx" ON "FaqItem"("sportId");
CREATE INDEX "MediaAsset_targetType_targetId_sortOrder_idx" ON "MediaAsset"("targetType", "targetId", "sortOrder");
CREATE INDEX "MediaAsset_targetType_targetId_isPrimary_idx" ON "MediaAsset"("targetType", "targetId", "isPrimary");
CREATE INDEX "MediaAsset_consentStatus_idx" ON "MediaAsset"("consentStatus");
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditLog_actorType_actorId_createdAt_idx" ON "AuditLog"("actorType", "actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "FaqItem"
ADD CONSTRAINT "FaqItem_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqItem"
ADD CONSTRAINT "FaqItem_sportId_fkey"
FOREIGN KEY ("sportId") REFERENCES "Sport"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

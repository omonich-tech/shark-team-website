-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PriceProductType" AS ENUM ('TRIAL', 'SUBSCRIPTION');

-- CreateTable
CREATE TABLE "Sport" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "nameRu" TEXT NOT NULL,
    "nameUz" TEXT NOT NULL,
    "shortDescriptionRu" TEXT,
    "shortDescriptionUz" TEXT,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "internalName" TEXT NOT NULL,
    "publicNameRu" TEXT NOT NULL,
    "publicNameUz" TEXT NOT NULL,
    "districtRu" TEXT,
    "districtUz" TEXT,
    "addressRu" TEXT NOT NULL,
    "addressUz" TEXT NOT NULL,
    "postalCode" TEXT,
    "landmarkRu" TEXT,
    "landmarkUz" TEXT,
    "entranceNoteRu" TEXT,
    "entranceNoteUz" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "publicPhone" TEXT,
    "workingHoursRu" TEXT,
    "workingHoursUz" TEXT,
    "facilityNotesRu" TEXT,
    "facilityNotesUz" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tashkent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BranchSport" (
    "branchId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "BranchSport_pkey" PRIMARY KEY ("branchId","sportId")
);

CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phonePrivate" TEXT,
    "experienceYears" INTEGER,
    "educationRu" TEXT,
    "educationUz" TEXT,
    "qualificationRu" TEXT,
    "qualificationUz" TEXT,
    "publicBioRu" TEXT,
    "publicBioUz" TEXT,
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoachSport" (
    "coachId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "CoachSport_pkey" PRIMARY KEY ("coachId","sportId")
);

CREATE TABLE "CoachBranch" (
    "coachId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "CoachBranch_pkey" PRIMARY KEY ("coachId","branchId")
);

CREATE TABLE "TrainingGroup" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sportId" TEXT NOT NULL,
    "primaryCoachId" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrollmentStatus" "EnrollmentStatus" NOT NULL DEFAULT 'OPEN',
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "capacityRegular" INTEGER NOT NULL,
    "capacityTrial" INTEGER,
    "level" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notesInternal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupScheduleRule" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "weekday" "Weekday" NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "GroupScheduleRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "scheduleRuleId" TEXT,
    "sourceDate" DATE,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "regularCapacity" INTEGER NOT NULL,
    "trialCapacity" INTEGER,
    "trialBookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Price" (
    "id" TEXT NOT NULL,
    "productType" "PriceProductType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "sportId" TEXT,
    "branchId" TEXT,
    "groupId" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "status" "LifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Price_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");
CREATE INDEX "Sport_status_sortOrder_idx" ON "Sport"("status", "sortOrder");
CREATE UNIQUE INDEX "Branch_slug_key" ON "Branch"("slug");
CREATE INDEX "Branch_status_idx" ON "Branch"("status");
CREATE INDEX "BranchSport_sportId_status_idx" ON "BranchSport"("sportId", "status");
CREATE INDEX "Coach_status_idx" ON "Coach"("status");
CREATE INDEX "TrainingGroup_branchId_sportId_status_idx" ON "TrainingGroup"("branchId", "sportId", "status");
CREATE INDEX "TrainingGroup_primaryCoachId_status_idx" ON "TrainingGroup"("primaryCoachId", "status");
CREATE INDEX "TrainingGroup_ageMin_ageMax_idx" ON "TrainingGroup"("ageMin", "ageMax");
CREATE INDEX "GroupScheduleRule_groupId_status_idx" ON "GroupScheduleRule"("groupId", "status");
CREATE UNIQUE INDEX "GroupScheduleRule_groupId_weekday_startMinutes_validFrom_key" ON "GroupScheduleRule"("groupId", "weekday", "startMinutes", "validFrom");
CREATE INDEX "TrainingSession_coachId_startsAt_status_idx" ON "TrainingSession"("coachId", "startsAt", "status");
CREATE INDEX "TrainingSession_startsAt_status_idx" ON "TrainingSession"("startsAt", "status");
CREATE INDEX "TrainingSession_groupId_sourceDate_idx" ON "TrainingSession"("groupId", "sourceDate");
CREATE UNIQUE INDEX "TrainingSession_groupId_startsAt_key" ON "TrainingSession"("groupId", "startsAt");
CREATE UNIQUE INDEX "TrainingSession_scheduleRuleId_sourceDate_key" ON "TrainingSession"("scheduleRuleId", "sourceDate");
CREATE INDEX "Price_productType_status_validFrom_idx" ON "Price"("productType", "status", "validFrom");
CREATE INDEX "Price_branchId_sportId_groupId_idx" ON "Price"("branchId", "sportId", "groupId");

ALTER TABLE "BranchSport" ADD CONSTRAINT "BranchSport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchSport" ADD CONSTRAINT "BranchSport_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachSport" ADD CONSTRAINT "CoachSport_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachSport" ADD CONSTRAINT "CoachSport_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachBranch" ADD CONSTRAINT "CoachBranch_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachBranch" ADD CONSTRAINT "CoachBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingGroup" ADD CONSTRAINT "TrainingGroup_primaryCoachId_fkey" FOREIGN KEY ("primaryCoachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroupScheduleRule" ADD CONSTRAINT "GroupScheduleRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_scheduleRuleId_fkey" FOREIGN KEY ("scheduleRuleId") REFERENCES "GroupScheduleRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Price" ADD CONSTRAINT "Price_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Price" ADD CONSTRAINT "Price_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Price" ADD CONSTRAINT "Price_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TrainingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

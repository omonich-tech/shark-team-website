-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN "parentId" TEXT,
ADD COLUMN "childId" TEXT;

-- CreateTable
CREATE TABLE "Parent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageAtRegistration" INTEGER NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Parent_phone_key" ON "Parent"("phone");

-- CreateIndex
CREATE INDEX "Parent_createdAt_idx" ON "Parent"("createdAt");

-- CreateIndex
CREATE INDEX "Child_parentId_idx" ON "Child"("parentId");

-- CreateIndex
CREATE INDEX "Child_createdAt_idx" ON "Child"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_parentId_idx" ON "Lead"("parentId");

-- CreateIndex
CREATE INDEX "Lead_childId_idx" ON "Lead"("childId");

-- AddForeignKey
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "Child"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child"
ADD CONSTRAINT "Child_parentId_fkey"
FOREIGN KEY ("parentId") REFERENCES "Parent"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

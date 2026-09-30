CREATE TABLE "StudentAdminNote" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "authorId" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAdminNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentAdminNote_childId_createdAt_idx" ON "StudentAdminNote"("childId", "createdAt");
CREATE INDEX "StudentAdminNote_authorId_createdAt_idx" ON "StudentAdminNote"("authorId", "createdAt");

ALTER TABLE "StudentAdminNote"
ADD CONSTRAINT "StudentAdminNote_childId_fkey"
FOREIGN KEY ("childId") REFERENCES "Child"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

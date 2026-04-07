ALTER TABLE "User" ADD COLUMN "planChangeAt" DATETIME;
UPDATE "User"
SET "planChangeAt" = "scheduledPlanChangeAt"
WHERE "planChangeAt" IS NULL
  AND "scheduledPlanChangeAt" IS NOT NULL;

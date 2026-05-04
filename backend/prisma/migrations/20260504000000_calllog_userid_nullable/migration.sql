-- Make CallLog.userId nullable to support webhook-created records with no authenticated user
ALTER TABLE "CallLog" ALTER COLUMN "userId" DROP NOT NULL;

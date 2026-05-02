-- Add missing columns to CallLog table
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "callStatus" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "recordingUrl" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "agentNumber" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "callDate" TIMESTAMP(3);
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "greeterCallId" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "transcription" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "plainText" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "tone" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "urgency" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "emotion" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "callCategory" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "sentiment" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "feedback" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "conclusion" TEXT;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "isTranscribed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CallLog" ADD COLUMN IF NOT EXISTS "transcribedAt" TIMESTAMP(3);

-- Set defaults on existing CallLog columns
ALTER TABLE "CallLog" ALTER COLUMN "duration" SET DEFAULT 0;
ALTER TABLE "CallLog" ALTER COLUMN "callType" SET DEFAULT 'OUTBOUND';

-- Add missing columns to Leave table
ALTER TABLE "Leave" ADD COLUMN IF NOT EXISTS "leaveType" TEXT NOT NULL DEFAULT 'LEAVE';

-- Add missing columns to Attendance table
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "location" JSONB;

-- Add WFH to AttendanceStatus enum
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'WFH';

-- Make Task.leadId nullable
ALTER TABLE "Task" ALTER COLUMN "leadId" DROP NOT NULL;

-- Add foreign key for CallLog.leadId if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CallLog_leadId_fkey'
  ) THEN
    ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

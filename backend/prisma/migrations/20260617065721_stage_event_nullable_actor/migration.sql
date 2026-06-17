-- DropForeignKey
ALTER TABLE "LeadDepartmentStageEvent" DROP CONSTRAINT "LeadDepartmentStageEvent_changedByUserId_fkey";

-- AlterTable
ALTER TABLE "LeadDepartmentStageEvent" ALTER COLUMN "changedByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LeadDepartmentStageEvent" ADD CONSTRAINT "LeadDepartmentStageEvent_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AssignmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LeadAssignmentRequest" (
    "id" TEXT NOT NULL,
    "leadDepartmentId" TEXT NOT NULL,
    "department" "DepartmentType" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "status" "AssignmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadAssignmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadAssignmentRequest_department_status_idx" ON "LeadAssignmentRequest"("department", "status");

-- CreateIndex
CREATE INDEX "LeadAssignmentRequest_leadDepartmentId_status_idx" ON "LeadAssignmentRequest"("leadDepartmentId", "status");

-- CreateIndex
CREATE INDEX "LeadAssignmentRequest_requestedById_idx" ON "LeadAssignmentRequest"("requestedById");

-- CreateIndex
CREATE INDEX "LeadAssignmentRequest_status_idx" ON "LeadAssignmentRequest"("status");

-- AddForeignKey
ALTER TABLE "LeadAssignmentRequest" ADD CONSTRAINT "LeadAssignmentRequest_leadDepartmentId_fkey" FOREIGN KEY ("leadDepartmentId") REFERENCES "LeadDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentRequest" ADD CONSTRAINT "LeadAssignmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentRequest" ADD CONSTRAINT "LeadAssignmentRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentRequest" ADD CONSTRAINT "LeadAssignmentRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignmentRequest" ADD CONSTRAINT "LeadAssignmentRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

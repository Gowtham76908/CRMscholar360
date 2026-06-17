-- CreateTable
CREATE TABLE "LeadDepartmentStageEvent" (
    "id" TEXT NOT NULL,
    "leadDepartmentId" TEXT NOT NULL,
    "department" "DepartmentType" NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadDepartmentStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadDepartmentStageEvent_department_createdAt_idx" ON "LeadDepartmentStageEvent"("department", "createdAt");

-- CreateIndex
CREATE INDEX "LeadDepartmentStageEvent_changedByUserId_createdAt_idx" ON "LeadDepartmentStageEvent"("changedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadDepartmentStageEvent_toStage_createdAt_idx" ON "LeadDepartmentStageEvent"("toStage", "createdAt");

-- CreateIndex
CREATE INDEX "LeadDepartmentStageEvent_leadDepartmentId_idx" ON "LeadDepartmentStageEvent"("leadDepartmentId");

-- CreateIndex
CREATE INDEX "LeadDepartmentStageEvent_createdAt_idx" ON "LeadDepartmentStageEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "LeadDepartmentStageEvent" ADD CONSTRAINT "LeadDepartmentStageEvent_leadDepartmentId_fkey" FOREIGN KEY ("leadDepartmentId") REFERENCES "LeadDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDepartmentStageEvent" ADD CONSTRAINT "LeadDepartmentStageEvent_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

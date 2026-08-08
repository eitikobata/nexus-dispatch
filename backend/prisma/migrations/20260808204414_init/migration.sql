-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DirectiveStatus" AS ENUM ('QUEUED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OperativeStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'BUSY', 'OFF_DUTY');

-- CreateEnum
CREATE TYPE "AssignmentOutcome" AS ENUM ('SUCCESS', 'FAILED', 'ABORTED');

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operative" (
    "id" TEXT NOT NULL,
    "codename" TEXT NOT NULL,
    "status" "OperativeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Directive" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "requiredSkillId" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "DirectiveStatus" NOT NULL DEFAULT 'QUEUED',
    "estimatedDurationSec" INTEGER NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Directive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "directiveId" TEXT NOT NULL,
    "operativeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "outcome" "AssignmentOutcome",

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlaEvent" (
    "id" TEXT NOT NULL,
    "directiveId" TEXT NOT NULL,
    "breachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waitTimeSeconds" INTEGER NOT NULL,
    "priorityBefore" "Priority" NOT NULL,
    "priorityAfter" "Priority" NOT NULL,

    CONSTRAINT "SlaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OperativeSkills" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Operative_codename_key" ON "Operative"("codename");

-- CreateIndex
CREATE INDEX "Operative_status_idx" ON "Operative"("status");

-- CreateIndex
CREATE INDEX "Directive_status_priority_idx" ON "Directive"("status", "priority");

-- CreateIndex
CREATE INDEX "Directive_requiredSkillId_idx" ON "Directive"("requiredSkillId");

-- CreateIndex
CREATE INDEX "Assignment_directiveId_idx" ON "Assignment"("directiveId");

-- CreateIndex
CREATE INDEX "Assignment_operativeId_idx" ON "Assignment"("operativeId");

-- CreateIndex
CREATE INDEX "SlaEvent_directiveId_idx" ON "SlaEvent"("directiveId");

-- CreateIndex
CREATE UNIQUE INDEX "_OperativeSkills_AB_unique" ON "_OperativeSkills"("A", "B");

-- CreateIndex
CREATE INDEX "_OperativeSkills_B_index" ON "_OperativeSkills"("B");

-- AddForeignKey
ALTER TABLE "Directive" ADD CONSTRAINT "Directive_requiredSkillId_fkey" FOREIGN KEY ("requiredSkillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_directiveId_fkey" FOREIGN KEY ("directiveId") REFERENCES "Directive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_operativeId_fkey" FOREIGN KEY ("operativeId") REFERENCES "Operative"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaEvent" ADD CONSTRAINT "SlaEvent_directiveId_fkey" FOREIGN KEY ("directiveId") REFERENCES "Directive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OperativeSkills" ADD CONSTRAINT "_OperativeSkills_A_fkey" FOREIGN KEY ("A") REFERENCES "Operative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OperativeSkills" ADD CONSTRAINT "_OperativeSkills_B_fkey" FOREIGN KEY ("B") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RoutineSchedule" (
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "routineId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineSchedule_pkey" PRIMARY KEY ("userId","dayOfWeek")
);

-- CreateIndex
CREATE INDEX "RoutineSchedule_routineId_idx" ON "RoutineSchedule"("routineId");

-- AddForeignKey
ALTER TABLE "RoutineSchedule" ADD CONSTRAINT "RoutineSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineSchedule" ADD CONSTRAINT "RoutineSchedule_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

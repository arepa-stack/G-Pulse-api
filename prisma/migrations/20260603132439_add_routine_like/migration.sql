-- CreateTable
CREATE TABLE "RoutineLike" (
    "userId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineLike_pkey" PRIMARY KEY ("userId","routineId")
);

-- CreateIndex
CREATE INDEX "RoutineLike_routineId_idx" ON "RoutineLike"("routineId");

-- AddForeignKey
ALTER TABLE "RoutineLike" ADD CONSTRAINT "RoutineLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineLike" ADD CONSTRAINT "RoutineLike_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

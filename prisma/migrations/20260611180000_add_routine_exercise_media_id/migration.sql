-- AlterTable
ALTER TABLE "RoutineExercise" ADD COLUMN "mediaId" TEXT;

-- AddForeignKey
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "ExerciseMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

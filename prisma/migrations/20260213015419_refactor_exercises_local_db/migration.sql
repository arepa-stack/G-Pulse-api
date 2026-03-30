/*
  Warnings:

  - The values [FREE,PREMIUM] on the enum `SubscriptionPlan` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `imageUrl` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `muscle` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `Exercise` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `Exercise` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Exercise` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubscriptionPlan_new" AS ENUM ('BASIC', 'PRO', 'EXPERT');
ALTER TABLE "User" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "plan" TYPE "SubscriptionPlan_new" USING ("plan"::text::"SubscriptionPlan_new");
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "SubscriptionPlan_new" USING ("plan"::text::"SubscriptionPlan_new");
ALTER TYPE "SubscriptionPlan" RENAME TO "SubscriptionPlan_old";
ALTER TYPE "SubscriptionPlan_new" RENAME TO "SubscriptionPlan";
DROP TYPE "SubscriptionPlan_old";
ALTER TABLE "User" ALTER COLUMN "plan" SET DEFAULT 'BASIC';
COMMIT;

-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "imageUrl",
DROP COLUMN "muscle",
DROP COLUMN "videoUrl",
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "force" TEXT,
ADD COLUMN     "instructions" TEXT[],
ADD COLUMN     "mechanic" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiPromptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAiPromptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "plan" SET DEFAULT 'BASIC';

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Muscle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" TEXT,

    CONSTRAINT "Muscle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,

    CONSTRAINT "ExerciseImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PrimaryMuscles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PrimaryMuscles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_SecondaryMuscles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SecondaryMuscles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Muscle_name_key" ON "Muscle"("name");

-- CreateIndex
CREATE INDEX "_PrimaryMuscles_B_index" ON "_PrimaryMuscles"("B");

-- CreateIndex
CREATE INDEX "_SecondaryMuscles_B_index" ON "_SecondaryMuscles"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseImage" ADD CONSTRAINT "ExerciseImage_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PrimaryMuscles" ADD CONSTRAINT "_PrimaryMuscles_A_fkey" FOREIGN KEY ("A") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PrimaryMuscles" ADD CONSTRAINT "_PrimaryMuscles_B_fkey" FOREIGN KEY ("B") REFERENCES "Muscle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SecondaryMuscles" ADD CONSTRAINT "_SecondaryMuscles_A_fkey" FOREIGN KEY ("A") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SecondaryMuscles" ADD CONSTRAINT "_SecondaryMuscles_B_fkey" FOREIGN KEY ("B") REFERENCES "Muscle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

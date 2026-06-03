/*
  Warnings:

  - The `description` column on the `Exercise` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `instructions` column on the `Exercise` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `name` on the `Exercise` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "Exercise_name_key";

-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "name",
ADD COLUMN     "name" JSONB NOT NULL,
DROP COLUMN "description",
ADD COLUMN     "description" JSONB,
DROP COLUMN "instructions",
ADD COLUMN     "instructions" JSONB;

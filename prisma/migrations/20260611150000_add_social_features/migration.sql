-- AlterTable: User profile fields
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;

-- Backfill username from email (local part, sanitized)
UPDATE "User"
SET "username" = LOWER(
  REGEXP_REPLACE(
    SPLIT_PART("email", '@', 1),
    '[^a-zA-Z0-9_]',
    '_',
    'g'
  )
)
WHERE "username" IS NULL;

-- Resolve duplicate usernames by appending id suffix
UPDATE "User" u
SET "username" = u."username" || '_' || LEFT(u."id"::text, 8)
WHERE u."username" IN (
  SELECT "username"
  FROM "User"
  WHERE "username" IS NOT NULL
  GROUP BY "username"
  HAVING COUNT(*) > 1
);

-- AlterTable: ExerciseMedia social fields
ALTER TABLE "ExerciseMedia" ADD COLUMN "likes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ExerciseMedia" ADD COLUMN "caption" TEXT;

-- CreateTable: UserFollow
CREATE TABLE "UserFollow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("followerId","followingId")
);

-- CreateTable: MediaLike
CREATE TABLE "MediaLike" (
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaLike_pkey" PRIMARY KEY ("userId","mediaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "UserFollow_followingId_idx" ON "UserFollow"("followingId");

-- CreateIndex
CREATE INDEX "MediaLike_mediaId_idx" ON "MediaLike"("mediaId");

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLike" ADD CONSTRAINT "MediaLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLike" ADD CONSTRAINT "MediaLike_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "ExerciseMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

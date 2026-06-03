-- CreateTable
CREATE TABLE "Dictionary" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "translations" JSONB NOT NULL,

    CONSTRAINT "Dictionary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dictionary_type_key_key" ON "Dictionary"("type", "key");

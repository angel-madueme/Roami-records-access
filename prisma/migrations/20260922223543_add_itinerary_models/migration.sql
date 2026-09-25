-- CreateEnum
CREATE TYPE "ItineraryJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ItineraryActivityCategory" AS ENUM ('TRANSPORT', 'LODGING', 'FOOD', 'SIGHTSEEING', 'OTHER');

-- CreateTable
CREATE TABLE "ItineraryJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ItineraryJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItineraryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Itinerary" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "unsplashImageUrl" TEXT,
    "unsplashPhotographerName" TEXT,
    "unsplashPhotographerUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Itinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryActivity" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "category" "ItineraryActivityCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ItineraryActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItineraryJob_userId_idx" ON "ItineraryJob"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Itinerary_jobId_key" ON "Itinerary"("jobId");

-- CreateIndex
CREATE INDEX "ItineraryActivity_itineraryId_idx" ON "ItineraryActivity"("itineraryId");

-- AddForeignKey
ALTER TABLE "ItineraryJob" ADD CONSTRAINT "ItineraryJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Itinerary" ADD CONSTRAINT "Itinerary_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ItineraryJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryActivity" ADD CONSTRAINT "ItineraryActivity_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "Itinerary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

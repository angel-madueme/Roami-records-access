import type { Prisma } from "@prisma/client";

/** Public projection: the internal id and userId never cross the API boundary. */
export const savedPlacePublicSelect = {
  publicId: true,
  destination: true,
  note: true,
  unsplashImageUrl: true,
  unsplashPhotographerName: true,
  unsplashPhotographerUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SavedPlaceSelect;

export type PublicSavedPlace = Prisma.SavedPlaceGetPayload<{
  select: typeof savedPlacePublicSelect;
}>;

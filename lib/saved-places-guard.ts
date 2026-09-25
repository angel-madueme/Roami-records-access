import type { SavedPlace } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Ownership is part of the database query itself, making leaking another
 * user's data structurally impossible: there is no broad fetch followed by
 * an application-level ownership check.
 */
export function findOwnedSavedPlace(userId: string, publicId: string): Promise<SavedPlace | null> {
  return prisma.savedPlace.findFirst({
    where: { userId, publicId },
  });
}

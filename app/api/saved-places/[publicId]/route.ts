import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/session";
import { findOwnedSavedPlace } from "@/lib/saved-places-guard";

interface SavedPlaceRouteContext {
  params: Promise<{ publicId: string }>;
}

function ownershipDeniedResponse() {
  return NextResponse.json(
    { error: "You do not have access to this saved place." },
    { status: 403 }
  );
}

export async function GET(_request: Request, context: SavedPlaceRouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { publicId } = await context.params;
  const savedPlace = await findOwnedSavedPlace(session.userId, publicId);
  if (!savedPlace) {
    return ownershipDeniedResponse();
  }

  return NextResponse.json({
    publicId: savedPlace.publicId,
    destination: savedPlace.destination,
    note: savedPlace.note,
    unsplashImageUrl: savedPlace.unsplashImageUrl,
    unsplashPhotographerName: savedPlace.unsplashPhotographerName,
    unsplashPhotographerUrl: savedPlace.unsplashPhotographerUrl,
    status: savedPlace.status,
    createdAt: savedPlace.createdAt,
    updatedAt: savedPlace.updatedAt,
  });
}

export async function DELETE(_request: Request, context: SavedPlaceRouteContext) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { publicId } = await context.params;
  const savedPlace = await findOwnedSavedPlace(session.userId, publicId);
  if (!savedPlace) {
    return ownershipDeniedResponse();
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.deletionAuditLog.create({
      data: {
        userId: session.userId,
        destination: savedPlace.destination,
        publicId: savedPlace.publicId,
        deletedAt: new Date(),
      },
    });

    const deleted = await transaction.savedPlace.deleteMany({
      where: { userId: session.userId, publicId },
    });
    if (deleted.count !== 1) {
      throw new Error("Saved place disappeared before deletion completed.");
    }
  });

  return new NextResponse(null, { status: 204 });
}

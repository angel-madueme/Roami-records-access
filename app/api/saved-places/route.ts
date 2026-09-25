import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/session";
import { generatePublicId } from "@/lib/nanoid";
import { findDestinationPhoto } from "@/lib/unsplash";
import { createSavedPlaceSchema } from "@/lib/validation/saved-places";
import { savedPlacePublicSelect } from "@/lib/saved-place-response";

async function enrichSavedPlacePhoto(userId: string, publicId: string, destination: string): Promise<void> {
  try {
    const photo = await findDestinationPhoto(destination);
    if (!photo) return;

    await prisma.savedPlace.updateMany({
      where: { userId, publicId },
      data: {
        unsplashImageUrl: photo.imageUrl,
        unsplashPhotographerName: photo.photographerName,
        unsplashPhotographerUrl: photo.photographerUrl,
      },
    });
  } catch (error) {
    console.error("Saved place photo enrichment failed:", error);
  }
}

export async function POST(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSavedPlaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid saved place.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const savedPlace = await prisma.savedPlace.create({
    data: {
      publicId: generatePublicId(),
      userId: session.userId,
      destination: parsed.data.destination,
      note: parsed.data.note || null,
      status: parsed.data.status,
    },
    select: savedPlacePublicSelect,
  });

  // Photo enrichment is deliberately fire-and-forget: saving the record must
  // never wait for or fail because of an optional Unsplash lookup.
  void enrichSavedPlacePhoto(session.userId, savedPlace.publicId, savedPlace.destination);

  return NextResponse.json(savedPlace, { status: 201 });
}

export async function GET() {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const savedPlaces = await prisma.savedPlace.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: savedPlacePublicSelect,
  });

  return NextResponse.json(savedPlaces);
}

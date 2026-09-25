import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/session";
import { generatePublicId } from "@/lib/nanoid";
import { createSavedPlaceSchema } from "@/lib/validation/saved-places";
import { savedPlacePublicSelect } from "@/lib/saved-place-response";

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

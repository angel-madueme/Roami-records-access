import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  const job = await prisma.itineraryJob.findFirst({
    where: { id, userId: session.userId },
    include: {
      itinerary: {
        include: {
          activities: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Itinerary job not found." }, { status: 404 });
  }

  const response: {
    id: string;
    status: typeof job.status;
    attempts: number;
    itinerary?: typeof job.itinerary;
    errorMessage?: string | null;
  } = {
    id: job.id,
    status: job.status,
    attempts: job.attempts,
  };

  if (job.status === "DONE") {
    response.itinerary = job.itinerary;
  }

  if (job.status === "FAILED") {
    response.errorMessage = job.errorMessage;
  }

  return NextResponse.json(response);
}

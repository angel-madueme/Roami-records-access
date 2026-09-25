import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/session";
import { checkExpandRateLimit } from "@/lib/job-rate-limit";
import { expandItineraryWithDeepSeek, DeepSeekTimeoutError } from "@/lib/deepseek";

export const runtime = "nodejs";

const expansionPrompt = `
You are Roami's itinerary expansion model. Return only a JSON object matching the requested itinerary schema.

Preserve the destination, dates, and every existing activity in its current order. Preserve null dates as null; do not invent dates or change genuine dates. Improve each existing activity's note with useful, concrete detail grounded in the supplied itinerary. You may append one or two additional relevant activities for the destination. New activities must use exactly one of TRANSPORT, LODGING, FOOD, SIGHTSEEING, or OTHER. Do not invent a new destination.
`;

const itinerarySchema = z.object({
  destination: z.string().min(1),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  activities: z.array(z.object({
    category: z.enum(["TRANSPORT", "LODGING", "FOOD", "SIGHTSEEING", "OTHER"]),
    title: z.string().min(1),
    note: z.string(),
  })),
});

type ExpandedItinerary = z.infer<typeof itinerarySchema>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "DeepSeek returned invalid itinerary data.";
}

function retryAfterResponse(retryAfterMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return NextResponse.json(
    { error: "Too many itinerary expansions. Try again later.", retryAfterSeconds },
    { status: 429, headers: { "Retry-After": retryAfterSeconds.toString() } }
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await validateSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const rateLimit = checkExpandRateLimit(session.userId);
  if (!rateLimit.allowed) return retryAfterResponse(rateLimit.retryAfterMs ?? 0);

  const { id } = await params;
  const itinerary = await prisma.itinerary.findFirst({
    where: { id, job: { userId: session.userId } },
    include: { activities: { orderBy: { order: "asc" } } },
  });
  if (!itinerary) return NextResponse.json({ error: "Itinerary not found." }, { status: 404 });

  const currentItinerary = {
    destination: itinerary.destination,
    startDate: itinerary.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: itinerary.endDate?.toISOString().slice(0, 10) ?? null,
    activities: itinerary.activities.map(({ category, title, note }) => ({ category, title, note })),
  };

  let expanded: ExpandedItinerary | null = null;
  let lastValidationError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let rawResponse: string;
    try {
      rawResponse = await expandItineraryWithDeepSeek({ itinerary: currentItinerary, prompt: expansionPrompt });
      console.info("DeepSeek raw itinerary response:", rawResponse);
    } catch (error) {
      if (error instanceof DeepSeekTimeoutError) {
        return NextResponse.json({ error: "The AI service took too long to respond. Please try again." }, { status: 504 });
      }
      return NextResponse.json({ error: `DeepSeek provider error: ${errorMessage(error)}` }, { status: 502 });
    }

    try {
      const candidate = itinerarySchema.parse(JSON.parse(rawResponse));
      if (candidate.activities.length < itinerary.activities.length) {
        throw new Error("DeepSeek omitted one or more existing itinerary activities.");
      }
      expanded = candidate;
      console.info("Validated DeepSeek itinerary result:", JSON.stringify(expanded));
      break;
    } catch (error) {
      lastValidationError = error;
    }
  }

  if (!expanded) {
    return NextResponse.json(
      { error: `DeepSeek response failed schema validation: ${errorMessage(lastValidationError)}` },
      { status: 502 }
    );
  }

  const updated = await prisma.$transaction(async (transaction) => {
    for (let index = 0; index < itinerary.activities.length; index += 1) {
      await transaction.itineraryActivity.update({
        where: { id: itinerary.activities[index].id },
        data: { note: expanded.activities[index].note },
      });
    }
    for (let index = itinerary.activities.length; index < expanded.activities.length; index += 1) {
      const activity = expanded.activities[index];
      await transaction.itineraryActivity.create({
        data: { itineraryId: itinerary.id, category: activity.category, title: activity.title, note: activity.note, order: index },
      });
    }
    return transaction.itinerary.findUnique({ where: { id: itinerary.id }, include: { activities: { orderBy: { order: "asc" } } } });
  });

  return NextResponse.json({ itinerary: updated });
}

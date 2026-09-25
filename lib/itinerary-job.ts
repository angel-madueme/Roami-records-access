import { readFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withGeminiConcurrency } from "@/lib/concurrency";
import { extractItineraryWithGemini, GeminiTimeoutError } from "@/lib/gemini";
import { findDestinationPhoto } from "@/lib/unsplash";

const extractionPrompt = `
You are Roami's itinerary extraction model. Read the uploaded travel-notes image and return only the structured JSON requested by the response schema.

Extract the destination, start date, end date, and every identifiable activity. Dates must be valid ISO calendar dates in YYYY-MM-DD format when genuine dates are identifiable in the notes. If no genuine start or end date is identifiable, return null for that field: do not guess, do not use today's date, and do not use a zero/epoch placeholder such as 0000-01-01. The destination must be a non-empty place name and every activity title must be non-empty. Categorize each activity as exactly one of TRANSPORT, LODGING, FOOD, SIGHTSEEING, or OTHER. Preserve uncertainty honestly in the note rather than inventing details. If the image does not contain enough information to identify a destination, return a structured response that will fail validation rather than inventing one.
`;

const itineraryExtractionSchema = z.object({
  destination: z.string().min(1),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  activities: z.array(
    z.object({
      category: z.enum(["TRANSPORT", "LODGING", "FOOD", "SIGHTSEEING", "OTHER"]),
      title: z.string().min(1),
      note: z.string(),
    })
  ),
});

type ValidatedItinerary = z.infer<typeof itineraryExtractionSchema>;

function storagePathFromKey(storageKey: string): { path: string; mimeType: string } {
  const match = /^uploads\/itinerary\/([^/]+)\/([^/]+\.(jpg|png))$/i.exec(storageKey);
  if (!match) throw new Error("Invalid itinerary storage key.");

  const filename = match[2];
  const mimeType = match[3].toLowerCase() === "png" ? "image/png" : "image/jpeg";
  return {
    path: path.join(process.cwd(), "uploads", "itinerary", match[1], filename),
    mimeType,
  };
}

function validationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Gemini returned invalid itinerary data.";
}

async function markFailed(jobId: string, errorMessage: string): Promise<void> {
  await prisma.itineraryJob.update({
    where: { id: jobId },
    data: { status: "FAILED", errorMessage },
  });
}

async function processJob(jobId: string): Promise<void> {
  const job = await prisma.itineraryJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const storedImage = storagePathFromKey(job.storageKey);
  const image = await readFile(/* turbopackIgnore: true */ storedImage.path);

  await prisma.itineraryJob.update({
    where: { id: jobId },
    data: { attempts: { increment: 1 } },
  });

  let validated: ValidatedItinerary | null = null;
  let lastValidationError: unknown;

  for (let validationAttempt = 0; validationAttempt < 2; validationAttempt += 1) {
    let rawResponse: string;
    try {
      rawResponse = await extractItineraryWithGemini({
        image,
        mimeType: storedImage.mimeType,
        prompt: extractionPrompt,
      });
      console.info("Gemini raw itinerary response:", rawResponse);
    } catch (error) {
      if (error instanceof GeminiTimeoutError) {
        await markFailed(jobId, "The AI service took too long to respond. Please try again.");
        return;
      }
      const message = error instanceof Error ? error.message : "Gemini provider error.";
      await markFailed(jobId, `Gemini provider error: ${message}`);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(rawResponse);
      validated = itineraryExtractionSchema.parse(parsed);
      console.info("Validated itinerary result:", JSON.stringify(validated));
      break;
    } catch (error) {
      lastValidationError = error;
    }
  }

  if (!validated) {
    await markFailed(jobId, `Gemini response failed schema validation: ${validationErrorMessage(lastValidationError)}`);
    return;
  }

  const destinationPhoto = await findDestinationPhoto(validated.destination);

  await prisma.itinerary.create({
      data: {
        job: { connect: { id: jobId } },
        destination: validated.destination,
      startDate: validated.startDate ? new Date(`${validated.startDate}T00:00:00.000Z`) : null,
      endDate: validated.endDate ? new Date(`${validated.endDate}T00:00:00.000Z`) : null,
      unsplashImageUrl: destinationPhoto?.imageUrl ?? null,
      unsplashPhotographerName: destinationPhoto?.photographerName ?? null,
      unsplashPhotographerUrl: destinationPhoto?.photographerUrl ?? null,
      activities: {
        create: validated.activities.map((activity, index) => ({
          category: activity.category,
          title: activity.title,
          note: activity.note,
          order: index,
        })),
      },
    },
  });

  await prisma.itineraryJob.update({
    where: { id: jobId },
    data: { status: "DONE", errorMessage: null },
  });
}

/** Runs real Gemini extraction behind the configured in-memory concurrency cap. */
export function runItineraryExtractionJob(jobId: string): void {
  void withGeminiConcurrency(async () => {
    try {
      await processJob(jobId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected extraction failure.";
      try {
        await markFailed(jobId, message);
      } catch (updateError) {
        console.error("Failed to mark itinerary job as FAILED:", updateError);
      }
      console.error("Itinerary extraction job failed:", error);
    }
  });
}

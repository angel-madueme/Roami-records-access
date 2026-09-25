import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSession } from "@/lib/session";
import { checkUploadRateLimit } from "@/lib/job-rate-limit";
import { AI_CONFIG } from "@/lib/ai-config";
import { runItineraryExtractionJob } from "@/lib/itinerary-job";

export const runtime = "nodejs";

function retryAfterResponse(retryAfterMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return NextResponse.json(
    {
      error: "Too many itinerary uploads. Try again later.",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": retryAfterSeconds.toString() },
    }
  );
}

export async function POST(request: Request) {
  const session = await validateSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rateLimit = checkUploadRateLimit(session.userId);
  if (!rateLimit.allowed) {
    return retryAfterResponse(rateLimit.retryAfterMs ?? 0);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  const files = formData.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File)) {
    return NextResponse.json(
      { error: "Upload exactly one JPG or PNG image in the 'file' field." },
      { status: 400 }
    );
  }

  const file = files[0];
  if (!(AI_CONFIG.upload.allowedMimeTypes as readonly string[]).includes(file.type)) {
    return NextResponse.json({ error: "Only JPG and PNG images are supported." }, { status: 400 });
  }

  if (file.size === 0 || file.size > AI_CONFIG.upload.maxFileSizeBytes) {
    return NextResponse.json(
      { error: `The image must be larger than 0 bytes and no larger than ${Math.round(AI_CONFIG.upload.maxFileSizeBytes / 1024 / 1024)}MB.` },
      { status: 400 }
    );
  }

  const extension = file.type === "image/png" ? "png" : "jpg";
  const filename = `${randomUUID()}.${extension}`;
  const storageKey = path.posix.join("uploads", "itinerary", session.userId, filename);
  const storagePath = path.join(process.cwd(), "uploads", "itinerary", session.userId, filename);

  try {
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, Buffer.from(await file.arrayBuffer()));

    const job = await prisma.itineraryJob.create({
      data: {
        userId: session.userId,
        status: "PENDING",
        attempts: 0,
        storageKey,
      },
    });

    await prisma.itineraryJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING" },
    });

    runItineraryExtractionJob(job.id);

    return NextResponse.json({ id: job.id, status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    console.error("Failed to create itinerary upload job:", error);
    return NextResponse.json({ error: "We couldn't start itinerary extraction." }, { status: 500 });
  }
}

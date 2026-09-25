export interface UnsplashPhoto {
  imageUrl: string;
  photographerName: string;
  photographerUrl: string;
}

interface UnsplashSearchResponse {
  results?: Array<{
    urls?: { regular?: string };
    user?: {
      name?: string;
      links?: { html?: string };
    };
  }>;
}

/** Searches Unsplash by destination and returns the first usable result. */
export async function findDestinationPhoto(
  destination: string
): Promise<UnsplashPhoto | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey || !destination.trim()) return null;

  try {
    const params = new URLSearchParams({
      query: destination,
      per_page: "1",
      orientation: "landscape",
    });
    const response = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as UnsplashSearchResponse;
    const result = data.results?.[0];
    const imageUrl = result?.urls?.regular;
    const photographerName = result?.user?.name;
    const photographerUrl = result?.user?.links?.html;

    if (!imageUrl || !photographerName || !photographerUrl) return null;

    return { imageUrl, photographerName, photographerUrl };
  } catch {
    return null;
  }
}

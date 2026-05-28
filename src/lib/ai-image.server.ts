/**
 * AI image generation helpers (server-only) via Lovable AI Gateway.
 * Non-streaming — returns the final PNG as a Blob.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";

function buildArtistPrompt(artistName: string): string {
  return `Abstract, artistic album-style square cover art inspired by the musical identity of "${artistName}". Minimalist, modern, evocative shapes and rich color palette. No faces, no people, no text, no logos, no letters. 1:1 square composition.`;
}

function buildTrackPrompt(artistName: string, trackTitle: string): string {
  return `Abstract, artistic album-style square cover art inspired by the song "${trackTitle}" by "${artistName}". Minimalist, modern, evocative shapes and rich color palette. No faces, no people, no text, no logos, no letters. 1:1 square composition.`;
}

export async function generateArtistFallbackImage(
  artistName: string,
): Promise<{ blob: Blob; contentType: string } | null> {
  return generateImage(buildArtistPrompt(artistName));
}

export async function generateTrackFallbackImage(
  artistName: string,
  trackTitle: string,
): Promise<{ blob: Blob; contentType: string } | null> {
  return generateImage(buildTrackPrompt(artistName, trackTitle));
}

async function generateImage(
  prompt: string,
): Promise<{ blob: Blob; contentType: string } | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt,
        size: "1024x1024",
        quality: "low",
        n: 1,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[ai-image] gateway ${res.status}: ${text}`);
      return null;
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) return null;

    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return {
      blob: new Blob([bin], { type: "image/png" }),
      contentType: "image/png",
    };
  } catch (e) {
    console.error("[ai-image] error", e);
    return null;
  }
}
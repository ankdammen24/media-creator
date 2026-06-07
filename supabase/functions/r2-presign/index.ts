// Mints a presigned PUT URL for uploading directly to Cloudflare R2.
// Requires a signed-in user. Returns { uploadUrl, key, publicUrl? }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.658.1";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.658.1";

const ALLOWED_AUDIO = new Set([
  "audio/wav",
  "audio/mpeg",
  "audio/flac",
  "audio/aiff",
  "audio/x-aiff",
  "audio/x-wav",
]);
const ALLOWED_COVER = new Set(["image/jpeg", "image/png", "image/webp"]);

const MAX_AUDIO_BYTES = 500 * 1024 * 1024;
const MAX_COVER_BYTES = 10 * 1024 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Identify caller
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  // Parse + validate input
  let body: { kind?: string; filename?: string; contentType?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { kind, filename, contentType, size } = body;
  if (!kind || !filename || !contentType || typeof size !== "number") {
    return json({ error: "Missing fields: kind, filename, contentType, size" }, 400);
  }

  let prefix: string;
  if (kind === "audio") {
    if (!ALLOWED_AUDIO.has(contentType)) return json({ error: `Unsupported audio: ${contentType}` }, 400);
    if (size > MAX_AUDIO_BYTES) return json({ error: "Audio too large (max 500 MB)" }, 400);
    prefix = "audio-originals";
  } else if (kind === "cover") {
    if (!ALLOWED_COVER.has(contentType)) return json({ error: `Unsupported image: ${contentType}` }, 400);
    if (size > MAX_COVER_BYTES) return json({ error: "Cover too large (max 10 MB)" }, 400);
    prefix = "cover-art";
  } else {
    return json({ error: "kind must be 'audio' or 'cover'" }, 400);
  }

  // R2 config
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const bucket = Deno.env.get("R2_BUCKET_NAME");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const publicBase = Deno.env.get("R2_PUBLIC_BASE_URL");

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return json({ error: "R2 is not configured" }, 500);
  }

  const endpoint = `https://${accountId}.eu.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const key = `${prefix}/${userId}/${crypto.randomUUID()}-${safeName(filename)}`;

  try {
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 900 },
    );
    const publicUrl =
      kind === "cover" && publicBase ? `${publicBase.replace(/\/$/, "")}/${key}` : null;
    return json({ uploadUrl, key, bucket: `r2:${bucket}`, publicUrl });
  } catch (err) {
    console.error("presign failed", err);
    return json({ error: err instanceof Error ? err.message : "presign failed" }, 500);
  }
});

/**
 * Audio processing worker for the media catalog.
 *
 * Pipeline (per job):
 *   1. Download original audio from a signed Supabase Storage URL.
 *   2. Pass 1: ffmpeg loudnorm measurement (-23 LUFS / -1 dBTP / LRA 11).
 *   3. Pass 2: produce FLAC master with embedded metadata + linear loudnorm.
 *   4. Pass 2: produce AAC 128 kbps (.m4a) web variant with same loudnorm.
 *   5. Upload both back to the Supabase "audio" bucket.
 *   6. POST signed result to the app's /api/public/hooks/audio-processed.
 *
 * Required env:
 *   AUDIO_PROCESSOR_SECRET   - shared HMAC secret (also set in Lovable Cloud)
 *   SUPABASE_URL             - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - service role key (NEVER commit)
 *   PORT                     - HTTP port (default 8080)
 *   STORAGE_BUCKET           - defaults to "audio"
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { createClient } from "@supabase/supabase-js";

const PORT = Number(process.env.PORT || 8080);
const SECRET = required("AUDIO_PROCESSOR_SECRET");
const SUPABASE_URL = required("SUPABASE_URL");
const SUPABASE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET = process.env.STORAGE_BUCKET || "audio";
const MAX_BYTES = Number(process.env.MAX_INPUT_BYTES || 500 * 1024 * 1024); // 500 MB

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

type Embed = Record<string, string | null | undefined>;
type Job = {
  submissionId: string;
  sourceUrl: string;
  masterPath: string;
  webPath: string;
  callbackUrl: string;
  embed: Embed;
  loudnorm: { i: number; tp: number; lra: number };
  force?: boolean;
};

function sign(body: string) {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

function verify(sig: string | null, body: string) {
  if (!sig) return false;
  const expected = sign(body);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function ffmpegArgs(args: string[]) {
  return ["-hide_banner", "-nostdin", "-y", ...args];
}

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 0, stderr, stdout }));
  });
}

async function downloadTo(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const len = Number(res.headers.get("content-length") || 0);
  if (len && len > MAX_BYTES) throw new Error(`input too large: ${len}`);
  if (!res.body) throw new Error("no response body");
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
}

type LoudnormJson = {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
};

async function measureLoudness(inputPath: string, target: { i: number; tp: number; lra: number }): Promise<LoudnormJson> {
  const af = `loudnorm=I=${target.i}:TP=${target.tp}:LRA=${target.lra}:print_format=json`;
  const { stderr, code } = await run("ffmpeg", ffmpegArgs([
    "-i", inputPath,
    "-af", af,
    "-f", "null", "-",
  ]));
  if (code !== 0) throw new Error(`measure failed (${code}): ${stderr.slice(-400)}`);
  // ffmpeg prints the JSON block at the end of stderr
  const match = stderr.match(/\{[\s\S]*"target_offset"[\s\S]*?\}/);
  if (!match) throw new Error("could not parse loudnorm json");
  return JSON.parse(match[0]) as LoudnormJson;
}

function loudnormPass2Af(
  target: { i: number; tp: number; lra: number },
  m: LoudnormJson,
) {
  return [
    `loudnorm=I=${target.i}`,
    `TP=${target.tp}`,
    `LRA=${target.lra}`,
    `measured_I=${m.input_i}`,
    `measured_TP=${m.input_tp}`,
    `measured_LRA=${m.input_lra}`,
    `measured_thresh=${m.input_thresh}`,
    `offset=${m.target_offset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");
}

function metaArgs(embed: Embed): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(embed)) {
    if (v == null || v === "") continue;
    out.push("-metadata", `${k}=${String(v).replace(/\n/g, " ")}`);
  }
  return out;
}

async function transcodeFlac(input: string, output: string, af: string, embed: Embed) {
  const { stderr, code } = await run("ffmpeg", ffmpegArgs([
    "-i", input,
    "-map", "0:a:0",
    "-af", af,
    "-c:a", "flac",
    "-compression_level", "8",
    ...metaArgs(embed),
    output,
  ]));
  if (code !== 0) throw new Error(`flac failed (${code}): ${stderr.slice(-400)}`);
}

async function transcodeAac(input: string, output: string, af: string, embed: Embed) {
  const { stderr, code } = await run("ffmpeg", ffmpegArgs([
    "-i", input,
    "-map", "0:a:0",
    "-af", af,
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    ...metaArgs(embed),
    output,
  ]));
  if (code !== 0) throw new Error(`aac failed (${code}): ${stderr.slice(-400)}`);
}

async function uploadFile(path: string, file: string, contentType: string) {
  const buf = await readFile(file);
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

async function callbackOk(job: Job, m: LoudnormJson) {
  const body = JSON.stringify({
    submissionId: job.submissionId,
    masterPath: job.masterPath,
    webPath: job.webPath,
    loudness: {
      input_i: Number(m.input_i),
      input_tp: Number(m.input_tp),
      input_lra: Number(m.input_lra),
    },
  });
  await postSigned(job.callbackUrl, body);
}

async function callbackErr(job: Job, error: string) {
  const body = JSON.stringify({ submissionId: job.submissionId, error });
  await postSigned(job.callbackUrl, body);
}

async function postSigned(url: string, body: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-signature": sign(body) },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(`callback ${res.status}: ${txt.slice(0, 200)}`);
  }
}

async function processJob(job: Job) {
  const dir = await mkdtemp(join(tmpdir(), `audio-${randomBytes(4).toString("hex")}-`));
  const input = join(dir, "input.bin");
  const flac = join(dir, "master.flac");
  const aac = join(dir, "web.m4a");
  try {
    console.log(`[${job.submissionId}] download`);
    await downloadTo(job.sourceUrl, input);
    console.log(`[${job.submissionId}] measure`);
    const measured = await measureLoudness(input, job.loudnorm);
    const af = loudnormPass2Af(job.loudnorm, measured);
    console.log(`[${job.submissionId}] flac`);
    await transcodeFlac(input, flac, af, job.embed);
    console.log(`[${job.submissionId}] aac`);
    await transcodeAac(input, aac, af, job.embed);
    console.log(`[${job.submissionId}] upload`);
    await uploadFile(job.masterPath, flac, "audio/flac");
    await uploadFile(job.webPath, aac, "audio/mp4");
    console.log(`[${job.submissionId}] callback ok`);
    await callbackOk(job, measured);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[${job.submissionId}] FAILED: ${msg}`);
    await callbackErr(job, msg);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== "POST" || req.url !== "/process") {
    res.writeHead(404);
    res.end();
    return;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const c of req) {
    chunks.push(c as Buffer);
    total += (c as Buffer).length;
    if (total > 1024 * 1024) {
      res.writeHead(413);
      res.end("body too large");
      return;
    }
  }
  const body = Buffer.concat(chunks).toString("utf8");
  const sig = req.headers["x-signature"];
  if (!verify(typeof sig === "string" ? sig : null, body)) {
    res.writeHead(401);
    res.end("invalid signature");
    return;
  }
  let job: Job;
  try {
    job = JSON.parse(body) as Job;
  } catch {
    res.writeHead(400);
    res.end("invalid json");
    return;
  }
  if (!job.submissionId || !job.sourceUrl || !job.masterPath || !job.webPath || !job.callbackUrl) {
    res.writeHead(400);
    res.end("missing fields");
    return;
  }
  // Accept immediately, process in background.
  res.writeHead(202, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ accepted: true, submissionId: job.submissionId }));
  // Fire-and-forget
  void processJob(job);
});

server.listen(PORT, () => {
  console.log(`audio worker listening on :${PORT} (bucket=${BUCKET})`);
});

// no-op to satisfy unused import warnings in some TS strip-types modes
void writeFile;
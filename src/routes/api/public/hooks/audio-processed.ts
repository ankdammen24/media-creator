// Webhook callback from the ffmpeg worker. The worker POSTs here once it has
// produced the FLAC master and the AAC web variant and uploaded both to the
// "audio" storage bucket. We verify the HMAC signature and persist the result.
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Payload = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["done", "failed"]).optional(),
  masterPath: z.string().min(1).max(500).optional(),
  webPath: z.string().min(1).max(500).optional(),
  loudness: z
    .object({
      i: z.number().optional(),
      tp: z.number().optional(),
      lra: z.number().optional(),
      // Legacy fields from earlier worker versions:
      input_i: z.number().optional(),
      input_tp: z.number().optional(),
      input_lra: z.number().optional(),
    })
    .optional(),
  error: z.string().max(1000).optional(),
});

function safeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/hooks/audio-processed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.AUDIO_PROCESSOR_SECRET;
        if (!secret) {
          return new Response("worker secret not configured", { status: 503 });
        }
        const signature = request.headers.get("x-signature");
        const body = await request.text();
        if (!signature) return new Response("missing signature", { status: 401 });
        const expected = createHmac("sha256", secret).update(body).digest("hex");
        if (!safeEqualHex(signature, expected)) {
          return new Response("invalid signature", { status: 401 });
        }

        let json: unknown;
        try {
          json = JSON.parse(body);
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const parsed = Payload.safeParse(json);
        if (!parsed.success) {
          return new Response(`invalid payload: ${parsed.error.message}`, { status: 400 });
        }
        const p = parsed.data;

        const isFailed = p.status === "failed" || (!p.status && !!p.error);
        if (isFailed) {
          await supabaseAdmin
            .from("submissions")
            .update({
              processing_status: "failed",
              processing_error: p.error ?? "processing failed",
              processed_at: new Date().toISOString(),
            })
            .eq("id", p.submissionId);
          return Response.json({ ok: true, status: "failed" });
        }

        if (!p.masterPath || !p.webPath) {
          return new Response("missing output paths on success", { status: 400 });
        }

        const { error } = await supabaseAdmin
          .from("submissions")
          .update({
            processing_status: "done",
            processing_error: null,
            audio_master_path: p.masterPath,
            audio_web_path: p.webPath,
            loudness_i: p.loudness?.i ?? p.loudness?.input_i ?? null,
            loudness_tp: p.loudness?.tp ?? p.loudness?.input_tp ?? null,
            loudness_lra: p.loudness?.lra ?? p.loudness?.input_lra ?? null,
            processed_at: new Date().toISOString(),
          })
          .eq("id", p.submissionId);
        if (error) {
          return new Response(`db update: ${error.message}`, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
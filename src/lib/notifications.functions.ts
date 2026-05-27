import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildNotification, type NotifLang } from "./notification-content";

const inputSchema = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  comment: z.string().max(2000).optional().nullable(),
});

export const notifySubmissionDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Admin role check
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      throw new Error("Forbidden: admin only");
    }

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("submissions")
      .select("id, title, user_id")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (subErr || !sub) throw new Error("Submission not found");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("preferred_language, display_name")
      .eq("user_id", sub.user_id)
      .maybeSingle();
    const lang: NotifLang =
      (profile?.preferred_language as NotifLang | undefined) ?? "sv";

    const kind =
      data.status === "approved" ? "submission_approved" : "submission_rejected";
    const { subject, body } = buildNotification(kind, lang, sub.title, data.comment);

    // Look up recipient email via auth admin
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(sub.user_id);
    const recipientEmail = userRes?.user?.email ?? null;

    let emailStatus: "sent" | "skipped" | "failed" = "skipped";
    let emailError: string | null = null;

    // Attempt email send via Lovable email infrastructure if configured.
    // If not configured this will fail silently and the in-app notification
    // still lands.
    if (recipientEmail) {
      try {
        const res = await fetch(
          "https://api.lovable.dev/email/send",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.LOVABLE_API_KEY ?? ""}`,
            },
            body: JSON.stringify({
              to: recipientEmail,
              subject,
              text: body,
              from: "Media Rosenqvist <noreply@notify.catalog.mediarosenqvist.com>",
            }),
          },
        );
        if (res.ok) {
          emailStatus = "sent";
        } else {
          emailStatus = "failed";
          emailError = `HTTP ${res.status}`;
        }
      } catch (e) {
        emailStatus = "failed";
        emailError = e instanceof Error ? e.message : String(e);
      }
    }

    const { error: insErr } = await supabaseAdmin.from("notifications").insert({
      user_id: sub.user_id,
      submission_id: sub.id,
      type: kind,
      title: subject,
      body,
      language: lang,
      email_status: emailStatus,
      email_error: emailError,
    });
    if (insErr) throw new Error(insErr.message);

    return { ok: true, emailStatus };
  });
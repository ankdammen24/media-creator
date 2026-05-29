// Server-only API key auth + scope helpers
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash, randomBytes } from "crypto";
export { ALL_SCOPES, USER_ALLOWED_SCOPES, type ApiScope } from "./api-scopes";
import type { ApiScope } from "./api-scopes";

export type ApiKeyContext = {
  keyId: string;
  type: "user" | "service";
  ownerUserId: string | null;
  scopes: ApiScope[];
  label: string;
};

const KEY_PREFIX = "cm_live_";

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString("base64url");
  const plaintext = `${KEY_PREFIX}${random}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const prefix = plaintext.slice(0, 12);
  return { plaintext, hash, prefix };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export async function authenticateApiKey(
  request: Request,
): Promise<ApiKeyContext | { error: Response }> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
  };
  const header = request.headers.get("authorization");
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return {
      error: new Response(
        JSON.stringify({ error: "Missing Authorization: Bearer <api_key>" }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } },
      ),
    };
  }
  const token = header.slice(7).trim();
  if (!token.startsWith(KEY_PREFIX)) {
    return {
      error: new Response(
        JSON.stringify({ error: "Invalid API key format" }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } },
      ),
    };
  }
  const hash = hashApiKey(token);
  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, type, owner_user_id, scopes, label, revoked_at, expires_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data) {
    return {
      error: new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } },
      ),
    };
  }
  if (data.revoked_at) {
    return {
      error: new Response(
        JSON.stringify({ error: "API key revoked" }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } },
      ),
    };
  }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return {
      error: new Response(
        JSON.stringify({ error: "API key expired" }),
        { status: 401, headers: { "Content-Type": "application/json", ...cors } },
      ),
    };
  }
  // Fire-and-forget last_used_at update
  void supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    keyId: data.id,
    type: data.type as "user" | "service",
    ownerUserId: data.owner_user_id,
    scopes: (data.scopes ?? []) as ApiScope[],
    label: data.label,
  };
}

export function requireScope(
  ctx: ApiKeyContext,
  scope: ApiScope,
): Response | null {
  if (ctx.scopes.includes(scope)) return null;
  return new Response(
    JSON.stringify({ error: `Missing required scope: ${scope}` }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

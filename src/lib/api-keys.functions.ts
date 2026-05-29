import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  generateApiKey,
  USER_ALLOWED_SCOPES,
  ALL_SCOPES,
  type ApiScope,
} from "./api-auth.server";

const createUserKeySchema = z.object({
  label: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).min(1).max(20),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
});

export const createUserApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createUserKeySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const requested = data.scopes.filter((s): s is ApiScope =>
      (USER_ALLOWED_SCOPES as string[]).includes(s),
    );
    if (requested.length === 0) {
      throw new Error("No valid scopes selected");
    }
    const { plaintext, hash, prefix } = generateApiKey();
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400_000).toISOString()
      : null;

    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        key_hash: hash,
        key_prefix: prefix,
        type: "user",
        owner_user_id: userId,
        label: data.label,
        scopes: requested,
        expires_at: expiresAt,
        created_by: userId,
      })
      .select("id, key_prefix, label, scopes, expires_at, created_at")
      .single();

    if (error || !row) throw new Error(error?.message ?? "Insert failed");
    return { ...row, plaintext };
  });

export const listMyApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, label, type, scopes, key_prefix, last_used_at, expires_at, revoked_at, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Admin: service keys
const createServiceKeySchema = z.object({
  label: z.string().trim().min(1).max(80),
  scopes: z.array(z.string()).min(1).max(20),
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
});

export const createServiceApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createServiceKeySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Admin check
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin required");

    const requested = data.scopes.filter((s): s is ApiScope =>
      (ALL_SCOPES as string[]).includes(s),
    );
    if (requested.length === 0) throw new Error("No valid scopes selected");

    const { plaintext, hash, prefix } = generateApiKey();
    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400_000).toISOString()
      : null;

    const { data: row, error } = await supabaseAdmin
      .from("api_keys")
      .insert({
        key_hash: hash,
        key_prefix: prefix,
        type: "service",
        owner_user_id: data.ownerUserId ?? null,
        label: data.label,
        scopes: requested,
        expires_at: expiresAt,
        created_by: userId,
      })
      .select("id, key_prefix, label, scopes, expires_at, created_at")
      .single();

    if (error || !row) throw new Error(error?.message ?? "Insert failed");
    return { ...row, plaintext };
  });

export const listServiceApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");
    const { data, error } = await supabaseAdmin
      .from("api_keys")
      .select("id, label, scopes, key_prefix, last_used_at, expires_at, revoked_at, created_at, owner_user_id")
      .eq("type", "service")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const revokeServiceApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden");
    const { error } = await supabaseAdmin
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("type", "service");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

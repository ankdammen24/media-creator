import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY krävs för autentisering.");
}

// Supabase används endast för browser-autentisering, session och JWT-hämtning.
// Frontend får inte läsa eller skriva Supabase-databasen.
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

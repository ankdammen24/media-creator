import { createClient } from "@supabase/supabase-js";
import { getRuntimeConfig } from "@/lib/runtime-config";

const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } = getRuntimeConfig();

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_PUBLISHABLE_KEY) {
  console.warn("VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY saknas. Autentisering fungerar inte förrän publik Supabase-konfiguration anges.");
}

// Supabase används endast för browser-autentisering, session och JWT-hämtning.
// Frontend får inte läsa eller skriva Supabase-databasen.
export const supabase = createClient(VITE_SUPABASE_URL || "https://missing-supabase-url.invalid", VITE_SUPABASE_PUBLISHABLE_KEY || "missing-publishable-key", {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

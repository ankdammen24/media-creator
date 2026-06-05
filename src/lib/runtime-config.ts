type RuntimeConfig = {
  VITE_API_BASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

declare global {
  interface Window {
    __MEDIA_CREATOR_CONFIG__?: RuntimeConfig;
  }
}

export function getRuntimeConfig(): Required<RuntimeConfig> {
  const runtime = typeof window !== "undefined" ? window.__MEDIA_CREATOR_CONFIG__ : undefined;

  return {
    VITE_API_BASE_URL:
      runtime?.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL || "https://api.mediarosenqvist.com",
    VITE_SUPABASE_URL: runtime?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "",
    VITE_SUPABASE_PUBLISHABLE_KEY:
      runtime?.VITE_SUPABASE_ANON_KEY ||
      runtime?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "",
  };
}

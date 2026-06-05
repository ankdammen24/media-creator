#!/bin/sh
set -eu

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

API_BASE_URL="${VITE_API_BASE_URL:-https://api.mediarosenqvist.com}"
SUPABASE_URL="${VITE_SUPABASE_URL:-}"
SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"

cat > /usr/share/nginx/html/env.js <<EOF_ENV
window.__MEDIA_CREATOR_CONFIG__ = {
  VITE_API_BASE_URL: "$(json_escape "$API_BASE_URL")",
  VITE_SUPABASE_URL: "$(json_escape "$SUPABASE_URL")",
  VITE_SUPABASE_PUBLISHABLE_KEY: "$(json_escape "$SUPABASE_PUBLISHABLE_KEY")"
};
EOF_ENV

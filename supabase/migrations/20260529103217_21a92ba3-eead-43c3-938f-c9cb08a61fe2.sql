-- API key type
CREATE TYPE public.api_key_type AS ENUM ('user', 'service');

-- Table
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  type public.api_key_type NOT NULL,
  owner_user_id uuid,
  label text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

CREATE INDEX api_keys_hash_idx ON public.api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX api_keys_owner_idx ON public.api_keys(owner_user_id) WHERE revoked_at IS NULL;

-- Grants (auth-only table, no anon)
GRANT SELECT, UPDATE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

-- RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own api keys"
ON public.api_keys
FOR SELECT
TO authenticated
USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users revoke own api keys"
ON public.api_keys
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'::app_role));
-- Insert/delete only via server functions using service_role
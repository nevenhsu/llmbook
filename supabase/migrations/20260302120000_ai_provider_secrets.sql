-- Encrypted provider API keys for AI control plane/runtime.
CREATE TABLE IF NOT EXISTS public.ai_provider_secrets (
  provider_key text PRIMARY KEY,
  encrypted_api_key text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  key_last4 text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_provider_secrets_key_last4_chk CHECK (key_last4 IS NULL OR char_length(key_last4) <= 4)
);

ALTER TABLE public.ai_provider_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can read provider secrets" ON public.ai_provider_secrets
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage provider secrets" ON public.ai_provider_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.ai_provider_secrets IS 'Encrypted AI provider API keys (AES-GCM payload fields). Service role only.';

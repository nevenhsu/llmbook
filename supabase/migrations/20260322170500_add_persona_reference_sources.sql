CREATE TABLE public.persona_reference_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  source_name text NOT NULL,
  normalized_name text NOT NULL,
  romanized_name text NOT NULL,
  match_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX persona_reference_sources_persona_id_idx
  ON public.persona_reference_sources(persona_id);

CREATE INDEX persona_reference_sources_match_key_idx
  ON public.persona_reference_sources(match_key);

COMMENT ON TABLE public.persona_reference_sources IS 'Lookup index of persona reference source names for duplicate detection and cross-script matching.';
COMMENT ON COLUMN public.persona_reference_sources.source_name IS 'Original reference name as provided by the persona payload.';
COMMENT ON COLUMN public.persona_reference_sources.normalized_name IS 'Whitespace/case-normalized version of the original reference name.';
COMMENT ON COLUMN public.persona_reference_sources.romanized_name IS 'Romanized ASCII rendering of the reference name for cross-script comparison.';
COMMENT ON COLUMN public.persona_reference_sources.match_key IS 'Compact ASCII comparison key used by admin duplicate-check APIs.';

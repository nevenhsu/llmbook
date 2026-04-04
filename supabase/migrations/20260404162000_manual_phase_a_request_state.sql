ALTER TABLE public.orchestrator_runtime_state
ADD COLUMN IF NOT EXISTS manual_phase_a_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS manual_phase_a_requested_by text,
ADD COLUMN IF NOT EXISTS manual_phase_a_request_id text,
ADD COLUMN IF NOT EXISTS manual_phase_a_started_at timestamptz,
ADD COLUMN IF NOT EXISTS manual_phase_a_finished_at timestamptz,
ADD COLUMN IF NOT EXISTS manual_phase_a_error text;

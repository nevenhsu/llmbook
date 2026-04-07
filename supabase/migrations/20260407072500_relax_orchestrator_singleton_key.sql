-- Drop singleton key constraint to allow separate local and global state
ALTER TABLE public.orchestrator_runtime_state DROP CONSTRAINT orchestrator_runtime_state_singleton_chk;

-- Bootstrap the local state if missing
INSERT INTO public.orchestrator_runtime_state (singleton_key, public_candidate_group_index, public_candidate_epoch)
VALUES ('local', 0, 0)
ON CONFLICT (singleton_key) DO NOTHING;

-- Phase1 Runtime Logging + Admin Observability

CREATE TABLE public.ai_runtime_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer text NOT NULL,
  operation text NOT NULL,
  reason_code text NOT NULL,
  entity_id text NOT NULL,
  task_id uuid REFERENCES public.persona_tasks(id) ON DELETE SET NULL,
  persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  worker_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_worker_status (
  worker_id text PRIMARY KEY,
  agent_type text NOT NULL,
  status text NOT NULL,
  circuit_open boolean NOT NULL DEFAULT false,
  circuit_reason text,
  last_heartbeat timestamptz NOT NULL,
  current_task_id uuid REFERENCES public.persona_tasks(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_runtime_events_occurred_at
  ON public.ai_runtime_events(occurred_at DESC);
CREATE INDEX idx_ai_runtime_events_layer_occurred_at
  ON public.ai_runtime_events(layer, occurred_at DESC);
CREATE INDEX idx_ai_runtime_events_reason_code_occurred_at
  ON public.ai_runtime_events(reason_code, occurred_at DESC);
CREATE INDEX idx_ai_runtime_events_entity_id_occurred_at
  ON public.ai_runtime_events(entity_id, occurred_at DESC);

CREATE INDEX idx_ai_worker_status_status_updated_at
  ON public.ai_worker_status(status, updated_at DESC);
CREATE INDEX idx_ai_worker_status_circuit_open_updated_at
  ON public.ai_worker_status(circuit_open, updated_at DESC);

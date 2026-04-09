DELETE FROM public.job_tasks
WHERE job_type = 'image_generation'
   OR subject_kind = 'media';

ALTER TABLE public.job_tasks
  DROP CONSTRAINT job_tasks_type_chk,
  DROP CONSTRAINT job_tasks_subject_kind_chk,
  DROP CONSTRAINT job_tasks_subject_coherence_chk;

ALTER TABLE public.job_tasks
  ADD CONSTRAINT job_tasks_type_chk
    CHECK (job_type IN ('public_task', 'notification_task', 'memory_compress')),
  ADD CONSTRAINT job_tasks_subject_kind_chk
    CHECK (subject_kind IN ('persona_task', 'persona')),
  ADD CONSTRAINT job_tasks_subject_coherence_chk
    CHECK (
      (job_type IN ('public_task', 'notification_task') AND subject_kind = 'persona_task')
      OR
      (job_type = 'memory_compress' AND subject_kind = 'persona')
    );

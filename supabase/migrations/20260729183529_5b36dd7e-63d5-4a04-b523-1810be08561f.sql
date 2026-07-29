CREATE TABLE public.task_reset_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  slot integer NOT NULL,
  snapshot jsonb NOT NULL,
  attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  reset_by text,
  restored_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_reset_backups_task ON public.task_reset_backups (task_id, created_at DESC);
CREATE INDEX idx_task_reset_backups_user ON public.task_reset_backups (user_id, created_at DESC);

GRANT ALL ON public.task_reset_backups TO service_role;

ALTER TABLE public.task_reset_backups ENABLE ROW LEVEL SECURITY;
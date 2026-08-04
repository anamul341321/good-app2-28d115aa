CREATE INDEX IF NOT EXISTS idx_tasks_verified_id ON public.tasks (id) WHERE initial_verify_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_user_slot ON public.tasks (user_id, slot);
CREATE TABLE IF NOT EXISTS public.ai_answer_cache (
  qhash text PRIMARY KEY,
  question text NOT NULL,
  answer text NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_answer_cache TO service_role;
ALTER TABLE public.ai_answer_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_answer_cache_updated ON public.ai_answer_cache (updated_at DESC);
UPDATE public.ai_keys
SET last_error = NULL
WHERE last_error IS NOT NULL
  AND last_error ~* '(ভয়েস|voice|tts|stt)';
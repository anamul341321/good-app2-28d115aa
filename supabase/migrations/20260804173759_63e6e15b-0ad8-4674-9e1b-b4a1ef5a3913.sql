UPDATE public.tg_bot_settings
SET enabled = true,
    auto_reply_enabled = true,
    smart_mode = true,
    photo_analysis_enabled = true,
    updated_at = now()
WHERE id = 'default';
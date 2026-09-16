-- Conversation lists sort active rows by activity and only need the newest
-- message for each row. These indexes match those access patterns directly.

CREATE INDEX IF NOT EXISTS idx_conversations_pending_site_activity
ON public.conversations (site_id, last_message_at DESC NULLS LAST, created_at DESC)
WHERE is_archived = false AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_conversations_non_pending_site_activity
ON public.conversations (site_id, last_message_at DESC NULLS LAST, created_at DESC)
WHERE is_archived = false AND status <> 'pending';

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_desc
ON public.messages (conversation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_moderation
ON public.messages (conversation_id)
WHERE (custom_data ->> 'status') IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_tasks_site_pending_conversation
ON public.tasks (site_id, conversation_id)
WHERE status = 'pending' AND conversation_id IS NOT NULL;

-- Metadata table for doubt-chat attachments (worksheet photos + PDFs).
--
-- Lifecycle:
--   1. User picks a file in the composer → row inserted with `message_id IS NULL`.
--   2. On send, the route handler links the row to the freshly-inserted user message
--      via `update doubt_message_attachments set message_id = ?`.
--   3. PDF rows may have `ocr_text` populated by the route during the first turn
--      that uses them (server-side `pdf-parse` + `tesseract.js` fallback).
--
-- RLS:
--   - Student INSERT/SELECT/UPDATE/DELETE on rows whose `conversation_id` belongs to them.
--   - Parent SELECT for actively-linked students (mirrors parent-doubt-read pattern).
--
-- Apply to BOTH Supabase projects.

BEGIN;

CREATE TABLE public.doubt_message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.doubt_conversations (id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.doubt_messages (id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('image', 'pdf')),
    storage_path TEXT NOT NULL,
    mime VARCHAR(80) NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    ocr_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doubt_attachments_conversation ON public.doubt_message_attachments (conversation_id);
CREATE INDEX idx_doubt_attachments_message ON public.doubt_message_attachments (message_id);

ALTER TABLE public.doubt_message_attachments ENABLE ROW LEVEL SECURITY;

-- Owning student: full access via the parent conversation.
CREATE POLICY "Students manage own doubt attachments"
    ON public.doubt_message_attachments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.doubt_conversations c
            WHERE c.id = conversation_id
              AND c.student_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.doubt_conversations c
            WHERE c.id = conversation_id
              AND c.student_id = auth.uid()
        )
    );

-- Parent (active link): read-only access to attachments under their child's conversations.
CREATE POLICY "Parents read linked student doubt attachments"
    ON public.doubt_message_attachments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.doubt_conversations c
            JOIN public.parent_student_links psl ON psl.student_id = c.student_id
            WHERE c.id = conversation_id
              AND psl.parent_id = auth.uid()
              AND psl.status = 'active'
        )
    );

GRANT ALL ON public.doubt_message_attachments TO authenticated;
GRANT ALL ON public.doubt_message_attachments TO service_role;

COMMIT;

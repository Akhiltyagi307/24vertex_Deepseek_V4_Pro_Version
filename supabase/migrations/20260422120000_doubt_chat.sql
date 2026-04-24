-- Student doubt chat: conversations + messages, RLS for owning student only

CREATE TABLE public.doubt_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects (id) ON DELETE RESTRICT,
    topic_id UUID NOT NULL REFERENCES public.topics (id) ON DELETE RESTRICT,
    title TEXT,
    model VARCHAR(120),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doubt_conversations_student_updated
    ON public.doubt_conversations (student_id, updated_at DESC);
CREATE INDEX idx_doubt_conversations_subject ON public.doubt_conversations (subject_id);

CREATE TABLE public.doubt_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.doubt_conversations (id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    prompt_tokens INT,
    completion_tokens INT,
    model VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT doubt_messages_role_check CHECK (role IN ('user', 'assistant'))
);

CREATE INDEX idx_doubt_messages_conversation_created
    ON public.doubt_messages (conversation_id, created_at);

ALTER TABLE public.doubt_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: only the owning student
CREATE POLICY "Students manage own doubt conversations"
    ON public.doubt_conversations
    FOR ALL
    TO authenticated
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

-- Messages: only if the parent conversation is owned by the user
CREATE POLICY "Students manage own doubt messages"
    ON public.doubt_messages
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

GRANT ALL ON public.doubt_conversations TO authenticated;
GRANT ALL ON public.doubt_messages TO authenticated;
GRANT ALL ON public.doubt_conversations TO service_role;
GRANT ALL ON public.doubt_messages TO service_role;

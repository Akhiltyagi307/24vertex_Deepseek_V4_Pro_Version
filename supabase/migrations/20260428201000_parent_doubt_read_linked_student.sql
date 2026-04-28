-- Parents (active link) can read doubt chat history for linked students (no insert/update).

BEGIN;

CREATE POLICY "Parents read linked student doubt conversations"
  ON public.doubt_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.parent_student_links psl
      WHERE psl.parent_id = auth.uid()
        AND psl.student_id = doubt_conversations.student_id
        AND psl.status = 'active'
    )
  );

CREATE POLICY "Parents read linked student doubt messages"
  ON public.doubt_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.doubt_conversations c
      JOIN public.parent_student_links psl ON psl.student_id = c.student_id
      WHERE c.id = doubt_messages.conversation_id
        AND psl.parent_id = auth.uid()
        AND psl.status = 'active'
    )
  );

COMMIT;

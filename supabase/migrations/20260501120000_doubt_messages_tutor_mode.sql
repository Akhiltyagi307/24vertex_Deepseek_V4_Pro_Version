-- Per-turn tutor mode for doubt chat (Explain vs Solve with me). User rows only; assistant rows stay NULL.

ALTER TABLE public.doubt_messages
	ADD COLUMN tutor_mode VARCHAR(20) NULL,
	ADD CONSTRAINT doubt_messages_tutor_mode_check CHECK (
		tutor_mode IS NULL OR tutor_mode IN ('explain', 'solve_with_me')
	);

COMMENT ON COLUMN public.doubt_messages.tutor_mode IS 'Set on user messages: mode selected when the message was sent.';

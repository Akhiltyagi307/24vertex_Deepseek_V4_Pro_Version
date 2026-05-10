-- Chapter-scoped doubt chat: nullable topic_id, persisted hidden context messages.

ALTER TABLE public.doubt_conversations
	ALTER COLUMN topic_id DROP NOT NULL;

COMMENT ON COLUMN public.doubt_conversations.topic_id IS
	'When set, conversation is scoped to this topic. When NULL, metadata must carry chapter scope (doubt_scope=chapter).';

ALTER TABLE public.doubt_messages
	ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.doubt_messages.is_hidden IS
	'When true, message supplies model context (e.g. scope bootstrap) but must not render in the student UI.';

ALTER TABLE public.doubt_conversations
	ADD CONSTRAINT doubt_conversations_topic_or_chapter_scope CHECK (
		topic_id IS NOT NULL
		OR (
			(metadata ->> 'doubt_scope') = 'chapter'
			AND jsonb_typeof(metadata -> 'chapter') = 'object'
			AND (metadata #>> '{chapter,unit_number}') IS NOT NULL
			AND (metadata #>> '{chapter,chapter_number}') IS NOT NULL
			AND coalesce(trim(metadata #>> '{chapter,chapter_name}'), '') <> ''
		)
	);

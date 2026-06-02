import type { Config as DomPurifyConfig } from "dompurify";

/**
 * Allowlist for student rich-text ("text") practice answers. Shared by the
 * client editor (browser DOMPurify, `practice-rich-answer-editor.tsx`) and the
 * server-side sanitizer (`rich-answer-sanitize-server.ts`) so both enforce the
 * SAME policy and can't drift. Type-only `dompurify` import keeps this file
 * safe to load in any runtime.
 */
export const RICH_ANSWER_ALLOWED_TAGS = [
	"p",
	"br",
	"strong",
	"b",
	"em",
	"i",
	"u",
	"s",
	"strike",
	"del",
	"sub",
	"sup",
	"ul",
	"ol",
	"li",
	"a",
	"h2",
	"h3",
	"blockquote",
	"hr",
	"table",
	"thead",
	"tbody",
	"tr",
	"th",
	"td",
] as const;

export const RICH_ANSWER_ALLOWED_ATTR = ["href", "target", "rel", "colspan", "rowspan"] as const;

export const RICH_ANSWER_PURIFY: DomPurifyConfig = {
	ALLOWED_TAGS: [...RICH_ANSWER_ALLOWED_TAGS],
	ALLOWED_ATTR: [...RICH_ANSWER_ALLOWED_ATTR],
};

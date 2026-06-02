import "server-only";

import {
	RICH_ANSWER_ALLOWED_ATTR,
	RICH_ANSWER_ALLOWED_TAGS,
} from "@/lib/practice/rich-answer-purify-config";

/**
 * Server-side sanitizer for student rich-text answers (DEFENSE-IN-DEPTH).
 *
 * Rich answers are already sanitized client-side with DOMPurify before being
 * sent, and every render sink re-sanitizes on the way out (TipTap re-parse,
 * react-pdf). But the API accepts arbitrary strings, so a scripted client could
 * persist hostile HTML. This guarantees the DB only ever holds markup within
 * the same allowlist as the editor, regardless of the client.
 *
 * Implemented dependency-free (no jsdom/DOMPurify on the server — jsdom is a
 * dev-only dep): a conservative allowlist filter that (1) drops dangerous
 * elements with their content, (2) strips any tag outside the allowlist while
 * keeping its text, (3) keeps only allowlisted attributes, and (4) neutralizes
 * dangerous `href` schemes. It is intentionally strict — the editor only ever
 * emits allowlisted markup, so legitimate answers are unaffected.
 */
const ALLOWED_TAGS = new Set<string>(RICH_ANSWER_ALLOWED_TAGS);
const ALLOWED_ATTR = new Set<string>(RICH_ANSWER_ALLOWED_ATTR);
const VOID_TAGS = new Set<string>(["br", "hr"]);

/** Elements whose entire subtree must be removed, not just the tags. */
const DROP_WITH_CONTENT = [
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"noscript",
	"template",
	"svg",
	"math",
	"title",
	"textarea",
];

const DANGEROUS_HREF_SCHEME = /^\s*(?:javascript|data|vbscript):/i;

function sanitizeAttributes(rawAttrs: string): string {
	const out: string[] = [];
	const attrRe = /([a-zA-Z][a-zA-Z0-9:_-]*)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
	let m: RegExpExecArray | null;
	while ((m = attrRe.exec(rawAttrs)) !== null) {
		const name = m[1].toLowerCase();
		if (!ALLOWED_ATTR.has(name)) continue;
		const rawValue = m[2] ?? "";
		const value = rawValue.replace(/^["']|["']$/g, "");
		if (name === "href" && DANGEROUS_HREF_SCHEME.test(value)) continue;
		out.push(rawValue ? `${name}="${value.replace(/"/g, "&quot;")}"` : name);
	}
	return out.length ? ` ${out.join(" ")}` : "";
}

export function sanitizeRichAnswerHtmlServer(html: string): string {
	if (!html) return html;
	let s = html.replace(/<!--[\s\S]*?-->/g, "");
	for (const tag of DROP_WITH_CONTENT) {
		s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, "gi"), "");
		s = s.replace(new RegExp(`</?${tag}\\b[^>]*>`, "gi"), "");
	}
	return s.replace(
		/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
		(_full, slash: string, name: string, attrs: string) => {
			const tag = name.toLowerCase();
			if (!ALLOWED_TAGS.has(tag)) return "";
			if (slash === "/") return `</${tag}>`;
			const selfClose = VOID_TAGS.has(tag) ? " /" : "";
			return `<${tag}${sanitizeAttributes(attrs)}${selfClose}>`;
		},
	);
}

/**
 * Sanitize a `student_answers.student_answer` payload before persistence.
 * Only the rich "text" kind carries HTML; MCQ / numerical pass through.
 */
export function sanitizeStudentAnswerForStorage(answer: unknown): unknown {
	if (
		answer !== null &&
		typeof answer === "object" &&
		(answer as { kind?: unknown }).kind === "text" &&
		typeof (answer as { value?: unknown }).value === "string"
	) {
		const typed = answer as { kind: "text"; value: string } & Record<string, unknown>;
		return { ...typed, value: sanitizeRichAnswerHtmlServer(typed.value) };
	}
	return answer;
}

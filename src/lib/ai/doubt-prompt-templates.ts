import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import type { DoubtScopeSuccess } from "@/lib/doubt/validate-doubt-scope";

const PROMPT_MARKERS = {
	start: "<<<DOUBT_PROMPT",
	end: "DOUBT_PROMPT",
} as const;

const DOC_FILE: Record<DoubtTutorMode, string> = {
	explain: "explain-mode-prompt.md",
	solve_with_me: "solve-with-me-mode-prompt.md",
};

let cachedTemplates: Record<DoubtTutorMode, string> | null = null;

function extractTemplateFromDoc(filePath: string): string {
	const raw = fs.readFileSync(filePath, "utf8");
	const startIdx = raw.indexOf(PROMPT_MARKERS.start);
	if (startIdx === -1) {
		throw new Error(`Missing ${PROMPT_MARKERS.start} in ${filePath}`);
	}
	const afterStart = raw.slice(startIdx + PROMPT_MARKERS.start.length);
	const bodyStart = afterStart.startsWith("\n") ? 1 : 0;
	const fromBody = afterStart.slice(bodyStart);
	const endIdx = fromBody.indexOf(`\n${PROMPT_MARKERS.end}`);
	if (endIdx === -1) {
		throw new Error(`Missing closing ${PROMPT_MARKERS.end} line in ${filePath}`);
	}
	return fromBody.slice(0, endIdx).trim();
}

function loadTemplatesFromDisk(): Record<DoubtTutorMode, string> {
	// Statically scoped to `<cwd>/docs/<known-file>.md` so Turbopack/NFT
	// doesn't conservatively over-trace the project (which previously caused
	// `next.config.ts` to be pulled into unrelated lambdas).
	const docsDir = path.join(process.cwd(), "docs");
	return {
		explain: extractTemplateFromDoc(path.join(docsDir, DOC_FILE.explain)),
		solve_with_me: extractTemplateFromDoc(path.join(docsDir, DOC_FILE.solve_with_me)),
	};
}

/** Raw template with `{{placeholders}}` (for tests). */
export function getDoubtModeTemplate(mode: DoubtTutorMode): string {
	if (!cachedTemplates) {
		cachedTemplates = loadTemplatesFromDisk();
	}
	return cachedTemplates[mode];
}

const EMPTY_DESC_FALLBACK =
	"(no description in catalog — rely on the topic name and your general knowledge of this CBSE topic)";
const EMPTY_GOALS_FALLBACK = "(none listed)";

/** Replace `{{key}}` placeholders using scope-derived strings. */
export function interpolateDoubtPromptTemplate(
	template: string,
	scope: DoubtScopeSuccess,
): string {
	let vars: Record<string, string>;
	if (scope.kind === "topic") {
		const t = scope.topic;
		const descFromChunks = t.contextChunksBlock?.trim() ?? "";
		const chunksOnly = descFromChunks.length > 0;
		const desc = descFromChunks || t.description?.trim() || EMPTY_DESC_FALLBACK;
		const goalsLines = chunksOnly
			? "Use ONLY the topic_context_chunks content above as grounding. If a detail is missing there, state that clearly."
			: t.learningObjectives?.filter((s) => s.trim().length > 0).map((s) => `- ${s}`).join("\n") ||
				EMPTY_GOALS_FALLBACK;
		vars = {
			student_grade: chunksOnly ? "not provided" : String(scope.studentGrade),
			subject_name: chunksOnly ? "not provided" : scope.subjectName,
			unit_name: chunksOnly ? "not provided" : t.unitName,
			unit_number: chunksOnly ? "not provided" : String(t.unitNumber),
			chapter_name: chunksOnly ? "not provided" : t.chapterName,
			chapter_number: chunksOnly ? "not provided" : String(t.chapterNumber),
			topic_name: chunksOnly ? "selected topic (metadata omitted)" : t.topicName,
			topic_number: chunksOnly ? "not provided" : String(t.topicNumber),
			topic_description: desc,
			learning_objectives: goalsLines,
			chapter_topic_list: chunksOnly
				? "(omitted intentionally — rely only on topic_context_chunks text)"
				: `- ${t.topicName}`,
		};
	} else {
		const ch = scope.chapter;
		const descFromChunks = ch.contextChunksBlock?.trim() ?? "";
		const chunksOnly = descFromChunks.length > 0;
		vars = {
			student_grade: chunksOnly ? "not provided" : String(scope.studentGrade),
			subject_name: chunksOnly ? "not provided" : scope.subjectName,
			unit_name: chunksOnly ? "not provided" : ch.unitName,
			unit_number: chunksOnly ? "not provided" : String(ch.unitNumber),
			chapter_name: chunksOnly ? "not provided" : ch.chapterName,
			chapter_number: chunksOnly ? "not provided" : String(ch.chapterNumber),
			topic_name: chunksOnly ? "selected chapter (metadata omitted)" : "Whole chapter (all syllabus topics listed below)",
			topic_number: chunksOnly ? "not provided" : "—",
			topic_description: descFromChunks || ch.topicDescription,
			learning_objectives: chunksOnly
				? "Use ONLY the topic_context_chunks content above as grounding. If a detail is missing there, state that clearly."
				: ch.learningObjectivesBlock,
			chapter_topic_list: chunksOnly
				? "(omitted intentionally — rely only on topic_context_chunks text)"
				: ch.topicNamesBlock,
		};
	}

	let out = template;
	for (const [key, value] of Object.entries(vars)) {
		out = out.split(`{{${key}}}`).join(value);
	}
	if (out.includes("{{")) {
		const leftover = [...out.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]);
		throw new Error(`Unreplaced doubt prompt placeholders: ${leftover.join(", ")}`);
	}
	return out;
}

export function buildDoubtPromptFromTemplate(scope: DoubtScopeSuccess, mode: DoubtTutorMode): string {
	const template = getDoubtModeTemplate(mode);
	return interpolateDoubtPromptTemplate(template, scope);
}

/** Test-only: reset cached templates after mutating doc files. */
export function __resetDoubtPromptTemplateCacheForTests(): void {
	cachedTemplates = null;
}

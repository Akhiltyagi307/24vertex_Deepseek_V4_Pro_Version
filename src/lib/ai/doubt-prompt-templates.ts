import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import {
	resolveSubjectKey,
	SUBJECT_PACK_FILE,
	type SubjectPackKey,
} from "@/lib/doubt/subject-packs";
import type { DoubtScopeSuccess } from "@/lib/doubt/validate-doubt-scope";

const PROMPT_MARKERS = {
	start: "<<<DOUBT_PROMPT",
	end: "DOUBT_PROMPT",
} as const;

const SHARED_PREAMBLE_FILE = "doubt-shared-preamble.md";
const SUBJECT_PACK_DIR = "doubt-subject-packs";

const TAIL_DOC_FILE: Record<DoubtTutorMode, string> = {
	explain: "explain-mode-prompt.md",
	solve_with_me: "solve-with-me-mode-prompt.md",
	quiz_me: "quiz-me-mode-prompt.md",
};

let cachedPreamble: string | null = null;
let cachedTails: Record<DoubtTutorMode, string> | null = null;
let cachedSubjectPacks: Record<SubjectPackKey, string> | null = null;

/**
 * Scope block. Hardcoded here (rather than in a doc file) because it has the
 * same byte-identical structure across every mode, and keeping it adjacent to
 * the interpolation function makes the placeholder contract obvious.
 *
 * Ordering matters for DeepSeek's prefix cache:
 *   preamble (no placeholders, identical bytes for everyone)
 *   + scope (placeholders, per-conversation invariant within a chat)
 *   + mode tail (mode-specific instructions)
 * A mode toggle invalidates only the tail; cross-conversation reuse hits on
 * the preamble. See `docs/doubt-shared-preamble.md` for the rationale.
 */
const SCOPE_TEMPLATE = `## Scope (stay strictly on topic)
- Student grade: Grade {{student_grade}}
- Subject: {{subject_name}}
- Unit: {{unit_name}} (unit {{unit_number}})
- Chapter: {{chapter_name}} (chapter {{chapter_number}})
- Topic: {{topic_name}} (topic {{topic_number}})

Topics in this chapter (catalog):
{{chapter_topic_list}}

## Curriculum context (from 24Vertex's catalog, not the full NCERT textbook)
Description:
{{topic_description}}

What this topic teaches:
{{learning_objectives}}`;

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

function loadPreambleFromDisk(): string {
	// Statically scoped to `<cwd>/docs/<known-file>.md` so Turbopack/NFT doesn't
	// conservatively over-trace the project (which previously caused
	// `next.config.ts` to be pulled into unrelated lambdas).
	const docsDir = path.join(process.cwd(), "docs");
	return extractTemplateFromDoc(path.join(docsDir, SHARED_PREAMBLE_FILE));
}

function loadTailsFromDisk(): Record<DoubtTutorMode, string> {
	const docsDir = path.join(process.cwd(), "docs");
	return {
		explain: extractTemplateFromDoc(path.join(docsDir, TAIL_DOC_FILE.explain)),
		solve_with_me: extractTemplateFromDoc(path.join(docsDir, TAIL_DOC_FILE.solve_with_me)),
		quiz_me: extractTemplateFromDoc(path.join(docsDir, TAIL_DOC_FILE.quiz_me)),
	};
}

/**
 * Load all subject packs from disk. Each pack is a small block of
 * subject-specific guidance inserted between the preamble and the scope when
 * the chat's subject matches. Listed statically so Turbopack/NFT doesn't
 * over-trace.
 */
function loadSubjectPacksFromDisk(): Record<SubjectPackKey, string> {
	const docsDir = path.join(process.cwd(), "docs", SUBJECT_PACK_DIR);
	return {
		mathematics: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.mathematics)),
		science: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.science)),
		physics: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.physics)),
		chemistry: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.chemistry)),
		biology: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.biology)),
		"social-science": extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE["social-science"])),
		history: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.history)),
		geography: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.geography)),
		"political-science": extractTemplateFromDoc(
			path.join(docsDir, SUBJECT_PACK_FILE["political-science"]),
		),
		economics: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.economics)),
		english: extractTemplateFromDoc(path.join(docsDir, SUBJECT_PACK_FILE.english)),
		"computer-science": extractTemplateFromDoc(
			path.join(docsDir, SUBJECT_PACK_FILE["computer-science"]),
		),
	};
}

function getPreamble(): string {
	if (cachedPreamble === null) {
		cachedPreamble = loadPreambleFromDisk();
	}
	return cachedPreamble;
}

function getTail(mode: DoubtTutorMode): string {
	if (cachedTails === null) {
		cachedTails = loadTailsFromDisk();
	}
	return cachedTails[mode];
}

function getSubjectPack(key: SubjectPackKey | null): string | null {
	if (key === null) return null;
	if (cachedSubjectPacks === null) {
		cachedSubjectPacks = loadSubjectPacksFromDisk();
	}
	return cachedSubjectPacks[key] ?? null;
}

/**
 * Raw composite template with `{{placeholders}}` (mode-only — used by tests
 * and DB-prompt overrides that don't have a scope to derive a subject pack
 * from). When you have a `DoubtScopeSuccess`, prefer
 * `buildDoubtPromptFromTemplate(scope, mode)` which also inserts the
 * subject pack.
 */
export function getDoubtModeTemplate(mode: DoubtTutorMode): string {
	return `${getPreamble()}\n\n${SCOPE_TEMPLATE}\n\n${getTail(mode)}`;
}

/**
 * Composite template with the subject pack inserted between preamble and
 * scope when a subject pack matches. Returns the same value as
 * `getDoubtModeTemplate(mode)` when no pack matches the subject.
 */
export function getDoubtModeTemplateForScope(
	scope: DoubtScopeSuccess,
	mode: DoubtTutorMode,
): string {
	const subjectKey = resolveSubjectKey(scope.subjectName);
	const pack = getSubjectPack(subjectKey);
	const preamble = getPreamble();
	const tail = getTail(mode);
	if (pack === null) {
		return `${preamble}\n\n${SCOPE_TEMPLATE}\n\n${tail}`;
	}
	return `${preamble}\n\n${pack}\n\n${SCOPE_TEMPLATE}\n\n${tail}`;
}

/** Just the shared preamble (no placeholders, no scope, no tail). Used by prefix-identity tests. */
export function getDoubtSharedPreamble(): string {
	return getPreamble();
}

/** Subject pack body for a given subject name (null when no match). Used by tests. */
export function getDoubtSubjectPackForSubjectName(subjectName: string | null): string | null {
	return getSubjectPack(resolveSubjectKey(subjectName));
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
	const template = getDoubtModeTemplateForScope(scope, mode);
	return interpolateDoubtPromptTemplate(template, scope);
}

/** Test-only: reset cached templates after mutating doc files. */
export function __resetDoubtPromptTemplateCacheForTests(): void {
	cachedPreamble = null;
	cachedTails = null;
	cachedSubjectPacks = null;
}

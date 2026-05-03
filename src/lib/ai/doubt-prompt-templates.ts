import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import type { DoubtScopeSuccess } from "@/lib/doubt/validate-doubt-scope";

const PROMPT_MARKERS = {
	start: "<<<DOUBT_PROMPT",
	end: "DOUBT_PROMPT",
} as const;

const DOC_PATH: Record<DoubtTutorMode, string> = {
	explain: "docs/explain-mode-prompt.md",
	solve_with_me: "docs/solve-with-me-mode-prompt.md",
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

/** Resolves the repo root that contains `docs/explain-mode-prompt.md` (supports linked git worktrees). */
function resolveRepoRootWithDocs(): string {
	const marker = path.join("docs", "explain-mode-prompt.md");
	let dir = path.resolve(process.cwd());
	for (let i = 0; i < 12; i++) {
		if (fs.existsSync(path.join(dir, marker))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return path.resolve(process.cwd());
}

function loadTemplatesFromDisk(): Record<DoubtTutorMode, string> {
	const root = resolveRepoRootWithDocs();
	return {
		explain: extractTemplateFromDoc(path.join(root, DOC_PATH.explain)),
		solve_with_me: extractTemplateFromDoc(path.join(root, DOC_PATH.solve_with_me)),
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
	const t = scope.topic;
	const desc = t.description?.trim() || EMPTY_DESC_FALLBACK;
	const goalsLines =
		t.learningObjectives?.filter((s) => s.trim().length > 0).map((s) => `- ${s}`).join("\n") || EMPTY_GOALS_FALLBACK;

	const vars: Record<string, string> = {
		student_grade: String(scope.studentGrade),
		subject_name: scope.subjectName,
		unit_name: t.unitName,
		unit_number: String(t.unitNumber),
		chapter_name: t.chapterName,
		chapter_number: String(t.chapterNumber),
		topic_name: t.topicName,
		topic_number: String(t.topicNumber),
		topic_description: desc,
		learning_objectives: goalsLines,
	};

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

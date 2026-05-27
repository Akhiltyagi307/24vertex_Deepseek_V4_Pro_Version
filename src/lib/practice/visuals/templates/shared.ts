import type { QuestionVisualKind } from "../types";

export const CORE_VISUAL_TEMPLATE_SUBJECTS = [
	"Mathematics",
	"Physics",
	"Chemistry",
	"Biology",
	"Accountancy",
	"Economics",
	"Statistics",
	"English",
	"Social Science",
	"Geography",
	"History",
	"Civics",
	"Business Studies",
	"Science",
] as const;

export type CoreVisualTemplateSubject = (typeof CORE_VISUAL_TEMPLATE_SUBJECTS)[number];
export type VisualTemplateGradeBand = "6-8" | "9-10" | "11-12" | "any";
export type VisualTemplatePriority = "essential" | "recommended" | "optional";

export type VisualTemplateSlotContract = {
	requiredSlots: string[];
	optionalSlots: string[];
	constraints: string[];
};

export type VisualTemplateDefinition = {
	id: string;
	title: string;
	description: string;
	subjects: CoreVisualTemplateSubject[];
	topicTags: string[];
	gradeBands: VisualTemplateGradeBand[];
	kind: QuestionVisualKind;
	priority: VisualTemplatePriority;
	slotContract: VisualTemplateSlotContract;
	validatorHints: string[];
	fallbackKind: QuestionVisualKind | null;
};

export type VisualTemplatePolicy = {
	enabled: boolean;
	subject: CoreVisualTemplateSubject | null;
	templates: VisualTemplateDefinition[];
	preferredKinds: QuestionVisualKind[];
	promptBrief: string;
};

const SUBJECT_ALIASES = new Map<string, CoreVisualTemplateSubject>([
	["math", "Mathematics"],
	["mathematics", "Mathematics"],
	["physics", "Physics"],
	["chemistry", "Chemistry"],
	["biology", "Biology"],
	["accountancy", "Accountancy"],
	["accounts", "Accountancy"],
	["economics", "Economics"],
	["statistics", "Statistics"],
	["english", "English"],
	["social science", "Social Science"],
	["social_science", "Social Science"],
	["sst", "Social Science"],
	["geography", "Geography"],
	["history", "History"],
	["civics", "Civics"],
	["political science", "Civics"],
	["business studies", "Business Studies"],
	["business_studies", "Business Studies"],
	["science", "Science"],
]);

export function normalizeText(value: string | null | undefined): string {
	return (value ?? "")
		.toLowerCase()
		.replace(/[_-]+/g, " ")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function normalizeSubject(subjectName: string): CoreVisualTemplateSubject | null {
	const normalized = normalizeText(subjectName);
	return SUBJECT_ALIASES.get(normalized) ?? null;
}

export function template(
	definition: Omit<VisualTemplateDefinition, "validatorHints" | "fallbackKind"> &
		Partial<Pick<VisualTemplateDefinition, "validatorHints" | "fallbackKind">>,
): VisualTemplateDefinition {
	return {
		...definition,
		validatorHints: definition.validatorHints ?? [],
		fallbackKind: definition.fallbackKind ?? null,
	};
}

export function gradeBandScore(
	template: VisualTemplateDefinition,
	gradeBand: VisualTemplateGradeBand | null,
): number {
	if (!gradeBand || gradeBand === "any") return 0;
	if (template.gradeBands.includes(gradeBand)) return 4;
	if (template.gradeBands.includes("any")) return 1;
	return -3;
}

export function priorityScore(priority: VisualTemplatePriority): number {
	if (priority === "essential") return 3;
	if (priority === "recommended") return 2;
	return 1;
}

export function topicScore(template: VisualTemplateDefinition, topicHintNorm: string): number {
	if (!topicHintNorm) return 0;
	let score = 0;
	for (const tag of template.topicTags) {
		const normalizedTag = normalizeText(tag);
		if (normalizedTag && topicHintNorm.includes(normalizedTag)) score += 6;
	}
	const titleWords = normalizeText(`${template.title} ${template.description}`)
		.split(" ")
		.filter((word) => word.length > 3);
	for (const word of titleWords) {
		if (topicHintNorm.includes(word)) score += 1;
	}
	return score;
}

export function uniqueKinds(templates: VisualTemplateDefinition[]): QuestionVisualKind[] {
	const seen = new Set<QuestionVisualKind>();
	const kinds: QuestionVisualKind[] = [];
	for (const template of templates) {
		if (seen.has(template.kind)) continue;
		seen.add(template.kind);
		kinds.push(template.kind);
	}
	return kinds;
}

import type { QuestionVisualKind } from "../types";

import type {
	VisualTemplateDefinition,
	VisualTemplateGradeBand,
	VisualTemplatePolicy,
} from "./shared";
import {
	gradeBandScore,
	normalizeSubject,
	normalizeText,
	priorityScore,
	topicScore,
	uniqueKinds,
} from "./shared";

import { MATHEMATICS_VISUAL_TEMPLATES } from "./mathematics";
import { PHYSICS_VISUAL_TEMPLATES } from "./physics";
import { CHEMISTRY_VISUAL_TEMPLATES } from "./chemistry";
import { BIOLOGY_VISUAL_TEMPLATES } from "./biology";
import { ACCOUNTANCY_VISUAL_TEMPLATES } from "./accountancy";
import { ECONOMICS_STATISTICS_VISUAL_TEMPLATES } from "./economics-statistics";
import { ENGLISH_VISUAL_TEMPLATES } from "./english";
import { GEOGRAPHY_SOCIAL_SCIENCE_VISUAL_TEMPLATES } from "./geography-social-science";
import { BUSINESS_STUDIES_VISUAL_TEMPLATES } from "./business-studies";
import { SCIENCE_VISUAL_TEMPLATES } from "./science";

// Re-export the type/constant surface so callers (e.g. user-message.ts) can
// continue importing from "@/lib/practice/visuals/templates" with no change.
export {
	CORE_VISUAL_TEMPLATE_SUBJECTS,
	normalizeSubject,
	normalizeText,
} from "./shared";
export type {
	CoreVisualTemplateSubject,
	VisualTemplateDefinition,
	VisualTemplateGradeBand,
	VisualTemplatePolicy,
	VisualTemplatePriority,
	VisualTemplateSlotContract,
} from "./shared";

/**
 * Aggregated registry. Order: per-subject blocks are spread in the same order
 * the first template of each block appeared in the pre-shard file. WITHIN
 * each subject block, the relative order matches the original. Cross-block
 * order can differ from the legacy single-file sequence when templates from
 * different first-subjects were interleaved — this affects only the index
 * used as a sort tie-breaker in `getVisualTemplatesForSubjectTopic` (the
 * SET of returned templates is identical; only ranking among score-tied
 * templates can shift). callers cap-by-score, not by index, so the
 * difference is invisible in the LLM prompt output for non-tied templates.
 */
export const VISUAL_TEMPLATE_REGISTRY: VisualTemplateDefinition[] = [
	...MATHEMATICS_VISUAL_TEMPLATES,
	...PHYSICS_VISUAL_TEMPLATES,
	...CHEMISTRY_VISUAL_TEMPLATES,
	...BIOLOGY_VISUAL_TEMPLATES,
	...ACCOUNTANCY_VISUAL_TEMPLATES,
	...ECONOMICS_STATISTICS_VISUAL_TEMPLATES,
	...ENGLISH_VISUAL_TEMPLATES,
	...GEOGRAPHY_SOCIAL_SCIENCE_VISUAL_TEMPLATES,
	...BUSINESS_STUDIES_VISUAL_TEMPLATES,
	...SCIENCE_VISUAL_TEMPLATES,
];

export function getVisualTemplatesForSubjectTopic(args: {
	subjectName: string;
	topicHint?: string | null;
	gradeBand?: VisualTemplateGradeBand | null;
	maxTemplates?: number;
}): VisualTemplateDefinition[] {
	const subject = normalizeSubject(args.subjectName);
	if (!subject) return [];
	const topicHintNorm = normalizeText(args.topicHint);
	const maxTemplates = Math.max(1, args.maxTemplates ?? VISUAL_TEMPLATE_REGISTRY.length);

	return VISUAL_TEMPLATE_REGISTRY.filter((template) => template.subjects.includes(subject))
		.map((template, order) => ({
			template,
			order,
			score:
				topicScore(template, topicHintNorm) +
				gradeBandScore(template, args.gradeBand ?? null) +
				priorityScore(template.priority),
		}))
		.sort((a, b) => b.score - a.score || a.order - b.order)
		.slice(0, maxTemplates)
		.map((entry) => entry.template);
}

export function resolveVisualTemplatePolicy(args: {
	subjectName: string;
	topicHint?: string | null;
	gradeBand?: VisualTemplateGradeBand | null;
	maxTemplates?: number;
}): VisualTemplatePolicy {
	const subject = normalizeSubject(args.subjectName);
	const templates = getVisualTemplatesForSubjectTopic(args);
	const preferredKinds = uniqueKinds(templates);
	const promptBrief =
		templates.length === 0 ?
			"Visual template engine: no subject/topic templates are available; keep visual null unless the legacy renderer policy requires one."
		:	[
				"Visual template engine: choose only from these template IDs and fill only their declared slots.",
				...templates.map((template, index) => {
					const required = template.slotContract.requiredSlots.join(", ");
					const constraints = template.slotContract.constraints.join(" ");
					return `${index + 1}. ${template.id} (${template.kind}) required: ${required}. ${constraints}`;
				}),
			].join("\n");

	return {
		enabled: templates.length > 0,
		subject,
		templates,
		preferredKinds,
		promptBrief,
	};
}
// Mark QuestionVisualKind as used (it's referenced via re-exported types).
export type _QuestionVisualKind = QuestionVisualKind;

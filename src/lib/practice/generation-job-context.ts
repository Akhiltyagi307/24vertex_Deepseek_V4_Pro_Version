import { getPracticeQuestionPlanForSubject, type PracticeQuestionTypeCounts } from "./constants";
import { buildPracticeEvidenceMap, type PracticeEvidenceMap } from "./generation-evidence-pack";
import type { PracticeConfigResolveSuccess } from "./resolve-config";
import type { FinalizePracticeConfigInput } from "./schemas";
import type { PracticeUserMessagePayload } from "./user-message";
import type { QuestionVisualKind } from "./visuals/types";

export type PracticeGenerationRequestMode = "server_action" | "stream" | "assignment_worker";

export type PracticeGenerationJobContext = {
	correlationId: string;
	generationRunId: string | null;
	requestMode: PracticeGenerationRequestMode;
	userId: string;
	subject: {
		id: string;
		name: string;
		subjectGrade: number | null;
		subjectGroup: string | null;
		studentGrade: number | null;
	};
	plan: {
		durationSeconds: number;
		expectedQuestionCount: number;
		expectedTypeCounts: PracticeQuestionTypeCounts;
		allowedTopicIds: string[];
		difficulty: FinalizePracticeConfigInput["difficulty"];
		focusArea: FinalizePracticeConfigInput["focusArea"];
	};
	visuals: {
		enabled: boolean;
		preferredKinds: QuestionVisualKind[];
		maxNonNullVisuals: number;
		templatePolicy: PracticeUserMessagePayload["test_parameters"]["visuals_policy"]["template_policy"] | null;
	};
	topicExemplarHint: string | null;
	userPayload: PracticeUserMessagePayload;
	evidenceByTopicId: PracticeEvidenceMap;
};

export function buildPracticeGenerationJobContext(args: {
	correlationId: string;
	generationRunId: string | null;
	requestMode: PracticeGenerationRequestMode;
	parsed: FinalizePracticeConfigInput;
	resolved: PracticeConfigResolveSuccess;
	userPayload: PracticeUserMessagePayload;
	topicExemplarHint: string | null;
}): PracticeGenerationJobContext {
	const { parsed, resolved, userPayload } = args;
	const plan = getPracticeQuestionPlanForSubject(parsed.durationSeconds, resolved.subjectName);
	const expectedTypeCounts = plan.counts;
	const allowedTopicIds = [...new Set(resolved.canonicalTopics.map((t) => t.topicId))];
	const visualPolicy = userPayload.test_parameters.visuals_policy;

	return {
		correlationId: args.correlationId,
		generationRunId: args.generationRunId,
		requestMode: args.requestMode,
		userId: resolved.userId,
		subject: {
			id: parsed.subjectId,
			name: resolved.subjectName,
			subjectGrade: resolved.subjectGrade,
			subjectGroup: resolved.subjectGroup,
			studentGrade: resolved.studentGrade,
		},
		plan: {
			durationSeconds: parsed.durationSeconds,
			expectedQuestionCount: plan.total,
			expectedTypeCounts,
			allowedTopicIds,
			difficulty: parsed.difficulty,
			focusArea: parsed.focusArea,
		},
		visuals: {
			enabled: visualPolicy.enabled,
			preferredKinds: [...visualPolicy.preferred_kinds],
			maxNonNullVisuals: visualPolicy.max_non_null_visuals,
			templatePolicy: visualPolicy.template_policy ?? null,
		},
		topicExemplarHint: args.topicExemplarHint,
		userPayload,
		evidenceByTopicId: buildPracticeEvidenceMap(userPayload.topic_grounding),
	};
}

export function generationJobConfigSnapshot(ctx: PracticeGenerationJobContext): Record<string, unknown> {
	return {
		subject_id: ctx.subject.id,
		subject_name: ctx.subject.name,
		difficulty: ctx.plan.difficulty,
		focus_area: ctx.plan.focusArea ?? null,
		duration_seconds: ctx.plan.durationSeconds,
		expected_question_count: ctx.plan.expectedQuestionCount,
		expected_type_counts: ctx.plan.expectedTypeCounts,
		allowed_topic_ids: ctx.plan.allowedTopicIds,
		request_mode: ctx.requestMode,
		visuals: {
			enabled: ctx.visuals.enabled,
			preferred_kinds: ctx.visuals.preferredKinds,
			max_non_null_visuals: ctx.visuals.maxNonNullVisuals,
			template_policy_enabled: ctx.visuals.templatePolicy?.enabled ?? false,
			template_ids: ctx.visuals.templatePolicy?.templates.map((template) => template.id) ?? [],
		},
	};
}

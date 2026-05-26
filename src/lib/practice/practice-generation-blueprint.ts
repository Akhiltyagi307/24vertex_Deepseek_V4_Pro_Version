import { resolveChatModel } from "@/lib/ai/model-router";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { generateStructured } from "@/lib/ai/structured-output";

import type { PracticeGenerationJobContext } from "./generation-job-context";
import {
	createPracticeGenerationBlueprintSchema,
	validatePracticeGenerationBlueprint,
	type PracticeGenerationBlueprintGrouped,
} from "./practice-generation-blueprint-schema";

function formatBlueprintError(error: unknown): string {
	const msg = error instanceof Error ? error.message : "Unknown error";
	return msg.length > 320 ? `${msg.slice(0, 320)}...` : msg;
}

function buildBlueprintSystemPrompt(): string {
	return `You design a blueprint for a school practice test.

Output must be JSON matching the provided schema.

Rules:
- Match the exact per-type slot counts from EXPECTED_TYPE_COUNTS.
- Every slot.topic_id must be copied from ALLOWED_TOPIC_IDS.
- skill_target should be specific and assessable.
- evidence_refs should reference ids from TOPIC_EVIDENCE_JSON where available.
- Visual stimulus planning (when BLUEPRINT_INPUT.visual_policy.enabled is true and preferred_kinds is non-empty):
  - If visual_policy.template_policy.enabled is true, prefer the listed template IDs. The template policy is stricter than broad kind preference: choose a template first, then set preferred_kind to that template's kind.
  - For each slot, decide whether a non-text stimulus materially helps the skill being tested.
  - If visual_intent.needs_visual is true, you MUST set:
    - visual_intent.preferred_kind: exactly one value from visual_policy.preferred_kinds (copy the string verbatim).
    - visual_intent.visual_idea: a concrete 1–3 sentence brief of what the student should SEE — axes and curve shape, geometry labels, circuit/optics layout, molecule/display, map region, passage + line refs, chart type + series, or (for real tabular data) column meanings — not a repeat of the eventual question wording. This is the creative spec for later rendering.
  - Prefer graphical / spatial / plot stimuli over generic data_table when the skill can be assessed from a diagram, graph, geometry, number line, map, chart, curve, circuit, ray diagram, molecule, reaction, passage, or accountancy grid. Use data_table only when the item truly requires reading or comparing rows of numeric/categorical facts, not to restate prose givens.
  - Accountancy / financial items: prefer accountancy_table (or data_table when accountancy_table is not in preferred_kinds) for journals, ledgers, trial balance, statements, or classified numeric cases; still write a specific visual_idea (which rows/columns, periods, missing amounts).
  - When visual_intent.needs_visual is false: set priority to none, preferred_kind null, visual_idea null, required false.
- visual_intent.priority must be one of: necessary | high | medium | none.
- If visual_intent.needs_visual is false, visual_intent.priority must be none.
- visual_intent.required should mirror visual_intent.needs_visual for compatibility.
- Keep notes short and actionable.`;
}

function buildBlueprintUserPrompt(ctx: PracticeGenerationJobContext): string {
	const topicEvidenceJson = [...ctx.evidenceByTopicId.values()].map((topic) => ({
		topic_id: topic.topic_id,
		topic_name: topic.topic_name,
		curriculum_hint: topic.curriculum_hint,
		evidence: topic.items.map((item) => ({
			ref: item.ref,
			kind: item.kind,
			text: item.text,
		})),
	}));

	return [
		"BLUEPRINT_INPUT:",
		JSON.stringify({
			subject: {
				id: ctx.subject.id,
				name: ctx.subject.name,
				student_grade: ctx.subject.studentGrade,
				subject_grade: ctx.subject.subjectGrade,
			},
			test_plan: {
				difficulty: ctx.plan.difficulty,
				duration_seconds: ctx.plan.durationSeconds,
				expected_question_count: ctx.plan.expectedQuestionCount,
				expected_type_counts: ctx.plan.expectedTypeCounts,
				allowed_topic_ids: ctx.plan.allowedTopicIds,
			},
			visual_policy: {
				enabled: ctx.visuals.enabled,
				preferred_kinds: ctx.visuals.preferredKinds,
				max_non_null_visuals: ctx.visuals.maxNonNullVisuals,
				template_policy: ctx.visuals.templatePolicy ?? null,
			},
			recent_errors: ctx.userPayload.student.recent_errors ?? [],
			topics: ctx.userPayload.topics,
			topic_evidence: topicEvidenceJson,
		}),
	].join("\n");
}

export type GeneratePracticeBlueprintResult =
	| {
			ok: true;
			blueprint: PracticeGenerationBlueprintGrouped;
			model: string;
			modelMs: number;
			inputTokens: number;
			outputTokens: number;
	  }
	| {
			ok: false;
			message: string;
			model: string;
			modelMs: number;
			inputTokens: number;
			outputTokens: number;
	  };

export async function generatePracticeBlueprint(args: {
	jobContext: PracticeGenerationJobContext;
	promptRevision: string;
	abortSignal?: AbortSignal;
}): Promise<GeneratePracticeBlueprintResult> {
	const resolved = resolveChatModel("practice.generation.blueprint");
	const modelId = resolved.modelId;
	const t0 = Date.now();
	const schema = createPracticeGenerationBlueprintSchema(args.jobContext.plan.expectedTypeCounts);

	try {
		const { object, usage, telemetry } = await generateStructured({
			resolved,
			schema,
			system: buildBlueprintSystemPrompt(),
			prompt: buildBlueprintUserPrompt(args.jobContext),
			maxOutputTokens: 4_000,
			maxRetries: 1,
			abortSignal: args.abortSignal,
			providerOptions: {
				openai: { strictJsonSchema: true },
			},
		});

		const parsed = object as PracticeGenerationBlueprintGrouped;
		const visualsOn =
			args.jobContext.visuals.enabled && args.jobContext.visuals.preferredKinds.length > 0;
		const check = validatePracticeGenerationBlueprint({
			blueprint: parsed,
			allowedTopicIds: new Set(args.jobContext.plan.allowedTopicIds),
			expectedTypeCounts: args.jobContext.plan.expectedTypeCounts,
			visualPolicy:
				visualsOn ?
					{
						enabled: true,
						preferredKinds: args.jobContext.visuals.preferredKinds,
					}
				:	null,
		});
		if (!check.ok) {
			void recordAiCall({
				feature: "practice.generation.blueprint",
				model: modelId,
				userId: args.jobContext.userId,
				promptId: args.promptRevision,
				generationRunId: args.jobContext.generationRunId,
				correlationId: args.jobContext.correlationId,
				stepKey: "blueprint_generate",
				inputTokens: usage?.inputTokens ?? 0,
				outputTokens: usage?.outputTokens ?? 0,
				reasoningTokens: telemetry.reasoningTokens,
				cacheHitTokens: telemetry.cacheHitTokens,
				cacheMissTokens: telemetry.cacheMissTokens,
				provider: telemetry.provider,
				latencyMs: Date.now() - t0,
				status: "error",
				error: check.message,
			});
			return {
				ok: false,
				message: check.message,
				model: modelId,
				modelMs: Date.now() - t0,
				inputTokens: usage?.inputTokens ?? 0,
				outputTokens: usage?.outputTokens ?? 0,
			};
		}

		void recordAiCall({
			feature: "practice.generation.blueprint",
			model: modelId,
			userId: args.jobContext.userId,
			promptId: args.promptRevision,
			generationRunId: args.jobContext.generationRunId,
			correlationId: args.jobContext.correlationId,
			stepKey: "blueprint_generate",
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
			reasoningTokens: telemetry.reasoningTokens,
			cacheHitTokens: telemetry.cacheHitTokens,
			cacheMissTokens: telemetry.cacheMissTokens,
			provider: telemetry.provider,
			latencyMs: Date.now() - t0,
			status: "ok",
		});

		return {
			ok: true,
			blueprint: parsed,
			model: modelId,
			modelMs: Date.now() - t0,
			inputTokens: usage?.inputTokens ?? 0,
			outputTokens: usage?.outputTokens ?? 0,
		};
	} catch (error) {
		const message = formatBlueprintError(error);
		void recordAiCall({
			feature: "practice.generation.blueprint",
			model: modelId,
			userId: args.jobContext.userId,
			promptId: args.promptRevision,
			generationRunId: args.jobContext.generationRunId,
			correlationId: args.jobContext.correlationId,
			stepKey: "blueprint_generate",
			inputTokens: 0,
			outputTokens: 0,
			provider: resolved.provider,
			latencyMs: Date.now() - t0,
			status: "error",
			error: message,
		});
		return {
			ok: false,
			message,
			model: modelId,
			modelMs: Date.now() - t0,
			inputTokens: 0,
			outputTokens: 0,
		};
	}
}

import { resolveChatModel } from "@/lib/ai/model-router";
import { recordAiCall } from "@/lib/ai/record-ai-call";
import { generateStructured } from "@/lib/ai/structured-output";

import type { PracticeQuestionTypeCounts } from "./constants";
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

const TOPIC_COVERAGE_RULE = `Topic coverage:
- When ALLOWED_TOPIC_IDS.length <= total slot count, every topic MUST appear in at least one slot.
- Weight extra slots toward weaker topics — lower performance.average_score_percent, status "weak"/"not_tested", declining trend, more hits in STUDENT_PROFILE.recent_errors.
- Topics with rich TOPIC_EVIDENCE deserve higher-Bloom (Apply / Analyze / Justify) slots; topics with sparse evidence stay at Recall / Understand / Define level.
- Do NOT stack all slots on one topic when more topics are available — diversity inside the allowlist is itself a quality signal.`;

const DIFFICULTY_DISTRIBUTION_RULE = `Difficulty distribution (TEST_PARAMETERS.difficulty is the BAND, not a per-slot directive):
- NEVER assign the same difficulty_level to every slot. A degenerate spread is treated as a planning failure.
- Target distributions across the full test:
    easy band   -> ~50% easy / ~40% medium / ~10% hard
    medium band -> ~25% easy / ~50% medium / ~25% hard
    hard band   -> ~10% easy / ~40% medium / ~50% hard
- Within each question-type bucket, order slots from EASIER to HARDER so the writer model can ramp cognitive load.
- Higher Bloom verbs (Analyze / Justify / Evaluate / Construct) belong on medium-or-hard slots; pure Recall / Define on easy slots.`;

const SKILL_TARGET_RULE = `skill_target (HIGHEST-LEVERAGE field — the writer model assesses exactly this):
- Concrete learning outcome. NOT a topic restatement, NOT a vague phrase. Avoid "apply concepts", "solve problem", "understand topic", "use formula".
- Pattern: "<Bloom verb> <specific object> <specific condition>." Aim for 80-220 characters.
- Allowed Bloom verbs (the first word of skill_target SHOULD be one of these):
    Recall, Identify, Define, State, Describe, Explain, Classify, Compare, Apply,
    Calculate, Compute, Derive, Analyze, Justify, Evaluate, Construct, Prove.
- Default verb -> question-type mapping (override only with a one-line reason in notes):
    multiple_choice -> Recall / Identify / Classify / Apply (single step)
    fill_in_blank   -> Define / State / Compute (single value / term)
    short_answer    -> Explain / Compare / Derive (2-4 reasoning steps)
    long_answer     -> Analyze / Justify / Evaluate / Construct / Prove (multi-step + reasoning chain)
- Bloom spread: in a 10+ slot test, use at LEAST 4 distinct Bloom verbs. No two slots may share the same skill_target verbatim. Within a single topic, vary sub-skills — do not write three slots that all say "Apply formula X to find Y".`;

const QUESTION_TYPE_PLANNING_RULE = `Question-type specific planning:
- multiple_choice: for every MCQ, commit to ONE misconception/trap the distractors will exploit (unit confusion, sign error, swapped cause/effect, formula misapplication, vocabulary near-miss, off-by-one indexing, partial-credit shortcut). Encode this short tag in visual_intent.reason (<=80 chars) even when needs_visual is false; if visual_intent must remain null, fold the misconception cue into skill_target's condition clause.
- fill_in_blank: skill_target must point at a SINGLE answer (a number with units, a term, a short phrase) — not a discussion. Mention units / form expected in the condition clause ("...in SI units", "...as a balanced equation", "...to two significant figures").
- short_answer: skill_target must imply a 2-4 step procedure. Examples: "state -> set up -> compute -> interpret", "define -> example -> contrast".
- long_answer: bundle 2-3 sub-skills the writer will chain. Record the chain as a short arrow-separated string in visual_intent.purpose (<=240 chars) even when needs_visual is false. Example: "free-body diagram -> resolve forces along incline -> apply Newton 2 -> interpret sign of acceleration".`;

const EVIDENCE_GROUNDING_RULE = `Evidence grounding:
- When TOPIC_EVIDENCE for the slot's topic has items, cite 1-3 ref ids in evidence_refs that the writer should draw from.
- Prefer kind="exercise" and kind="question_bank" for higher-Bloom slots (they carry worked patterns); kind="content" suits Recall / Define slots.
- evidence_refs may be empty ONLY when the topic has no items in TOPIC_EVIDENCE. If GROUNDING_QUALITY is "ok", an empty evidence_refs on a populated topic is a planning miss.`;

const PERSONALIZATION_RULE = `Personalization (read TEST_PARAMETERS.focus_area and STUDENT_PROFILE):
- focus_area "recent_errors" AND STUDENT_PROFILE.recent_errors non-empty:
    Allocate >=40% of slots to concepts in recent_errors. Vary the scenario / numbers — never clone the missed item; the student must be testing the concept, not memorizing the prior question.
- focus_area "weak":
    Pitch ABOVE the student's current ability on these topics. Lean into known misconceptions from past performance.
- focus_area "not_tested":
    Bias toward topics with performance.tests_taken == 0; anchor those slots at the LOW half of the requested difficulty band; rely heavily on TOPIC_EVIDENCE.content_chunks for the writer.
- focus_area "all":
    Even distribution across topics. Let chunk availability and weakness signals break ties.`;

const VISUAL_RULE_ON = `Visual planning (VISUAL_POLICY.enabled is TRUE):
- For each slot, decide: does a non-text stimulus materially HELP assess slot.skill_target? If not — keep needs_visual=false.
- When needs_visual = true you MUST also set:
    visual_intent.preferred_kind: copy EXACTLY one string from the VISUAL_POLICY.preferred_kinds list provided in the user message. Use the snake_case identifier verbatim (e.g. "economics_curve", "statistics_chart", "physics_diagram"). DO NOT invent kebab-case or new IDs. If no listed kind seems to fit the slot, choose the closest one or leave needs_visual=false — never write a new kind ID.
    visual_intent.priority: "necessary" (item is unsolvable without the figure) | "high" (figure makes the item materially clearer) | "medium" (figure is a nice-to-have).
    visual_intent.visual_idea: a CONCRETE 1-3 sentence brief of what the student should SEE — axes & curve shape, geometry labels, circuit/optics layout, molecule/scheme, map region, passage + line refs, chart type + series, or table column meanings. It is the renderer's spec, NOT a restatement of the eventual stem.
- Visual BUDGET: VISUAL_POLICY.max_non_null_visuals is the cap. Mark only your top-priority slots needs_visual=true. Reserve "necessary" for items that cannot be assessed without the figure.
- Visual FLOOR: when the test's topic set includes **visual-heavy chapters** — Coordinate Geometry, Conic Sections, Straight Lines, Trigonometric Functions, Three-Dimensional Geometry, Frequency Distribution, Bivariate Frequency, Correlation, Diagrammatic Presentation of Data, Probability distributions, Physics circuits / free-body / optics / waves, Chemistry molecular structures — AT LEAST floor(0.25 * total_slots) slots (minimum 4) must have needs_visual=true with priority in {necessary, high, medium}. Slots on definitional or recall items inside those chapters may still be needs_visual=false, but the count across the test must meet the floor or the run will be flagged as under-grounded.
- Modality bias: prefer diagrams / plots / geometry / number lines / circuits / ray diagrams / molecules / maps / passages / charts over data_table when the skill is graphical or spatial. Use data_table only for items that truly require reading or comparing rows of numeric or categorical facts.
- Accountancy / financial items: prefer accountancy_table (or data_table when accountancy_table is absent) for journals, ledgers, trial balance, statements, classified numeric cases. Still write a specific visual_idea (which rows / columns, period, missing amounts).
- If VISUAL_POLICY.template_policy.enabled is true, choose a template id from the listed templates FIRST and set preferred_kind to that template's kind.
- When needs_visual = false: priority must be "none", preferred_kind null, visual_idea null, required false. The purpose field MAY carry the LA sub-skill chain even when needs_visual is false.
- visual_intent.required mirrors visual_intent.needs_visual (backward-compat — keep them aligned).`;

const VISUAL_RULE_OFF = `Visual planning (VISUAL_POLICY is DISABLED for this test):
- Set visual_intent to null on EVERY slot. The writer model will emit visual: null for every question.
- Do not invent a preferred_kind or visual_idea — anything non-null here is discarded downstream.`;

function buildBlueprintSystemPrompt(visualsOn: boolean): string {
	const visualBlock = visualsOn ? VISUAL_RULE_ON : VISUAL_RULE_OFF;
	return `You are an expert CBSE-style school test designer.
A separate WRITER model will draft the actual questions from your blueprint, so your job is to PLAN SLOTS that lead to a high-quality, pedagogically balanced, personalized practice test.

OUTPUT
- JSON only, matching the supplied schema.
- One entry per slot in the per-type buckets. The sum across buckets must equal the sum of EXPECTED_TYPE_COUNTS.

HARD CONSTRAINTS (the validator REJECTS the blueprint if any fail)
1. Per-type slot counts EXACTLY equal EXPECTED_TYPE_COUNTS.
2. slot.topic_id is copied VERBATIM from ALLOWED_TOPIC_IDS — full UUID, no edits, no near-misses.
3. evidence_refs values exist as ref ids in TOPIC_EVIDENCE for that slot's topic.
4. visual_intent obeys the VISUAL block below.

LENGTH CAPS (the JSON schema REJECTS the blueprint if any field exceeds these — stay under by 20+ chars to leave buffer)
- slot.skill_target ≤ 340 chars (target: 80-220).
- slot.visual_intent.visual_idea ≤ 560 chars (target: 1-3 short sentences).
- slot.visual_intent.purpose ≤ 320 chars.
- slot.visual_intent.reason ≤ 78 chars.
- top-level notes ≤ 1100 chars.

PLANNING RULES (these are what RAISE test quality — treat them as soft requirements the writer model relies on)

${TOPIC_COVERAGE_RULE}

${DIFFICULTY_DISTRIBUTION_RULE}

${SKILL_TARGET_RULE}

${QUESTION_TYPE_PLANNING_RULE}

${EVIDENCE_GROUNDING_RULE}

${PERSONALIZATION_RULE}

${visualBlock}

USE THE notes FIELD (top-level, <=600 chars)
Summarize the adaptation rationale for the writer: which topics you weighted up or down and why, how you distributed difficulty, the dominant Bloom verb mix, any constraint you had to compromise. This becomes the writer's orientation paragraph.

QUALITY-BAR EXAMPLES (match the SHAPE / specificity — do NOT copy verbatim; the IDs shown are placeholders)

Example multiple_choice slot, physics, medium:
{
  "slot_id": "mcq_3",
  "topic_id": "<uuid-from-ALLOWED_TOPIC_IDS>",
  "question_type": "multiple_choice",
  "difficulty_level": "medium",
  "skill_target": "Apply Newton's second law to find the net force on a 5 kg block on a frictionless 30-degree incline given g = 9.8 m/s^2.",
  "evidence_refs": ["<topic>:content:0", "<topic>:exercise:1"],
  "visual_intent": {
    "needs_visual": true,
    "priority": "high",
    "preferred_kind": "physics_diagram",
    "reason": "trap: confusing mg-sin-theta with mg-cos-theta",
    "visual_idea": "Block at rest on a 30-degree frictionless incline; arrows for weight (vertical), normal (perpendicular to surface), net force (along incline). Angle theta labelled at the base of the incline.",
    "required": true,
    "purpose": "Draw free-body -> resolve weight along and perpendicular to incline -> apply F = ma"
  }
}

Example long_answer slot, chemistry, hard (no visual):
{
  "slot_id": "la_2",
  "topic_id": "<uuid>",
  "question_type": "long_answer",
  "difficulty_level": "hard",
  "skill_target": "Analyze how Le Chatelier's principle predicts the direction of shift in a gas-phase equilibrium when temperature, pressure, and one reactant concentration change independently, with Kc-based reasoning.",
  "evidence_refs": ["<topic>:exercise:0", "<topic>:question_bank:1"],
  "visual_intent": {
    "needs_visual": false,
    "priority": "none",
    "preferred_kind": null,
    "reason": null,
    "visual_idea": null,
    "required": false,
    "purpose": "Write Kc expression -> compute Q at perturbed state -> compare Q vs Kc -> justify shift direction"
  }
}`;
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

	const focusArea = ctx.userPayload.student.focus_area ?? "all";
	const testParameters = {
		subject_id: ctx.subject.id,
		subject_name: ctx.subject.name,
		student_grade: ctx.subject.studentGrade,
		subject_grade: ctx.subject.subjectGrade,
		difficulty: ctx.plan.difficulty,
		duration_seconds: ctx.plan.durationSeconds,
		expected_question_count: ctx.plan.expectedQuestionCount,
		focus_area: focusArea,
	};

	const studentProfile = {
		grade: ctx.subject.studentGrade,
		focus_area: focusArea,
		recent_errors: ctx.userPayload.student.recent_errors ?? [],
		topics: ctx.userPayload.topics,
	};

	const visualPolicy =
		ctx.visuals.enabled && ctx.visuals.preferredKinds.length > 0
			? {
					enabled: true,
					preferred_kinds: ctx.visuals.preferredKinds,
					max_non_null_visuals: ctx.visuals.maxNonNullVisuals,
					template_policy: ctx.visuals.templatePolicy ?? null,
				}
			: { enabled: false };

	const groundingQuality = ctx.userPayload.grounding_meta.context_quality ?? "ok";

	// Surface the allowed preferred_kinds as a top-level block so the model is
	// MUCH less likely to invent a kebab-cased ID (we've seen
	// "economics-sectors-chart-grade-10" come back from the blueprint LLM
	// when only the nested VISUAL_POLICY.preferred_kinds list was visible).
	const allowedKindsBlock =
		ctx.visuals.enabled && ctx.visuals.preferredKinds.length > 0
			? [
					"ALLOWED_PREFERRED_KINDS (the EXACT strings allowed in visual_intent.preferred_kind — copy verbatim, never invent):",
					JSON.stringify(ctx.visuals.preferredKinds),
					"",
				]
			: [];

	return [
		"TEST_PARAMETERS:",
		JSON.stringify(testParameters),
		"",
		"EXPECTED_TYPE_COUNTS:",
		JSON.stringify(ctx.plan.expectedTypeCounts),
		"",
		"ALLOWED_TOPIC_IDS:",
		JSON.stringify(ctx.plan.allowedTopicIds),
		"",
		`GROUNDING_QUALITY: ${groundingQuality}`,
		"",
		"STUDENT_PROFILE:",
		JSON.stringify(studentProfile),
		"",
		"TOPIC_EVIDENCE:",
		JSON.stringify(topicEvidenceJson),
		"",
		...allowedKindsBlock,
		"VISUAL_POLICY:",
		JSON.stringify(visualPolicy),
	].join("\n");
}

/**
 * Token budget scales with slot count so 30-question tests aren't truncated.
 * Each rich slot serializes to roughly 200-250 tokens once skill_target,
 * evidence_refs, visual_idea, and purpose are populated; we add 1500 tokens of
 * overhead for the notes field and JSON framing. Clamped to a sane ceiling.
 */
function computeBlueprintMaxOutputTokens(expectedTypeCounts: PracticeQuestionTypeCounts): number {
	const totalSlots =
		expectedTypeCounts.multiple_choice +
		expectedTypeCounts.fill_in_blank +
		expectedTypeCounts.short_answer +
		expectedTypeCounts.long_answer;
	const headroom = 1_500 + 250 * totalSlots;
	return Math.max(4_000, Math.min(12_000, headroom));
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
	const visualsOn =
		args.jobContext.visuals.enabled && args.jobContext.visuals.preferredKinds.length > 0;

	try {
		const { object, usage, telemetry } = await generateStructured({
			resolved,
			schema,
			system: buildBlueprintSystemPrompt(visualsOn),
			prompt: buildBlueprintUserPrompt(args.jobContext),
			maxOutputTokens: computeBlueprintMaxOutputTokens(args.jobContext.plan.expectedTypeCounts),
			maxRetries: 1,
			abortSignal: args.abortSignal,
			providerOptions: {
				openai: { strictJsonSchema: true },
			},
		});

		const parsed = object as PracticeGenerationBlueprintGrouped;
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
			// Record the failed first attempt and try ONE repair turn that feeds
			// the invariant error back to the model. The structured-output adapter
			// already handles JSON / Zod-schema failures via `maxRepairAttempts`,
			// but post-Zod runtime invariants (e.g. "priority must be 'none' when
			// needs_visual is false") are checked by `validatePracticeGenerationBlueprint`
			// AFTER `generateStructured` returns success — so the adapter never sees
			// them. Without this repair turn, a single LLM slip-up aborts the whole
			// pipeline (we observed two such failures in production today).
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

			const repair = await attemptBlueprintRepair({
				jobContext: args.jobContext,
				promptRevision: args.promptRevision,
				schema,
				visualsOn,
				resolved,
				modelId,
				originalOutput: parsed,
				originalError: check.message,
				abortSignal: args.abortSignal,
			});
			if (repair.ok) {
				return {
					ok: true,
					blueprint: repair.blueprint,
					model: modelId,
					modelMs: (Date.now() - t0) + repair.repairMs,
					inputTokens: (usage?.inputTokens ?? 0) + repair.inputTokens,
					outputTokens: (usage?.outputTokens ?? 0) + repair.outputTokens,
				};
			}
			return {
				ok: false,
				message: repair.message,
				model: modelId,
				modelMs: (Date.now() - t0) + repair.repairMs,
				inputTokens: (usage?.inputTokens ?? 0) + repair.inputTokens,
				outputTokens: (usage?.outputTokens ?? 0) + repair.outputTokens,
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

/**
 * One-shot repair pass for blueprints that pass JSON / Zod-schema validation
 * but fail the post-Zod runtime invariant check in
 * `validatePracticeGenerationBlueprint`. Feeds the original output + the exact
 * error message back to the model and asks for a minimal fix.
 *
 * Returns `ok: true` only if the repaired blueprint passes validation.
 * Both the failed first attempt (recorded by the caller) and this repair
 * attempt land as separate `ai_calls` rows so dashboards can count repair
 * frequency. No cascade — only ONE repair attempt; if it also fails, the
 * caller surfaces the original failure to the pipeline (which aborts).
 */
async function attemptBlueprintRepair(args: {
	jobContext: PracticeGenerationJobContext;
	promptRevision: string;
	schema: ReturnType<typeof createPracticeGenerationBlueprintSchema>;
	visualsOn: boolean;
	resolved: ReturnType<typeof resolveChatModel>;
	modelId: string;
	originalOutput: PracticeGenerationBlueprintGrouped;
	originalError: string;
	abortSignal?: AbortSignal;
}): Promise<
	| {
			ok: true;
			blueprint: PracticeGenerationBlueprintGrouped;
			repairMs: number;
			inputTokens: number;
			outputTokens: number;
	  }
	| {
			ok: false;
			message: string;
			repairMs: number;
			inputTokens: number;
			outputTokens: number;
	  }
> {
	const t0 = Date.now();
	const repairSystem = buildBlueprintSystemPrompt(args.visualsOn);
	const repairUser = [
		"BLUEPRINT REPAIR — previous attempt failed runtime validation.",
		"",
		"## Previous output (JSON)",
		JSON.stringify(args.originalOutput),
		"",
		"## Validation error",
		args.originalError,
		"",
		"## Instructions",
		"Re-emit the FULL blueprint with the offending slot fixed. Keep all valid slots unchanged where possible. Common fixes:",
		"  • If `visual_intent.priority` is anything other than `\"none\"`, then `needs_visual` MUST be `true`.",
		"  • If `needs_visual` is `false`, then `visual_intent.priority` MUST be `\"none\"` and `preferred_kind` MUST be `null`.",
		"  • Do NOT add or remove slots — preserve total counts per question type.",
		"",
		"## Original input (for context)",
		buildBlueprintUserPrompt(args.jobContext),
	].join("\n");

	let inputTokens = 0;
	let outputTokens = 0;
	try {
		const { object, usage, telemetry } = await generateStructured({
			resolved: args.resolved,
			schema: args.schema,
			system: repairSystem,
			prompt: repairUser,
			maxOutputTokens: computeBlueprintMaxOutputTokens(args.jobContext.plan.expectedTypeCounts),
			maxRetries: 0,
			maxRepairAttempts: 0, // one shot — caller already absorbed the original failure
			abortSignal: args.abortSignal,
			providerOptions: {
				openai: { strictJsonSchema: true },
			},
		});
		inputTokens = usage?.inputTokens ?? 0;
		outputTokens = usage?.outputTokens ?? 0;

		const repaired = object as PracticeGenerationBlueprintGrouped;
		const check = validatePracticeGenerationBlueprint({
			blueprint: repaired,
			allowedTopicIds: new Set(args.jobContext.plan.allowedTopicIds),
			expectedTypeCounts: args.jobContext.plan.expectedTypeCounts,
			visualPolicy:
				args.visualsOn ?
					{
						enabled: true,
						preferredKinds: args.jobContext.visuals.preferredKinds,
					}
				:	null,
		});

		const repairMs = Date.now() - t0;
		void recordAiCall({
			feature: "practice.generation.blueprint",
			model: args.modelId,
			userId: args.jobContext.userId,
			promptId: args.promptRevision,
			generationRunId: args.jobContext.generationRunId,
			correlationId: args.jobContext.correlationId,
			stepKey: "blueprint_repair",
			inputTokens,
			outputTokens,
			reasoningTokens: telemetry.reasoningTokens,
			cacheHitTokens: telemetry.cacheHitTokens,
			cacheMissTokens: telemetry.cacheMissTokens,
			provider: telemetry.provider,
			latencyMs: repairMs,
			status: check.ok ? "ok" : "error",
			error: check.ok ? null : check.message,
		});

		if (check.ok) {
			return { ok: true, blueprint: repaired, repairMs, inputTokens, outputTokens };
		}
		return { ok: false, message: check.message, repairMs, inputTokens, outputTokens };
	} catch (error) {
		const message = formatBlueprintError(error);
		const repairMs = Date.now() - t0;
		void recordAiCall({
			feature: "practice.generation.blueprint",
			model: args.modelId,
			userId: args.jobContext.userId,
			promptId: args.promptRevision,
			generationRunId: args.jobContext.generationRunId,
			correlationId: args.jobContext.correlationId,
			stepKey: "blueprint_repair",
			inputTokens,
			outputTokens,
			provider: args.resolved.provider,
			latencyMs: repairMs,
			status: "error",
			error: message,
		});
		return { ok: false, message, repairMs, inputTokens, outputTokens };
	}
}

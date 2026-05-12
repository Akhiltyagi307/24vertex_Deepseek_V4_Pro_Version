import type { PracticeGenerationOutput } from "../generation-schema";
import type { PracticeTopicEvidencePack } from "../generation-evidence-pack";
import type { PracticeUserMessagePayload } from "../user-message";
import { pickExemplarsForSubject, type VisualExemplar } from "./exemplars";
import type { QuestionVisualKind } from "./types";

function mapSubjectToExemplarKey(
	subjectName?: string | null,
): VisualExemplar["subjects"][number] {
	if (!subjectName) return "mathematics";
	const lower = subjectName.toLowerCase();
	if (lower.includes("geography")) return "geography";
	if (
		lower.includes("social science") ||
		lower.includes("political science") ||
		lower.includes("civics") ||
		lower.includes("history")
	) {
		return "social_science";
	}
	if (lower.includes("business studies")) return "business_studies";
	if (lower.includes("accountancy")) return "accountancy";
	if (lower.includes("economics") || lower.includes("statistics")) return "economics_statistics";
	if (lower.includes("physics")) return "physics";
	if (lower.includes("chemistry")) return "chemistry";
	if (lower.includes("biology")) return "biology";
	if (lower.includes("science")) return "science";
	if (lower.includes("english")) return "english";
	return "mathematics";
}

function buildExemplarBlock(
	subjectName: string,
	topicExemplarHint: string | null | undefined,
	limit = 8,
): string {
	const subjectKey = mapSubjectToExemplarKey(subjectName);
	const examples = pickExemplarsForSubject(subjectKey, limit, {
		topicHintNorm: topicExemplarHint?.trim() ? topicExemplarHint.trim().toLowerCase() : undefined,
	});
	if (examples.length === 0) return "[]";
	return JSON.stringify(
		examples.map((ex) => ({
			stem: ex.stem,
			visual: ex.visual,
			topic_keywords: ex.topicKeywords ?? [],
		})),
	);
}

export function buildVisualEnrichmentSystemPrompt(args?: { strictGrounding?: boolean }): string {
	const strictGrounding = args?.strictGrounding !== false;
	const groundingRules =
		strictGrounding ?
			`- Treat CANDIDATE_QUESTION_BUNDLES as the single source of truth for literals.
- Every numeric literal, unit, point/component/object label, state symbol, and named entity in visual.spec must be present in that candidate's question_text/options.
- Secondary guides are allowed even when absent in the stem (axis ticks/gridlines, "x"/"y" axis markers, generic table headers, and helper letters such as A/B/C when non-answer-bearing).
- Never copy numbers/entities from VISUAL_EXEMPLARS_JSON or topic_evidence unless they also appear in the candidate question payload.
- If a faithful grounded visual cannot be produced, return null_visual for that index.`
		:	"";
	return `You enrich already-generated practice questions by adding safe, schema-valid visuals.

Output MUST be a raw JSON array of patch objects:
- action: "replace_visual" | "null_visual"
- index: integer (0-based question index)
- replace_visual requires "value" (full visual envelope: caption, altText, spec)

Rules:
- Only patch indices listed in CANDIDATE_INDEXES.
- CANDIDATE_INTENT_JSON provides per-index visual need priority and reason.
- Prioritize replace_visual for priority necessary/high candidates unless impossible.
- Keep answer correctness unchanged.
- Do not rewrite question text or explanations in this pass.
- Use allowed visual kinds only.
- When \`blueprint_visual_idea\` appears on a candidate bundle intent, treat it as the primary stimulus brief: \`replace_visual\` must realize that idea using \`preferred_kind\` (or the closest faithful allowed kind). The diagram, graph, or table must be **about the same situation** as the brief — not a generic unrelated scaffold. Do not substitute a decorative \`data_table\` that only re-lists prose givens unless \`preferred_kind\` is \`data_table\` or \`accountancy_table\`.
- Prefer replace_visual whenever a visual adds clear instructional value
  (spatial setup, trend/relationship, table of values, or labeled diagram).
- In each pass, enrich as many candidate questions as possible when visuals add
  clear learning value; do not stop after a single replace_visual.
- Use null_visual only when a visual would add little/no learning value.
- If a visual cannot be made safely, return null_visual for that index.
- Before finalizing output, self-verify every proposed replace_visual:
  - caption and altText are present and non-spoiling,
  - spec is internally consistent (bounds/ranges/orderings/labels),
  - the visual improves clarity for that exact stem.
- If self-verification fails, improve the visual once; if it still fails,
  return null_visual for that index.
- If require_at_least_one_visual is true, return at least one replace_visual patch.
- When adding label references in stem (A, B, etc), ensure those labels exist in visual.spec.
- Never leak the answer in caption/altText.
${groundingRules}
- Physics sub-topic routing: \`physics_diagram/free_body\` is **only** for Newtonian mechanics questions about forces, tension, friction, inclined planes, pulleys, or Newton's laws. For **gravitation geometry** (Earth radius \`R_E\`, height \`h\`, depth \`d\`, escape paths, Moon/Earth comparison, neutral point between spheres), use \`math_geometry\` with circles/points/segments/vectors; never use a block-on-plane or weight/normal free-body diagram. For **waves/oscillations/SHM** (wavelength, frequency, superposition, beats, resonance, standing waves, SHM), use \`math_function_plot\` with \`sin(x)\` or \`cos(x)\`. For **kinetic theory / thermodynamics** (mean free path, rms speed, Cv/Cp, equipartition, PV/TV diagrams), use \`math_function_plot\` for a relevant curve or \`data_table\` for comparisons. When a question is abstract/derivation and no allowed kind adds genuine learning value, return \`null_visual\` — a generic scaffold that does not relate to the specific question is worse than no visual.
- Concept-family routing: for intent reason \`kinematics_components\`, use \`math_geometry\` for velocity/component vectors or \`math_function_plot\` for projectile trajectory; never use \`physics_diagram/free_body\`. For \`work_energy_forces\`, use \`physics_diagram/free_body\` only when force/displacement/friction directions are explicit and all named forces are represented. For \`chemistry_equilibrium\`, use \`chemistry_reaction\` or \`data_table\`; do not emit \`chemistry_molecule\` unless the stem explicitly asks about structure/connectivity. For \`chemistry_lewis\`, use \`chemistry_molecule\` only as a connectivity substitute when that is genuinely enough; otherwise return \`null_visual\` rather than approximating with an unrelated atom/molecule scaffold.
- Output JSON only, no markdown.`;
}

export function buildVisualEnrichmentUserPrompt(args: {
	output: PracticeGenerationOutput;
	subjectName: string;
	preferredKinds: QuestionVisualKind[];
	candidateIndexes: number[];
	candidateIntent?: Array<{
		index: number;
		priority: "necessary" | "high" | "medium";
		reason: string;
		preferred_kind: QuestionVisualKind | null;
		blueprint_visual_idea?: string | null;
	}>;
	topicEvidence: PracticeTopicEvidencePack[];
	topicExemplarHint?: string | null;
	templatePolicy?: PracticeUserMessagePayload["test_parameters"]["visuals_policy"]["template_policy"] | null;
	requireAtLeastOneVisual?: boolean;
	strictGrounding?: boolean;
}): string {
	const intentByIndex = new Map((args.candidateIntent ?? []).map((intent) => [intent.index, intent]));
	const candidateQuestionBundles = args.candidateIndexes.map((index) => {
		const question = args.output.questions[index];
		const intent = intentByIndex.get(index);
		return {
			index,
			question_text: question?.question_text ?? null,
			question_type: question?.question_type ?? null,
			options: question?.question_type === "multiple_choice" ? question.options : null,
			allowed_visual_kinds: args.preferredKinds,
			intent:
				intent ?
					{
						priority: intent.priority,
						reason: intent.reason,
						preferred_kind: intent.preferred_kind,
						blueprint_visual_idea: intent.blueprint_visual_idea ?? null,
					}
				:	null,
		};
	});

	return [
		"VISUAL_ENRICHMENT_INPUT:",
		JSON.stringify({
			subject_name: args.subjectName,
			allowed_visual_kinds: args.preferredKinds,
			candidate_indexes: args.candidateIndexes,
			candidate_intent: args.candidateIntent ?? [],
			candidate_question_bundles: candidateQuestionBundles,
			require_at_least_one_visual: args.requireAtLeastOneVisual === true,
			strict_grounding: args.strictGrounding !== false,
			template_policy: args.templatePolicy ?? null,
			topic_evidence: args.topicEvidence,
			questions: args.output.questions,
		}),
		"",
		"VISUAL_EXEMPLARS_JSON:",
		buildExemplarBlock(args.subjectName, args.topicExemplarHint),
	].join("\n");
}

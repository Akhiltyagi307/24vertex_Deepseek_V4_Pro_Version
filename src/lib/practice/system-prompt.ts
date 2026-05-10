import type { PracticeQuestionTypeCounts } from "./constants";
import { isMathematicsSubject } from "./constants";
import {
	getPracticeGenerationSubjectPreamble,
	resolvePracticeGenerationSubjectRouting,
} from "./generation-prompt-registry";
import type { PracticeUserMessagePayload } from "./user-message";

export type PracticeGenerationSubjectContext = {
	subjectName: string;
	/** `subjects.grade` for this curriculum row */
	subjectGrade: number | null;
	subjectGroup: string | null;
	studentGrade: number | null;
};

type UserMessageSummary = Pick<
	PracticeUserMessagePayload,
	"schema_version" | "intent" | "test_parameters" | "constraints"
> & {
	/** Subject name passed in so the Math-only banner is reinforced contextually. */
	subjectName?: string | null;
};

/**
 * Per-bucket weights used to derive concrete time targets for the model.
 * MCQ is the baseline; written items take longer per question. The targets
 * are advisory — the validator only enforces the total time band — but a
 * concrete number per bucket is far easier for the model to land in one shot
 * than mental arithmetic across 15–30 items.
 */
const BUCKET_TIME_WEIGHTS: Record<keyof PracticeQuestionTypeCounts, number> = {
	multiple_choice: 1,
	fill_in_blank: 0.7,
	short_answer: 2.5,
	long_answer: 4,
};

function computePerBucketTimeTargets(
	timeLimitSeconds: number,
	counts: PracticeQuestionTypeCounts,
): { mcq: number; fib: number; sa: number; la: number } {
	const totalWeight =
		counts.multiple_choice * BUCKET_TIME_WEIGHTS.multiple_choice +
		counts.fill_in_blank * BUCKET_TIME_WEIGHTS.fill_in_blank +
		counts.short_answer * BUCKET_TIME_WEIGHTS.short_answer +
		counts.long_answer * BUCKET_TIME_WEIGHTS.long_answer;
	if (totalWeight <= 0) return { mcq: 60, fib: 45, sa: 180, la: 360 };
	const perWeight = timeLimitSeconds / totalWeight;
	return {
		mcq: Math.max(20, Math.round(perWeight * BUCKET_TIME_WEIGHTS.multiple_choice)),
		fib: Math.max(20, Math.round(perWeight * BUCKET_TIME_WEIGHTS.fill_in_blank)),
		sa: Math.max(60, Math.round(perWeight * BUCKET_TIME_WEIGHTS.short_answer)),
		la: Math.max(120, Math.round(perWeight * BUCKET_TIME_WEIGHTS.long_answer)),
	};
}

/**
 * Build the HARD GATES block — the non-negotiable machine constraints.
 * Reused at the very top AND at the very end of the system prompt so
 * recency on long inputs reinforces the same rules the validator enforces.
 */
function buildHardGatesBlock(args: {
	heading: string;
	estimatedQuestionCount: number;
	counts: PracticeQuestionTypeCounts;
	timeLimitSeconds: number;
	timeSumMin: number;
	timeSumMax: number;
	bucketTimes: { mcq: number; fib: number; sa: number; la: number };
	subjectIsMath: boolean;
}): string {
	const c = args.counts;
	const mathBanner =
		args.subjectIsMath ?
			"- Subject is Mathematics: EVERY question must be in `multiple_choice`. The `fill_in_blank`, `short_answer`, and `long_answer` arrays MUST be empty arrays."
		:	"- If the subject is Mathematics, every question is `multiple_choice` and the other three buckets are empty. (For this test the counts below already encode that.)";

	const perBucketTimes =
		[
			c.multiple_choice > 0 ? `MCQ ~${args.bucketTimes.mcq}s each` : null,
			c.fill_in_blank > 0 ? `FIB ~${args.bucketTimes.fib}s each` : null,
			c.short_answer > 0 ? `short_answer ~${args.bucketTimes.sa}s each` : null,
			c.long_answer > 0 ? `long_answer ~${args.bucketTimes.la}s each` : null,
		]
			.filter(Boolean)
			.join(", ");

	return `${args.heading}
- Output JSON only — no markdown fences, no commentary, no leading or trailing prose.
- Emit EXACTLY ${args.estimatedQuestionCount} questions across the four buckets: ${c.multiple_choice} multiple_choice, ${c.fill_in_blank} fill_in_blank, ${c.short_answer} short_answer, ${c.long_answer} long_answer. Buckets MUST contain exactly that many items — not one more, not one fewer. If a bucket is 0, emit an empty array \`[]\`.
${mathBanner}
- topic_id COPY PROTOCOL: every \`topic_id\` MUST be copied character-for-character from \`test_parameters.allowed_topic_ids\` (or the same values under \`topic_grounding[].topic_id\`). Do NOT type a UUID from memory, do NOT splice segments from two different ids, do NOT lowercase/uppercase or trim. Set each question's \`topic_name\` to the \`topic_grounding[].topic_name\` matching that exact \`topic_id\`.
- multiple_choice questions MUST include \`options\` with exactly the four keys A, B, C, D (string values). \`answer_key.correct_answer\` MUST be exactly one of "A", "B", "C", or "D" matching one of those keys. Do NOT emit \`options: null\` inside multiple_choice; if the stem is a single blank or short completion, place it in \`fill_in_blank\` instead.
- fill_in_blank, short_answer, long_answer questions MUST omit \`options\` entirely (or set it to null). Their \`answer_key.correct_answer\` is a short string for FIB, sentences for short_answer, paragraph-style for long_answer.
- MCQ self-consistency: for each MCQ, mentally re-solve the stem and confirm \`answer_key.correct_answer\` is the letter of the option that solves it. The explanation must justify THAT letter only. For numerically-keyed MCQs, recompute every option's value before locking the letter.
- Time budget: SUM of every question's \`estimated_time_seconds\` across ALL buckets MUST be between ${args.timeSumMin} and ${args.timeSumMax} inclusive (target ~${args.timeLimitSeconds}). Per-bucket starting points: ${perBucketTimes || "n/a"}. Adjust ±20% within the band based on item complexity.`;
}

/**
 * Shared rules and JSON contract for the assessment generator (server-side).
 * Subject-specific preamble is prepended by `buildPracticeSystemPrompt`.
 */
export function buildPracticeGenerationSharedSystemInstructions(userMessageSummary: UserMessageSummary): string {
	const {
		estimated_question_count,
		difficulty,
		time_limit_seconds,
		topic_count,
		coverage_mode,
		coverage_instruction,
		question_type_counts,
	} = userMessageSummary.test_parameters;

	const subjectIsMath = isMathematicsSubject(userMessageSummary.subjectName);
	const timeSumMin = Math.round(time_limit_seconds * 0.6);
	const timeSumMax = Math.round(time_limit_seconds * 1.2);
	const bucketTimes = computePerBucketTimeTargets(time_limit_seconds, question_type_counts);

	const hardGatesTop = buildHardGatesBlock({
		heading: "## HARD GATES (non-negotiable machine constraints)",
		estimatedQuestionCount: estimated_question_count,
		counts: question_type_counts,
		timeLimitSeconds: time_limit_seconds,
		timeSumMin,
		timeSumMax,
		bucketTimes,
		subjectIsMath,
	});

	const finalChecklist = buildHardGatesBlock({
		heading: "## FINAL COMPLIANCE CHECKLIST — verify before you emit",
		estimatedQuestionCount: estimated_question_count,
		counts: question_type_counts,
		timeLimitSeconds: time_limit_seconds,
		timeSumMin,
		timeSumMax,
		bucketTimes,
		subjectIsMath,
	});

	return `${hardGatesTop}

## Pedagogy

- Difficulty target: ${difficulty}. Calibrate reading length, computation steps, and distractor quality accordingly.
- Bloom-inspired cognitive demand: map each item to one of Remember, Understand, Apply, Analyze, Evaluate, Create as appropriate to the subject and grade. Earlier items may lean lower; later items may climb where the global difficulty allows. Keep \`difficulty_level\` consistent with that cognitive demand.
- Topic coverage: selected ${topic_count} topic(s); coverage_mode=${coverage_mode}. Follow this instruction exactly: ${coverage_instruction}
- When performance data exists in \`topics[].performance\`, favor weaker areas (lower \`average_score_percent\`, worse status, fewer tests_taken, declining trend) when allocating questions.
- When \`student.recent_errors\` is present, bias roughly 25–35% of items toward those concepts where the pedagogy allows. Use a different scenario or representation; never repeat the prior wording.
- Pedagogical quality: unambiguous prompts, correct mathematics, physically sensible science, exactly one defensible best answer for MCQs. Distractors must be plausible misconceptions, not filler.
- Explanations in \`answer_key\` must teach: step-by-step reasoning, common mistakes, and a related concept.
- Do not include profanity, stereotypes, or personally identifiable information.

## Student-friendly language (stems and answer keys)

The student is the audience, not a board examiner colleague. Adopt the voice of
a clear, kind teacher who respects the student's intelligence.

### In \`question_text\`

- Lead with the concrete situation, then ask. Do not stack three nested
  qualifiers before the verb.
- One idea per sentence. Break compound sentences if the verb-to-noun distance
  exceeds ~12 words.
- Prefer concrete names over abstract placeholders when it does not change the
  pedagogy: "Rohan invests ₹5,000…" beats "A person invests ₹X…".
- Use Indian-English conventions (₹, lakh/crore where the topic permits, school
  examples like Maths/CBSE/ICSE).
- Avoid jargon the chunks did not introduce. If a domain word IS the assessment
  target, use it; if it is incidental, use a plainer synonym.
- Never use double negatives ("which of the following is NOT untrue").
- Numerical inputs in word problems should be friendly: round to 2 sig figs
  unless the topic specifically tests precision.

### In \`answer_key.explanation\`

Structure every explanation as four short parts (no headings, just sentences):

  1. ONE-LINE ANSWER. State the result first. ("The slope is 2.")
  2. WHY (concept). Name the rule, formula, or principle being applied in
     student-language ("Slope is rise over run — change in y divided by
     change in x.").
  3. HOW (worked steps). Show the arithmetic / algebra / chemistry steps
     compactly, one per line if multi-step. Use \`$...$\` for any expression.
  4. SO WHAT (anchor). One sentence connecting back to the topic so the
     student can place this in memory ("This is the same idea as the
     gradient of any straight line in coordinate geometry.").

Length targets: easy=80–150 words, medium=120–220, hard=180–320. Do NOT pad to
hit the upper bound; under is better than over.

### In \`answer_key.common_mistakes\`

Each entry is one full sentence in the form:
  "Students often <do X>; this leads to <wrong result> because <reason>."

NOT just a label. NOT a one-word fragment. The mistake teaches by naming the
trap AND why it traps.

### In \`answer_key.related_concept\`

A plain-language phrase, NOT a textbook title. "Slope and gradient" beats
"Coordinate geometry — Section 7.2".

### Tone (for stems and explanations)

Clear, encouraging, never condescending. Avoid "obviously", "trivially",
"simply" — what feels obvious to the writer almost never feels obvious to a
student stuck on the topic. Avoid long parenthetical asides; if the parenthesis
matters, write it as its own sentence.

## Using \`topic_grounding\` chunks

For each topic, treat the two chunk arrays as a pair with distinct jobs:
- \`content_chunks\` — NCERT-style explanatory passages. Use them to decide WHAT to ask (concepts, definitions, processes, formulae, named entities).
- \`exercise_chunks\` — NCERT-style end-of-chapter questions. Use them to decide HOW to ask (register, cadence, command verbs, scaffolding, format conventions).

Rules:
1. Style imitation. Match the register, cadence, and command-verb family of \`exercise_chunks\` for that topic. The test should sound like it came from the same chapter — without copying any chunk verbatim.
2. Per-topic stylistic loyalty. In multi-topic tests, take stylistic cues for each item from THAT item's own topic chunks, not from a dominant topic.
3. Do not import chunk noise. Silently correct typos, OCR artefacts, and stray captions. Imitate intent and register, not accidents.
4. When \`grounding_meta.context_quality\` is \`low_context\` or \`no_context\`, stay at the conceptual / definition level for affected topics; do not invent specific named examples, dates, formulae, or numeric constants you cannot verify from the chunks.

## Output shape

Top-level: \`{ questions_by_type: { multiple_choice, fill_in_blank, short_answer, long_answer }, generation_metadata: { adaptation_rationale } }\`. Each question contains \`topic_id\`, \`topic_name\`, \`question_text\`, \`difficulty_level\` (easy|medium|hard), \`estimated_time_seconds\` (positive integer), and \`answer_key\` ({ correct_answer, explanation, common_mistakes[], related_concept }). Multiple-choice items also include \`options\` ({A,B,C,D}). \`generation_metadata.adaptation_rationale\` should be a short string and SHOULD include the intended total seconds (e.g. "sum target = ${time_limit_seconds}").

${finalChecklist}

Schema marker: intent=${userMessageSummary.intent}, schema_version=${userMessageSummary.schema_version}.`;
}

/**
 * System prompt for the assessment generator (server-side).
 * Output is written to DB; students never receive raw answer keys from this channel.
 */
export function buildPracticeSystemPrompt(context: {
	userMessageSummary: UserMessageSummary;
	generationSubject: PracticeGenerationSubjectContext;
}): string {
	const routing = resolvePracticeGenerationSubjectRouting(
		context.generationSubject.subjectGrade,
		context.generationSubject.studentGrade,
		context.generationSubject.subjectGroup,
		context.generationSubject.subjectName,
	);
	const preamble = getPracticeGenerationSubjectPreamble(routing, {
		subjectName: context.generationSubject.subjectName,
		subjectGrade: context.generationSubject.subjectGrade,
	});
	const summaryWithSubject: UserMessageSummary = {
		...context.userMessageSummary,
		subjectName: context.generationSubject.subjectName,
	};
	const shared = buildPracticeGenerationSharedSystemInstructions(summaryWithSubject);
	return `${preamble}\n\n${shared}`;
}

import type { PracticeQuestionTypeCounts } from "./constants";
import { isMathematicsSubject } from "./constants";
import type { PracticeDifficulty } from "./types";
import {
	getPracticeGenerationSubjectPreamble,
	resolvePracticeGenerationSubjectRouting,
} from "./generation-prompt-registry";
import type { PracticeUserMessagePayload } from "./user-message";
import { getPracticeVisualExemplarCount, isPracticeVisualsEnabledForSubject } from "./visuals/env";
import { pickExemplarsForSubject, type VisualExemplar } from "./visuals/exemplars";

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
	/** Student grade (from payload.student.grade) for concise band rules. */
	student_grade?: number | null;
	/** Curriculum subject grade when known (from routing / subject row). */
	subject_grade?: number | null;
	/**
	 * Lowercase concat of selected topic names + unit/chapter hints, built server-side
	 * for exemplar relevance only (not sent on the student-facing user JSON schema).
	 */
	topic_exemplar_hint?: string | null;
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

function buildGradeBandSection(grade: number | null | undefined): string {
	if (grade == null || typeof grade !== "number" || !Number.isFinite(grade)) return "";
	if (grade <= 8) {
		return `### Grade band (about class ${grade})\n\n- Prefer shorter stems with fewer stacked clauses; one main task per question. Keep vocabulary aligned to NCERT tier for middle school.\n\n`;
	}
	if (grade <= 10) {
		return `### Grade band (about class ${grade})\n\n- Standard secondary depth; avoid long multi-part stems unless the topic requires it.\n\n`;
	}
	return `### Grade band (about class ${grade})\n\n- May use denser stems, formal notation, and multi-step items where the syllabus expects it.\n\n`;
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
	visualsEnabled: boolean;
	visualsPolicy?: PracticeUserMessagePayload["test_parameters"]["visuals_policy"];
	/** Appended only on the final checklist pass — subject discipline + sanity self-audit. */
	finalChecklistExtras?: string;
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

	const visualLine = args.visualsEnabled
		? "- `visual` field: **Maximize non-null visuals** per the Visuals section — default to attaching a non-null `visual` on every question when any `preferred_kinds` kind fits; use `null` only in the narrow exceptions listed there. If non-null, every label in the stem MUST match the spec."
		: "- `visual` field: ALWAYS emit `null` for every question in this generation.";

	let visualExtras = "";
	if (args.visualsEnabled && args.visualsPolicy) {
		const vp = args.visualsPolicy;
		const kindsLine =
			vp.preferred_kinds.length > 0 ?
				`- Non-null \`visual.spec.kind\` MUST be one of: ${JSON.stringify(vp.preferred_kinds)}. Do not invent other kinds.`
			:	`- \`visuals_policy.preferred_kinds\` is empty for this subject: emit \`visual: null\` on every question.`;
		const capLine =
			vp.max_non_null_visuals > 0 ?
				`- Non-null \`visual\`: no artificial per-test quota — **aim for one non-null visual on every question** when an allowed kind can faithfully support the item (see Visuals section for the narrow \`null\` exceptions).`
			:	`- Non-null visuals are disabled (\`max_non_null_visuals\` = 0): emit \`visual: null\` on every question.`;
		visualExtras = `\n${kindsLine}\n${capLine}`;
	}

	return `${args.heading}
- Output JSON only — no markdown fences, no commentary, no leading or trailing prose.
- Emit EXACTLY ${args.estimatedQuestionCount} questions across the four buckets: ${c.multiple_choice} multiple_choice, ${c.fill_in_blank} fill_in_blank, ${c.short_answer} short_answer, ${c.long_answer} long_answer. Buckets MUST contain exactly that many items — not one more, not one fewer. If a bucket is 0, emit an empty array \`[]\`.
${mathBanner}
- topic_id COPY PROTOCOL: every \`topic_id\` MUST be copied character-for-character from \`test_parameters.allowed_topic_ids\` (or the same values under \`topic_grounding[].topic_id\`). Do NOT type a UUID from memory, do NOT splice segments from two different ids, do NOT lowercase/uppercase or trim. Set each question's \`topic_name\` to the \`topic_grounding[].topic_name\` matching that exact \`topic_id\`.
- Chunk fidelity: paraphrase wording; reuse facts, numbers, labels, and scenario shapes from that item's \`topic_grounding\` chunks when they supply them. Stay consistent with \`curriculum_hint\`; do not contradict it. Use made-up numerics or novel setups only when chunks offer no concrete drill — then keep items conceptual and conservative per \`test_parameters.context_quality_instruction\`.
- multiple_choice questions MUST include \`options\` with exactly the four keys A, B, C, D (string values). \`answer_key.correct_answer\` MUST be exactly one of "A", "B", "C", or "D" matching one of those keys. Do NOT emit \`options: null\` inside multiple_choice; if the stem is a single blank or short completion, place it in \`fill_in_blank\` instead.
- fill_in_blank, short_answer, long_answer questions MUST omit \`options\` entirely (or set it to null). Their \`answer_key.correct_answer\` is a short string for FIB, sentences for short_answer, paragraph-style for long_answer.
- MCQ self-consistency: for each MCQ, mentally re-solve the stem and confirm \`answer_key.correct_answer\` is the letter of the option that solves it. The explanation must justify THAT letter only. For numerically-keyed MCQs, recompute every option's value before locking the letter.
- Time budget: SUM of every question's \`estimated_time_seconds\` across ALL buckets MUST be between ${args.timeSumMin} and ${args.timeSumMax} inclusive (target ~${args.timeLimitSeconds}). Per-bucket starting points: ${perBucketTimes || "n/a"}. Adjust ±20% within the band based on item complexity.
${visualLine}${visualExtras}${args.finalChecklistExtras ? `\n${args.finalChecklistExtras}` : ""}`;
}

/** Universal anti-trivia and quality floor — applies to every subject and bucket. */
function buildSubjectDisciplineBlock(difficulty: PracticeDifficulty): string {
	const rememberCap =
		difficulty === "easy" ?
			"For an `easy` test, at most **30%** of items may be `Remember`-level recall."
		:	"For `medium` and `hard` tests, at most **15%** of items may be `Remember`-level recall.";
	return `## Subject discipline (every question must teach the SUBJECT)

Each item exists to test the named subject's concepts, methods, or reasoning. If a non-subject expert could answer the item from general knowledge or trivia alone, the item is **OFF-BAND** — rewrite or replace it.

### Hard bans (EVERY question, EVERY bucket)

- **DATE / YEAR AS ANSWER.** Never key a four-digit year, a decade, or an "in what year" answer. Even if a date appears in \`topic_grounding\`, the year itself is not the subject concept — reframe to the process, mechanism, law, or theorem. (Bad: "Wöhler synthesised urea in ______" → 1828. Good: significance of urea synthesis for vital-force theory — only if that topic is in grounding.) **Exception — not assessing the year:** stems (e.g. Accountancy journal rows) may display transaction dates (dd Mmm yyyy); the keyed skill must remain classification or arithmetic, never "which calendar year…".
- **BIOGRAPHY AS ANSWER.** Never key a scientist's, mathematician's, economist's, or author's **name** as the answer unless \`topic_grounding\` is explicitly about the history of the discipline for that figure. Names may appear in the stem as setting; the **keyed** target must be a subject concept.
- **GENERAL-KNOWLEDGE / TRIVIA STEMS.** No "which country", "which capital", "which festival", "which year was X founded" unless the subject is Geography or Social Science and the chunk supports it.
- **DEFINITIONAL FLASHCARDS.** A fill-in-blank whose answer is one glossary word copied verbatim from the book is a flashcard, not an assessment — upgrade to one-step application / inference, or use another bucket. (Bad: "The SI unit of power is ______" → watt. Good: a short numerical power problem with clean numbers.)
- **SUBJECTIVE SUPERLATIVES WITHOUT GROUNDING.** Avoid "best", "latest", "most modern", "most important" unless the chunk explicitly supplies that ranking.
- **NEAR-DUPLICATE STEMS.** Within one test, do not paraphrase the same fact twice (e.g. "Wöhler … in ___" plus "In 1828, Wöhler …"). Each item must teach a **distinct** skill — avoid copy-paste procedural twins (e.g. two Lassaigne setups differing only in trivial wording).

### Cognitive-demand floor

- ${rememberCap}
- The rest must be \`Understand\`, \`Apply\`, \`Analyze\`, \`Evaluate\`, or \`Create\`. Convert pure recall into application, sign/trend prediction, or a one-line worked step.

### Numeric and answer-key sanity (every numerical item)

- Recompute the keyed answer end-to-end before emitting. If the result is impossible (supersonic speeds from everyday forces, percentage > 100%, probability outside [0, 1], balance sheet that does not balance), **change the input numbers** — do not ship the item.
- For MCQs, recompute **every option's** numeric value, not only the keyed letter, so two options never accidentally match the correct value.
- If the stem is fixed and only options shuffle between items, reshuffle so \`correct_answer\` stays consistent — never reuse the same stem with a different keyed letter unless the scenario changed.
- For **fill_in_blank**, **short_answer**, and **long_answer**, numeric \`correct_answer\` must match the arithmetic in \`answer_key.explanation\` (catch half/double-mole and back-titration errors).
- Drop or rewrite any item whose \`correct_answer\` is **only** a bare four-digit calendar year.

Current difficulty band from payload: **${difficulty}**.`;
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
	const subjectNameForVisuals = userMessageSummary.subjectName ?? "";
	const visualsEnabled = isPracticeVisualsEnabledForSubject(subjectNameForVisuals);

	const vp = userMessageSummary.test_parameters.visuals_policy;
	const hardGatesTop = buildHardGatesBlock({
		heading: "## HARD GATES (non-negotiable machine constraints)",
		estimatedQuestionCount: estimated_question_count,
		counts: question_type_counts,
		timeLimitSeconds: time_limit_seconds,
		timeSumMin,
		timeSumMax,
		bucketTimes,
		subjectIsMath,
		visualsEnabled,
		visualsPolicy: vp,
	});

	const finalChecklistExtras = `- Subject-discipline check: every item tests a SUBJECT concept — not a date, biography trivia, standalone unit symbol / Greek letter / SI unit name as the keyed answer, or general-knowledge fact.
- Cognitive-demand check: \`Remember\`-level items stay within the cap (easy ≤30% Remember; medium/hard ≤15% Remember) per Shared **Subject discipline** section.
- Sanity check: every numerical answer recomputed; every MCQ option recomputed; written items' \`correct_answer\` agrees with the explanation; accounting entries balance; physical/economic outputs sit in plausible domains.`;

	const finalChecklist = buildHardGatesBlock({
		heading: "## FINAL COMPLIANCE CHECKLIST — verify before you emit",
		estimatedQuestionCount: estimated_question_count,
		counts: question_type_counts,
		timeLimitSeconds: time_limit_seconds,
		timeSumMin,
		timeSumMax,
		bucketTimes,
		subjectIsMath,
		visualsEnabled,
		visualsPolicy: vp,
		finalChecklistExtras,
	});

	const visualsBlock = visualsEnabled
		? buildVisualsDisciplineBlock(vp)
		: "## Visuals\n\nFor this generation set `visual: null` on every question. Do not emit a non-null visual envelope under any circumstance.";

	const exemplarsBlock =
		visualsEnabled && vp.preferred_kinds.length > 0 ?
			buildExemplarsBlock(
				userMessageSummary.subjectName,
				getPracticeVisualExemplarCount(),
				userMessageSummary.topic_exemplar_hint ?? null,
			)
		:	"";

	const subjectDiscipline = buildSubjectDisciplineBlock(difficulty);

	return `${hardGatesTop}

${subjectDiscipline}

## Pedagogy
${buildGradeBandSection(userMessageSummary.student_grade ?? userMessageSummary.subject_grade)}

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

Write the explanation in plain, kind, simple English — a Class 9-level
reader should follow every line. **Short sentences. Common words.** If a
technical term is essential, briefly define it inline the first time it
appears ("the resultant — that is, the single vector that replaces the
two").

Choose ONE of the two formats below based on the question type. **Do NOT
mix formats.**

#### Format A — Numerical / "calculate" questions (math, physics, chemistry, accountancy, economics with numbers)

Use this format whenever the answer is a number, a formula result, a
balanced equation, a journal entry, or any computed value. Lay the work
out as an explicit step-by-step list. Every step shows BOTH the
operation AND a one-line reason.

  1. ONE-LINE ANSWER first. State the final result on its own line.
     ("The current is 1 A.")
  2. WHAT WE ARE GIVEN. List the values pulled from the stem, each on
     its own bullet, with units. ("- Battery: 6 V", "- R₁: 2 Ω", "- R₂: 4 Ω")
  3. STEP-BY-STEP. Number every step. Each step has two lines:
        Step N: <what we do>      ← the operation
        Why: <which rule / formula / unit-cancellation justifies it>
     Show every \`$...$\` expression on its own line so the student
     can scan vertically. Carry units through every step. Round at
     the LAST step only, not mid-way.
  4. CHECK (one line). State a quick sanity check ("Units come out
     in amperes — matches the ask.") or a plausibility check
     ("Current is positive — consistent with conventional flow").
  5. RELATED IDEA (one sentence). What broader concept this exercises.

#### Format B — Theoretical / conceptual / definition / comparison questions

Use this format whenever the answer is a definition, a comparison, a
short reasoned argument, or a description (no arithmetic). Write in
short paragraphs with simple language.

  1. ONE-LINE ANSWER. State the conclusion in one short sentence
     ("Friction is the force that opposes relative motion between
     surfaces in contact.").
  2. WHAT IT MEANS (in everyday language). 2-3 short sentences that
     un-pack the answer using a concrete example or analogy. Define
     any technical term you must use. Avoid jargon the student has
     not yet been taught.
  3. WHY IT IS TRUE (the reason). 2-4 short sentences pointing to
     the rule, law, or observation that makes the answer correct.
     If the answer is a comparison, contrast the two ideas one
     point at a time.
  4. WHERE IT SHOWS UP. One sentence with a real-world or
     classroom example, OR one sentence connecting back to the
     broader topic the student is studying.

#### Universal rules for both formats

- **Plain language first**. Replace jargon with everyday words when
  possible ("uses up" beats "expends", "the same" beats "equivalent").
- **One idea per sentence**. If a sentence has two clauses you can
  separate, separate them.
- **No empty filler**. Phrases like "It is important to note that…"
  or "As we have learnt…" add nothing — strip them.
- **Numbers and units stay together**: "6 V", not "6 volts" in line
  with the stem; never bare "6" when a unit is implied.
- **Length**: easy = 80–160 words, medium = 140–260 words, hard =
  200–360 words. Do NOT pad to hit the upper bound; under is better
  than over.

Adapt to subject naturally:

- **Mathematics** → Format A, every step shows the algebraic move
  plus the rule that justifies it.
- **Physics (numeric)** → Format A, carry units through every step
  and state the formula by name in the Why line.
- **Physics (conceptual)** → Format B, use a real-world example
  in "Where it shows up".
- **Chemistry (numeric — stoichiometry, mole calculations,
  electrochemistry)** → Format A, show mol / molar mass
  conversions on their own lines.
- **Chemistry (conceptual — definitions, periodic trends, bonding
  reasoning)** → Format B, name the underlying rule (octet,
  effective nuclear charge, Le Chatelier, etc.) in plain language.
- **Accountancy** → Format A, with each ledger / journal posting
  treated as one step. Always state the debit/credit rule applied.
- **Economics / Business Studies (numeric)** → Format A, money in ₹.
- **Economics / Business Studies (conceptual)** → Format B, with a
  one-line real-world example.
- **Biology** → mostly Format B, with a relatable everyday analogy
  (cells, body systems, ecology). Format A only when the question
  is genuinely numeric (Punnett ratios, population counts).
- **English** → Format B; reference specific line numbers when the
  passage is shown alongside, but never copy long quotes.

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

${visualsBlock}

## Using \`topic_grounding\` chunks

For each topic, treat the two chunk arrays as a pair with distinct jobs:
- \`content_chunks\` — NCERT-style explanatory passages. Use them to decide WHAT to ask (concepts, definitions, processes, formulae, named entities).
- \`exercise_chunks\` — NCERT-style end-of-chapter questions. Use them to decide HOW to ask (register, cadence, command verbs, scaffolding, format conventions).

Rules:
1. Style imitation. Match the register, cadence, and command-verb family of \`exercise_chunks\` for that topic. The test should sound like the same chapter — paraphrase sentences; do not paste a full chunk line-for-line.
2. Traceability. Each question must be justifiable from that \`topic_id\`'s \`content_chunks\` / \`exercise_chunks\` when they are non-empty — same concepts, vocabulary tier, and (where chunks give them) numbers and diagram types.
3. Per-topic loyalty. In multi-topic tests, take cues for each item from THAT item's own topic chunks, not from a dominant topic.
4. Do not import chunk noise. Silently correct typos, OCR artefacts, and stray captions. Imitate intent and register, not accidents.
5. When \`grounding_meta.context_quality\` is \`low_context\` or \`no_context\`, stay at the conceptual / definition level for affected topics; do not invent specific named examples, dates, formulae, or numeric constants you cannot verify. Still do not contradict \`curriculum_hint\` (unit/chapter/grade).
6. When \`test_parameters.grounding_policy.prefer_chunk_aligned_items\` is true, treat chunk-aligned items as the default path — generic rewrites are second choice.

## Output shape

Top-level: \`{ questions_by_type: { multiple_choice, fill_in_blank, short_answer, long_answer }, generation_metadata: { adaptation_rationale } }\`. Each question contains \`topic_id\`, \`topic_name\`, \`question_text\`, \`difficulty_level\` (easy|medium|hard), \`estimated_time_seconds\` (positive integer), \`answer_key\` ({ correct_answer, explanation, common_mistakes[], related_concept }), and \`visual\` (envelope or null). Multiple-choice items also include \`options\` ({A,B,C,D}). \`generation_metadata.adaptation_rationale\` should be a short string and SHOULD include the intended total seconds (e.g. "sum target = ${time_limit_seconds}").
${exemplarsBlock}
${finalChecklist}

Schema marker: intent=${userMessageSummary.intent}, schema_version=${userMessageSummary.schema_version}.`;
}

/**
 * Visuals discipline block — see `docs/EDU-AI-VISUALS-GUIDE-V2.md` §2.2.
 *
 * Only emitted when `PRACTICE_VISUALS=true`. Tells the model when to attach
 * a non-null `visual` envelope and what each renderer expects. Intentionally
 * verbose — exemplars at the bottom of the prompt show concrete `spec` shapes;
 * this block biases toward **maximal** visual attachment while preserving
 * renderer syntax, stem↔spec alignment, and anti-spoiler captions.
 */
function buildVisualsDisciplineBlock(
	vp: PracticeUserMessagePayload["test_parameters"]["visuals_policy"],
): string {
	const kindsEcho =
		vp.preferred_kinds.length > 0 ? vp.preferred_kinds.join(", ") : "— leave every `visual` null —";
	const templatePolicyBlock =
		vp.template_policy?.enabled ?
			`
### Template policy (deterministic first)

${vp.template_policy.prompt_brief}

- The model may only use template IDs listed above. Do not invent template IDs, visual kinds, node shapes, map scopes, biological structures, chemistry cells, or physics diagrams outside the declared slot contracts.
- Fill required slots exactly; optional slots are allowed only when they improve the item and remain grounded in the stem/chunks.
- If no listed template can faithfully represent the item without answer leakage, set \`visual: null\` and write the stem without figure/table/map references.`
		:	"";
	return `## Visuals (\`visual\` field — required on every question)

### Policy (must match \`test_parameters.visuals_policy\`)

- Non-null \`visual.spec.kind\` must be drawn from: ${kindsEcho}.
- **Maximize non-null visuals:** attach a **non-null** \`visual\` on **as many questions as possible** — treat **one non-null visual per question** as the usual outcome whenever any allowed kind can **faithfully** support the item (pedagogically, representatively, or by showing givens). The \`## Examples\` block includes some \`visual: null\` rows so you see valid JSON; **do not** imitate those nulls as a target frequency — prefer a real stimulus whenever a \`preferred_kinds\` kind fits.
- No per-test quota limiting how many questions may use a non-null \`visual\` (other than payload \`max_non_null_visuals\` and an empty \`preferred_kinds\` list).
- Avoid **orphan** diagrams: the stem must cue the figure ("shown below", "use the table", "read the passage", etc.) **or** the visual **is** the worksheet/stimulus (accountancy blocks, data tables, numbered passages).

**Use \`visual: null\` when:** \`preferred_kinds\` is empty, \`max_non_null_visuals\` is 0, no allowed kind can represent the item **faithfully** without contradicting \`topic_grounding\`, or you cannot satisfy the renderer HARD rules below. Also use \`null\` for purely abstract or derivation questions where any visual would be a generic placeholder unrelated to the specific question (e.g. a kinetic-theory derivation or a wave equation explanation — a generic sine wave or free-body scaffold adds no learning value there). **Prefer a correct, relevant visual over a forced placeholder.**
${templatePolicyBlock}

### Choosing a kind (loose — prefer a visual; mirror \`## Examples\`)

Pick the closest exemplar-backed renderer. Non-exhaustive mapping:

- **Mathematics:** shapes, coordinates, constructions, vectors, angles → \`math_geometry\`; graphs and read-offs → \`math_function_plot\`; intervals and inequalities → \`number_line\`. For items that look *text-only* (linear equations, quadratics, sequences, "find x"), still add a **minimal** legitimate visual when possible: e.g. \`number_line\` marking a solution, \`math_function_plot\` when any function is named, or a compact \`data_table\` of coefficients/givens — without spoiling the keyed answer in \`caption\`/\`altText\`.
- **Physics:** \`physics_diagram\` to match the specific physics sub-topic — never default to \`free_body\` when the question is not about forces on a body:
  - **Newtonian mechanics / forces** (tension, friction, inclined planes, pulleys, Newton's laws, equilibrium of a point mass): \`physics_diagram/free_body\`.
  - **Electric circuits** (resistance, EMF, current, Ohm's law, Kirchhoff's laws): \`physics_diagram/circuit\`.
  - **Optics / ray diagrams** (lens, mirror, refraction, image formation, focal length): \`physics_diagram/ray_optics\`.
  - **Waves / oscillations / SHM** (wavelength, frequency, amplitude, superposition, interference, beats, resonance, standing waves, simple harmonic motion): \`math_function_plot\` with a sinusoidal expression (\`sin(x)\`, \`cos(x)\`, or a scaled/shifted variant). Do **not** use \`physics_diagram\` for wave or oscillation topics.
  - **Kinetic theory / thermodynamics / gas laws** (mean free path, rms speed, equipartition, degrees of freedom, Cv/Cp, PV diagrams, Avogadro, ideal gas law): prefer \`math_function_plot\` for a relevant curve (isothermal PV: \`8/x\`) or \`data_table\` to compare gas properties; use \`null\` when no renderer adds clear learning value for an abstract derivation.
  - **Other physics** (semiconductor, EM induction, nuclear, fluid statics, etc.): \`math_function_plot\` or \`data_table\` when quantitative givens are present; otherwise \`null\`.
- **Chemistry:** structures → \`chemistry_molecule\`; schemes → \`chemistry_reaction\`.
- **Accountancy / structured presentations:** \`accountancy_table\` whenever journals, ledgers, trial balances, or statements are natural.
- **Economics:** intersecting schedules → \`economics_curve\`.
- **Numeric / categorical / social / business / bio data:** \`statistics_chart\` or \`data_table\` whenever numbers, shares, categories, or trends appear — not only formal histogram or ogive wordings.
- **Geography (India-centric):** \`india_map\` when states, neighbours, or regions matter; otherwise charts/tables from grounding.
- **English / reading:** \`english_passage\` with numbered lines when the student reads before answering.

If multiple kinds fit, choose the clearest for the student. **Only** use kinds in \`preferred_kinds\`.

### Stem ↔ visual single-source-of-truth

If you emit a visual, the stem MUST NOT restate data the visual already carries.
  BAD : "In the figure below, A=(1,2), B=(4,8). Find slope of AB." + a visual
        that already places A and B.
  GOOD: "Find the slope of segment AB shown below." + the visual.

Every label, letter, number, or unit referenced in the stem MUST appear in the
spec; every label, letter, number in the spec MUST appear in the stem or be
clearly secondary (axis ticks, gridlines).

- Treat the generated question payload as canonical: numbers, entities, labels,
  and units in \`visual.spec\` must come from that question's stem/options.
  Never copy literals from few-shot examples or unrelated topic chunks.

- For minimal supporting visuals (\`data_table\`, \`number_line\`, small
  \`math_geometry\`), keep labels sparse: include only the letters, numbers, and
  units the stem actually references plus unavoidable secondary guides such as
  axis ticks or gridlines.

### Caption and altText (student-facing — must not spoil the item)

Every non-null visual includes envelope fields \`caption\` (short, visible
under the figure) and \`altText\` (richer description for screen readers).

- \`caption\`: One line stating **what the stimulus is** — diagram type, table
  purpose, axis meanings, or passage layout. NOT the conclusion, NOT
  "therefore…", NOT the correct option letter, NOT the final keyed value unless
  the **stem** already states that value as given data.
- \`altText\`: Reading order — components, directions, tick/grid notes, legend,
  column headers. Same anti-spoiler rules as \`caption\`.
- Do **not** encode which MCQ option is correct (e.g. only the correct arrow
  bolded, or altText naming one choice). Spec labels must not duplicate the
  keyed answer string unless it already appears in the stem.
- \`data_table\` / \`english_passage\`: describe structure (headers, line
  numbers). Do not summarise the passage moral or the numeric result the
  student must produce if that result **is** the answer.

### Renderer-specific syntax (HARD)

- \`math_geometry\`: integer or single-decimal coordinates only. The view must
  contain every primitive with at least 1 unit of margin. Every primitive's
  \`type\` is one of: point, segment, polygon, vector, angle_marker, circle, arc.
  For \`arc\`, angles are in degrees (0° = +x, CCW); \`minorArc\` null defaults to
  true (shorter arc between the two bearings); use \`dashed\` for construction strokes.
- \`math_function_plot\`: mathjs syntax (\`x^2\`, \`sin(x)\`, \`exp(-x^2)\`,
  \`abs(x)\`, \`sqrt(x)\`). Every function MUST be defined and finite over its
  plotted range. Never plot \`ln(-x)\`, \`1/0\`, or \`sqrt(negative)\` over the
  visible domain.
- \`number_line\`: \`min < max\`, \`tickStep > 0\`. \`points\` and \`intervals\`
  carry their own \`openCircle\` / \`leftOpen\` / \`rightOpen\` flags.
- \`physics_diagram\` with \`subKind: "free_body"\`: forces from the body's
  centre; \`magnitude\` positive, \`angleDeg\` in degrees (standard math angle
  convention — 0 = +x, 90 = +y).
- \`physics_diagram\` with \`subKind: "ray_optics"\`: principal axis is the
  spec's domain \`[axisMin, axisMax]\`; objects/images expressed as upright
  arrows of \`height\`; lenses identified by \`type\` and a positive
  \`focalLength\`.
- \`physics_diagram\` with \`subKind: "circuit"\`: every node \`id\` referenced
  by a component must appear in the \`nodes\` array; component \`from\` / \`to\`
  reference node ids.
- \`chemistry_molecule.smiles\`: canonical, parseable SMILES. Walk the bonds
  mentally before emitting. Use skeletal SMILES; avoid explicit Hs unless
  stereochemistry depends on them.
- \`chemistry_reaction.ce\`: mhchem syntax. Numbers are auto-subscripted; do
  NOT write \`H_2O\` (write \`H2O\`). Use double-backslash for control sequences
  (\`\\\\Delta\`, \`\\\\Phi\`).
- \`accountancy_table\` amounts: plain numbers (15000), no commas, no symbol.
  The renderer formats as ₹15,000.00. Each \`subKind\` consumes a different
  shape (journal_entry/cash_book/rectification → \`rows[]\`; ledger →
  \`ledger\`; trial_balance → \`rows[]\`; balance_sheet → \`assetsSide\` +
  \`equityAndLiabilitiesSide\`; p_and_l → \`rows[]\`).
- \`economics_curve\`: horizontal axis is \`xMin\`…\`xMax\` — set \`xLabel\` to its meaning (often Quantity \`Q\` in intro micro). Vertical values come from each \`curves[].expr\`, written **in terms of \`p\`** where \`p\` is the horizontal-axis variable; the renderer substitutes \`p\` → the plotter's \`x\` internally (do not pre-substitute). Set \`yLabel\` to the vertical meaning (often Price \`P\`). Example: demand might use \`expr\` like \`80 - 0.4 * p\` for downward-sloping price vs quantity in \`Q\`–\`P\` space.
- \`statistics_chart\`: pick the matching \`subKind\` (histogram, bar, line,
  scatter, pie, frequency_polygon, ogive, box). Histogram + frequency_polygon
  + ogive consume \`bins[]\`; ogive also requires \`cumulative\` =
  "less_than" or "more_than".
- \`data_table\`: rows are arrays of cells; each cell has \`value\`, \`bold\`,
  \`align\` ("left" | "center" | "right"). Use this for short stimulus tables
  that don't fit accountancy or statistics shapes.
- **Geography / Social Science (grades 8–12):** Use \`india_map\` when **location, states, neighbours, coasts, or regional comparison** is part of the item — prefer showing the map whenever it clarifies the stem (not only when the item is unsolvable without it). Set \`mapStyle\` to \`political\` (pastel states), \`outline\` (minimal
  fills, bold borders), or \`physical_palette\` (muted earth-tone fills — not relief).
  Put lowercase ids in \`highlightedStates\` only for regions the stem names or
  contrasts (\`mh\`, \`rj\`, \`tn\`, … — ids match \`@svg-maps/india\`). Also use
  \`statistics_chart\` (line, bar, pie, histogram, scatter, ogive, frequency_polygon,
  box as appropriate) and \`data_table\` for climate tables, population or resource
  comparisons, and land-use shares. Prefer values and place names from \`topic_grounding\`.
- **Business Studies:** Use \`statistics_chart\` (bar, line, pie for revenue or market
  mix), \`data_table\` for short case facts, and \`economics_curve\` when intersecting
  demand/supply or similar curves carry the question; reserve \`math_function_plot\`
  for rare quantitative sketches that are not better as a curve diagram.
- **Biology:** Prefer \`data_table\` or \`statistics_chart\` liberally for tallies, comparative measurements, classifications, population or experimental summaries, and any numeric/categorical stimulus — even when the item could be read as pure recall. There is **no** dedicated histology / organ / life-cycle diagram renderer in v1; use tables or charts (when in \`preferred_kinds\`) rather than leaving \`visual: null\` by default.
- \`english_passage\`: \`lines[]\` with \`number\` (positive int) and \`text\`.
  Inline \`$...$\` LaTeX is supported in line text.
- All text labels in any spec are LaTeX-aware — \`$x_0$\`, \`$\\\\theta$\` will
  render. Do NOT escape the LaTeX delimiters.

### Self-check before emit (apply per-question)

1. Could any allowed kind add a **faithful** supporting visual? If **yes** → prefer **non-null** (goal: every question).
2. Does every label in the stem appear in the spec?
3. Do \`caption\` and \`altText\` explain the stimulus without revealing the keyed answer?
4. Does the answer key reference the same labels and values as the spec?
5. For function plots and curves: f(x) defined and finite over the plotted range?
6. For chemistry: does the SMILES / mhchem string parse?

If checks 2–6 fail and you cannot repair the spec, set \`visual: null\` and rewrite
the stem to be self-contained. Dropping the visual is a **last resort** after simplifying the spec — a spoiled or invalid visual is never acceptable.
`;
}

/** Keys matched with `subjectName.toLowerCase().includes(key)` — put `social science` before `science`. */
const SUBJECT_EXEMPLAR_KEY: Record<string, VisualExemplar["subjects"][number]> = {
	"social science": "social_science",
	geography: "geography",
	"political science": "social_science",
	civics: "social_science",
	history: "social_science",
	maths: "mathematics",
	mathematics: "mathematics",
	physics: "physics",
	chemistry: "chemistry",
	accountancy: "accountancy",
	economics: "economics_statistics",
	statistics: "economics_statistics",
	economics_statistics: "economics_statistics",
	"business studies": "business_studies",
	science: "science",
	biology: "biology",
	english: "english",
};

function pickExemplarSubjectKey(
	subjectName?: string | null,
): VisualExemplar["subjects"][number] {
	if (!subjectName) return "mathematics";
	const lower = subjectName.toLowerCase();
	for (const [key, value] of Object.entries(SUBJECT_EXEMPLAR_KEY)) {
		if (lower.includes(key)) return value;
	}
	return "mathematics";
}

/**
 * Few-shot exemplars block — appended to the bottom of the shared system
 * instructions when visuals are enabled. Provides worked stems with
 * matched \`visual\` shapes so the model has concrete patterns to imitate.
 */
function buildExemplarsBlock(
	subjectName?: string | null,
	exemplarLimit = 6,
	topicExemplarHint?: string | null,
): string {
	const subjectKey = pickExemplarSubjectKey(subjectName);
	const exemplars = pickExemplarsForSubject(subjectKey, exemplarLimit, {
		topicHintNorm: topicExemplarHint?.trim() ? topicExemplarHint.trim().toLowerCase() : undefined,
	});
	if (exemplars.length === 0) return "";
	const rendered = exemplars
		.map((ex, i) => {
			const stem = ex.stem.trim();
			const visual = JSON.stringify(ex.visual);
			return `Example ${i + 1}:
  question_text: ${JSON.stringify(stem)}
  visual: ${visual}`;
		})
		.join("\n\n");
	const topicOrderingNote =
		topicExemplarHint?.trim() ?
			"\nSelected-topic ordering: exemplars whose catalogue keywords overlap the student's chosen topic/chapter titles are listed earlier when possible; still vary supported visual shapes across the test.\n"
		:	"";
	return `\n\n## Examples (worked stems with matching visuals)\n\nThe following concrete stem ↔ visual pairs mix Indian-board-typical items and international-exam-shaped graphs (AP, IB, SAT-style where applicable). Imitate the SHAPE — not the
content — when constructing your own questions; keep notation, currency, and syllabus cues aligned with the student's topic unless the stem explicitly states another convention. **Policy:** this catalogue includes some \`visual: null\` examples for JSON shape — in real generations, **prefer a non-null visual on almost every question** when \`preferred_kinds\` allows (see Visuals section).
${topicOrderingNote}
${rendered}\n`;
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
		student_grade: context.generationSubject.studentGrade,
		subject_grade: context.generationSubject.subjectGrade,
	};
	const shared = buildPracticeGenerationSharedSystemInstructions(summaryWithSubject);
	return `${preamble}\n\n${shared}`;
}

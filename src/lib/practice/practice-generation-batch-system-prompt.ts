import {
	getPracticeGenerationSubjectPreamble,
	resolvePracticeGenerationSubjectRouting,
} from "./generation-prompt-registry";
import {
	buildGradeBandSection,
	buildHardGatesBlock,
	computePerBucketTimeTargets,
	type PracticeGenerationSubjectContext,
} from "./system-prompt";
import type {
	PracticeGenerationBatch,
} from "./practice-generation-batches";
import type { UserMessageSummary } from "./system-prompt";

/**
 * V2 per-batch system prompt. Strips the visuals block (always — parallel
 * batches force `visual: null` via schema), the irrelevant question-type
 * sections (MCQ distractor archetypes for non-MCQ; Format-A/B explanations
 * for MCQ), and the non-matching gold-standard exemplars. The result is
 * ~30-50% smaller per call than the shared system prompt.
 */

type BatchLabel = PracticeGenerationBatch["label"];

const SUBJECT_DISCIPLINE_HARD_BANS = `### Hard bans (every question in this batch)

- **DATE / YEAR AS ANSWER.** Never key a four-digit year or "in what year" answer. Stems may display transaction dates (Accountancy) but the keyed skill stays classification or arithmetic.
- **BIOGRAPHY AS ANSWER.** Never key a person's name unless the topic is explicitly history-of-discipline for that figure.
- **GENERAL-KNOWLEDGE STEMS.** No "which country / capital / festival" unless the subject is Geography / Social Science and the chunk supports it.
- **DEFINITIONAL FLASHCARDS.** A fill-in-blank whose answer is one glossary word copied verbatim from the book is a flashcard — upgrade to one-step application / inference.
- **NEAR-DUPLICATE STEMS.** Within this batch AND across the test (see SISTER_BATCHES_BRIEF), no two items may paraphrase the same fact. Each item teaches a DISTINCT skill.
- **SYLLABUS DRIFT.** Each question must be answerable from this test's topic_grounding. Off-syllabus invocations of facts outside the chapter's scope are forbidden.`;

const MCQ_DISTRACTOR_DISCIPLINE = `### MCQ distractor discipline (every multiple_choice item)

A 4-option MCQ has ONE correct answer and THREE distractors. Each distractor must correspond to a specific student misconception or error — never random plausible noise. Use these four archetypes deliberately:

- **CORRECT** — the defensible best answer.
- **COMMON-ERROR** — the answer when a student makes the single most common procedural slip on this topic (unit conversion, sign, factor-of-two in kinematics, balanced-equation oversight, dropping a negative when transposing).
- **PARTIAL-KNOWLEDGE** — the answer when a student knows half the concept (applied the right formula but skipped step 2, identified the right substance but confused its state).
- **SURFACE-PLAUSIBILITY** — looks the same shape/magnitude as the right answer but is conceptually wrong (reversed ratio, swapped givens).

Populate \`answer_key.distractor_rationale\` with FOUR one-line entries keyed by A/B/C/D — archetype + the specific misconception each option traps.

ARCHETYPE LABEL RULES (the grader uses these labels directly — any violation here breaks per-option feedback):

1. **Each archetype appears EXACTLY ONCE across the four entries.** One CORRECT, one COMMON-ERROR, one PARTIAL-KNOWLEDGE, one SURFACE-PLAUSIBILITY. Never two CORRECT entries. Never two of the same distractor archetype.
2. The entry tagged \`CORRECT\` MUST be on the letter named in \`answer_key.correct_answer\`. If \`correct_answer\` is "B", then ONLY \`distractor_rationale.B\` may begin with "CORRECT"; the other three entries must NOT use the word "CORRECT" anywhere in them.
3. Use the word "CORRECT" in ALL CAPS exactly once across all four entries. Lower-case "correct" inside a longer phrase is fine (e.g. "correctly applied"), but the ALL-CAPS token "CORRECT" must be the unique archetype tag of the keyed option only.
4. The three distractors share the three remaining archetypes — order doesn't matter, but every archetype must be used and none repeated.

Example (correct_answer="B" — note "CORRECT" appears once, on B, in ALL CAPS):
{ "A": "COMMON-ERROR — forgot to multiply by N, just used μ × 10 = 4 N",
  "B": "CORRECT — applied F = μN with μ=0.4, N=50 → 20 N",
  "C": "SURFACE-PLAUSIBILITY — 50 N (used N as the answer; right magnitude, wrong concept)",
  "D": "PARTIAL-KNOWLEDGE — used μ=0.6 (confused static and kinetic friction)" }`;

const MCQ_AI_TELLS = `### Anti-AI-generation tells (every multiple_choice)

- **Length tell**: the correct option must NOT be conspicuously longer than distractors. Lengths within 1.5× of each other.
- **Round-number tell**: numerical distractors should NOT all be multiples of 10 with the correct answer odd.
- **Grammar tell**: stem ending in "an ___" must have all four options start with vowels (or rewrite stem as "a / an ___").
- **Parallelism**: all four options must share syntactic shape — all noun phrases OR all sentences OR all numerical values OR all formulas. NEVER mix.
- **Order tell**: do NOT systematically place the correct answer at A. Distribute roughly uniformly across A/B/C/D within the batch.
- **No "All of the above" / "None of the above" / "Both A and B"** — these are cognitive traps, not assessment.`;

const NON_MCQ_EXPECTED_MISANSWERS = `### Expected misanswers (every item in this batch)

Non-MCQ items have no distractors to design — but they DO have common wrong answers students give. For every item, populate \`answer_key.expected_misanswers\` with 2-4 entries naming the most common WRONG answers students write, each with the misconception it reveals.

Format: \`expected_misanswers: [{ answer: "<the wrong answer>", rationale: "<the misconception>" }, ...]\`.

The grader downstream matches the student's answer against this list and cites the rationale in feedback ("You wrote 12 A — looks like you multiplied V × R; remember Ohm's Law is I = V / R."). This makes feedback diagnostic, not judgmental.`;

const OPERATIONAL_DIFFICULTY = `### Operational difficulty definitions

Treat \`difficulty_level\` per question as operational, not a label:

- **easy** = direct one-step application of a single rule / formula / definition stated in the chapter. Values mirror NCERT worked examples. Stem ≤ 25 words. One concept.
- **medium** = combine TWO concepts, OR interpret given data before applying a rule, OR apply a known rule in a slightly novel context. Stem 25-50 words.
- **hard** = HOTS — multi-step reasoning OR data analysis without all values given OR transfer to a context the chapter does NOT cover OR derivation. Stem may reach 80 words.

An item whose stem is 50 words with a 3-step solution but labelled "easy" is mislabelled.`;

const NUMERIC_SANITY = `### Numeric and answer-key sanity

- Recompute the keyed answer end-to-end before emitting. Impossible results (supersonic everyday speeds, percentages > 100%, probabilities outside [0,1], unbalanced balance sheets) → change input numbers, do not ship.
- For MCQs, recompute EVERY option's numeric value, not just the keyed letter, so two options never accidentally match.
- Final numeric answer "clean" for the difficulty band: easy → integer or one decimal; medium → simple fraction, surds, or 2 decimals; hard → any.
- Numeric \`correct_answer\` for FIB/SA/LA must match the arithmetic in \`answer_key.explanation\`.
- Drop or rewrite any item whose \`correct_answer\` is only a bare four-digit calendar year.`;

const FORMAT_A_B_EXPLANATIONS_NON_MCQ = `### Student-friendly explanations (every item in this batch)

The student is the audience, not a board examiner. Write the explanation in plain English a Class 9 reader can follow. Short sentences. Common words. Define essential technical terms inline the first time.

Choose ONE format based on the question's nature. **Do NOT mix.**

#### Format A — numerical / calculate items (math, physics, chemistry, accountancy, economics with numbers)

  1. ONE-LINE ANSWER on its own line ("The current is 1 A.").
  2. WHAT WE ARE GIVEN — bullet list, each value with units.
  3. STEP-BY-STEP — number every step. Two lines per step: "Step N: <operation>" and "Why: <rule / formula>".
  4. CHECK (one line) — quick sanity check (units, plausibility).
  5. RELATED IDEA (one sentence) — broader concept this exercises.

#### Format B — theoretical / conceptual / comparison items

  1. ONE-LINE ANSWER (one short sentence).
  2. WHAT IT MEANS — 2-3 short sentences with a concrete example or analogy.
  3. WHY IT IS TRUE — 2-4 short sentences pointing to the rule / law / observation.
  4. WHERE IT SHOWS UP — one sentence with a real-world or classroom example.

Universal rules: plain language first, one idea per sentence, no empty filler ("It is important to note that…"), numbers and units stay together, length within: easy 80-160 words, medium 140-260, hard 200-360.`;

const MCQ_EXPLANATION_FORMAT = `### MCQ explanation style (every item in this batch)

\`answer_key.explanation\` for an MCQ teaches the chosen letter. Structure:
- ONE-LINE ANSWER ("Option B is correct — n = 18.").
- Brief derivation in 2-4 lines showing the steps a student would walk through.
- common_mistakes: one full sentence in the form "Students often <do X>; this leads to <wrong result> because <reason>." No labels, no fragments.
- related_concept: a plain phrase ("Slope and gradient"), not a section reference.
- Tone: clear and encouraging — never "obviously", "trivially", "simply".`;

const TOPIC_GROUNDING = `## Using \`topic_grounding\` chunks

For each topic, treat the chunk arrays as paired sources:
- \`content_chunks\` — NCERT-style explanatory passages. Decide WHAT to ask.
- \`exercise_chunks\` — NCERT-style end-of-chapter questions. Decide HOW to ask (register, command verbs, scaffolding).
- \`question_bank_chunks\` — external practice items. Diversify problem shapes; do not treat as canonical source truth.

Rules:
1. Style imitation. Match the register and command-verb family of exercise / question_bank chunks for the topic. Paraphrase — never paste a full chunk line-for-line.
2. Traceability. Each question must be justifiable from that topic's chunks when they are non-empty — same concepts, vocabulary, and (where chunks give them) numbers and diagram types.
3. Per-topic loyalty. In multi-topic tests, take cues for each item from THAT item's own topic chunks.
4. Do not import chunk noise — silently correct typos, OCR artefacts, stray captions.
5. When \`grounding_meta.context_quality\` is \`low_context\` or \`no_context\`, stay at the conceptual level for affected topics; do not invent specific named examples, dates, formulae, or numerics you cannot verify.
6. When \`grounding_policy.prefer_chunk_aligned_items\` is true, chunk-aligned items are the default path.`;

const OUTPUT_SHAPE_MCQ = `## Output shape

Top-level: \`{ questions_by_type: { multiple_choice, fill_in_blank: [], short_answer: [], long_answer: [] }, generation_metadata: { adaptation_rationale } }\`. Each MCQ contains: topic_id, topic_name, question_text, options ({A,B,C,D}), difficulty_level, cognitive_demand, estimated_time_seconds, answer_key ({ correct_answer (one of A/B/C/D), explanation, common_mistakes[], related_concept, distractor_rationale {A,B,C,D} }), visual: null.`;

const OUTPUT_SHAPE_NON_MCQ = `## Output shape

Top-level: \`{ questions_by_type: { multiple_choice: [], fill_in_blank, short_answer, long_answer }, generation_metadata: { adaptation_rationale } }\`. Each item contains: topic_id, topic_name, question_text, options: null, difficulty_level, cognitive_demand, estimated_time_seconds, answer_key ({ correct_answer, explanation, common_mistakes[], related_concept, expected_misanswers [{answer, rationale}, ...], marking_points[] for SA / LA }), visual: null.`;

function pickExemplars(subjectName: string | null | undefined, label: BatchLabel): string {
	const lower = (subjectName ?? "").toLowerCase();
	const isMcq = label === "mcq" || label === "mcq_math";
	if (isMcq) {
		if (lower.includes("math")) return MATH_MCQ_EXEMPLAR;
		if (lower.includes("physics")) return PHYSICS_MCQ_EXEMPLAR;
		if (lower.includes("chemistry")) return CHEMISTRY_MCQ_EXEMPLAR;
		if (lower.includes("economics") || lower.includes("statistics")) return ECONOMICS_MCQ_EXEMPLAR;
		return MATH_MCQ_EXEMPLAR;
	}
	if (label === "sa" || label === "la") {
		if (lower.includes("accountancy") || lower.includes("financial")) return ACCOUNTANCY_SA_EXEMPLAR;
		return ACCOUNTANCY_SA_EXEMPLAR; // best-shape SA exemplar in current prompt suite
	}
	// FIB has no dedicated exemplar in the current registry — use the math MCQ
	// as a "single-answer" style reference and lean on the FIB contract.
	return MATH_MCQ_EXEMPLAR;
}

const MATH_MCQ_EXEMPLAR = `### Mathematics (medium · Apply · MCQ)
\`\`\`json
{
  "topic_name": "Linear Equations in Two Variables",
  "question_text": "At Aarav's stationery shop, 3 pens and 2 notebooks cost ₹105. One pen and 4 notebooks cost ₹95. The cost of one notebook is:",
  "question_type": "multiple_choice",
  "difficulty_level": "medium",
  "cognitive_demand": "Apply",
  "options": { "A": "₹15", "B": "₹18", "C": "₹20", "D": "₹25" },
  "answer_key": {
    "correct_answer": "B",
    "explanation": "Let pen = p, notebook = n. 3p + 2n = 105 and p + 4n = 95. From the second: p = 95 − 4n. Substitute: 3(95 − 4n) + 2n = 105 → 285 − 12n + 2n = 105 → 10n = 180 → n = 18.",
    "common_mistakes": ["Students often add the equations directly without aligning coefficients; this leaves both variables and no clean cancellation."],
    "related_concept": "Solving simultaneous linear equations by substitution",
    "distractor_rationale": {
      "A": "COMMON-ERROR — divided 105 by 7 (counting items), got 15",
      "B": "CORRECT — solved by substitution, n = 18",
      "C": "PARTIAL-KNOWLEDGE — solved for p instead of n",
      "D": "SURFACE-PLAUSIBILITY — eliminated wrong variable; got n = 25 by sign slip"
    }
  }
}
\`\`\``;

const PHYSICS_MCQ_EXEMPLAR = `### Physics (medium · Apply · MCQ)
\`\`\`json
{
  "topic_name": "Friction on Level Surface",
  "question_text": "A cyclist of mass 70 kg takes a sharp circular turn of radius 4 m on a level road. The coefficient of static friction is 0.2. The maximum speed for no slipping is (g = 10 m/s²):",
  "question_type": "multiple_choice",
  "difficulty_level": "medium",
  "cognitive_demand": "Apply",
  "options": { "A": "2.83 m/s", "B": "4 m/s", "C": "8 m/s", "D": "14 m/s" },
  "answer_key": {
    "correct_answer": "A",
    "explanation": "Maximum static friction provides centripetal force: μmg = mv²/r → v_max = √(μgr) = √(0.2 × 10 × 4) = √8 ≈ 2.83 m/s.",
    "common_mistakes": ["Students often forget the square root in √(μgr); this gives v = μgr = 8, which is the WRONG dimension (m²/s²)."],
    "related_concept": "Centripetal force from static friction",
    "distractor_rationale": {
      "A": "CORRECT — √(μgr) = √8 ≈ 2.83 m/s",
      "B": "PARTIAL-KNOWLEDGE — used μ×g without r factor",
      "C": "COMMON-ERROR — forgot the square root, gave μgr = 8",
      "D": "SURFACE-PLAUSIBILITY — used μmg = 140 N as if it were v"
    }
  }
}
\`\`\``;

const CHEMISTRY_MCQ_EXEMPLAR = `### Chemistry (medium · Apply · MCQ)
\`\`\`json
{
  "topic_name": "Mole Concept",
  "question_text": "How many moles of CO₂ are produced when 24 g of carbon is completely burned in excess oxygen? (C = 12, O = 16)",
  "question_type": "multiple_choice",
  "difficulty_level": "medium",
  "cognitive_demand": "Apply",
  "options": { "A": "1 mol", "B": "2 mol", "C": "3 mol", "D": "4 mol" },
  "answer_key": {
    "correct_answer": "B",
    "explanation": "C(s) + O₂(g) → CO₂(g). Moles of C = 24/12 = 2 mol. C:CO₂ ratio is 1:1, so moles of CO₂ = 2 mol.",
    "common_mistakes": ["Students often divide 24 by the molar mass of CO₂ (44) instead of C (12); this gives ~0.55 mol — the wrong limiting species."],
    "related_concept": "Stoichiometric ratios from a balanced equation",
    "distractor_rationale": {
      "A": "COMMON-ERROR — divided 24 by 24 thinking carbon's mass had to match O₂'s 24 g",
      "B": "CORRECT — 24/12 = 2 mol; 1:1 ratio gives 2 mol CO₂",
      "C": "PARTIAL-KNOWLEDGE — added 1 mol thinking O₂ contributes its own carbon",
      "D": "SURFACE-PLAUSIBILITY — used 24/6 (incorrect simplification of molar mass)"
    }
  }
}
\`\`\``;

const ECONOMICS_MCQ_EXEMPLAR = `### Economics (medium · Analyze · MCQ)
\`\`\`json
{
  "topic_name": "Indian Economy on the Eve of Independence",
  "question_text": "On the eve of independence (1947), the sectoral distribution of India's workforce was: Agriculture 72%, Industry 10%, Services 18%. Which feature does this best illustrate?",
  "question_type": "multiple_choice",
  "difficulty_level": "medium",
  "cognitive_demand": "Analyze",
  "options": {
    "A": "Balanced sectoral development",
    "B": "Stagnant, agriculture-dominated economy",
    "C": "Rapidly industrialising economy",
    "D": "Service-led modern economy"
  },
  "answer_key": {
    "correct_answer": "B",
    "explanation": "~72% workforce in agriculture and only 10% in industry: primary-sector-dominated with minimal industrial transformation — the hallmark of a stagnant, colonial-era economy.",
    "common_mistakes": ["Students confuse workforce share with GDP share and read 18% services as 'service-led' modernity."],
    "related_concept": "Sectoral composition as an indicator of structural change",
    "distractor_rationale": {
      "A": "COMMON-ERROR — assumed three sectors present means balanced",
      "B": "CORRECT — agriculture-dominated workforce + minimal industry = stagnant colonial economy",
      "C": "SURFACE-PLAUSIBILITY — 10% in industry sounds notable but is far below industrialising thresholds",
      "D": "PARTIAL-KNOWLEDGE — saw 18% services and skipped that 72% is in agriculture"
    }
  }
}
\`\`\``;

const ACCOUNTANCY_SA_EXEMPLAR = `### Accountancy (medium · Apply · short_answer)
\`\`\`json
{
  "topic_name": "Preparation of Trial Balance",
  "question_text": "From the following ledger balances of M/s Saral Traders as on 31 March 2024, prepare a Trial Balance using the balances method. Capital ₹2,00,000; Drawings ₹15,000; Sales ₹3,80,000; Purchases ₹2,40,000; Wages ₹25,000; Cash in Hand ₹40,000; Debtors ₹80,000; Creditors ₹60,000; Building ₹2,40,000.",
  "question_type": "short_answer",
  "difficulty_level": "medium",
  "cognitive_demand": "Apply",
  "answer_key": {
    "correct_answer": "Debit total = ₹6,40,000; Credit total = ₹6,40,000; the trial balance tallies.",
    "explanation": "Debit side (assets, expenses, drawings, purchases): Drawings 15,000 + Purchases 2,40,000 + Wages 25,000 + Cash 40,000 + Debtors 80,000 + Building 2,40,000 = ₹6,40,000. Credit side (liabilities, capital, income): Capital 2,00,000 + Sales 3,80,000 + Creditors 60,000 = ₹6,40,000. Totals match → trial balance tallies.",
    "common_mistakes": ["Students often place Drawings on the credit side because it 'reduces capital'; Drawings is always Debit (asset withdrawn by owner)."],
    "related_concept": "Trial balance preparation under the balances method",
    "marking_points": [
      "Correct classification of every account as Debit or Credit (4 marks)",
      "Arithmetic accuracy in column totals (2 marks)",
      "Final statement on tally with reasoning (1 mark)"
    ]
  }
}
\`\`\``;

function batchSpecificDisciplineBlock(label: BatchLabel): string {
	const isMcq = label === "mcq" || label === "mcq_math";
	const blocks: string[] = [
		`## Subject discipline (every question must teach the SUBJECT)`,
		``,
		`Each item exists to test the named subject's concepts, methods, or reasoning. If a non-subject expert could answer the item from general knowledge alone, the item is OFF-BAND — rewrite or replace it.`,
		``,
		SUBJECT_DISCIPLINE_HARD_BANS,
		``,
	];
	if (isMcq) {
		blocks.push(MCQ_DISTRACTOR_DISCIPLINE, ``, MCQ_AI_TELLS, ``, MCQ_EXPLANATION_FORMAT, ``);
	} else {
		blocks.push(NON_MCQ_EXPECTED_MISANSWERS, ``, FORMAT_A_B_EXPLANATIONS_NON_MCQ, ``);
	}
	blocks.push(OPERATIONAL_DIFFICULTY, ``, NUMERIC_SANITY);
	return blocks.join("\n");
}

function outputShapeFor(label: BatchLabel): string {
	const isMcq = label === "mcq" || label === "mcq_math";
	return isMcq ? OUTPUT_SHAPE_MCQ : OUTPUT_SHAPE_NON_MCQ;
}

export function buildBatchSystemPromptV2(args: {
	batch: PracticeGenerationBatch;
	userMessageSummary: UserMessageSummary;
	generationSubject: PracticeGenerationSubjectContext;
}): string {
	const { batch, userMessageSummary, generationSubject } = args;

	const routing = resolvePracticeGenerationSubjectRouting(
		generationSubject.subjectGrade,
		generationSubject.studentGrade,
		generationSubject.subjectGroup,
		generationSubject.subjectName,
	);
	const preamble = getPracticeGenerationSubjectPreamble(routing, {
		subjectName: generationSubject.subjectName,
		subjectGrade: generationSubject.subjectGrade,
	});

	const summary = userMessageSummary.test_parameters;
	const bucketTimes = computePerBucketTimeTargets(summary.time_limit_seconds, summary.question_type_counts);
	const timeSumMin = Math.round(summary.time_limit_seconds * 0.6);
	const timeSumMax = Math.round(summary.time_limit_seconds * 1.2);

	const hardGates = buildHardGatesBlock({
		heading: "## TEST-WIDE HARD GATES (the BATCH CONTRACT in the user prompt OVERRIDES these for this call)",
		estimatedQuestionCount: summary.estimated_question_count,
		counts: summary.question_type_counts,
		timeLimitSeconds: summary.time_limit_seconds,
		timeSumMin,
		timeSumMax,
		bucketTimes,
		subjectIsMath: generationSubject.subjectName.toLowerCase().includes("math"),
		visualsEnabled: false, // parallel batches force visual: null
	});

	const grade = userMessageSummary.student_grade ?? userMessageSummary.subject_grade;
	const exemplar = pickExemplars(generationSubject.subjectName, batch.label);

	return `${preamble}

${hardGates}

${batchSpecificDisciplineBlock(batch.label)}

## Pedagogy
${buildGradeBandSection(grade)}
- Difficulty target: ${summary.difficulty}. Calibrate reading length, computation steps, and distractor quality accordingly.
- Use \`cognitive_demand\` from { Remember, Understand, Apply, Analyze, Evaluate, Create } per the batch's per-call budget (see BATCH CONTRACT in user prompt).
- Topic coverage: ${summary.topic_count} topic(s); coverage_mode=${summary.coverage_mode}. ${summary.coverage_instruction}
- When performance data exists in \`topics[].performance\`, favor weaker areas (lower \`average_score_percent\`, worse status, fewer tests_taken, declining trend).
- When \`student.recent_errors\` is present, bias roughly 25-35% of items toward those concepts using a different scenario or representation.
- Pedagogical quality: unambiguous prompts, correct mathematics, physically sensible science, exactly one defensible best answer for MCQs. Distractors must be plausible misconceptions, not filler.

${TOPIC_GROUNDING}

${outputShapeFor(batch.label)}

## Gold-standard exemplar (imitate shape / distractor archetype labelling / explanation depth — never copy content)

${exemplar}

Schema marker: intent=${userMessageSummary.intent}, schema_version=${userMessageSummary.schema_version}, batch=${batch.label} (V2).`;
}

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
>;

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

	const c = question_type_counts;
	const typeCountsLine = `Fill questions_by_type with exactly ${c.multiple_choice} multiple_choice, ${c.fill_in_blank} fill_in_blank, ${c.short_answer} short_answer, and ${c.long_answer} long_answer questions (total ${estimated_question_count}).`;

	return `Rules:
- Use \`topic_grounding\` (content_chunks and exercise_chunks per topic) as the primary factual basis for scope and terminology; do not invent curriculum outside those chunks except where needed for coherent, well-formed questions.
- Generate exactly ${estimated_question_count} questions — this count MUST be respected.
- ${typeCountsLine}
- Output questions grouped under the matching questions_by_type bucket. Do not move a question into the wrong bucket and do not invent extra buckets.
- Target difficulty: ${difficulty}. Calibrate reading length, computation steps, and distractor quality accordingly.
- Respect the time limit: ${time_limit_seconds} seconds total. The SUM of all questions' estimated_time_seconds MUST be between ${Math.round(time_limit_seconds * 0.6)} and ${Math.round(time_limit_seconds * 1.2)} seconds inclusive (same rule the server enforces). Aim near ${time_limit_seconds} when possible.
- Bloom-inspired cognitive demand: map each item to a primary level from Remember, Understand, Apply, Analyze, Evaluate, and Create as appropriate to the subject and grade. Prefer progression within the test (earlier items may lean toward lower levels; later items increase demand where the global difficulty allows). Keep difficulty_level consistent with that cognitive demand.
- Topic coverage: selected topic_count=${topic_count}; coverage_mode=${coverage_mode}. Follow this instruction exactly: ${coverage_instruction} Every question's topic_id MUST be copied character-for-character from test_parameters.allowed_topic_ids (or the same values under topics[] / topic_grounding[].topic_id). Never invent, merge, or partially reuse UUID segments from different topics.
- When coverage_mode is balanced or many_topics and performance data exists, still favor weaker areas (lower average_score_percent, worse status, fewer tests_taken, declining trend) in how you allocate questions.
- When the user message includes student.recent_errors, bias questions toward those concepts where the pedagogy allows, without repeating exact prior wording. Those entries are only for concept hints: every question's topic_id must still be copied from topic_grounding (or the topics list), never from a UUID that is not listed there.
- Pedagogical quality: unambiguous prompts, correct mathematics, physically sensible science, one clearly best answer for MCQs. MCQ options MUST be labeled A, B, C, D (exactly those four keys). answer_key.correct_answer MUST be a single letter A, B, C, or D that maps to one of the options.
- Bucket discipline: anything in multiple_choice MUST have options {A,B,C,D}. If the stem is a single blank or short completion, put it in fill_in_blank instead — never put options: null inside multiple_choice.
- fill_in_blank: use a clear blank or a single missing term; answer_key.correct_answer is the expected word or very short phrase.
- short_answer: brief written response (sentences).
- long_answer: longer written response (paragraph-level where appropriate).
- Explanations in answer_key must teach: step-by-step reasoning, common mistakes, related concept.
- Do not include profanity, stereotypes, or personally identifiable information.
- Output JSON only — no markdown fences, no commentary before or after.

## How to use the topic_grounding chunks
For each topic in \`topic_grounding[]\`, treat the two chunk arrays as a pair with distinct jobs:
- \`content_chunks\` — NCERT-style explanatory passages. Use them to decide **what** to ask: which concept, definition, process, formula, or named entity each item targets. The "answerable from grounding" rule still applies; this specifies which array carries the concepts.
- \`exercise_chunks\` — NCERT-style end-of-chapter or in-text questions. Use them to decide **how** to ask: language register, sentence cadence, command verbs, scaffolding pattern, length, and any visible format conventions (assertion-reason, blank-at-end, sub-parts).
### Generation rules
1. Style imitation. Match \`exercise_chunks\` on register, cadence, command-verb family ("State and explain", "Distinguish between", "Find the value of", "Why does…", "Identify the…"), scaffolding density, and format conventions. The generated test should sound like it came from the same chapter as the chunks. When you bias an item toward a concept in \`student.recent_errors\`, draw the language from \`exercise_chunks\` for that item's \`topic_id\`.
2. Calibrate within the grade envelope. The grade-level cognitive-load table in the subject preamble is the global guard. Within that envelope, treat the complexity visible in \`exercise_chunks\` as the local style benchmark for "medium" at this chapter — scale up by adding a step or layering a sub-concept for "hard," scale down for "easy."
3. Per-topic stylistic loyalty. In multi-topic tests, take stylistic cues for each item from that item's own topic chunks, not from a dominant topic. A history item and a geography item in the same test should each sound like their own chapter's exercises.
4. Do not import chunk noise. If a chunk contains a typo, OCR artefact, stray figure caption, or factually questionable phrasing, silently correct it in your item. Imitate the chunk's intent and register, not its accidents.
### Self-check before emitting each item
- Sum estimated_time_seconds across ALL questions; confirm it lies between ${Math.round(time_limit_seconds * 0.6)} and ${Math.round(time_limit_seconds * 1.2)}.
- The concept tested is traceable to a sentence in \`content_chunks\` for this \`topic_id\`.
- The phrasing could pass for an item from \`exercise_chunks\` for this \`topic_id\` — same register, same command-verb family, same scaffolding density — without being a copy.
- A teacher who wrote those exercise chunks would recognise the item as theirs in voice, but not as one they had already written.

Response JSON shape (types are illustrative; follow field names exactly):
{
  "questions_by_type": {
    "multiple_choice": [
      {
        "topic_id": "<uuid from user message>",
        "topic_name": "<string>",
        "question_text": "<string, LaTeX inline allowed where needed>",
        "difficulty_level": "easy" | "medium" | "hard",
        "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
        "answer_key": {
          "correct_answer": "A" | "B" | "C" | "D",
          "explanation": "<string>",
          "common_mistakes": ["<string>", "..."],
          "related_concept": "<string>"
        },
        "estimated_time_seconds": <integer>
      }
    ],
    "fill_in_blank": [
      {
        "topic_id": "<uuid from user message>",
        "topic_name": "<string>",
        "question_text": "<string>",
        "difficulty_level": "easy" | "medium" | "hard",
        "answer_key": {
          "correct_answer": "<short text answer>",
          "explanation": "<string>",
          "common_mistakes": ["<string>", "..."],
          "related_concept": "<string>"
        },
        "estimated_time_seconds": <integer>
      }
    ],
    "short_answer": [
      {
        "topic_id": "<uuid from user message>",
        "topic_name": "<string>",
        "question_text": "<string>",
        "difficulty_level": "easy" | "medium" | "hard",
        "answer_key": {
          "correct_answer": "<short text answer>",
          "explanation": "<string>",
          "common_mistakes": ["<string>", "..."],
          "related_concept": "<string>"
        },
        "estimated_time_seconds": <integer>
      }
    ],
    "long_answer": [
      {
        "topic_id": "<uuid from user message>",
        "topic_name": "<string>",
        "question_text": "<string>",
        "difficulty_level": "easy" | "medium" | "hard",
        "answer_key": {
          "correct_answer": "<paragraph-style answer>",
          "explanation": "<string>",
          "common_mistakes": ["<string>", "..."],
          "related_concept": "<string>"
        },
        "estimated_time_seconds": <integer>
      }
    ]
  },
  "generation_metadata": {
    "adaptation_rationale": "<short string>"
  }
}

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
	const shared = buildPracticeGenerationSharedSystemInstructions(context.userMessageSummary);
	return `${preamble}\n\n${shared}`;
}

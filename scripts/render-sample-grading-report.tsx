/**
 * Renders a sample practice grading PDF using the new breakdown fields.
 * Run: pnpm exec tsx scripts/render-sample-grading-report.tsx
 * Output: .tmp/sample-practice-grading-report.pdf
 */
import fs from "node:fs";
import path from "node:path";

import { renderToBuffer } from "@react-pdf/renderer";

import { formatGradingFeedbackForStorage } from "@/lib/practice/grading-feedback-format";
import type { GradedQuestionItem, PracticeGradingSummary } from "@/lib/practice/grading-schema";
import {
	PracticeGradingPdfDocument,
	type PracticeGradingPdfQuestion,
	type TopicCoverageRow,
} from "@/lib/student/practice-grading-pdf-document";

const Q1_ID = "11111111-1111-4111-8111-111111111101";
const Q2_ID = "11111111-1111-4111-8111-111111111102";
const Q3_ID = "11111111-1111-4111-8111-111111111103";
const Q4_ID = "11111111-1111-4111-8111-111111111104";
const TOPIC_A = "22222222-2222-4222-8222-222222222201";
const TOPIC_B = "22222222-2222-4222-8222-222222222202";

function buildQuestion(
	base: Omit<PracticeGradingPdfQuestion, "analysis" | "step_by_step_solution"> & GradedQuestionItem,
): PracticeGradingPdfQuestion {
	const feedback = formatGradingFeedbackForStorage(base);
	const step = base.step_by_step_solution;
	return {
		...base,
		analysis: base.analysis,
		step_by_step_solution: step,
		// PDF reads structured fields directly from GradedQuestionItem shape on question row
	};
}

const summary: PracticeGradingSummary = {
	overall_summary:
		"You attempted all four items. Strong MCQ reasoning on gravitation; written answers need clearer definitions and one worked numerical step.",
	strengths: [
		"Gravitation MCQ: correct inverse-square reasoning",
		"Short answer: named the right quantity (acceleration due to gravity)",
	],
	improvement_areas: [
		"Q2: define g with units and value at Earth's surface",
		"Q3: long answer missing named example for weight vs mass",
		"Q4: fill-in-blank unit for power",
	],
	recommendations: [
		"Revise Chapter 8 (Gravitation) definitions: weight, mass, g",
		"Redo 2 short numericals with unit checks",
		"Practice one 5-mark explanation with a labelled diagram",
	],
	ai_insights:
		"Focus next session on units and one complete worked example per numerical. Your MCQ accuracy suggests concepts are forming; written answers need the same precision.",
};

const topicCoverageRows: TopicCoverageRow[] = [
	{
		chapterName: "Gravitation",
		topicName: "Universal law and g",
		unitName: "Unit 8",
		grade: 11,
		averageScore: 100,
		statusLabel: "Strong",
	},
	{
		chapterName: "Gravitation",
		topicName: "Weight and free fall",
		unitName: "Unit 8",
		grade: 11,
		averageScore: 62.5,
		statusLabel: "On track",
	},
];

const questions: PracticeGradingPdfQuestion[] = [
	buildQuestion({
		question_id: Q1_ID,
		topic_id: TOPIC_A,
		question_number: 1,
		question_text:
			"A planet has mass M and radius R. The gravitational field strength at its surface is proportional to:",
		question_type: "multiple_choice",
		topic_name: "Universal law and g",
		chapter_name: "Gravitation",
		unit_name: "Unit 8",
		grade: 11,
		question_difficulty: "medium",
		student_answer_display: "Selected: C",
		generation_answer_display:
			"Correct option: C (M/R²). Field g = GM/R², so g ∝ M/R² for fixed G.",
		visual: null,
		verdict: "correct",
		score: 100,
		band_label: "Full credit",
		what_was_correct: ["Full credit on this item.", "Option C matches g ∝ M/R²."],
		where_marks_were_lost: [],
		to_reach_next_band: "",
		user_answer_summary: "You selected option C, linking field strength to M/R².",
		reference_answer_summary: "The official key is C because g = GM/R².",
		analysis:
			"You identified the correct proportionality. Keep checking whether the question asks for field, force, or potential.",
		step_by_step_solution:
			"1. Write g = GM/R² at the surface.\n2. For fixed G, g ∝ M/R².\n3. Match to option C.",
	}),
	buildQuestion({
		question_id: Q2_ID,
		topic_id: TOPIC_B,
		question_number: 2,
		question_text: "Define acceleration due to gravity (g) and state its approximate value at Earth's surface with SI unit.",
		question_type: "short_answer",
		topic_name: "Weight and free fall",
		chapter_name: "Gravitation",
		unit_name: "Unit 8",
		grade: 11,
		question_difficulty: "easy",
		student_answer_display: "g is acceleration when things fall. value is 9.8",
		generation_answer_display:
			"g is acceleration of a freely falling body due to Earth's gravity, ≈ 9.8 m/s² (often 10 m/s² in problems).",
		visual: null,
		verdict: "partially_correct",
		score: 50,
		band_label: "Partial credit (50% band)",
		what_was_correct: ["Named g as a falling-body acceleration.", "Gave a correct numeric value 9.8."],
		where_marks_were_lost: [
			"Missing SI unit (m/s²) on the value.",
			"Definition did not say 'due to Earth's gravity' or 'free fall'.",
		],
		to_reach_next_band:
			"To move from 50 to 75, add 'm/s²' and one phrase: freely falling body near Earth's surface.",
		user_answer_summary: "You described g informally and gave 9.8 without units.",
		reference_answer_summary:
			"Full answer defines free-fall acceleration due to gravity and states ≈ 9.8 m/s².",
		analysis:
			"Borderline: credited generously at 50 because the number is right; tighten definitions before exams.",
		step_by_step_solution:
			"1. State: g is acceleration of a body in free fall near Earth.\n2. Give value: 9.8 m/s² (or 10 m/s² if specified).\n3. Mention direction: toward Earth's centre.",
	}),
	buildQuestion({
		question_id: Q3_ID,
		topic_id: TOPIC_B,
		question_number: 3,
		question_text:
			"Distinguish mass and weight. Why do astronauts appear weightless in orbit although gravity still acts? (About 80 words)",
		question_type: "long_answer",
		topic_name: "Weight and free fall",
		chapter_name: "Gravitation",
		unit_name: "Unit 8",
		grade: 11,
		question_difficulty: "medium",
		student_answer_display:
			"Mass is how much matter. Weight is force of gravity. In orbit they float because there is no gravity.",
		generation_answer_display:
			"Mass: scalar, kg, inertia. Weight: force W=mg, newton. Weightlessness: apparent; astronaut and craft in continuous free fall around Earth; g not zero.",
		visual: null,
		verdict: "partially_correct",
		score: 60,
		band_label: "Partial credit (60% band)",
		what_was_correct: ["Mass vs weight distinction started correctly.", "Linked weight to gravitational force."],
		where_marks_were_lost: [
			"Claimed 'no gravity' in orbit (conceptual error on weightlessness).",
			"No SI units (kg, N) or formula W = mg.",
		],
		to_reach_next_band:
			"To move from 60 to 80, explain weightlessness as free fall (microgravity), not absence of g.",
		criterion_scores: [
			{ name: "Conceptual accuracy", points: 10, note: "Mass/weight partly right; orbit explanation wrong." },
			{ name: "Coverage of all parts asked", points: 20, note: "Both parts attempted." },
			{ name: "Correct terminology / formulae", points: 10, note: "Missing W = mg and units." },
			{ name: "Logical structure / reasoning", points: 10, note: "Clear sentences but flawed orbit reason." },
			{ name: "Worked example or supporting detail", points: 10, note: "No example of apparent weightlessness." },
		],
		user_answer_summary: "You contrasted mass and weight but said gravity is absent in orbit.",
		reference_answer_summary:
			"Full credit requires units, W = mg, and weightlessness as continuous free fall.",
		analysis:
			"Good vocabulary on mass and weight; revise orbit as free fall so you do not lose marks on similar 5-mark items.",
		step_by_step_solution:
			"1. Mass m (kg): measure of inertia.\n2. Weight W = mg (N): gravitational force.\n3. Orbit: astronauts and vehicle accelerate together toward Earth; no support force, hence apparent weightlessness.",
	}),
	buildQuestion({
		question_id: Q4_ID,
		topic_id: TOPIC_A,
		question_number: 4,
		question_text: "A 60 W bulb runs for 5 minutes. Energy used = ______ J",
		question_type: "fill_in_blank",
		topic_name: "Universal law and g",
		chapter_name: "Gravitation",
		unit_name: "Unit 8",
		grade: 11,
		question_difficulty: "hard",
		student_answer_display: "300",
		generation_answer_display: "E = P × t = 60 × 300 = 18 000 J (t = 5 min = 300 s).",
		visual: null,
		verdict: "incorrect",
		score: 0,
		band_label: "Needs work (0% band)",
		what_was_correct: ["You attempted a numerical answer."],
		where_marks_were_lost: [
			"Used t = 5 (minutes) directly instead of converting to 300 seconds in E = Pt.",
		],
		to_reach_next_band:
			"To move from 0 to 50, write t in seconds and use E = P × t with P in watts.",
		user_answer_summary: "You wrote 300, matching 60 × 5 without converting minutes to seconds.",
		reference_answer_summary: "Correct: 60 W × 300 s = 18 000 J.",
		analysis:
			"Common slip: minutes vs seconds. Always list P, t (s), then multiply.",
		step_by_step_solution:
			"1. P = 60 W.\n2. t = 5 min = 5 × 60 = 300 s.\n3. E = Pt = 60 × 300 = 18 000 J.",
	}),
];

// Re-attach formatted feedback strings for PDF coach sections (uses analysis + step from item)
for (const q of questions) {
	const stored = formatGradingFeedbackForStorage(q);
	const tail = stored.split("\n\n").slice(1).join("\n\n");
	const stepIdx = tail.indexOf("\n\nStep-by-step:\n");
	if (stepIdx >= 0) {
		q.analysis = tail.slice(0, stepIdx).trim();
		q.step_by_step_solution = tail.slice(stepIdx + "\n\nStep-by-step:\n".length).trim();
	} else {
		q.analysis = tail.trim();
	}
}

async function main() {
	const logoPath = path.join(process.cwd(), "public", "brand", "logo-icon.png");
	const logoSrc = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;

	const doc = (
		<PracticeGradingPdfDocument
			subjectName="Physics (Class 11)"
			studentDisplayName="Sample Student"
			difficulty="medium"
			timeLimitSeconds={3600}
			durationSeconds={2840}
			testDateIso={new Date().toISOString()}
			createdAtIso={new Date().toISOString()}
			topicCoverageRows={topicCoverageRows}
			totalQuestions={4}
			overallScorePercent={52.5}
			summary={summary}
			logoSrc={logoSrc}
			questions={questions}
		/>
	);

	const buffer = await renderToBuffer(doc);
	const outDir = path.join(process.cwd(), ".tmp");
	fs.mkdirSync(outDir, { recursive: true });
	const outPath = path.join(outDir, "sample-practice-grading-report.pdf");
	fs.writeFileSync(outPath, buffer);
	console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});

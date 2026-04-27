/**
 * Routes practice test generation to a subject- and grade-band-specific system prompt preamble.
 * Replace template strings in PREAMBLES as final copy is finalized.
 */

export type PracticeGenerationPromptBand = "6_10" | "11_12";

/** Category keys for grades 6–10 (middle school). */
export type PracticeGenerationPromptCategory6_10 =
	| "english"
	| "science"
	| "social_science"
	| "mathematics"
	| "default";

/** Category keys for grades 11–12 (senior secondary). */
export type PracticeGenerationPromptCategory11_12 =
	| "english"
	| "physics"
	| "chemistry"
	| "biology"
	| "mathematics"
	| "accountancy"
	| "business_studies"
	| "economics_statistics"
	| "default";

export type PracticeGenerationPromptCategory =
	| PracticeGenerationPromptCategory6_10
	| PracticeGenerationPromptCategory11_12;

export type PracticeGenerationSubjectRouting =
	| { band: "6_10"; category: PracticeGenerationPromptCategory6_10 }
	| { band: "11_12"; category: PracticeGenerationPromptCategory11_12 };

const PREAMBLES_6_10: Record<PracticeGenerationPromptCategory6_10, string> = {
	english:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT English (middle stage, grades 6–10). Subject focus: reading, literature, grammar, and writing appropriate to the student’s grade. Generate items that match the tone and skills expected in NCERT-aligned English for this level.",
	science:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT integrated Science (grades 6–10). Subject focus: physics, chemistry, and biology concepts as taught in a single Science course at this level. Use physically and chemically sound setups; vocabulary should match NCERT-style integrated science.",
	social_science:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Social Science (grades 6–10). Subject focus: history, geography, civics, and economics as appropriate to the student’s grade. Use terminology and framing consistent with NCERT Social Science.",
	mathematics:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Mathematics (grades 6–10). Subject focus: arithmetic, algebra, geometry, and data handling at the appropriate depth. Ensure calculations and reasoning are correct and notation is standard.",
	default:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT (grades 6–10). Align questions to the supplied topic grounding and the named subject; keep difficulty and reading level appropriate to the student’s grade.",
};

const PREAMBLES_11_12: Record<PracticeGenerationPromptCategory11_12, string> = {
	english:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT English Core (senior secondary, grades 11–12). Subject focus: literature, reading comprehension, and writing as in Hornbill/Snapshots, Flamingo/Vistas, or equivalent NCERT readers. Calibrate to Class XI/XII depth.",
	physics:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Physics (grades 11–12). Subject focus: mechanics, thermodynamics, electricity, optics, and modern physics as per the syllabus. Problems must be physically consistent; use standard SI reasoning and notation.",
	chemistry:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Chemistry (grades 11–12). Subject focus: physical, organic, and inorganic chemistry at senior-secondary depth. Use correct formulas, valence, and reaction types; avoid chemically implausible scenarios.",
	biology:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Biology (grades 11–12). Subject focus: botany and zoology, genetics, ecology, and human physiology as per NCERT. Use accurate biological terminology and relationships.",
	mathematics:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Mathematics (grades 11–12). Subject focus: calculus, algebra, coordinate geometry, probability, and related topics at senior-secondary depth. Ensure proofs and computations are correct.",
	accountancy:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Accountancy (grades 11–12). Subject focus: journal entries, ledgers, financial statements, partnership, company accounts, and analysis as per NCERT Accountancy. Use standard accounting conventions and terminology.",
	business_studies:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Business Studies (grades 11–12). Subject focus: principles of management, marketing, finance, and business environment at senior-secondary depth. Use vocabulary consistent with NCERT Business Studies.",
	economics_statistics:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT Economics and quantitative methods (grades 11–12). Subject focus: microeconomics, macroeconomics, and statistics as used in the commerce/arts streams. Use correct economic definitions and interpret data carefully.",
	default:
		"You are an expert educator and assessment specialist for Indian CBSE/NCERT (senior secondary, grades 11–12). Align questions to the supplied topic grounding and the named subject; keep difficulty appropriate to Class XI/XII.",
};

function norm(s: string): string {
	return s.trim().toLowerCase();
}

/** Curriculum grade on the subject row (6–12); falls back to student profile grade. */
export function getPracticeGenerationPromptBand(
	subjectGrade: number | null,
	studentGrade: number | null,
): PracticeGenerationPromptBand {
	const g = subjectGrade ?? studentGrade;
	if (g != null && g >= 11 && g <= 12) return "11_12";
	return "6_10";
}

function categoryFromSubjectGroup6_10(groupNorm: string): PracticeGenerationPromptCategory6_10 | null {
	if (groupNorm === "english") return "english";
	if (groupNorm === "science") return "science";
	if (groupNorm === "social science" || groupNorm === "social_science") return "social_science";
	if (groupNorm === "mathematics" || groupNorm === "math" || groupNorm === "maths") return "mathematics";
	return null;
}

function categoryFromSubjectGroup11_12(groupNorm: string): PracticeGenerationPromptCategory11_12 | null {
	if (groupNorm === "english") return "english";
	if (groupNorm === "physics") return "physics";
	if (groupNorm === "chemistry") return "chemistry";
	if (groupNorm === "biology") return "biology";
	if (groupNorm === "mathematics" || groupNorm === "math" || groupNorm === "maths") return "mathematics";
	if (
		groupNorm === "accountancy" ||
		groupNorm === "financial accounting" ||
		groupNorm.includes("accounting") ||
		groupNorm.includes("accountancy")
	) {
		return "accountancy";
	}
	if (groupNorm.includes("business stud")) return "business_studies";
	if (groupNorm === "economics" || groupNorm === "statistics") return "economics_statistics";
	if (groupNorm.includes("economics") || groupNorm.includes("statistics")) return "economics_statistics";
	return null;
}

function categoryFromSubjectName6_10(name: string): PracticeGenerationPromptCategory6_10 | null {
	const n = norm(name);
	if (n.includes("english")) return "english";
	if (n.includes("social science")) return "social_science";
	if (n === "science" || (n.includes("science") && !n.includes("social"))) return "science";
	if (n.includes("mathematics") || /\bmath\b/.test(n)) return "mathematics";
	return null;
}

function categoryFromSubjectName11_12(name: string): PracticeGenerationPromptCategory11_12 | null {
	const n = norm(name);
	if (n.includes("english")) return "english";
	if (n.includes("physics")) return "physics";
	if (n.includes("chemistry")) return "chemistry";
	if (n.includes("biology")) return "biology";
	if (n.includes("mathematics") || /\bmath\b/.test(n)) return "mathematics";
	if (n.includes("account") || n.includes("financial accounting")) return "accountancy";
	if (n.includes("business studies")) return "business_studies";
	if (n.includes("economics") || n.includes("statistics") || n.includes("macroeconomics") || n.includes("microeconomics")) {
		return "economics_statistics";
	}
	return null;
}

/**
 * Resolves band + category from DB subject_group and display name.
 */
export function resolvePracticeGenerationSubjectRouting(
	subjectGrade: number | null,
	studentGrade: number | null,
	subjectGroup: string | null,
	subjectName: string,
): PracticeGenerationSubjectRouting {
	const band = getPracticeGenerationPromptBand(subjectGrade, studentGrade);
	const g = subjectGroup?.trim() ? norm(subjectGroup) : "";

	if (band === "6_10") {
		let category = g ? categoryFromSubjectGroup6_10(g) : null;
		if (!category) category = categoryFromSubjectName6_10(subjectName);
		return { band: "6_10", category: category ?? "default" };
	}

	let category = g ? categoryFromSubjectGroup11_12(g) : null;
	if (!category) category = categoryFromSubjectName11_12(subjectName);
	return { band: "11_12", category: category ?? "default" };
}

export type PracticeGenerationPreambleContext = {
	subjectName: string;
	subjectGrade: number | null;
};

/**
 * Subject-specific preamble paragraph(s). Shared JSON contract is appended separately.
 */
export function getPracticeGenerationSubjectPreamble(
	routing: PracticeGenerationSubjectRouting,
	ctx: PracticeGenerationPreambleContext,
): string {
	const gradeLabel =
		ctx.subjectGrade != null ? `Grade ${ctx.subjectGrade}` : "the student’s grade";
	const subjectLine = `You are generating practice for subject “${ctx.subjectName}” (${gradeLabel}).`;

	const body =
		routing.band === "6_10" ? PREAMBLES_6_10[routing.category] : PREAMBLES_11_12[routing.category];

	return `${subjectLine}\n\n${body}\n\nYour task: generate a single practice test as strict JSON matching the contract in the instructions below.`;
}

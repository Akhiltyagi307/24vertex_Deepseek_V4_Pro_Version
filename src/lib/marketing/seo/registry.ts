/** Slugify board display names for URL segments. */
function boardNameToSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "");
}

const BOARD_ENTRIES: { slug: string; name: string; shortDescription: string }[] = [
	{
		slug: "cbse",
		name: "CBSE",
		shortDescription:
			"Practice and tutoring aligned to NCERT chapter structure and CBSE exam patterns for grades 6 to 10.",
	},
	{
		slug: "icse",
		name: "ICSE",
		shortDescription:
			"Chapter-level practice tuned to ICSE depth and terminology for middle and secondary school.",
	},
	{
		slug: boardNameToSlug("Maharashtra State Board"),
		name: "Maharashtra State Board",
		shortDescription: "State-board question style and chapter pacing for Maharashtra classes 6 to 10.",
	},
	{
		slug: boardNameToSlug("Karnataka State Board"),
		name: "Karnataka State Board",
		shortDescription: "Practice mapped to Karnataka state syllabus chapters and unit-test rhythms.",
	},
	{
		slug: boardNameToSlug("Tamil Nadu State Board"),
		name: "Tamil Nadu State Board",
		shortDescription: "Coverage for Tamil Nadu state board middle and high school subjects.",
	},
	{
		slug: boardNameToSlug("Gujarat State Board"),
		name: "Gujarat State Board",
		shortDescription: "GSEB-aligned chapter practice for grades 6 to 10.",
	},
	{
		slug: boardNameToSlug("Rajasthan State Board"),
		name: "Rajasthan State Board",
		shortDescription: "RBSE-style practice for state board students in Rajasthan.",
	},
	{
		slug: boardNameToSlug("Madhya Pradesh State Board"),
		name: "Madhya Pradesh State Board",
		shortDescription: "MP board chapter coverage for middle school learners.",
	},
	{
		slug: boardNameToSlug("Uttar Pradesh State Board"),
		name: "Uttar Pradesh State Board",
		shortDescription: "UP board question patterns and chapter naming for classes 6 to 10.",
	},
	{
		slug: boardNameToSlug("West Bengal State Board"),
		name: "West Bengal State Board",
		shortDescription: "WBBSE-aligned practice for Bengal state board students.",
	},
	{
		slug: boardNameToSlug("Haryana State Board"),
		name: "Haryana State Board",
		shortDescription: "HBSE chapter practice for Haryana state syllabus.",
	},
	{
		slug: boardNameToSlug("Punjab State Board"),
		name: "Punjab State Board",
		shortDescription: "PSEB-style coverage for Punjab state board grades 6 to 10.",
	},
	{
		slug: boardNameToSlug("Andhra Pradesh State Board"),
		name: "Andhra Pradesh State Board",
		shortDescription: "AP state board chapter alignment for middle school.",
	},
	{
		slug: boardNameToSlug("Telangana State Board"),
		name: "Telangana State Board",
		shortDescription: "Telangana state syllabus practice and weak-chapter tracking.",
	},
	{
		slug: boardNameToSlug("Kerala State Board"),
		name: "Kerala State Board",
		shortDescription: "Kerala state board chapter practice for classes 6 to 10.",
	},
];

const GRADE_ENTRIES = [6, 7, 8, 9, 10].map((grade) => ({
	grade: String(grade),
	classLabel: `Class ${grade}`,
	shortDescription: `Adaptive practice, AI tutor, and parent dashboard for Class ${grade} students in India.`,
}));

const SUBJECT_ENTRIES: {
	slug: string;
	name: string;
	shortDescription: string;
	exampleChapters: string[];
}[] = [
	{
		slug: "maths",
		name: "Maths",
		shortDescription: "Algebra, geometry, and arithmetic practice with step-by-step tutoring.",
		exampleChapters: ["Linear equations", "Triangles", "Rational numbers"],
	},
	{
		slug: "science",
		name: "Science",
		shortDescription: "Physics, chemistry, and biology chapters with concept-first explanations.",
		exampleChapters: ["Light and reflection", "Acids and bases", "Photosynthesis"],
	},
	{
		slug: "social-science",
		name: "Social Science",
		shortDescription: "History, geography, and civics practice aligned to school textbooks.",
		exampleChapters: ["French Revolution", "Resources and development", "Democratic rights"],
	},
	{
		slug: "english",
		name: "English",
		shortDescription: "Grammar, comprehension, and writing practice for school English papers.",
		exampleChapters: ["Tenses", "Reading comprehension", "Formal letter writing"],
	},
];

export type BoardSeoEntry = (typeof BOARD_ENTRIES)[number];
export type GradeSeoEntry = (typeof GRADE_ENTRIES)[number];
export type SubjectSeoEntry = (typeof SUBJECT_ENTRIES)[number];

export function getBoardBySlug(slug: string): BoardSeoEntry | undefined {
	return BOARD_ENTRIES.find((b) => b.slug === slug);
}

export function getAllBoardSlugs(): string[] {
	return BOARD_ENTRIES.map((b) => b.slug);
}

export function getGradeBySlug(grade: string): GradeSeoEntry | undefined {
	return GRADE_ENTRIES.find((g) => g.grade === grade);
}

export function getAllGradeSlugs(): string[] {
	return GRADE_ENTRIES.map((g) => g.grade);
}

export function getSubjectBySlug(slug: string): SubjectSeoEntry | undefined {
	return SUBJECT_ENTRIES.find((s) => s.slug === slug);
}

export function getAllSubjectSlugs(): string[] {
	return SUBJECT_ENTRIES.map((s) => s.slug);
}

const VS_ENTRIES = [
	{ slug: "byjus", brand: "BYJU'S" },
	{ slug: "vedantu", brand: "Vedantu" },
	{ slug: "physics-wallah", brand: "Physics Wallah" },
] as const;

export type VsSeoEntry = (typeof VS_ENTRIES)[number];

export function getVsBySlug(slug: string): VsSeoEntry | undefined {
	return VS_ENTRIES.find((v) => v.slug === slug);
}

export function getAllVsSlugsFromRegistry(): string[] {
	return VS_ENTRIES.map((v) => v.slug);
}

export { BOARD_ENTRIES, GRADE_ENTRIES, SUBJECT_ENTRIES, VS_ENTRIES };

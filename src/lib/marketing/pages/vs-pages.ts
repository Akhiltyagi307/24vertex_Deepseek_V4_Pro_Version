import type { MarketingComparisonRow } from "@/components/marketing/blocks/marketing-comparison-table";

export type VsPageContent = {
	slug: string;
	brand: string;
	heroLead: string;
	theirStrength: string;
	ourRole: string;
	comparisonRows: MarketingComparisonRow[];
	whoShouldPickThem: string;
	whoShouldPickUs: string;
};

export const VS_PAGES: Record<string, VsPageContent> = {
	byjus: {
		slug: "byjus",
		brand: "BYJU'S",
		heroLead: "Different jobs. BYJU'S is strong at packaged learning content. 24Vertex is the layer on your child's current school chapters.",
		theirStrength:
			"BYJU'S built a large library of video lessons and structured courses. Families who want a full content subscription with celebrity teachers and long-form video will find that model familiar.",
		ourRole:
			"24Vertex does not try to replace your child's textbook. We find weak chapters from practice, run 20-minute adaptive sets, and give you a parent dashboard plus a private tutor for doubts at home.",
		comparisonRows: [
			{ label: "Primary offer", vertex: "Weak-chapter practice + chapter radar chart", other: "Video courses and test series" },
			{ label: "Session length", vertex: "~20 minutes targeted", other: "Often longer video blocks" },
			{ label: "Parent visibility", vertex: "Chapter-level dashboard", other: "Varies by product bundle" },
			{ label: "Tutor chat privacy", vertex: "Chat private to student", other: "Depends on product" },
			{ label: "Pricing", vertex: "Monthly / yearly student subscription", other: "Course and bundle pricing" },
		],
		whoShouldPickThem: "You want a video-first course library and are comfortable with that study style.",
		whoShouldPickUs:
			"You want to know which 3 chapters are hurting marks this month and fix them before the unit test.",
	},
	vedantu: {
		slug: "vedantu",
		brand: "Vedantu",
		heroLead: "Vedantu excels at live classes and structured programs. 24Vertex focuses on daily chapter gaps on school work.",
		theirStrength:
			"Vedantu is known for live tutoring, batches, and competitive-exam prep ecosystems. Families enrolled in live programs get scheduled teaching.",
		ourRole:
			"24Vertex is always-on practice and doubt support aligned to school chapters, with analytics parents can read without interrogating their child.",
		comparisonRows: [
			{ label: "Primary offer", vertex: "Adaptive practice on school chapters", other: "Live classes and programs" },
			{ label: "Practice adaptivity", vertex: "Targets 3 to 5 weak chapters", other: "Program-driven schedule" },
			{ label: "Parent visibility", vertex: "Chapter mastery radar chart", other: "Varies by enrollment" },
			{ label: "Solve doubts at home", vertex: "Explain + Solve-with-me AI", other: "Live teacher dependent" },
			{ label: "Pricing", vertex: "Monthly / yearly student subscription", other: "Program / batch pricing" },
		],
		whoShouldPickThem: "You want scheduled live teaching in a batch.",
		whoShouldPickUs: "You want chapter-level signal and short practice between school and tuition.",
	},
	"physics-wallah": {
		slug: "physics-wallah",
		brand: "Physics Wallah",
		heroLead: "Physics Wallah is a powerhouse for affordable video and test prep. 24Vertex is for chapter gaps in grades 6 to 10 school work.",
		theirStrength:
			"Physics Wallah offers accessible video content and large test-prep communities, especially for older grades and competitive exams.",
		ourRole:
			"24Vertex serves middle school families who need CBSE / ICSE / state board chapter alignment, parent-readable reports, and a tutor that meets your child where their school book is this week.",
		comparisonRows: [
			{ label: "Focus grades", vertex: "Grades 6 to 10 school sync", other: "Broader, incl. competitive prep" },
			{ label: "Content model", vertex: "Practice on current chapters", other: "Video + test series" },
			{ label: "Parent dashboard", vertex: "Chapter mastery radar chart", other: "Not the core product" },
			{ label: "Session style", vertex: "Short adaptive sets", other: "Video-first study" },
			{ label: "Board alignment", vertex: "NCERT + ICSE + state variants", other: "Exam-prep oriented" },
		],
		whoShouldPickThem: "You want affordable video-led prep at scale.",
		whoShouldPickUs: "You want school-chapter practice and parent visibility before report-card day.",
	},
};

export function getVsPageContent(slug: string): VsPageContent | undefined {
	return VS_PAGES[slug];
}

export function getAllVsSlugs(): string[] {
	return Object.keys(VS_PAGES);
}

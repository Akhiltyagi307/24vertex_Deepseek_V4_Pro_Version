import type { MarketingBeliefCard, MarketingPageHero, MarketingTeamMember } from "@/lib/marketing/pages/types";

export const ABOUT_HERO: MarketingPageHero = {
	eyebrow: "About 24Vertex",
	title: "We built the layer schools do not have time to give.",
	lead: "24Vertex helps Indian families in grades 6 to 10 catch weak chapters before report-card day. CBSE, ICSE, and major state boards. Adaptive practice, a private AI tutor, and a chapter-level parent dashboard.",
};

export const ABOUT_ORIGIN_BEATS = [
	{
		title: "Report-card surprise is a systems problem",
		body: "Not a child problem, and not the school's fault either. Schools move fast. Parents find out which chapters slipped only when marks land.",
	},
	{
		title: "Tuition teaches. Nobody shows the three chapters dragging marks",
		body: "Your child sits through hours of explanation. What is missing is a clear list of which chapters need 20 minutes this week.",
	},
	{
		title: "AI should coach, not shame",
		body: "Wrong answers should get another explanation, not a lecture. That is why we built Explain and Solve-with-me modes instead of answer dumps.",
	},
] as const;

export const ABOUT_BELIEFS: MarketingBeliefCard[] = [
	{
		title: "Chapter-level honesty",
		body: "We show mastery by chapter, not a single vanity score. Green, amber, and red mean something you can act on.",
	},
	{
		title: "20-minute sessions",
		body: "Practice fits after school, not instead of sleep. Short, targeted sets beat endless question banks.",
	},
	{
		title: "Tutor chat stays private",
		body: "Parents and teachers see what was practised and how often. The words your child used to ask stay between them and the tutor.",
	},
	{
		title: "No exam-panic marketing",
		body: "We will not promise rank, guarantee marks, or tell you your child is falling behind their peers.",
	},
];

export const ABOUT_WILL_NOT = [
	"Guarantee a rank or a percentage on the next exam",
	"Sell or share student data with advertisers",
	"Replace your child's teacher or school",
	"Shame students for wrong answers in the AI tutor",
] as const;

export const ABOUT_TEAM: MarketingTeamMember[] = [
	{
		name: "Product and curriculum",
		role: "Building for Indian classrooms",
		bio: "We map practice to NCERT and board chapter rhythms so questions feel like school, not a foreign syllabus.",
		initials: "PC",
	},
	{
		name: "Engineering",
		role: "Reliability and privacy",
		bio: "Sessions, reports, and school workspaces are built to stay fast on the phones families actually use.",
		initials: "EN",
	},
];

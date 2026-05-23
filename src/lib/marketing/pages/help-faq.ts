import type { MarketingFaqItem } from "@/lib/marketing/pages/types";

export type HelpFaqCategory = {
	id: string;
	title: string;
	items: MarketingFaqItem[];
};

export const HELP_FAQ_CATEGORIES: HelpFaqCategory[] = [
	{
		id: "parents",
		title: "Parents",
		items: [
			{
				id: "p1",
				question: "How is 24Vertex different from BYJU's, Vedantu, or Physics Wallah?",
				answer:
					"Those products mostly sell content: videos, tests, sometimes live classes. 24Vertex is a layer that sits on top of your child's actual school work. Adaptive practice on the chapters they are learning right now, a private AI tutor for the doubts that pile up at home, and a parent dashboard built so you do not have to ask your child every evening how studies are going.",
			},
			{
				id: "p2",
				question: "Will my child actually use this?",
				answer:
					"Sessions are 20 minutes, not two-hour video lectures. Practice is targeted to the 3 to 5 chapters they are weak in, not a 600-question bank. The AI tutor responds in seconds and never makes them feel stupid for wrong answers.",
			},
			{
				id: "p3",
				question: "My child is in CBSE / ICSE / state board. Will questions match their textbook?",
				answer:
					"Yes. Content maps to NCERT and ICSE chapter structures, with major state board variants for grades 6 to 10. Vocabulary, question patterns, and difficulty match what your child sees in school books.",
			},
			{
				id: "p4",
				question: "Does this replace tuition?",
				answer:
					"Most families use it alongside tuition. Tuitions teach. 24Vertex shows where the gap is, lets your child practise that exact gap, and answers doubts they would not ask the tuition teacher. Some families drop a tuition once chapters close week by week. That is your call.",
			},
			{
				id: "p5",
				question: "How long until marks improve?",
				answer:
					"Most families see chapter-level mastery shift inside the first 4 weeks of consistent use. Marks on school tests follow your school's unit-test cycle. We will not promise a number; it depends on practice cadence and which chapters are assessed next.",
			},
			{
				id: "p6",
				question:
					"What happens when my child gets stuck or gives a wrong answer? Will the AI shame them?",
				answer:
					"Never. The tutor responds to wrong answers with a question, not a sigh. It will explain a concept five different ways before giving up. Solve-with-me mode coaches through a sum without handing the answer with a smug correction.",
			},
			{
				id: "p7",
				question:
					"Who can see my child's data? Can teachers and the school admin see everything?",
				answer:
					"Practice scores and chapter mastery are visible to you, your child, and linked teachers. Tutor chat content is private to your child. See the security page and privacy policy for the full breakdown.",
			},
			{
				id: "p8",
				question:
					"What if our school is not on 24Vertex? Can my child still use it solo?",
				answer:
					"Yes. Parent and student views work without a school link. If your school joins later, teacher views activate without lost progress.",
			},
		],
	},
	{
		id: "students",
		title: "Students",
		items: [
			{
				id: "s1",
				question: "What happens when I get a question wrong?",
				answer:
					"The tutor responds with a question, not a sigh. Explain mode breaks concepts down. Solve-with-me mode coaches you through steps without handing you the final answer on the first try.",
			},
			{
				id: "s2",
				question: "How long should a practice session be?",
				answer:
					"About 20 minutes on the chapters your heatmap flags. That is enough for meaningful progress without burning out after school and tuition.",
			},
		],
	},
	{
		id: "schools",
		title: "Schools and teachers",
		items: [
			{
				id: "sc1",
				question: "Can we pilot with one section first?",
				answer:
					"Yes. Most schools start with one grade or section, invite teachers, run one assignment cycle, then expand. Contact us to plan a walkthrough.",
			},
			{
				id: "sc2",
				question: "Do teachers see tutor chat messages?",
				answer:
					"No. Teachers and parents see practice activity and chapter mastery. Tutor chat text stays private to the student.",
			},
			{
				id: "sc3",
				question: "What if our school is not on 24Vertex yet?",
				answer:
					"Families can use parent and student views without a school link. If your school joins later, teacher views activate without losing progress.",
			},
		],
	},
	{
		id: "billing",
		title: "Billing",
		items: [
			{
				id: "b1",
				question: "How does the free trial work?",
				answer:
					"14 days free with 5 practice tests and full access to the AI tutor. No card needed to start. See pricing for monthly and yearly plans after the trial.",
			},
			{
				id: "b2",
				question: "Can I cancel anytime?",
				answer:
					"Yes on monthly billing. Cancel before the next renewal. Yearly plans follow the refund policy on our legal page.",
			},
			{
				id: "b3",
				question: "Who processes payments?",
				answer:
					"Razorpay and your bank or UPI app. We receive transaction status and references, not your full card number or UPI PIN.",
			},
		],
	},
	{
		id: "privacy",
		title: "Privacy and data",
		items: [
			{
				id: "d1",
				question: "Who can see my child's data?",
				answer:
					"Practice scores and chapter mastery are visible to you, your child, and teachers you link. Tutor chat content is private to your child. See our security page and privacy policy for the full matrix.",
			},
			{
				id: "d2",
				question: "Is data sold to advertisers?",
				answer:
					"No. We do not run ads in the product and we do not sell student data.",
			},
		],
	},
];

export function getAllHelpFaqItems(): MarketingFaqItem[] {
	return HELP_FAQ_CATEGORIES.flatMap((c) => c.items);
}

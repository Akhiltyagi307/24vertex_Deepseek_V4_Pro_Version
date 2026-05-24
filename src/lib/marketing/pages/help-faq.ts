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
				id: "1",
				question: "How is 24Vertex different from BYJU's, Vedantu, or Physics Wallah?",
				answer:
					"Those products mostly sell content: videos, tests, sometimes live classes. 24Vertex is a layer that sits on top of your child's actual school work. Adaptive practice on the chapters they are learning right now, a private AI tutor for the doubts that pile up at home, and a parent dashboard built so you do not have to ask your child every evening how studies are going.",
			},
			{
				id: "2",
				question: "Will my child actually use this?",
				answer:
					"Sessions are 20 minutes, not two-hour video lectures. Practice is targeted to the 3 to 5 chapters they are weak in, not a 600-question bank. The AI tutor responds in seconds and never makes them feel stupid for wrong answers.",
			},
			{
				id: "3",
				question: "My child is in CBSE / ICSE / state board. Will questions match their textbook?",
				answer:
					"Yes. Content maps to NCERT and ICSE chapter structures, with major state board variants for grades 6 to 10. Vocabulary, question patterns, and difficulty match what your child sees in school books.",
			},
			{
				id: "4",
				question: "Does this replace tuition?",
				answer:
					"Most families use it alongside tuition. Tuitions teach. 24Vertex shows where the gap is, lets your child practise that exact gap, and answers doubts they would not ask the tuition teacher. Some families drop a tuition once chapters close week by week. That is your call.",
			},
			{
				id: "5",
				question: "How long until marks improve?",
				answer:
					"Most families see chapter-level mastery shift inside the first 4 weeks of consistent use. Marks on school tests follow your school's unit-test cycle. We will not promise a number; it depends on practice cadence and which chapters are assessed next.",
			},
			{
				id: "6",
				question:
					"What happens when my child gets stuck or gives a wrong answer? Will the AI shame them?",
				answer:
					"Never. The tutor responds to wrong answers with a question, not a sigh. It will explain a concept five different ways before giving up. Solve-with-me mode coaches through a sum without handing the answer with a smug correction.",
			},
			{
				id: "7",
				question:
					"Who can see my child's data? Can teachers and the school admin see everything?",
				answer:
					"Practice scores and chapter mastery are visible to you, your child, and linked teachers. Tutor chat content is private to your child. See the security page and privacy policy for the full breakdown.",
			},
			{
				id: "8",
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
				id: "1",
				question: "What happens when I get a question wrong?",
				answer:
					"The tutor responds with a question, not a sigh. Explain mode breaks concepts down. Solve-with-me mode coaches you through steps without handing you the final answer on the first try.",
			},
			{
				id: "2",
				question: "How long should a practice session be?",
				answer:
					"About 20 minutes on the chapters your radar chart flags. That is enough for meaningful progress without burning out after school and tuition.",
			},
			{
				id: "3",
				question: "How long are practice tests?",
				answer:
					"Practice tests run 1 hour or 3 hours. Pick the length that fits your schedule before you start.",
			},
			{
				id: "4",
				question: "I am on CBSE / ICSE / state board. Will questions match my textbook?",
				answer:
					"Yes. Practice maps to NCERT and ICSE chapter structures, with major state board variants for grades 6 to 10. Wording and question style follow what you see in school books, not a random competitive-exam bank.",
			},
			{
				id: "5",
				question: "Do I need my parent to sign up first?",
				answer:
					"Usually yes. 24Vertex is a family subscription: your parent creates the account, links you, and handles billing after the trial. You get practice and the tutor. They get the chapter map. You each see the same mastery signal from your own screen.",
			},
			{
				id: "6",
				question: "Can my parent or teacher read what I ask the tutor?",
				answer:
					"No. Tutor chat stays private to you. Your parent and teachers see practice scores and which chapters are strong or weak. They do not see the words you typed in the tutor.",
			},
			{
				id: "7",
				question: "What if my school is not on 24Vertex yet?",
				answer:
					"You can still use it. Parent and student views work without a school link. If your school joins later, teacher views turn on and your progress stays where it is.",
			},
			{
				id: "8",
				question: "What is in the free trial?",
				answer:
					"14 days free with 5 practice tests (1 hour or 3 hours each) and full access to the AI tutor. No card needed to start. After the trial, only the student account needs a paid plan. Parent accounts stay free.",
			},
			{
				id: "9",
				question: "How does the chapter heatmap know what is weak?",
				answer:
					"After you finish a practice session, each chapter you touched gets a state: strong, weak, or guesswork. It updates within minutes. Open the map before you pick what to revise tonight instead of guessing from how class felt.",
			},
			{
				id: "10",
				question: "Does this replace homework or tuition?",
				answer:
					"No. It sits on top of school work. Use it for the chapters your heatmap flags and for doubts you would not ask in class. Many students keep tuition and use 24Vertex to close gaps between classes.",
			},
		],
	},
	{
		id: "schools",
		title: "Schools and teachers",
		items: [
			{
				id: "1",
				question: "Can we pilot with one section first?",
				answer:
					"Yes. Most schools start with one grade or section, invite teachers, run one assignment cycle, then expand. Contact us to plan a walkthrough.",
			},
			{
				id: "2",
				question: "Do teachers see tutor chat messages?",
				answer:
					"No. Teachers and parents see practice activity and chapter mastery. Tutor chat text stays private to the student.",
			},
			{
				id: "3",
				question: "What if our school is not on 24Vertex yet?",
				answer:
					"Families can use parent and student views without a school link. If your school joins later, teacher views activate without losing progress.",
			},
			{
				id: "4",
				question: "Which boards and grades do you support?",
				answer:
					"Grades 6 to 10 across CBSE, ICSE, and major state boards. Practice maps to NCERT and ICSE chapter structures so questions match what students see in school books.",
			},
			{
				id: "5",
				question: "How do teachers join our workspace?",
				answer:
					"Share a join link with your staff. Each teacher requests access and your coordinator approves them before they can see section or student data.",
			},
			{
				id: "6",
				question: "Can we run CBSE and state board sections separately?",
				answer:
					"Yes. Create separate sections per board, grade, and batch. Analytics and assignments stay scoped to each section so classes do not mix.",
			},
			{
				id: "7",
				question: "How does school pricing work?",
				answer:
					"Only student accounts require a paid subscription. Parent and teacher accounts are free. Schools can pilot with per-seat or school-wide plans; book a walkthrough for a quote. There is no self-serve school checkout on the site yet.",
			},
			{
				id: "8",
				question: "What can coordinators see that teachers cannot?",
				answer:
					"Coordinators get grade-level rollups across sections. Teachers see their assigned sections by default. Coordinators can grant cross-section access when needed.",
			},
		],
	},
	{
		id: "billing",
		title: "Billing",
		items: [
			{
				id: "1",
				question: "How does the free trial work?",
				answer:
					"14 days free with 5 practice tests (1 hour or 3 hours each) and full access to the AI tutor. No card needed to start. Only student accounts are paid after the trial; parent and teacher accounts stay free. See pricing for monthly and yearly student plans.",
			},
			{
				id: "2",
				question: "Who pays? Are parent and teacher accounts free?",
				answer:
					"Only student accounts require a paid subscription after the free trial. Parent and teacher accounts are free. Parents typically manage billing for their child's student account.",
			},
			{
				id: "3",
				question: "Can I cancel anytime?",
				answer:
					"Yes on monthly billing. Cancel before the next renewal. Yearly plans follow the refund policy on our legal page.",
			},
			{
				id: "4",
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
				id: "1",
				question: "Who can see my child's data?",
				answer:
					"Practice scores and chapter mastery are visible to you, your child, and teachers you link. Tutor chat content is private to your child. See our security page and privacy policy for the full matrix.",
			},
			{
				id: "2",
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

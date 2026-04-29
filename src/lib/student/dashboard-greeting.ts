/** First token of `full_name` for greetings; falls back when missing. */
export function firstNameFromFullName(fullName: string | null | undefined): string {
	const t = fullName?.trim();
	if (!t) return "there";
	return t.split(/\s+/)[0] ?? "there";
}

const GREETING_TEMPLATES = [
	(name: string) =>
		`Hi ${name}, here's a quick snapshot of your progress and what to work on next.`,
	(name: string) =>
		`Welcome back, ${name}. Subjects, recent tests, and shortcuts to practice are below.`,
	(name: string) =>
		`Good to see you, ${name}. Review progress, open a subject, or continue practice when you're ready.`,
	(name: string) =>
		`${name}, your scores, topic coverage, and recent activity are summarized on this page.`,
	(name: string) =>
		`Hi ${name}, use this overview to see strong subjects, gaps, and a quick path back into practice.`,
] as const;

/** Picks one template at random (call from a server component once per request). */
export function pickStudentDashboardGreeting(fullName: string | null | undefined): string {
	const first = firstNameFromFullName(fullName);
	const i = Math.floor(Math.random() * GREETING_TEMPLATES.length);
	return GREETING_TEMPLATES[i](first);
}

const PARENT_GREETING_TEMPLATES = [
	(name: string) =>
		name === "there"
			? "Your linked student at a glance: scores, subjects, and what to watch next."
			: `${name}'s activity at a glance: scores, subjects, and what to watch next.`,
	(name: string) =>
		name === "there"
			? "EduAI progress for your linked student: recent tests, topic coverage, and trends below."
			: `EduAI progress for ${name}: recent tests, topic coverage, and trends below.`,
	(name: string) =>
		name === "there"
			? "Snapshot of your student: strengths, gaps, and recent timed tests below."
			: `Snapshot of ${name}: strengths, gaps, and recent timed tests below.`,
	(name: string) =>
		name === "there"
			? "Your student's recent progress, school readiness, and study habits are summarized below."
			: `${name}'s recent progress, school readiness, and study habits are summarized below.`,
	(name: string) =>
		name === "there"
			? "Track your student's scores, see which subjects need attention, and open detailed reports when you need them."
			: `Track ${name}'s scores, see which subjects need attention, and open detailed reports when you need them.`,
] as const;

/** Parent portal: addresses the guardian; `fullName` is the linked student's name. */
export function pickParentDashboardGreeting(childFullName: string | null | undefined): string {
	const first = firstNameFromFullName(childFullName);
	const i = Math.floor(Math.random() * PARENT_GREETING_TEMPLATES.length);
	return PARENT_GREETING_TEMPLATES[i](first);
}

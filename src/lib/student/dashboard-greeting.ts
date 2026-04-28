/** First token of `full_name` for greetings; falls back when missing. */
export function firstNameFromFullName(fullName: string | null | undefined): string {
	const t = fullName?.trim();
	if (!t) return "there";
	return t.split(/\s+/)[0] ?? "there";
}

const GREETING_TEMPLATES = [
	(name: string) =>
		`Hi ${name} — here's a snapshot of how you're doing and what to tackle next.`,
	(name: string) =>
		`Welcome back, ${name} — your subjects, recent tests, and practice shortcuts are all below.`,
	(name: string) =>
		`Good to see you, ${name} — scan your progress and open a subject or start practice whenever you're ready.`,
	(name: string) =>
		`${name}, this page shows your scores, topic coverage, and recent activity in one place.`,
	(name: string) =>
		`Hey ${name} — use this overview to spot strong subjects, see what needs work, and jump back into practice.`,
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
			? "Overview of your linked student — scores, subjects, and what to watch next."
			: `${name}'s activity at a glance — scores, subjects, and what to watch next.`,
	(name: string) =>
		name === "there"
			? "You're viewing this student's EduAI progress: recent tests, topic coverage, and trends below."
			: `You're viewing ${name}'s EduAI progress: recent tests, topic coverage, and trends below.`,
	(name: string) =>
		name === "there"
			? "Monitor this student's learning snapshot — strengths, gaps, and recent timed tests in one place."
			: `Monitor ${name}'s learning snapshot — strengths, gaps, and recent timed tests in one place.`,
	(name: string) =>
		name === "there"
			? "Here's how they're doing lately — use this overview to follow school readiness and study habits."
			: `Here's how ${name} is doing lately — use this overview to follow school readiness and study habits.`,
	(name: string) =>
		name === "there"
			? "Student dashboard — track scores, see which subjects need attention, and open detailed reports when you need them."
			: `${name}'s dashboard — track scores, see which subjects need attention, and open detailed reports when you need them.`,
] as const;

/** Parent portal: addresses the guardian; `fullName` is the linked student's name. */
export function pickParentDashboardGreeting(childFullName: string | null | undefined): string {
	const first = firstNameFromFullName(childFullName);
	const i = Math.floor(Math.random() * PARENT_GREETING_TEMPLATES.length);
	return PARENT_GREETING_TEMPLATES[i](first);
}

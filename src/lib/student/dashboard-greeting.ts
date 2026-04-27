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
		`${name}, this page shows your scores, topic coverage, assignments, and recent activity in one place.`,
	(name: string) =>
		`Hey ${name} — use this overview to spot strong subjects, see what needs work, and jump back into practice.`,
] as const;

/** Picks one template at random (call from a server component once per request). */
export function pickStudentDashboardGreeting(fullName: string | null | undefined): string {
	const first = firstNameFromFullName(fullName);
	const i = Math.floor(Math.random() * GREETING_TEMPLATES.length);
	return GREETING_TEMPLATES[i](first);
}

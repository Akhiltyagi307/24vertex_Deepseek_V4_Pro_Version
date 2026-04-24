/** First token of `full_name` for greetings; falls back when missing. */
export function firstNameFromFullName(fullName: string | null | undefined): string {
	const t = fullName?.trim();
	if (!t) return "there";
	return t.split(/\s+/)[0] ?? "there";
}

const GREETING_TEMPLATES = [
	(name: string) => `Ready to crush your goals today, ${name}?`,
	(name: string) => `Welcome back, ${name}! Let's keep that streak alive.`,
	(name: string) => `Hey ${name} — your subjects, stats, and next win are all right here.`,
	(name: string) => `Good to see you, ${name}. Pick a practice and turn focus into progress.`,
	(name: string) => `${name}, you've got this — one step at a time, starting from your dashboard.`,
] as const;

/** Picks one template at random (call from a server component once per request). */
export function pickStudentDashboardGreeting(fullName: string | null | undefined): string {
	const first = firstNameFromFullName(fullName);
	const i = Math.floor(Math.random() * GREETING_TEMPLATES.length);
	return GREETING_TEMPLATES[i](first);
}

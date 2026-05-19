const WHITESPACE = /\s+/g;

export function truncateQuestionPreview(input: string, maxChars = 20): string {
	const normalized = input.replace(WHITESPACE, " ").trim();
	if (normalized.length <= maxChars) return normalized;
	return `${normalized.slice(0, maxChars)}…`;
}

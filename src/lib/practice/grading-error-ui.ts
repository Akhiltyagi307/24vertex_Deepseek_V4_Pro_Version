/**
 * Student-facing grading error lines. Strips common secret patterns and caps length.
 */
export function sanitizeGradingErrorForUi(raw: string | null | undefined): string {
	if (raw == null) return "";
	let s = String(raw);
	s = s.replace(/\bBearer\s+[^\s]+\b/gi, "[redacted]");
	s = s.replace(/\b(?:sk|pk|rk)-[a-zA-Z0-9]{8,}\b/g, "[redacted]");
	s = s.replace(/\bapi[_-]?key\s*[:=]\s*[^\s,;]+/gi, "[redacted]");
	s = s.trim();
	if (s.length > 200) {
		return `${s.slice(0, 197)}…`;
	}
	return s;
}

export function jobStatusHint(status: string | null | undefined): string {
	switch (status) {
		case "pending":
			return "Grading request is queued.";
		case "running":
			return "The grader is processing your answers.";
		case "done":
			return "Finishing your report…";
		case "dead":
			return "Grading could not complete after several tries.";
		default:
			return "";
	}
}

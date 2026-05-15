/**
 * Parse a failed admin `fetch` response into a human-readable message.
 * Handles `{ error: string }` bodies, plain text, and empty bodies (common
 * behind HTTP/2 where `statusText` is often blank).
 */
export async function adminHttpErrorMessage(res: Response, fallback: string): Promise<string> {
	const statusPart = res.status ? `HTTP ${res.status}` : "request failed";
	let raw = "";
	try {
		raw = await res.text();
	} catch {
		return `${fallback} (${statusPart})`;
	}

	const trimmed = raw.trim();
	if (trimmed.startsWith("{")) {
		try {
			const j = JSON.parse(trimmed) as { error?: unknown };
			if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
		} catch {
			/* not JSON */
		}
	}

	if (trimmed) return trimmed;

	const st = res.statusText?.trim();
	if (st) return `${fallback}: ${st}`;

	return `${fallback} (${statusPart})`;
}

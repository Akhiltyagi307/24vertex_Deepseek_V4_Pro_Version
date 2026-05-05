import type { GeneratePracticeResult } from "../../../../../app/student/practice/actions/types";

/** NDJSON from `/api/student/practice/generate-stream` when `PRACTICE_STREAM` + `NEXT_PUBLIC_PRACTICE_STREAM` are enabled. */
export async function readPracticeGenerateNdjsonResponse(res: Response): Promise<GeneratePracticeResult> {
	const reader = res.body?.getReader();
	if (!reader) {
		throw new Error("No response body from generation stream.");
	}
	const dec = new TextDecoder();
	let buffer = "";
	let final: GeneratePracticeResult | null = null;
	while (true) {
		const { done, value } = await reader.read();
		if (value) {
			buffer += dec.decode(value, { stream: true });
		}
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const msg = JSON.parse(trimmed) as
				| { type: "partial"; partial: unknown }
				| { type: "done"; result: GeneratePracticeResult }
				| { type: "error"; message: string };
			if (msg.type === "error") {
				throw new Error(msg.message);
			}
			if (msg.type === "done") {
				final = msg.result;
			}
		}
		if (done) break;
	}
	if (buffer.trim()) {
		const msg = JSON.parse(buffer.trim()) as { type: string; result?: GeneratePracticeResult };
		if (msg.type === "done" && msg.result) {
			final = msg.result;
		}
	}
	if (!final) {
		throw new Error("Could not read generation result from stream.");
	}
	return final;
}

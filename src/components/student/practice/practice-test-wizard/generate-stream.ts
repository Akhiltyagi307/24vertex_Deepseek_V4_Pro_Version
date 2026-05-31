import type { GeneratePracticeResult } from "../../../../../app/student/practice/actions/types";
import type { GenerateStreamStageEnvelope } from "@/lib/practice/generate-stream-envelope";

/** NDJSON from `/api/student/practice/generate-stream` when `PRACTICE_STREAM` + `NEXT_PUBLIC_PRACTICE_STREAM` are enabled. */
export type PracticeGenerateStreamProgress = {
	draftedQuestions: number;
};

export class PracticeStreamError extends Error {
	readonly correlationId?: string;

	constructor(message: string, correlationId?: string) {
		super(message);
		this.name = "PracticeStreamError";
		this.correlationId = correlationId;
	}
}

function inferDraftedQuestionsFromPartial(partial: unknown): number | null {
	if (!partial || typeof partial !== "object") return null;
	const buckets = (partial as { questions_by_type?: unknown }).questions_by_type;
	if (!buckets || typeof buckets !== "object") return null;
	const typed = buckets as Record<string, unknown>;
	const keys = ["multiple_choice", "fill_in_blank", "short_answer", "long_answer"] as const;
	let total = 0;
	let sawAnyArray = false;
	for (const key of keys) {
		const arr = typed[key];
		if (!Array.isArray(arr)) continue;
		sawAnyArray = true;
		total += arr.length;
	}
	return sawAnyArray ? total : null;
}

export async function readPracticeGenerateNdjsonResponse(
	res: Response,
	options: {
		onPartialProgress?: (progress: PracticeGenerateStreamProgress) => void;
		onStage?: (stage: GenerateStreamStageEnvelope) => void;
	} = {},
): Promise<GeneratePracticeResult> {
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
				| GenerateStreamStageEnvelope
				| { type: "done"; result: GeneratePracticeResult }
				| { type: "error"; message: string; correlationId?: string };
			if (msg.type === "stage") {
				options.onStage?.(msg);
				continue;
			}
			if (msg.type === "partial") {
				const draftedQuestions = inferDraftedQuestionsFromPartial(msg.partial);
				if (draftedQuestions !== null) {
					options.onPartialProgress?.({ draftedQuestions });
				}
				continue;
			}
			if (msg.type === "error") {
				throw new PracticeStreamError(msg.message, msg.correlationId);
			}
			if (msg.type === "done") {
				final = msg.result;
			}
		}
		if (done) break;
	}
	if (buffer.trim()) {
		const msg = JSON.parse(buffer.trim()) as {
			type: string;
			result?: GeneratePracticeResult;
			message?: string;
			correlationId?: string;
			bucket?: GenerateStreamStageEnvelope["bucket"];
			status?: GenerateStreamStageEnvelope["status"];
			index?: number;
			total?: number;
		};
		if (msg.type === "stage") {
			if (msg.bucket && msg.status && typeof msg.index === "number" && typeof msg.total === "number") {
				options.onStage?.({
					type: "stage",
					bucket: msg.bucket,
					status: msg.status,
					index: msg.index,
					total: msg.total,
				});
			}
		} else if (msg.type === "error") {
			throw new PracticeStreamError(msg.message ?? "Generation failed.", msg.correlationId);
		} else if (msg.type === "done" && msg.result) {
			final = msg.result;
		}
	}
	if (!final) {
		throw new Error("Could not read generation result from stream.");
	}
	return final;
}

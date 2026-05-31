import {
	preflightPracticeGeneration,
	runPracticeGenerationAfterResolve,
	safeParseGenerationInput,
} from "@/lib/practice/practice-generation-pipeline";
import {
	envelopeForPartial,
	envelopeForResult,
	envelopeForStage,
	envelopeForThrown,
	httpStatusForGenerateFailure,
} from "@/lib/practice/generate-stream-envelope";
import { BUCKET_INDEX, BUCKET_TOTAL, bucketForStepKey } from "@/lib/practice/generation-progress-buckets";
import { getApiRequestUser } from "@/lib/auth/api-request-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
const PARTIAL_EMIT_MIN_INTERVAL_MS = 250;

function isPracticeStreamingEnabled(): boolean {
	const raw = process.env.PRACTICE_STREAM?.trim().toLowerCase();
	// Keep strict opt-in in production; always enable for local/dev backend test coverage.
	if (process.env.NODE_ENV !== "production") return true;
	return raw === "true";
}

/**
 * When `PRACTICE_STREAM=true`, streams NDJSON: partial object lines, then a final `done` line
 * with the same {@link import("@/app/student/practice/actions/types").GeneratePracticeResult} shape
 * as the `generatePracticeTest` server action. One model run and shared pipeline — no double charge.
 */
export async function POST(request: Request) {
	if (!isPracticeStreamingEnabled()) {
		return Response.json({ success: false, code: "not_found", message: "Streaming disabled." }, { status: 404 });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ success: false, code: "validation_error", message: "Invalid JSON." }, { status: 400 });
	}

	const parsed = safeParseGenerationInput(json);
	if (!parsed.success) {
		// TC001/H-3: include a stable `code` so clients (and the backend test
		// suite) can branch on the failure type, not just the HTTP status.
		return Response.json(
			{ success: false, code: "validation_error", message: "Validation error: invalid configuration." },
			{ status: 400 },
		);
	}

	const auth = await getApiRequestUser(request);
	if (!auth) {
		return Response.json({ success: false, code: "unauthorized", message: "Unauthorized." }, { status: 401 });
	}
	const { supabase } = auth;

	const gate = await preflightPracticeGeneration(supabase, parsed.data);
	if (!gate.ok) {
		const r = gate.result;
		if (r.ok) {
			return Response.json(
				{ success: false, code: "internal_error", message: "Unexpected preflight state." },
				{ status: 500 },
			);
		}
		// HTTP status mapping centralized in `httpStatusForGenerateFailure` so the
		// server-action and streaming-route paths can't drift apart silently.
		const status = httpStatusForGenerateFailure(r);
		const headers: Record<string, string> = {};
		if (r.code === "rate_limited" && r.resetAt) {
			const secs = Math.max(0, Math.ceil((new Date(r.resetAt).getTime() - Date.now()) / 1000));
			headers["Retry-After"] = String(secs);
		}
		return Response.json(
			{
				success: false,
				code: r.code,
				message: r.message,
				...(r.paywall ? { paywall: true } : {}),
				...(r.correlationId ? { correlationId: r.correlationId } : {}),
				...(r.code === "rate_limited" ? { resetAt: r.resetAt ?? null } : {}),
			},
			{ status, headers },
		);
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (line: object) => {
				controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
			};
			let latestPendingPartial: unknown = null;
			let lastPartialSentAt = 0;
			// Highest checklist-bucket index marked done — keeps stage events
			// monotonic across parallel question-generation batches.
			let lastDoneIndex = 0;
			const flushPendingPartial = () => {
				if (latestPendingPartial === null) return;
				send(envelopeForPartial(latestPendingPartial));
				latestPendingPartial = null;
				lastPartialSentAt = Date.now();
			};
			try {
				const result = await runPracticeGenerationAfterResolve(
					supabase,
					parsed.data,
					gate.resolved,
					{
						useStreamObject: true,
						onPartialObject: (partial) => {
							latestPendingPartial = partial;
							const now = Date.now();
							if (now - lastPartialSentAt >= PARTIAL_EMIT_MIN_INTERVAL_MS) {
								flushPendingPartial();
							}
						},
						// Progress checklist: one `stage` line per completed pipeline step,
						// collapsed to a student-facing bucket. Sent directly (not throttled
						// like partials) so steps never drop; clamped monotonic so parallel
						// batches/retries can't regress it. Recoverable mid-step errors are
						// left to the final `error` envelope, not surfaced as a stage.
						onStage: ({ stepKey, status }) => {
							if (status !== "ok") return;
							const bucket = bucketForStepKey(stepKey);
							if (!bucket) return;
							const index = BUCKET_INDEX[bucket];
							if (index <= lastDoneIndex) return;
							lastDoneIndex = index;
							send(envelopeForStage({ bucket, status: "done", index, total: BUCKET_TOTAL }));
						},
						// When the client closes the connection, request.signal fires
						// and the in-flight OpenAI HTTP call is cancelled — no more
						// tokens billed for a stream nobody is reading.
						abortSignal: request.signal,
					},
				);
				flushPendingPartial();
				// envelopeForResult guarantees success → `done`, failure → `error`.
				// Wrapping a failure inside `done` would look like success to a
				// naive client.
				send(envelopeForResult(result));
			} catch (e) {
				send(envelopeForThrown(e));
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "application/x-ndjson; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}

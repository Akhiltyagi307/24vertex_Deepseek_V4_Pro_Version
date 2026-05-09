import {
	preflightPracticeGeneration,
	runPracticeGenerationAfterResolve,
	safeParseGenerationInput,
} from "@/lib/practice/practice-generation-pipeline";
import {
	envelopeForPartial,
	envelopeForResult,
	envelopeForThrown,
	httpStatusForGenerateFailure,
} from "@/lib/practice/generate-stream-envelope";
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
		return Response.json({ ok: false, message: "Streaming disabled." }, { status: 404 });
	}

	let json: unknown;
	try {
		json = await request.json();
	} catch {
		return Response.json({ ok: false, message: "Invalid JSON." }, { status: 400 });
	}

	const parsed = safeParseGenerationInput(json);
	if (!parsed.success) {
		return Response.json({ ok: false, message: "Validation error: invalid configuration." }, { status: 400 });
	}

	const auth = await getApiRequestUser(request);
	if (!auth) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}
	const { supabase } = auth;

	const gate = await preflightPracticeGeneration(supabase, parsed.data);
	if (!gate.ok) {
		const r = gate.result;
		if (r.ok) {
			return Response.json({ ok: false, message: "Unexpected preflight state." }, { status: 500 });
		}
		// HTTP status mapping centralized in `httpStatusForGenerateFailure` so the
		// server-action and streaming-route paths can't drift apart silently.
		return Response.json(
			{
				ok: false,
				message: r.message,
				code: r.code,
				...(r.paywall ? { paywall: true } : {}),
				...(r.correlationId ? { correlationId: r.correlationId } : {}),
			},
			{ status: httpStatusForGenerateFailure(r) },
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

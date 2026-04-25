import {
	preflightPracticeGeneration,
	runPracticeGenerationAfterResolve,
	safeParseGenerationInput,
} from "@/lib/practice/practice-generation-pipeline";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * When `PRACTICE_STREAM=true`, streams NDJSON: partial object lines, then a final `done` line
 * with the same {@link import("@/app/student/practice/actions/types").GeneratePracticeResult} shape
 * as the `generatePracticeTest` server action. One model run and shared pipeline — no double charge.
 */
export async function POST(request: Request) {
	if (process.env.PRACTICE_STREAM !== "true") {
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
		return Response.json({ ok: false, message: "Invalid configuration." }, { status: 400 });
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
	}

	const gate = await preflightPracticeGeneration(supabase, parsed.data);
	if (!gate.ok) {
		const r = gate.result;
		if (r.ok) {
			return Response.json({ ok: false, message: "Unexpected preflight state." }, { status: 500 });
		}
		// r is GeneratePracticeFailure
		if (r.paywall) {
			return Response.json(
				{ ok: false, message: r.message, code: r.code, paywall: true },
				{ status: 402 },
			);
		}
		if (r.code === "validation_error" || r.message.includes("selection")) {
			return Response.json({ ok: false, message: r.message, code: r.code }, { status: 400 });
		}
		return Response.json({ ok: false, message: r.message, code: r.code }, { status: 400 });
	}

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const send = (line: object) => {
				controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
			};
			try {
				const result = await runPracticeGenerationAfterResolve(
					supabase,
					parsed.data,
					gate.resolved,
					{
						useStreamObject: true,
						onPartialObject: (partial) => {
							send({ type: "partial" as const, partial });
						},
					},
				);
				send({ type: "done" as const, result });
			} catch (e) {
				const message = e instanceof Error ? e.message : "Generation failed.";
				send({ type: "error" as const, message: message.length > 400 ? `${message.slice(0, 400)}…` : message });
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

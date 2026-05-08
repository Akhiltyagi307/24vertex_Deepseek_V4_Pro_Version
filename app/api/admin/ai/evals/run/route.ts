import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApi } from "@/lib/admin/api-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { ADMIN_RESPONSE_HEADERS, adminErrorResponse } from "@/lib/admin/response";
import { db } from "@/db";
import { evalRunResults, evalRuns } from "@/db/schema/eval-runs";
import { FIXTURES, FIXTURES_BY_SUBJECT } from "@/lib/practice/__fixtures__/index";
import type { PracticeFixture } from "@/lib/practice/__fixtures__/types";
import { runEvalSet } from "@/lib/practice/__evals__/runner";
import { buildPracticeSystemPrompt } from "@/lib/practice/system-prompt";

export const runtime = "nodejs";
// Eval runs take 20–60s. Vercel's default is 10s; bump to 5 minutes.
export const maxDuration = 300;

/**
 * Rate-limit window for "Run evals" — at most 4 manual runs per hour, project-wide.
 * Evals cost ~$0.06 per full run; this keeps a runaway click out of the realm
 * of significant spend while still allowing iteration.
 */
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_RUNS = 4;

function pickFixtures(filter: string | undefined): PracticeFixture[] {
	if (!filter || filter === "all") return FIXTURES;
	if (FIXTURES_BY_SUBJECT[filter]) return FIXTURES_BY_SUBJECT[filter];
	const byId = FIXTURES.find((f) => f.id === filter);
	if (byId) return [byId];
	const matchPrefix = FIXTURES.filter((f) => f.id.startsWith(filter));
	return matchPrefix;
}

const RUN_BODY_SCHEMA = z.object({
	filter: z.string().min(1).max(120).optional(),
	notes: z.string().max(500).optional(),
});

/**
 * POST /api/admin/ai/evals/run
 *
 * Triggers a Tier 2 LLM eval run against the supplied fixture filter (or all
 * fixtures if omitted), persists the run + per-fixture results, and returns
 * the run id + final summary.
 *
 * Synchronous: this route blocks until the run completes. With ~12 fixtures
 * and a typical model latency of 2–5s per call the total stays well under
 * `maxDuration`. If we ever exceed that, switch to a background job pattern.
 *
 * Cost: ~$0.06 per full run (gpt-4o-mini). Rate-limited to 4 manual runs / hr.
 */
export async function POST(request: NextRequest) {
	const gate = await requireAdminApi();
	if (gate instanceof NextResponse) return gate;

	let body: unknown = {};
	try {
		body = await request.json();
	} catch {
		// Empty body is fine — defaults to filter='all'
	}
	const parsed = RUN_BODY_SCHEMA.safeParse(body);
	if (!parsed.success) {
		return adminErrorResponse("Invalid body", { details: parsed.error.flatten() });
	}
	const filter = parsed.data.filter ?? "all";
	const notes = parsed.data.notes ?? null;

	const fixtures = pickFixtures(filter);
	if (fixtures.length === 0) {
		return adminErrorResponse(
			`No fixtures matched filter "${filter}". Available subjects: ${Object.keys(FIXTURES_BY_SUBJECT).join(", ")}.`,
		);
	}

	// Rate-limit: count completed runs in the last hour, project-wide.
	const sinceCutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
	const [{ count: recentCount }] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(evalRuns)
		.where(sql`${evalRuns.triggeredAt} >= ${sinceCutoff.toISOString()}`);
	if (recentCount >= RATE_LIMIT_MAX_RUNS) {
		return adminErrorResponse(
			`Rate-limited: at most ${RATE_LIMIT_MAX_RUNS} eval runs may be triggered per hour. ${recentCount} in the last hour. Wait or run via CLI (\`pnpm run evals:practice\`).`,
			{ status: 429 },
		);
	}

	// Insert the run row first (status='running'). If the runner crashes
	// mid-flight, the row stays as a tombstone for visibility.
	const triggeredBy = gate.jti ? `admin:${gate.jti}` : "admin:unknown";
	const [runRow] = await db
		.insert(evalRuns)
		.values({
			triggeredBy,
			status: "running",
			filter,
			model: "(resolving)",
			notes,
		})
		.returning();

	if (!runRow) {
		return adminErrorResponse("Failed to insert eval_runs row.", { status: 500 });
	}

	await writeAdminAction({
		action: ADMIN_ACTIONS.AI_EVAL_RUN_TRIGGER,
		payload: { run_id: runRow.id, filter, fixture_count: fixtures.length },
	});

	let modelUsed = "(unknown)";

	try {
		const summary = await runEvalSet(fixtures, {
			buildSystemPrompt: (fixture) =>
				buildPracticeSystemPrompt({
					userMessageSummary: fixture.input.userMessageSummary,
					generationSubject: fixture.input.generationSubject,
				}),
			onModelResolved: (m) => {
				modelUsed = m;
			},
		});

		// Persist per-fixture results
		if (summary.results.length > 0) {
			await db.insert(evalRunResults).values(
				summary.results.map((r) => ({
					evalRunId: runRow.id,
					fixtureId: r.fixtureId,
					subject: r.subject,
					pass: r.pass,
					schemaValid: r.schemaValid,
					latencyMs: r.latencyMs,
					inputTokens: r.usage.inputTokens,
					outputTokens: r.usage.outputTokens,
					outputResults: r.outputResults,
					error: r.error ?? null,
				})),
			);
		}

		// Update the run row with summary
		const [completedRow] = await db
			.update(evalRuns)
			.set({
				status: "complete",
				completedAt: new Date(),
				model: modelUsed,
				totalFixtures: summary.totalFixtures,
				passed: summary.passed,
				failed: summary.failed,
				schemaInvalid: summary.schemaInvalid,
				totalAssertions: summary.totalAssertions,
				passedAssertions: summary.passedAssertions,
				totalInputTokens: summary.totalInputTokens,
				totalOutputTokens: summary.totalOutputTokens,
				totalLatencyMs: summary.totalLatencyMs,
			})
			.where(eq(evalRuns.id, runRow.id))
			.returning();

		return NextResponse.json(
			{ data: completedRow },
			{ headers: { ...ADMIN_RESPONSE_HEADERS } },
		);
	} catch (e) {
		const errMsg = e instanceof Error ? e.message : String(e);
		await db
			.update(evalRuns)
			.set({
				status: "failed",
				completedAt: new Date(),
				model: modelUsed,
				error: errMsg,
			})
			.where(eq(evalRuns.id, runRow.id));
		return adminErrorResponse(errMsg, { status: 500 });
	}
}

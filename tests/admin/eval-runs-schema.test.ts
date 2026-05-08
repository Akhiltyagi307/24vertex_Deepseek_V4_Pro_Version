/**
 * Lock down the contract for the eval-runs admin surface — the audit action
 * constant, the Drizzle schema column shape, and the migration's status check
 * literals. These tests don't touch a live DB; they protect against silent
 * drift between the SQL migration, the Drizzle schema, and the route code
 * that reads/writes them.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { ADMIN_ACTIONS } from "@/lib/admin/audit-actions";
import { evalRunResults, evalRuns } from "@/db/schema/eval-runs";

const MIGRATION_FILE = path.resolve(
	process.cwd(),
	"supabase/migrations/20260601000000_eval_runs.sql",
);

describe("eval_runs admin surface", () => {
	it("AI_EVAL_RUN_TRIGGER audit action is wired", () => {
		expect(ADMIN_ACTIONS.AI_EVAL_RUN_TRIGGER).toBe("ai_eval_run_trigger");
	});

	it("Drizzle eval_runs table has the columns the routes write", () => {
		// The POST run route writes these columns. If a column name changes,
		// either rename in the route or update this test — never silently drift.
		const columnKeys = Object.keys(evalRuns);
		const required = [
			"id",
			"triggeredBy",
			"triggeredAt",
			"completedAt",
			"status",
			"filter",
			"model",
			"promptId",
			"totalFixtures",
			"passed",
			"failed",
			"schemaInvalid",
			"totalAssertions",
			"passedAssertions",
			"totalInputTokens",
			"totalOutputTokens",
			"totalLatencyMs",
			"notes",
			"error",
			"createdAt",
		];
		for (const k of required) {
			expect(columnKeys, `eval_runs missing column ${k}`).toContain(k);
		}
	});

	it("Drizzle eval_run_results has the per-fixture columns", () => {
		const columnKeys = Object.keys(evalRunResults);
		const required = [
			"id",
			"evalRunId",
			"fixtureId",
			"subject",
			"pass",
			"schemaValid",
			"latencyMs",
			"inputTokens",
			"outputTokens",
			"outputResults",
			"error",
			"createdAt",
		];
		for (const k of required) {
			expect(columnKeys, `eval_run_results missing column ${k}`).toContain(k);
		}
	});

	it("migration SQL exists and creates both tables with expected columns", () => {
		const sql = fs.readFileSync(MIGRATION_FILE, "utf8");
		expect(sql).toContain("create table if not exists public.eval_runs");
		expect(sql).toContain("create table if not exists public.eval_run_results");
		// Status enum literals must match what the routes write
		expect(sql).toContain("'running', 'complete', 'failed'");
		// FK to ai_prompts must use SET NULL so deleting a prompt doesn't
		// cascade-destroy historical eval runs against it.
		expect(sql).toMatch(/prompt_id uuid references public\.ai_prompts\(id\) on delete set null/);
		// FK from eval_run_results to eval_runs must CASCADE so deleting a
		// run cleans up its result rows.
		expect(sql).toMatch(/eval_run_id uuid not null\s+references public\.eval_runs\(id\) on delete cascade/);
		// RLS must be enabled on both tables (service-role-only access).
		expect(sql).toContain("alter table public.eval_runs enable row level security");
		expect(sql).toContain("alter table public.eval_run_results enable row level security");
	});

	it("migration SQL has indexes the list page depends on", () => {
		const sql = fs.readFileSync(MIGRATION_FILE, "utf8");
		// The dashboard list query orders by triggered_at desc — needs an index.
		expect(sql).toContain("eval_runs_triggered_at_idx");
		// The detail page joins by eval_run_id — needs an index.
		expect(sql).toContain("eval_run_results_run_idx");
	});
});

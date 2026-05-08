import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { aiPrompts } from "./ai-prompts";

/**
 * Eval-run summary row. One per practice-prompt eval-runner invocation.
 * Service-role only — populated by the admin `/api/admin/ai/evals/run` route
 * and the GitHub Actions weekly cron.
 *
 * Mirror of the SQL migration at
 * `supabase/migrations/20260601000000_eval_runs.sql`. If this drifts, run
 * `pnpm run db:generate` and reconcile.
 */
export const evalRuns = pgTable(
	"eval_runs",
	{
		id: uuid("id").defaultRandom().primaryKey(),

		/**
		 * Free-form: 'cron' | 'admin:<jti>' | 'cli' | null.
		 * Admin auth uses session JTIs, not profiles.id, so this can't be
		 * a foreign key to profiles.
		 */
		triggeredBy: text("triggered_by"),
		triggeredAt: timestamp("triggered_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		completedAt: timestamp("completed_at", { withTimezone: true }),

		/** 'running' | 'complete' | 'failed'. */
		status: text("status").notNull().default("running"),

		/** Fixture filter ('all' | subject-key | fixture-id | prefix). */
		filter: text("filter").notNull().default("all"),

		/** Model used for this run (snapshotted, not env-dependent). */
		model: text("model").notNull(),

		/** Optional: ai_prompts row this run exercised. NULL = file defaults. */
		promptId: uuid("prompt_id").references(() => aiPrompts.id, {
			onDelete: "set null",
		}),

		// Denormalised summary
		totalFixtures: integer("total_fixtures"),
		passed: integer("passed"),
		failed: integer("failed"),
		schemaInvalid: integer("schema_invalid"),
		totalAssertions: integer("total_assertions"),
		passedAssertions: integer("passed_assertions"),
		totalInputTokens: integer("total_input_tokens"),
		totalOutputTokens: integer("total_output_tokens"),
		totalLatencyMs: integer("total_latency_ms"),

		notes: text("notes"),
		error: text("error"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		check(
			"eval_runs_status_check",
			sql`${t.status} in ('running', 'complete', 'failed')`,
		),
		index("eval_runs_triggered_at_idx").on(sql`${t.triggeredAt} desc`),
	],
);

/**
 * Per-fixture results within an eval run. One row per fixture in
 * `evalRuns`. Service-role only.
 */
export const evalRunResults = pgTable(
	"eval_run_results",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		evalRunId: uuid("eval_run_id")
			.notNull()
			.references(() => evalRuns.id, { onDelete: "cascade" }),

		fixtureId: text("fixture_id").notNull(),
		subject: text("subject").notNull(),

		pass: boolean("pass").notNull(),
		schemaValid: boolean("schema_valid").notNull(),

		latencyMs: integer("latency_ms"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),

		/**
		 * Per-assertion results: array of
		 *   `{ pass: boolean, assertion: { type, ...params }, reason?: string }`
		 * JSONB so the assertion-type taxonomy can evolve without migrations.
		 */
		outputResults: jsonb("output_results").notNull(),

		error: text("error"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("eval_run_results_run_idx").on(t.evalRunId),
		index("eval_run_results_fixture_idx").on(t.fixtureId, sql`${t.createdAt} desc`),
	],
);

export type EvalRun = typeof evalRuns.$inferSelect;
export type NewEvalRun = typeof evalRuns.$inferInsert;
export type EvalRunResult = typeof evalRunResults.$inferSelect;
export type NewEvalRunResult = typeof evalRunResults.$inferInsert;

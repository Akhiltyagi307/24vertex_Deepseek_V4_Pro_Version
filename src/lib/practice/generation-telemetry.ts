import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiCalls, practiceGenerationRuns, practiceGenerationSteps } from "@/db/schema";

export type PracticeGenerationRequestMode = "server_action" | "stream" | "assignment_worker";
export type PracticeGenerationRunStatus = "running" | "succeeded" | "failed" | "aborted";
export type PracticeGenerationStepStatus = "started" | "ok" | "error" | "skipped";

type JsonRecord = Record<string, unknown>;

export type StartGenerationRunInput = {
	correlationId: string;
	studentId: string;
	subjectId: string;
	requestMode: PracticeGenerationRequestMode;
	configSnapshot?: JsonRecord;
	startedAt?: Date;
};

export type AppendGenerationStepInput = {
	runId: string;
	stepOrder: number;
	stepKey: string;
	status: PracticeGenerationStepStatus;
	model?: string | null;
	feature?: string | null;
	latencyMs?: number | null;
	inputTokens?: number | null;
	outputTokens?: number | null;
	error?: string | null;
	metadata?: JsonRecord;
};

export type FinishGenerationRunInput = {
	runId: string;
	status: Exclude<PracticeGenerationRunStatus, "running">;
	testId?: string | null;
	failureCode?: string | null;
	failureMessage?: string | null;
	timingsMs?: JsonRecord;
	finishedAt?: Date;
};

function toJsonRecordOrEmpty(value: unknown): JsonRecord {
	if (value == null) return {};
	try {
		const asJson = JSON.parse(JSON.stringify(value));
		if (asJson && typeof asJson === "object" && !Array.isArray(asJson)) {
			return asJson as JsonRecord;
		}
		return {};
	} catch {
		return {};
	}
}

function safeLogTelemetryFailure(label: string, error: unknown, extra?: JsonRecord) {
	if (process.env.NODE_ENV === "development") {
		console.error(`[generation-telemetry] ${label}`, { error, ...(extra ?? {}) });
	}
}

async function summarizeRunAiCalls(runId: string) {
	const [row] = await db
		.select({
			totalInputTokens: sql<number>`coalesce(sum(${aiCalls.inputTokens}), 0)`,
			totalOutputTokens: sql<number>`coalesce(sum(${aiCalls.outputTokens}), 0)`,
			totalAiCalls: sql<number>`coalesce(count(${aiCalls.id}), 0)`,
		})
		.from(aiCalls)
		.where(eq(aiCalls.generationRunId, runId));

	return {
		totalInputTokens: row?.totalInputTokens ?? 0,
		totalOutputTokens: row?.totalOutputTokens ?? 0,
		totalAiCalls: row?.totalAiCalls ?? 0,
	};
}

export async function startGenerationRun(input: StartGenerationRunInput): Promise<string | null> {
	try {
		const [row] = await db
			.insert(practiceGenerationRuns)
			.values({
				correlationId: input.correlationId,
				studentId: input.studentId,
				subjectId: input.subjectId,
				requestMode: input.requestMode,
				configSnapshot: toJsonRecordOrEmpty(input.configSnapshot),
				status: "running",
				startedAt: input.startedAt ?? new Date(),
			})
			.returning({ id: practiceGenerationRuns.id });
		return row?.id ?? null;
	} catch (error) {
		safeLogTelemetryFailure("startGenerationRun", error, {
			correlationId: input.correlationId,
			studentId: input.studentId,
			subjectId: input.subjectId,
		});
		return null;
	}
}

export async function appendGenerationStep(input: AppendGenerationStepInput): Promise<void> {
	try {
		await db.insert(practiceGenerationSteps).values({
			runId: input.runId,
			stepOrder: input.stepOrder,
			stepKey: input.stepKey,
			status: input.status,
			model: input.model ?? null,
			feature: input.feature ?? null,
			latencyMs: input.latencyMs ?? null,
			inputTokens: input.inputTokens ?? null,
			outputTokens: input.outputTokens ?? null,
			error: input.error ?? null,
			metadata: toJsonRecordOrEmpty(input.metadata),
		});
	} catch (error) {
		safeLogTelemetryFailure("appendGenerationStep", error, {
			runId: input.runId,
			stepOrder: input.stepOrder,
			stepKey: input.stepKey,
		});
	}
}

export async function updateGenerationRunConfigSnapshot(
	runId: string,
	configSnapshot: Record<string, unknown>,
): Promise<void> {
	try {
		await db
			.update(practiceGenerationRuns)
			.set({
				configSnapshot: toJsonRecordOrEmpty(configSnapshot),
			})
			.where(eq(practiceGenerationRuns.id, runId));
	} catch (error) {
		safeLogTelemetryFailure("updateGenerationRunConfigSnapshot", error, { runId });
	}
}

export async function attachTestIdToRunAiCalls(runId: string, testId: string): Promise<void> {
	try {
		await db
			.update(aiCalls)
			.set({ testId })
			.where(and(eq(aiCalls.generationRunId, runId), isNull(aiCalls.testId)));
	} catch (error) {
		safeLogTelemetryFailure("attachTestIdToRunAiCalls", error, { runId, testId });
	}
}

/**
 * H-5 safety net: mark a run `aborted` ONLY if it is still `running`. The
 * `status = 'running'` predicate makes this idempotent and safe to call
 * unconditionally from a `finally` — it is a no-op once a terminal status
 * (`succeeded`/`failed`/`aborted`) has already been written, so it can never
 * clobber a real outcome. Closes the "stuck running forever" gap where the
 * pipeline throws before reaching a terminal {@link finishGenerationRun}.
 */
export async function markGenerationRunAbortedIfRunning(runId: string): Promise<void> {
	try {
		await db
			.update(practiceGenerationRuns)
			.set({
				status: "aborted",
				failureCode: "aborted",
				failureMessage: "Generation pipeline threw before finalizing the run.",
				finishedAt: new Date(),
			})
			.where(and(eq(practiceGenerationRuns.id, runId), eq(practiceGenerationRuns.status, "running")));
	} catch (error) {
		safeLogTelemetryFailure("markGenerationRunAbortedIfRunning", error, { runId });
	}
}

export async function finishGenerationRun(input: FinishGenerationRunInput): Promise<void> {
	try {
		const totals = await summarizeRunAiCalls(input.runId);
		await db
			.update(practiceGenerationRuns)
			.set({
				status: input.status,
				testId: input.testId ?? null,
				failureCode: input.failureCode ?? null,
				failureMessage: input.failureMessage ?? null,
				totalInputTokens: totals.totalInputTokens,
				totalOutputTokens: totals.totalOutputTokens,
				totalAiCalls: totals.totalAiCalls,
				timingsMs: toJsonRecordOrEmpty(input.timingsMs),
				finishedAt: input.finishedAt ?? new Date(),
			})
			.where(eq(practiceGenerationRuns.id, input.runId));
	} catch (error) {
		safeLogTelemetryFailure("finishGenerationRun", error, {
			runId: input.runId,
			status: input.status,
		});
	}
}

/**
 * Unit tests for `recordComplianceEvent` — verifies the writer never throws
 * on infrastructure failure, even when the underlying `db.execute` rejects.
 *
 * Why no integration test in this file:
 *   The writer's only domain logic is "insert a row, swallow on failure".
 *   The schema constraints (status enum, phase length) are exercised by the
 *   Postgres-side checks in the migration; verifying them here would just
 *   re-test PG. A separate gated integration test can be added later if the
 *   payload shape grows beyond a single insert.
 */
import { describe, expect, it, vi } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("@/db", () => ({
	db: {
		execute: executeMock,
	},
}));

vi.mock("@sentry/nextjs", () => ({
	captureException: vi.fn(),
}));

import * as Sentry from "@sentry/nextjs";

import { recordComplianceEvent } from "@/lib/compliance/events";

describe("recordComplianceEvent", () => {
	it("inserts a row when db.execute resolves", async () => {
		executeMock.mockReset();
		executeMock.mockResolvedValue(undefined);
		(Sentry.captureException as unknown as ReturnType<typeof vi.fn>).mockReset();

		await recordComplianceEvent({
			requestId: "11111111-1111-1111-1111-111111111111",
			phase: "saga_started",
			status: "started",
			payload: { subject_user_id: "22222222-2222-2222-2222-222222222222" },
		});

		expect(executeMock).toHaveBeenCalledTimes(1);
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	it("does not throw when db.execute rejects, and reports to Sentry", async () => {
		executeMock.mockReset();
		executeMock.mockRejectedValue(new Error("connection refused"));
		(Sentry.captureException as unknown as ReturnType<typeof vi.fn>).mockReset();

		await expect(
			recordComplianceEvent({
				requestId: "11111111-1111-1111-1111-111111111111",
				phase: "db_transaction",
				status: "failed",
				errorMessage: "boom",
			}),
		).resolves.toBeUndefined();

		expect(Sentry.captureException).toHaveBeenCalledTimes(1);
		const [, opts] = (Sentry.captureException as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
			unknown,
			{ tags?: Record<string, string>; extra?: Record<string, unknown> },
		];
		expect(opts?.tags).toMatchObject({ feature: "compliance", phase: "record_event" });
		expect(opts?.extra).toMatchObject({
			request_id: "11111111-1111-1111-1111-111111111111",
			saga_phase: "db_transaction",
			saga_status: "failed",
		});
	});

	it("accepts all four documented status values without runtime error", async () => {
		executeMock.mockReset();
		executeMock.mockResolvedValue(undefined);
		const statuses = ["started", "ok", "failed", "skipped"] as const;
		for (const status of statuses) {
			await recordComplianceEvent({
				requestId: "11111111-1111-1111-1111-111111111111",
				phase: "test_phase",
				status,
			});
		}
		expect(executeMock).toHaveBeenCalledTimes(statuses.length);
	});
});

import { describe, expect, it } from "vitest";

import { isPostgresTooManyConnectionsError } from "@/lib/db/postgres-errors";

describe("isPostgresTooManyConnectionsError", () => {
	it("matches EMAXCONN on the root error", () => {
		expect(
			isPostgresTooManyConnectionsError(
				new Error("(EMAXCONN) max client connections reached, limit: 200"),
			),
		).toBe(true);
	});

	it("matches when EMAXCONN is only on nested cause (Drizzle-style wrap)", () => {
		const inner = new Error("(EMAXCONN) max client connections reached, limit: 200");
		const outer = new Error('Failed query: insert into "admin_sessions" …');
		(outer as Error & { cause?: unknown }).cause = inner;
		expect(isPostgresTooManyConnectionsError(outer)).toBe(true);
	});

	it("matches AggregateError.errors[]", () => {
		const inner = new Error("(EMAXCONN) max client connections reached");
		const agg = new AggregateError([inner], "batch failed");
		expect(isPostgresTooManyConnectionsError(agg)).toBe(true);
	});

	it("returns false for unrelated errors", () => {
		expect(isPostgresTooManyConnectionsError(new Error("relation \"admin_sessions\" does not exist"))).toBe(
			false,
		);
	});
});

import { describe, expect, it } from "vitest";

import { classifyLinkParentRpc } from "@/lib/auth/link-parent-rpc-errors";

describe("classifyLinkParentRpc", () => {
	it("detects student not found from details when message is generic", () => {
		expect(
			classifyLinkParentRpc({
				message: "internal error",
				details: 'ERROR: Student not found (SQLSTATE P0001)',
				hint: null,
			}),
		).toBe("student_not_found");
	});

	it("detects guardian email mismatch from message", () => {
		expect(
			classifyLinkParentRpc({
				message: "Parent email does not match student record",
				details: null,
				hint: null,
			}),
		).toBe("parent_email_mismatch");
	});

	it("detects missing ON CONFLICT target (Postgres 42P10)", () => {
		expect(
			classifyLinkParentRpc({
				message: "there is no unique or exclusion constraint matching the ON CONFLICT specification",
				details: null,
				hint: null,
				code: "42P10",
			}),
		).toBe("link_upsert_constraint_missing");
	});
});

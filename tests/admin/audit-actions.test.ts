/**
 * Tests for the audit-action constants. The constants exist so renames are
 * grep-able and so TS forbids unknown action strings at the call site. These
 * tests lock down the contract: every constant maps to its snake_case literal,
 * the literals are unique, and `isKnownAdminAction` recognizes them.
 */
import { describe, expect, it } from "vitest";

import { ADMIN_ACTION_NAMES, ADMIN_ACTIONS, isKnownAdminAction } from "@/lib/admin/audit-actions";

describe("ADMIN_ACTIONS", () => {
	it("every constant has a snake_case literal value", () => {
		const re = /^[a-z][a-z0-9_]*$/;
		for (const [k, v] of Object.entries(ADMIN_ACTIONS)) {
			expect(re.test(v), `${k}=${v} not snake_case`).toBe(true);
		}
	});

	it("literal values are unique (no two constants share a name)", () => {
		const values = Object.values(ADMIN_ACTIONS);
		const set = new Set(values);
		expect(set.size).toBe(values.length);
	});

	it("ADMIN_ACTION_NAMES is the value set", () => {
		for (const v of Object.values(ADMIN_ACTIONS)) {
			expect(ADMIN_ACTION_NAMES.has(v)).toBe(true);
		}
		expect(ADMIN_ACTION_NAMES.size).toBe(Object.keys(ADMIN_ACTIONS).length);
	});

	it("isKnownAdminAction recognizes constants and rejects strangers", () => {
		expect(isKnownAdminAction(ADMIN_ACTIONS.PAYMENT_REFUND)).toBe(true);
		expect(isKnownAdminAction("payment_refund")).toBe(true);
		expect(isKnownAdminAction("not_a_real_action")).toBe(false);
	});

	it("includes the actions wired into Sprint 1 + Sprint 2 hardening", () => {
		// These are the ones the Sprint 1/2 work explicitly relies on. If the
		// constant gets renamed without updating callers, this test fires.
		expect(ADMIN_ACTIONS.SAVED_VIEW_DELETE).toBe("saved_view_delete");
		expect(ADMIN_ACTIONS.ANALYTICS_EXPORT).toBe("analytics_export");
		expect(ADMIN_ACTIONS.PAYMENT_REFUND).toBe("payment_refund");
		expect(ADMIN_ACTIONS.BROADCAST_SEND).toBe("broadcast_send");
		expect(ADMIN_ACTIONS.USER_HARD_DELETE_REQUEST).toBe("user_hard_delete_request");
		expect(ADMIN_ACTIONS.USER_HARD_DELETE_DONE).toBe("user_hard_delete_done");
		expect(ADMIN_ACTIONS.IMPERSONATE).toBe("impersonate");
	});
});

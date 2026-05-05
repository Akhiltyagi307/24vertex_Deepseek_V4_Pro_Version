/**
 * Tests for the parent-action constants. Mirrors
 * tests/admin/audit-actions.test.ts. The constants exist so renames are
 * grep-able and TS forbids unknown action strings at the call site.
 */
import { describe, expect, it } from "vitest";

import { PARENT_ACTION_NAMES, PARENT_ACTIONS, isKnownParentAction } from "@/lib/parent/audit-actions";

describe("PARENT_ACTIONS", () => {
	it("every constant has a snake_case literal value", () => {
		const re = /^[a-z][a-z0-9_]*$/;
		for (const [k, v] of Object.entries(PARENT_ACTIONS)) {
			expect(re.test(v), `${k}=${v} not snake_case`).toBe(true);
		}
	});

	it("literal values are unique (no two constants share a name)", () => {
		const values = Object.values(PARENT_ACTIONS);
		const set = new Set(values);
		expect(set.size).toBe(values.length);
	});

	it("PARENT_ACTION_NAMES is the value set", () => {
		for (const v of Object.values(PARENT_ACTIONS)) {
			expect(PARENT_ACTION_NAMES.has(v)).toBe(true);
		}
		expect(PARENT_ACTION_NAMES.size).toBe(Object.keys(PARENT_ACTIONS).length);
	});

	it("isKnownParentAction recognizes constants and rejects strangers", () => {
		expect(isKnownParentAction(PARENT_ACTIONS.SELECT_STUDENT)).toBe(true);
		expect(isKnownParentAction("select_student")).toBe(true);
		expect(isKnownParentAction("not_a_real_action")).toBe(false);
	});

	it("includes the actions wired into the select-student + link-child flows", () => {
		expect(PARENT_ACTIONS.SELECT_STUDENT).toBe("select_student");
		expect(PARENT_ACTIONS.SELECT_STUDENT_UNAUTHORIZED).toBe("select_student_unauthorized");
		expect(PARENT_ACTIONS.LINK_CHILD_SUCCESS).toBe("link_child_success");
		expect(PARENT_ACTIONS.LINK_CHILD_FAILED).toBe("link_child_failed");
	});
});

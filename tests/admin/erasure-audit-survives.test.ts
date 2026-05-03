import { describe, expect, it } from "vitest";

import { ERASURE_PROTECTED_TABLES } from "@/lib/compliance/erasure";

describe("compliance erasure invariants", () => {
	it("does not list destructive deletes for immutable audit or billing tables", () => {
		expect(ERASURE_PROTECTED_TABLES).toContain("admin_action_log");
		expect(ERASURE_PROTECTED_TABLES).toContain("audit_logs");
		expect(ERASURE_PROTECTED_TABLES).toContain("payments");
	});
});

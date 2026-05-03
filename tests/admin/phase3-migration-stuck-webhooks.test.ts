import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Phase 3 migration: stuck_webhooks excludes admin events", () => {
	it("SQL definition filters admin_* event types", () => {
		const sql = readFileSync(join(__dirname, "../../supabase/migrations/20260504140000_admin_phase3_assessments_live.sql"), "utf8");
		expect(sql).toContain("stuck_webhooks");
		expect(sql).toContain("event_type NOT LIKE 'admin\\_%'");
	});
});

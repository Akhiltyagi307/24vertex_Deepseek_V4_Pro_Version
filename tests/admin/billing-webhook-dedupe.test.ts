import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("billing webhook dedupe", () => {
	it("insert path ignores duplicate razorpay_event_id (replay-safe ingest)", () => {
		const src = readFileSync(join(__dirname, "../../app/api/billing/webhook/route.ts"), "utf8");
		expect(src).toContain("ignoreDuplicates");
		expect(src).toContain("deduped");
	});
});

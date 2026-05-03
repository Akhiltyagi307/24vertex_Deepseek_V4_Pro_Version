import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

export type ExplainGateResult = { ok: true; totalCost: number } | { ok: false; error: string };

function stripTrailingSemicolons(s: string): string {
	return s.replace(/;+\s*$/g, "").trim();
}

/**
 * Runs `EXPLAIN (FORMAT JSON)` and returns the top-level plan total cost.
 */
export async function explainTotalCost(sqlText: string): Promise<ExplainGateResult> {
	const inner = stripTrailingSemicolons(sqlText);
	if (!inner) return { ok: false, error: "Empty SQL" };
	const low = inner.toLowerCase();
	const explain = low.startsWith("explain") ? inner : `EXPLAIN (FORMAT JSON) ${inner}`;
	try {
		const rows = await db.execute(sql.raw(explain));
		const first = (rows as unknown as Record<string, unknown>[])[0];
		const planJson =
			first?.["QUERY PLAN"] ?? first?.["query_plan"] ?? first?.[Object.keys(first ?? {})[0] ?? ""];
		const parsed =
			typeof planJson === "string" ? (JSON.parse(planJson) as unknown[])
			: Array.isArray(planJson) ? planJson
			: null;
		const root = parsed?.[0] as { Plan?: { "Total Cost"?: number } } | undefined;
		const total = root?.Plan?.["Total Cost"];
		if (typeof total !== "number" || !Number.isFinite(total)) {
			return { ok: false, error: "Could not parse EXPLAIN cost" };
		}
		return { ok: true, totalCost: total };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : "EXPLAIN failed" };
	}
}

import "server-only";

import { count, desc, gte } from "drizzle-orm";

import { db } from "@/db";
import { practiceAnalyticsEvents } from "@/db/schema/practice-tables";

/** Ordered funnel stages for product analytics (approximation using recorded events). */
export const FUNNEL_EVENTS = [
	"practice_wizard_opened",
	"practice_generation_succeeded",
	"practice_graded",
	"subscription_started",
] as const;

export type FunnelStageRow = { event_name: string; count: number };

export type FunnelEventCountRow = { eventName: string; n: number };

export async function getAdminAnalyticsFunnelData(): Promise<{
	stages: FunnelStageRow[];
	events_90d: FunnelEventCountRow[];
}> {
	const since = new Date();
	since.setDate(since.getDate() - 90);

	const rows = await db
		.select({
			eventName: practiceAnalyticsEvents.eventName,
			n: count(),
		})
		.from(practiceAnalyticsEvents)
		.where(gte(practiceAnalyticsEvents.occurredAt, since))
		.groupBy(practiceAnalyticsEvents.eventName)
		.orderBy(desc(count()));

	const map = new Map(rows.map((r) => [r.eventName, Number(r.n)]));
	const stages = FUNNEL_EVENTS.map((name) => ({
		event_name: name,
		count: map.get(name) ?? 0,
	}));

	return {
		stages,
		events_90d: rows.map((r) => ({ eventName: r.eventName, n: Number(r.n) })),
	};
}

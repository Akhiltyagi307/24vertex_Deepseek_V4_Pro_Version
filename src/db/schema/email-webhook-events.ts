import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Idempotency ledger for Resend webhooks (svix). The webhook route INSERTs
 * with `ON CONFLICT (svix_id) DO NOTHING RETURNING id` — if no row comes
 * back, the event has already been processed and the email_log update is
 * skipped. Mirrors `billing_events` (the Razorpay-side equivalent).
 *
 * Service-role only; no end-user RLS policy is needed.
 */
export const emailWebhookEvents = pgTable(
	"email_webhook_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		svixId: text("svix_id").notNull().unique(),
		eventType: varchar("event_type", { length: 80 }).notNull(),
		payload: jsonb("payload").notNull(),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [index("idx_email_webhook_events_type_created").on(t.eventType, t.createdAt)],
);

import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, smallint, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { profiles } from "./profiles";

// SaaS billing tables (see supabase/migrations/20260423000001_saas_billing.sql)

export const plans = pgTable("plans", {
	code: varchar("code", { length: 32 }).primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	interval: varchar("interval", { length: 16 }).notNull(),
	pricePaise: integer("price_paise").notNull().default(0),
	testsPerPeriod: integer("tests_per_period").notNull(),
	tokensGrade6to10: integer("tokens_grade_6_10").notNull(),
	tokensGrade11to12: integer("tokens_grade_11_12").notNull(),
	poolMultiplier: integer("pool_multiplier").notNull().default(1),
	razorpayPlanId: varchar("razorpay_plan_id", { length: 80 }),
	isActive: boolean("is_active").notNull().default(true),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable(
	"subscriptions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		profileId: uuid("profile_id")
			.notNull()
			.unique()
			.references(() => profiles.id, { onDelete: "cascade" }),
		planCode: varchar("plan_code", { length: 32 })
			.notNull()
			.references(() => plans.code),
		status: varchar("status", { length: 20 }).notNull(),
		trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
		currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull().defaultNow(),
		currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
		cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
		razorpaySubscriptionId: varchar("razorpay_subscription_id", { length: 80 }),
		razorpayCustomerId: varchar("razorpay_customer_id", { length: 80 }),
		pendingPlanCode: varchar("pending_plan_code", { length: 32 }).references(() => plans.code),
		staffOverride: boolean("staff_override").notNull().default(false),
		metadata: jsonb("metadata").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_subscriptions_status").on(t.status),
		index("idx_subscriptions_period_end").on(t.currentPeriodEnd),
	],
);

export const usagePeriods = pgTable(
	"usage_periods",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		subscriptionId: uuid("subscription_id")
			.notNull()
			.references(() => subscriptions.id, { onDelete: "cascade" }),
		profileId: uuid("profile_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
		periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
		testsQuota: integer("tests_quota").notNull(),
		testsUsed: integer("tests_used").notNull().default(0),
		tokensQuota: integer("tokens_quota").notNull(),
		tokensUsed: integer("tokens_used").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		unique("usage_periods_sub_start_unique").on(t.subscriptionId, t.periodStart),
		index("idx_usage_periods_profile_end").on(t.profileId, t.periodEnd),
		index("idx_usage_periods_subscription").on(t.subscriptionId, t.periodEnd),
	],
);

/** Dedupe ledger: one free trial per normalized email (Gmail rules) or phone; see migration `20260423110000_free_trial_once_per_identity.sql`. */
export const freeTrialClaims = pgTable(
	"free_trial_claims",
	{
		identityKey: text("identity_key").primaryKey(),
		firstProfileId: uuid("first_profile_id").notNull(),
		claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
		releasedAt: timestamp("released_at", { withTimezone: true }),
		releasedBy: text("released_by"),
		releasedReason: text("released_reason"),
	},
	(t) => [index("idx_free_trial_claims_profile").on(t.firstProfileId)],
);

/** Manual test/token grants consumed before subscription period quota (Phase 4). */
export const quotaGrants = pgTable(
	"quota_grants",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		studentId: uuid("student_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		grantType: varchar("grant_type", { length: 32 }).notNull(),
		quantity: integer("quantity").notNull(),
		consumed: integer("consumed").notNull().default(0),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		note: text("note"),
		createdBy: text("created_by"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_quota_grants_student_type").on(t.studentId, t.grantType),
		index("idx_quota_grants_expires").on(t.expiresAt),
	],
);

export const identityBlocklist = pgTable("identity_blocklist", {
	identityKey: text("identity_key").primaryKey(),
	reason: text("reason"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable(
	"payments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
		profileId: uuid("profile_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		razorpayPaymentId: varchar("razorpay_payment_id", { length: 80 }).unique(),
		razorpayInvoiceId: varchar("razorpay_invoice_id", { length: 80 }),
		razorpayOrderId: varchar("razorpay_order_id", { length: 80 }),
		amountPaise: integer("amount_paise").notNull(),
		currency: varchar("currency", { length: 8 }).notNull().default("INR"),
		status: varchar("status", { length: 20 }).notNull(),
		method: varchar("method", { length: 30 }),
		invoiceShortUrl: varchar("invoice_short_url", { length: 500 }),
		capturedAt: timestamp("captured_at", { withTimezone: true }),
		metadata: jsonb("metadata").notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		razorpayRefundId: varchar("razorpay_refund_id", { length: 80 }),
		refundAmountPaise: integer("refund_amount_paise"),
		refundedAt: timestamp("refunded_at", { withTimezone: true }),
	},
	(t) => [
		index("idx_payments_profile").on(t.profileId, t.createdAt),
		index("idx_payments_subscription").on(t.subscriptionId, t.createdAt),
	],
);

export const adminRefundIdempotency = pgTable("admin_refund_idempotency", {
	idempotencyKey: text("idempotency_key").primaryKey(),
	paymentId: uuid("payment_id")
		.notNull()
		.references(() => payments.id, { onDelete: "cascade" }),
	razorpayRefundId: varchar("razorpay_refund_id", { length: 80 }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coupons = pgTable(
	"coupons",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		code: varchar("code", { length: 40 }).notNull().unique(),
		description: text("description"),
		maxRedemptions: integer("max_redemptions").notNull(),
		redemptionsCount: integer("redemptions_count").notNull().default(0),
		durationDays: integer("duration_days").notNull().default(30),
		/** Entitlement coupons require a plan; checkout_discount may omit (use eligible_plan_codes + Razorpay offers). */
		grantsPlanCode: varchar("grants_plan_code", { length: 32 }).references(() => plans.code),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		isActive: boolean("is_active").notNull().default(true),
		createdBy: uuid("created_by"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		kind: varchar("kind", { length: 32 }).notNull().default("entitlement"),
		singleUseGlobally: boolean("single_use_globally").notNull().default(false),
		discountPercent: smallint("discount_percent"),
		eligiblePlanCodes: text("eligible_plan_codes").array(),
		razorpayOffersByPlan: jsonb("razorpay_offers_by_plan")
			.$type<Record<string, string>>()
			.notNull()
			.default(sql`'{}'::jsonb`),
	},
);

export const couponRedemptions = pgTable(
	"coupon_redemptions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		couponId: uuid("coupon_id")
			.notNull()
			.references(() => coupons.id, { onDelete: "cascade" }),
		profileId: uuid("profile_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
		redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [unique("coupon_redemptions_unique").on(t.couponId, t.profileId)],
);

export const billingEvents = pgTable(
	"billing_events",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		razorpayEventId: varchar("razorpay_event_id", { length: 120 }).unique(),
		eventType: varchar("event_type", { length: 80 }).notNull(),
		payload: jsonb("payload").notNull(),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		replayCount: integer("replay_count").notNull().default(0),
		lastReplayAt: timestamp("last_replay_at", { withTimezone: true }),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolvedBy: text("resolved_by"),
	},
	(t) => [index("idx_billing_events_type_created").on(t.eventType, t.createdAt)],
);

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { consumeNextQuotaTestGrant } from "@/lib/billing/quota-grant-consume";

const wantsIntegration = Boolean(process.env.DATABASE_URL && process.env.BILLING_INTEGRATION_VITEST === "1");

let integrationRun = false;
if (wantsIntegration) {
	try {
		const { db } = await import("@/db");
		const { quotaGrants } = await import("@/db/schema/billing");
		await db.select({ id: quotaGrants.id }).from(quotaGrants).limit(1);
		integrationRun = true;
	} catch {
		integrationRun = false;
	}
}

describe.skipIf(!integrationRun)("billing DB integration (BILLING_INTEGRATION_VITEST=1 + quota_grants migration)", () => {
	let db: typeof import("@/db").db;
	let profileId: string;
	let paymentId: string;
	let grantId: string;

	beforeAll(async () => {
		({ db } = await import("@/db"));
		const { profiles } = await import("@/db/schema/profiles");
		const p = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.role, "student")).limit(1);
		if (!p[0]) throw new Error("No student profile in DB; cannot run billing integration tests.");
		profileId = p[0].id;
	});

	afterAll(async () => {
		if (!integrationRun) return;
		const { payments, adminRefundIdempotency, quotaGrants } = await import("@/db/schema/billing");
		if (paymentId) {
			await db.delete(adminRefundIdempotency).where(eq(adminRefundIdempotency.paymentId, paymentId));
			await db.delete(payments).where(eq(payments.id, paymentId));
		}
		if (grantId) await db.delete(quotaGrants).where(eq(quotaGrants.id, grantId));
	});

	it("admin refund idempotency row: second insert with same key is no-op", async () => {
		const { payments } = await import("@/db/schema/billing");
		const { adminRefundIdempotency } = await import("@/db/schema/billing");

		paymentId = randomUUID();
		await db.insert(payments).values({
			id: paymentId,
			profileId,
			amountPaise: 100,
			status: "captured",
			razorpayPaymentId: `pay_int_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
		});

		const idemKey = `vitest-refund-${randomUUID()}`;
		const first = await db
			.insert(adminRefundIdempotency)
			.values({ idempotencyKey: idemKey, paymentId, razorpayRefundId: null })
			.onConflictDoNothing({ target: adminRefundIdempotency.idempotencyKey })
			.returning({ key: adminRefundIdempotency.idempotencyKey });
		const second = await db
			.insert(adminRefundIdempotency)
			.values({ idempotencyKey: idemKey, paymentId, razorpayRefundId: null })
			.onConflictDoNothing({ target: adminRefundIdempotency.idempotencyKey })
			.returning({ key: adminRefundIdempotency.idempotencyKey });

		expect(first.length).toBe(1);
		expect(second.length).toBe(0);
	});

	it("quota test grant consumption stops at quantity", async () => {
		const { quotaGrants } = await import("@/db/schema/billing");

		grantId = randomUUID();
		await db.insert(quotaGrants).values({
			id: grantId,
			studentId: profileId,
			grantType: "tests",
			quantity: 2,
			consumed: 0,
			expiresAt: null,
			note: "vitest billing-integration",
			createdBy: "vitest",
		});

		expect(await consumeNextQuotaTestGrant(profileId)).toBe(true);
		expect(await consumeNextQuotaTestGrant(profileId)).toBe(true);
		expect(await consumeNextQuotaTestGrant(profileId)).toBe(false);

		const rows = await db.select().from(quotaGrants).where(eq(quotaGrants.id, grantId)).limit(1);
		expect(rows[0]?.consumed).toBe(2);
	});
});

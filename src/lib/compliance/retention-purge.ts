import "server-only";

import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { assignmentSubmissions } from "@/db/schema/teaching";
import { auditLogs, emailLog, notifications } from "@/db/schema/comms-audit";
import { performanceTracker, questionFlags, tests } from "@/db/schema/assessment";
import { retentionPolicies } from "@/db/schema/retention-policies";

function cutoffDate(ttlDays: number): Date {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - ttlDays);
	return d;
}

export type RetentionPurgeResult = { entity: string; dry_run: boolean; deleted_or_would_delete: number };

/**
 * Applies one retention policy row. Skips `payments` / `coupon_redemptions` regardless of flags (billing law).
 */
export async function purgeRetentionEntity(entity: string, ttlDays: number, dryRun: boolean): Promise<number> {
	const cutoff = cutoffDate(ttlDays);
	let n = 0;

	switch (entity) {
		case "payments":
		case "coupon_redemptions":
			return 0;
		case "notifications": {
			if (dryRun) {
				const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(notifications).where(lt(notifications.createdAt, cutoff));
				n = Number(r?.c ?? 0);
			} else {
				const del = await db.delete(notifications).where(lt(notifications.createdAt, cutoff)).returning({ id: notifications.id });
				n = del.length;
			}
			break;
		}
		case "email_log": {
			if (dryRun) {
				const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(emailLog).where(lt(emailLog.createdAt, cutoff));
				n = Number(r?.c ?? 0);
			} else {
				const del = await db.delete(emailLog).where(lt(emailLog.createdAt, cutoff)).returning({ id: emailLog.id });
				n = del.length;
			}
			break;
		}
		case "audit_logs": {
			if (dryRun) {
				const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(auditLogs).where(lt(auditLogs.createdAt, cutoff));
				n = Number(r?.c ?? 0);
			} else {
				const del = await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff)).returning({ id: auditLogs.id });
				n = del.length;
			}
			break;
		}
		case "performance_tracker": {
			if (dryRun) {
				const [r] = await db
					.select({ c: sql<number>`count(*)::int` })
					.from(performanceTracker)
					.where(lt(performanceTracker.updatedAt, cutoff));
				n = Number(r?.c ?? 0);
			} else {
				const del = await db
					.delete(performanceTracker)
					.where(lt(performanceTracker.updatedAt, cutoff))
					.returning({ id: performanceTracker.id });
				n = del.length;
			}
			break;
		}
		case "question_flags": {
			if (dryRun) {
				const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(questionFlags).where(lt(questionFlags.createdAt, cutoff));
				n = Number(r?.c ?? 0);
			} else {
				const del = await db.delete(questionFlags).where(lt(questionFlags.createdAt, cutoff)).returning({ id: questionFlags.id });
				n = del.length;
			}
			break;
		}
		case "assignment_submissions": {
			if (dryRun) {
				const [r] = await db
					.select({ c: sql<number>`count(*)::int` })
					.from(assignmentSubmissions)
					.where(lt(assignmentSubmissions.updatedAt, cutoff));
				n = Number(r?.c ?? 0);
			} else {
				const del = await db
					.delete(assignmentSubmissions)
					.where(lt(assignmentSubmissions.updatedAt, cutoff))
					.returning({ id: assignmentSubmissions.id });
				n = del.length;
			}
			break;
		}
		case "tests": {
			const cond = and(lt(tests.createdAt, cutoff), inArray(tests.status, ["expired", "abandoned"]));
			if (dryRun) {
				const [r] = await db.select({ c: sql<number>`count(*)::int` }).from(tests).where(cond!);
				n = Number(r?.c ?? 0);
			} else {
				const del = await db.delete(tests).where(cond!).returning({ id: tests.id });
				n = del.length;
			}
			break;
		}
		default:
			return 0;
	}

	if (!dryRun && n > 0) {
		await db
			.update(retentionPolicies)
			.set({ lastPurge: new Date() })
			.where(eq(retentionPolicies.entity, entity));
	}

	return n;
}

export async function runAllEnabledRetentionPolicies(dryRun: boolean): Promise<RetentionPurgeResult[]> {
	const policies = await db.select().from(retentionPolicies).where(eq(retentionPolicies.enabled, true));
	const out: RetentionPurgeResult[] = [];
	for (const p of policies) {
		const deleted = await purgeRetentionEntity(p.entity, p.ttlDays, dryRun);
		out.push({ entity: p.entity, dry_run: dryRun, deleted_or_would_delete: deleted });
	}
	return out;
}

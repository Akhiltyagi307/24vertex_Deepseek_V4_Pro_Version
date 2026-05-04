import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { usageNotificationLog } from "@/db/schema/billing";
import { parentStudentLinks } from "@/db/schema/profiles";
import { findCurrentUsagePeriodId } from "@/lib/billing/usage-period";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import {
	sendParentPortalUsageThresholdEmail,
	sendUsageThresholdEmail,
} from "@/lib/email/notifications-emails";
import { loadProfileContact } from "@/lib/notifications/report-ready";
import { insertInAppNotification, markNotificationEmailSent } from "@/lib/notifications/insert";
import {
	getNotificationPrefs,
	isEmailAllowed,
	type NotificationPrefs,
} from "@/lib/notifications/prefs";
import type { NotificationCategory } from "@/lib/notifications/types";
import { logServerError } from "@/lib/server/log-supabase-error";

type Threshold = 80 | 100;

const THRESHOLDS: Threshold[] = [80, 100];

type MaybeNotifyBase = {
	profileId: string;
	/** When omitted, the helper resolves the latest (active) usage period for the profile. */
	usagePeriodId?: string;
};

type MaybeNotifyTests = MaybeNotifyBase & {
	meter: "tests";
	testsUsed: number;
	testsQuota: number;
};

type MaybeNotifyTokens = MaybeNotifyBase & {
	meter: "tokens";
	tokensUsed: number;
	tokensQuota: number;
};

export type MaybeNotifyUsageInput = MaybeNotifyTests | MaybeNotifyTokens;

/**
 * Emits 80% / 100% usage-threshold notifications when the meter crosses the
 * corresponding line in the current period. Dedup is enforced by the unique
 * constraint on `usage_notification_log`; concurrent callers race the INSERT
 * and only the winner writes the notification + email.
 *
 * Design notes:
 * - Alerts reflect the *subscription* meter in `usage_periods`. Manual grants
 *   consumed via `consumeNextQuotaTestGrant` do not move these counts, so
 *   they never trigger a usage alert. This matches product expectation that
 *   "plan usage" messages refer to the paid period's quota.
 * - Fire-and-forget: callers on the billing hot path pass through even when
 *   this helper fails.
 * - When the student wins the idempotency claim, the same threshold is also
 *   written for each **active linked parent** (in-app + optional email), scoped
 *   with `context_student_id` and parent-facing copy. Parent email respects
 *   `usage_alert` the same way as the student.
 */
export async function maybeNotifyUsageThreshold(input: MaybeNotifyUsageInput): Promise<void> {
	const used = input.meter === "tests" ? input.testsUsed : input.tokensUsed;
	const quota = input.meter === "tests" ? input.testsQuota : input.tokensQuota;
	if (quota <= 0 || used < 0) return;

	const pct = used / quota;
	const crossed: Threshold[] = THRESHOLDS.filter((t) => pct >= t / 100);
	if (crossed.length === 0) return;

	let periodId = input.usagePeriodId ?? null;
	if (!periodId) {
		periodId = await findCurrentUsagePeriodId(input.profileId);
		if (!periodId) return;
	}

	let prefs: NotificationPrefs | null = null;
	for (const threshold of crossed) {
		try {
			const claim = await db
				.insert(usageNotificationLog)
				.values({
					profileId: input.profileId,
					usagePeriodId: periodId,
					meter: input.meter,
					threshold,
				})
				.onConflictDoNothing({
					target: [
						usageNotificationLog.profileId,
						usageNotificationLog.usagePeriodId,
						usageNotificationLog.meter,
						usageNotificationLog.threshold,
					],
				})
				.returning({ id: usageNotificationLog.id });

			if (claim.length === 0) continue;

			if (!prefs) prefs = await getNotificationPrefs(input.profileId);

			const category: NotificationCategory =
				input.meter === "tests"
					? threshold === 80
						? "usage_tests_80"
						: "usage_tests_100"
					: threshold === 80
						? "usage_tokens_80"
						: "usage_tokens_100";

			const { title, body } = buildUsageCopy({ ...input, threshold });

			const studentNotificationId = await insertInAppNotification({
				recipientId: input.profileId,
				title,
				body,
				type: "alert",
				category,
				referenceType: "usage_period",
				referenceId: periodId,
				priority: threshold === 100 ? "urgent" : "normal",
				prefs,
			});

			if (isEmailAllowed(prefs, "usage_alert")) {
				const contact = await loadProfileContact(input.profileId);
				if (contact?.email) {
					const { error } = await sendUsageThresholdEmail({
						to: contact.email,
						recipientUserId: input.profileId,
						studentName: contact.fullName ?? undefined,
						meter: input.meter,
						threshold,
						testsUsed: input.meter === "tests" ? input.testsUsed : undefined,
						testsQuota: input.meter === "tests" ? input.testsQuota : undefined,
						tokensUsed: input.meter === "tokens" ? input.tokensUsed : undefined,
						tokensQuota: input.meter === "tokens" ? input.tokensQuota : undefined,
					});
					if (error) {
						logServerError("notifications.usage_threshold.email", new Error(error), {
							profileId: input.profileId,
							meter: input.meter,
							threshold,
						});
					} else if (studentNotificationId) {
						await markNotificationEmailSent(studentNotificationId);
					}
				}
			}

			await notifyLinkedParentsUsageThreshold({
				studentProfileId: input.profileId,
				usagePeriodId: periodId,
				input,
				threshold,
				category,
			});
		} catch (err) {
			logServerError("notifications.usage_threshold", err, {
				profileId: input.profileId,
				meter: input.meter,
				threshold,
				usagePeriodId: periodId ?? "",
			});
		}
	}
}

async function notifyLinkedParentsUsageThreshold(params: {
	studentProfileId: string;
	usagePeriodId: string;
	input: MaybeNotifyUsageInput;
	threshold: Threshold;
	category: NotificationCategory;
}): Promise<void> {
	const childContact = await loadProfileContact(params.studentProfileId);
	const childLabel = formatPersonDisplayName(childContact?.fullName ?? "") || "your child";

	const linkRows = await db
		.select({ parentId: parentStudentLinks.parentId })
		.from(parentStudentLinks)
		.where(
			and(
				eq(parentStudentLinks.studentId, params.studentProfileId),
				eq(parentStudentLinks.status, "active"),
			),
		);

	await Promise.allSettled(
		linkRows.map(async ({ parentId }) => {
			try {
				const parentPrefs = await getNotificationPrefs(parentId);
				const { title, body } = buildParentUsageCopy({
					childLabel,
					input: params.input,
					threshold: params.threshold,
				});

				const parentNotificationId = await insertInAppNotification({
					recipientId: parentId,
					title,
					body,
					type: "alert",
					category: params.category,
					referenceType: "usage_period",
					referenceId: params.usagePeriodId,
					contextStudentId: params.studentProfileId,
					priority: params.threshold === 100 ? "urgent" : "normal",
					prefs: parentPrefs,
				});

				if (!isEmailAllowed(parentPrefs, "usage_alert")) return;

				const parentContact = await loadProfileContact(parentId);
				if (!parentContact?.email) return;

				const parentDisplayName = formatPersonDisplayName(parentContact.fullName ?? "") || null;

				const { error } = await sendParentPortalUsageThresholdEmail({
					to: parentContact.email,
					recipientUserId: parentId,
					parentDisplayName,
					childDisplayName: childLabel,
					meter: params.input.meter,
					threshold: params.threshold,
					testsUsed: params.input.meter === "tests" ? params.input.testsUsed : undefined,
					testsQuota: params.input.meter === "tests" ? params.input.testsQuota : undefined,
					tokensUsed: params.input.meter === "tokens" ? params.input.tokensUsed : undefined,
					tokensQuota: params.input.meter === "tokens" ? params.input.tokensQuota : undefined,
				});
				if (error) {
					logServerError("notifications.usage_threshold.parent_email", new Error(error), {
						parentId,
						studentProfileId: params.studentProfileId,
						meter: params.input.meter,
						threshold: params.threshold,
					});
				} else if (parentNotificationId) {
					await markNotificationEmailSent(parentNotificationId);
				}
			} catch (err) {
				logServerError("notifications.usage_threshold.parent", err, {
					parentId,
					studentProfileId: params.studentProfileId,
					meter: params.input.meter,
					threshold: params.threshold,
				});
			}
		}),
	);
}

function buildParentUsageCopy(args: {
	childLabel: string;
	input: MaybeNotifyUsageInput;
	threshold: Threshold;
}): { title: string; body: string } {
	const inp = args.input;
	const isTests = inp.meter === "tests";
	const hundred = args.threshold === 100;
	const used = isTests ? inp.testsUsed : inp.tokensUsed;
	const quota = isTests ? inp.testsQuota : inp.tokensQuota;
	const label = isTests ? "practice tests" : "doubt-chat tokens";
	const title = hundred
		? `${args.childLabel}'s plan: 100% of ${label} used`
		: `${args.childLabel}'s plan: 80% of ${label} used`;
	const usageStat = isTests
		? `${used} of ${quota} tests used this period.`
		: `${used.toLocaleString()} of ${quota.toLocaleString()} tokens used this period.`;
	const nudge = hundred
		? "Review Plan & billing in the parent portal to upgrade or top up so their practice can continue."
		: "Consider reviewing their plan in the parent portal before they hit 100%.";
	return { title, body: `${usageStat} ${nudge}` };
}

function buildUsageCopy(input: MaybeNotifyUsageInput & { threshold: Threshold }): { title: string; body: string } {
	const isTests = input.meter === "tests";
	const hundred = input.threshold === 100;
	const used = isTests ? input.testsUsed : input.tokensUsed;
	const quota = isTests ? input.testsQuota : input.tokensQuota;
	const label = isTests ? "practice tests" : "doubt-chat tokens";
	const title = hundred
		? `You've used 100% of your ${label}`
		: `You've used 80% of your ${label}`;
	const usageStat = isTests
		? `${used} of ${quota} tests used this period.`
		: `${used.toLocaleString()} of ${quota.toLocaleString()} tokens used this period.`;
	const nudge = hundred
		? "Upgrade or top up to keep practicing without pausing."
		: "Consider upgrading soon so your practice doesn't pause at 100%.";
	return { title, body: `${usageStat} ${nudge}` };
}


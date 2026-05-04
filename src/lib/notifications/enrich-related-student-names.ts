import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema/profiles";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { logServerError } from "@/lib/server/log-supabase-error";
import type { NotificationListItem } from "@/lib/notifications/types";

/**
 * Fills `relatedStudentName` for list rows that reference a student (parent
 * portal or `reference_type = student`).
 */
export async function enrichNotificationsWithRelatedStudentNames(
	items: NotificationListItem[],
): Promise<NotificationListItem[]> {
	const ids = new Set<string>();
	for (const it of items) {
		if (it.contextStudentId) ids.add(it.contextStudentId);
		else if (it.referenceType === "student" && it.referenceId) ids.add(it.referenceId);
	}
	if (ids.size === 0) {
		return items.map((it) => ({ ...it, relatedStudentName: it.relatedStudentName ?? null }));
	}

	try {
		const idList = [...ids];
		const rows = await db
			.select({ id: profiles.id, fullName: profiles.fullName })
			.from(profiles)
			.where(inArray(profiles.id, idList));
		const map = new Map(
			rows.map((r) => [r.id, formatPersonDisplayName(r.fullName ?? "") || null] as const),
		);
		return items.map((it) => {
			const sid =
				it.contextStudentId ?? (it.referenceType === "student" ? it.referenceId : null);
			const relatedStudentName = sid ? map.get(sid) ?? null : null;
			return { ...it, relatedStudentName };
		});
	} catch (err) {
		logServerError("notifications.enrich_related_student", err, { count: ids.size });
		return items.map((it) => ({ ...it, relatedStudentName: it.relatedStudentName ?? null }));
	}
}

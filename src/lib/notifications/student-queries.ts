import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { enrichNotificationsWithRelatedStudentNames } from "@/lib/notifications/enrich-related-student-names";
import type { NotificationListItem } from "@/lib/notifications/types";

export type ListNotificationsInput = {
	userId: string;
	/** ISO timestamp to paginate by `created_at < cursor`. */
	cursor?: string | null;
	/** Max rows to return; clamped to [1, 50]. */
	limit?: number;
	filter?: "all" | "unread";
};

type NotificationRow = {
	id: string;
	title: string;
	body: string;
	type: NotificationListItem["type"];
	category: string | null;
	reference_type: string | null;
	reference_id: string | null;
	context_student_id: string | null;
	priority: "normal" | "urgent" | null;
	is_read: boolean | null;
	created_at: string;
};

/**
 * Lists notifications for the given recipient (student or parent). RLS must
 * allow `recipient_id = auth.uid()` for the caller.
 */
export async function listNotificationsForRecipient(
	supabase: SupabaseClient,
	input: ListNotificationsInput,
): Promise<{ items: NotificationListItem[]; nextCursor: string | null }> {
	const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
	let q = supabase
		.from("notifications")
		.select(
			"id, title, body, type, category, reference_type, reference_id, context_student_id, priority, is_read, created_at",
		)
		.eq("recipient_id", input.userId)
		.order("created_at", { ascending: false })
		.limit(limit + 1);

	if (input.filter === "unread") {
		q = q.eq("is_read", false);
	}
	if (input.cursor) {
		q = q.lt("created_at", input.cursor);
	}

	const { data, error } = await q;
	if (error) {
		// Caller can log; keep this query pure.
		throw error;
	}

	const rows = (data ?? []) as NotificationRow[];
	const hasMore = rows.length > limit;
	const sliced = hasMore ? rows.slice(0, limit) : rows;
	const items: NotificationListItem[] = sliced.map((r) => ({
		id: r.id,
		title: r.title,
		body: r.body,
		type: r.type,
		category: r.category,
		referenceType: r.reference_type,
		referenceId: r.reference_id,
		contextStudentId: r.context_student_id,
		priority: r.priority === "urgent" ? "urgent" : "normal",
		isRead: Boolean(r.is_read),
		createdAt: r.created_at,
	}));
	const enriched = await enrichNotificationsWithRelatedStudentNames(items);
	return {
		items: enriched,
		nextCursor: hasMore ? sliced[sliced.length - 1]?.created_at ?? null : null,
	};
}

/** @deprecated Use {@link listNotificationsForRecipient} */
export const listStudentNotifications = listNotificationsForRecipient;

export async function getStudentUnreadCount(
	supabase: SupabaseClient,
	userId: string,
): Promise<number> {
	const { count, error } = await supabase
		.from("notifications")
		.select("id", { count: "exact", head: true })
		.eq("recipient_id", userId)
		.eq("is_read", false);
	if (error) throw error;
	return count ?? 0;
}

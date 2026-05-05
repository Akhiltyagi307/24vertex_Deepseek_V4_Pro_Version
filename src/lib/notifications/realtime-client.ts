"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { NotificationListItem } from "@/lib/notifications/types";

type NotificationRowDb = {
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

export type NotificationsRealtimeScope = "bell" | "list" | "tray" | "nav";

/**
 * Subscribes to Supabase Realtime inserts on `notifications` filtered to the
 * recipient's own rows. Returns an unsubscribe cleanup. Callers should handle
 * transport errors by falling back to polling (see the bell component).
 *
 * **`scope` is required** so each UI surface gets its own channel name. If two
 * components reused `notifications:user:<id>`, Supabase would return the same
 * channel instance after the first had already called `subscribe()`, and the
 * second `.on()` would throw: "cannot add postgres_changes callbacks … after subscribe()".
 */
export function subscribeToMyNotifications(
	userId: string,
	onInsert: (row: NotificationListItem) => void,
	scope: NotificationsRealtimeScope,
): () => void {
	const supabase = createClient();
	const channel: RealtimeChannel = supabase
		.channel(`notifications:user:${userId}:${scope}`)
		.on(
			"postgres_changes",
			{
				event: "INSERT",
				schema: "public",
				table: "notifications",
				filter: `recipient_id=eq.${userId}`,
			},
			(payload) => {
				const row = payload.new as NotificationRowDb;
				onInsert({
					id: row.id,
					title: row.title,
					body: row.body,
					type: row.type,
					category: row.category,
					referenceType: row.reference_type,
					referenceId: row.reference_id,
					contextStudentId: row.context_student_id ?? null,
					priority: (row.priority ?? "normal") === "urgent" ? "urgent" : "normal",
					isRead: Boolean(row.is_read),
					createdAt: row.created_at,
				});
			},
		)
		.subscribe();

	return () => {
		// fire-and-forget: best-effort realtime cleanup on unmount
		void supabase.removeChannel(channel);
	};
}

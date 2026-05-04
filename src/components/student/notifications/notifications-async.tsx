import { NotificationsList } from "@/components/student/notifications/notifications-list";
import {
	getStudentUnreadCount,
	listStudentNotifications,
} from "@/lib/notifications/student-queries";
import type { NotificationListItem } from "@/lib/notifications/types";
import { logSupabaseError } from "@/lib/server/log-supabase-error";
import { createClient } from "@/lib/supabase/server";

type InitialPayload = {
	items: NotificationListItem[];
	nextCursor: string | null;
	unreadCount: number;
};

async function loadInitialPayload(
	userId: string,
	apiBasePath: string,
): Promise<InitialPayload> {
	const supabase = await createClient();
	try {
		const [page, unreadCount] = await Promise.all([
			listStudentNotifications(supabase, { userId, limit: 20 }),
			getStudentUnreadCount(supabase, userId),
		]);
		return { items: page.items, nextCursor: page.nextCursor, unreadCount };
	} catch (err) {
		logSupabaseError("notifications.async", err as { message?: string }, { userId, apiBasePath });
		return { items: [], nextCursor: null, unreadCount: 0 };
	}
}

export type NotificationsAsyncProps = {
	userId: string;
	apiBasePath?: string;
	portal?: "student" | "parent";
};

/** Streamed data loader for `/student/notifications` or `/parent/notifications`. */
export async function NotificationsAsync({
	userId,
	apiBasePath = "/api/student/notifications",
	portal = "student",
}: NotificationsAsyncProps) {
	const initial = await loadInitialPayload(userId, apiBasePath);
	return (
		<NotificationsList
			userId={userId}
			apiBasePath={apiBasePath}
			portal={portal}
			initialItems={initial.items}
			initialNextCursor={initial.nextCursor}
			initialUnreadCount={initial.unreadCount}
		/>
	);
}

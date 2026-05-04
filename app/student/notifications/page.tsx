import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NotificationsAsync } from "@/components/student/notifications/notifications-async";
import { NotificationsSkeleton } from "@/components/student/notifications/notifications-skeleton";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notifications" };

export default async function StudentNotificationsPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") {
		redirect("/login");
	}

	return (
		<section className="flex flex-col gap-5 py-6">
			<header className="flex flex-col gap-1">
				<h1 className="font-heading text-xl font-semibold text-foreground">Notifications</h1>
				<p className="text-sm text-muted-foreground">
					Report updates, plan alerts, and announcements from EduAI.
				</p>
			</header>
			<Suspense fallback={<NotificationsSkeleton />}>
				<NotificationsAsync userId={user.id} />
			</Suspense>
		</section>
	);
}

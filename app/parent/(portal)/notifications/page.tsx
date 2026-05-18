import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NotificationsAsync } from "@/components/student/notifications/notifications-async";
import { NotificationsSkeleton } from "@/components/student/notifications/notifications-skeleton";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Notifications · Parent",
	description: "Updates for your linked students — each card shows which child it refers to.",
	robots: { index: false, follow: false },
};

export default async function ParentNotificationsPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "parent") {
		redirect("/login");
	}

	return (
		<section className="flex flex-col gap-5 py-6">
			<header className="flex flex-col gap-1">
				<h1 className="font-heading text-xl font-semibold text-foreground">Notifications</h1>
				<p className="text-sm text-muted-foreground">
					Updates for your linked students — each card shows which child it refers to.
				</p>
			</header>
			<Suspense fallback={<NotificationsSkeleton />}>
				<NotificationsAsync userId={user.id} apiBasePath="/api/parent/notifications" portal="parent" />
			</Suspense>
		</section>
	);
}

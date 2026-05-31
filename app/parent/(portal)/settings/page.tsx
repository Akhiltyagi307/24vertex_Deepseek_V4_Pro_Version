import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { getNotificationPrefs } from "@/lib/notifications/prefs";
import { loadLinkedChildrenForParent } from "@/lib/parent/linked-children";
import { studentHubPageShellClassName } from "@/lib/student/student-hub-page-layout";
import { cn } from "@/lib/utils";

import { ParentAccountSettingsForm } from "./parent-account-settings-form";
import { updateParentNotificationPreferences } from "./notification-preferences-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Account · Parent",
	description: "Manage your parent profile, password, notifications, and linked students.",
	robots: { index: false, follow: false },
};

export default async function ParentSettingsPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "parent") redirect("/login");

	const [linkedStudentsRows, prefs] = await Promise.all([
		loadLinkedChildrenForParent(user.id),
		getNotificationPrefs(user.id),
	]);

	const initialNotificationPrefs = {
		enableInApp: prefs.enableInApp,
		enableEmail: prefs.enableEmail,
		types: {
			test_result: prefs.types.test_result !== false,
			usage_alert: prefs.types.usage_alert !== false,
			announcement: prefs.types.announcement !== false,
			reminder: prefs.types.reminder !== false,
		},
	};

	return (
		<div
			className={cn(
				"flex min-w-0 flex-col gap-6 py-6 medium:py-8",
				studentHubPageShellClassName,
			)}
		>
			<PageStaggerRoot
				enableLift={false}
				className="min-w-0"
				sections={[
					{
						key: "account",
						content: (
							<ParentAccountSettingsForm
								userId={user.id}
								loginEmail={user.email ?? ""}
								profile={{
									id: row.id,
									full_name: row.full_name,
									avatar_url: row.avatar_url,
									phone: row.phone,
								}}
								initialNotificationPrefs={initialNotificationPrefs}
								saveNotificationPreferences={updateParentNotificationPreferences}
								linkedStudents={linkedStudentsRows.map((c) => ({
									id: c.id,
									displayName: formatPersonDisplayName(c.full_name ?? "") || "Your student",
								}))}
							/>
						),
					},
				]}
			/>
		</div>
	);
}

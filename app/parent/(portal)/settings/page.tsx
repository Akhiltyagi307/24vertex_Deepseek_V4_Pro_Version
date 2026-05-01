import { redirect } from "next/navigation";

import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { formatPersonDisplayName } from "@/lib/format/person-display-name";
import { loadLinkedChildrenForParent } from "@/lib/parent/linked-children";
import { studentHubPageShellClassName } from "@/lib/student/student-hub-page-layout";
import { cn } from "@/lib/utils";

import { ParentAccountSettingsClient } from "./parent-account-settings-client";

export const dynamic = "force-dynamic";

export default async function ParentSettingsPage() {
	const user = await getServerUser();
	if (!user) redirect("/login");
	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "parent") redirect("/login");

	const linkedStudentsRows = await loadLinkedChildrenForParent(user.id);
	const displayName = formatPersonDisplayName(row.full_name ?? "") || "Parent";

	return (
		<div
			className={cn(
				"flex min-w-0 flex-col gap-6 py-6 sm:py-8",
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
							<ParentAccountSettingsClient
								signedInAs={displayName}
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

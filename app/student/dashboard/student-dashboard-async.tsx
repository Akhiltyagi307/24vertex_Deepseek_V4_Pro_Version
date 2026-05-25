import { Suspense } from "react";

import { StudentDashboardView } from "@/components/student/student-dashboard-view";
import type {
	LoadStudentDashboardOptions,
	StudentDashboardProfileRow,
} from "@/lib/student/load-student-dashboard";
import { loadStudentDashboardCorePayloadCached } from "@/lib/student/student-dashboard-cache";
import { StudentDashboardLeaderboardAsync } from "./student-dashboard-leaderboard-async";
import { StudentDashboardLeaderboardSkeleton } from "./student-dashboard-leaderboard-skeleton";

export async function StudentDashboardAsync({
	userId,
	profileRow,
	loadOpts,
	viewVariant = "student",
}: {
	userId: string;
	profileRow: StudentDashboardProfileRow;
	loadOpts?: LoadStudentDashboardOptions;
	viewVariant?: "student" | "parent";
}) {
	const core = await loadStudentDashboardCorePayloadCached(userId, profileRow, {
		...loadOpts,
		viewerRole: viewVariant,
	});

	return (
		<StudentDashboardView
			{...core}
			variant={viewVariant}
			leaderboardContent={
				<Suspense fallback={<StudentDashboardLeaderboardSkeleton />}>
					<StudentDashboardLeaderboardAsync
						studentId={userId}
						organizationId={profileRow.organization_id}
						enrolledSubjects={core.enrolledSubjects}
						variant={viewVariant}
					/>
				</Suspense>
			}
		/>
	);
}

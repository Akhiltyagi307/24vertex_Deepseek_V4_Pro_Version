import { Suspense } from "react";

import { StudentDashboardView } from "@/components/student/student-dashboard-view";
import { firstNameFromFullName } from "@/lib/student/dashboard-greeting";
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

	// First-run welcome copy (student variant only). Grade is shown without the
	// section suffix so the line reads naturally ("You're all set for Grade 9.").
	const isStudent = viewVariant === "student";
	const resolvedFirstName = firstNameFromFullName(profileRow.full_name);
	// `firstNameFromFullName` returns the "there" sentinel when no name is set;
	// treat that as absent so the welcome dialog uses its neutral greeting.
	const onboardingFirstName =
		isStudent && resolvedFirstName !== "there" ? resolvedFirstName : null;
	const onboardingGradeLabel =
		isStudent && profileRow.grade != null ? `Grade ${profileRow.grade}` : null;

	return (
		<StudentDashboardView
			{...core}
			variant={viewVariant}
			onboardingFirstName={onboardingFirstName}
			onboardingGradeLabel={onboardingGradeLabel}
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

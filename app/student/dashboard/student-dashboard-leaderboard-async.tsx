import { StudentDashboardLeaderboardCard } from "@/components/student/student-dashboard-leaderboard-card";
import { loadStudentDashboardLeaderboardOnly } from "@/lib/student/load-student-dashboard";

export async function StudentDashboardLeaderboardAsync({
	studentId,
	organizationId,
	enrolledSubjects,
	variant = "student",
}: {
	studentId: string;
	organizationId: string | null;
	enrolledSubjects: { id: string; name: string }[];
	variant?: "student" | "parent";
}) {
	const leaderboard = await loadStudentDashboardLeaderboardOnly({
		studentId,
		organizationId,
		enrolledSubjects,
	});
	return <StudentDashboardLeaderboardCard leaderboard={leaderboard} variant={variant} />;
}

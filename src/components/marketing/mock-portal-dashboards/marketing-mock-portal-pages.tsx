"use client";

import { ParentShell } from "@/components/parent/parent-shell";
import { StudentShell } from "@/components/student/student-shell";
import { StudentDashboardView } from "@/components/student/student-dashboard-view";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import {
	buildMockStudentDashboardPayload,
	MOCK_PARENT,
	MOCK_SCHOOL,
	MOCK_STUDENT,
	MOCK_TEACHER,
} from "@/lib/marketing/mock-portal-dashboard-data";

import { MarketingMockTeacherDashboard } from "./marketing-mock-teacher-dashboard";

const studentPayload = buildMockStudentDashboardPayload();

export function MarketingMockStudentPortalPage() {
	return (
		<StudentShell
			organizationName={MOCK_SCHOOL}
			userDisplayName={MOCK_STUDENT.fullName}
			shareableId={MOCK_STUDENT.linkCode}
			email={MOCK_STUDENT.email}
			avatarUrl={null}
			gradeLabel={MOCK_STUDENT.gradeLabel}
			entitlement={null}
		>
			<StudentDashboardView {...studentPayload} variant="student" />
		</StudentShell>
	);
}

export function MarketingMockParentPortalPage() {
	return (
		<ParentShell
			organizationName={MOCK_SCHOOL}
			childDisplayName={MOCK_STUDENT.fullName}
			childLinkCode={MOCK_STUDENT.linkCode}
			parentUserId="mock-parent-user"
			parentDisplayName={MOCK_PARENT.fullName}
			parentEmail={MOCK_PARENT.email}
			parentAvatarUrl={null}
			childGradeLabel={MOCK_STUDENT.gradeLabel}
			entitlement={null}
		>
			<StudentDashboardView
				{...studentPayload}
				headerGreeting="Aanya is on a 12-day streak with strong scores in Biology and English. Physics and a few Chemistry topics still need a focused pass."
				variant="parent"
			/>
		</ParentShell>
	);
}

export function MarketingMockTeacherPortalPage() {
	return (
		<TeacherShell
			organizationName={MOCK_SCHOOL}
			userDisplayName={MOCK_TEACHER.fullName}
			contextLabel={MOCK_TEACHER.contextLabel}
			email={MOCK_TEACHER.email}
			avatarUrl={null}
		>
			<MarketingMockTeacherDashboard />
		</TeacherShell>
	);
}

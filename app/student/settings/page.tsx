import { redirect } from "next/navigation";

import { NotificationPreferencesForm } from "./notification-preferences-form";
import { PageStaggerRoot } from "@/components/motion/page-stagger-root";
import {
	StudentProfileSettingsForm,
	type ResolvedSubjectForSettings,
	type StudentProfileSettingsRow,
} from "./student-profile-settings-form";
import type { AppProfileRow } from "@/lib/auth/cached-profile";
import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getNotificationPrefs } from "@/lib/notifications/prefs";
import { loadStudentSubjects } from "@/lib/student/load-student-subjects";
import { studentHubPageShellClassName } from "@/lib/student/student-hub-page-layout";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function appProfileToSettingsRow(row: AppProfileRow): StudentProfileSettingsRow {
	return {
		id: row.id,
		student_link_code: row.student_link_code,
		full_name: row.full_name,
		grade: row.grade,
		section: row.section,
		stream: row.stream,
		elective_subject_id: row.elective_subject_id,
		school_name: row.school_name,
		parent_name: row.parent_name,
		parent_email: row.parent_email,
		avatar_url: row.avatar_url,
		phone: row.phone,
		is_verified: row.is_verified,
		created_at: row.created_at ?? "1970-01-01T00:00:00.000Z",
	};
}

export default async function StudentSettingsPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const supabase = await createClient();

	const row = await getCachedAppProfileRow();
	if (!row || row.role !== "student") {
		redirect("/login");
	}
	const profile = appProfileToSettingsRow(row);

	let electiveSubjectName: string | null = null;
	if (profile.elective_subject_id) {
		const { data: sub } = await supabase
			.from("subjects")
			.select("name")
			.eq("id", profile.elective_subject_id)
			.maybeSingle();
		electiveSubjectName = sub?.name ?? null;
	}

	const subjectResult = await loadStudentSubjects(supabase, profile);
	const resolvedSubjects: ResolvedSubjectForSettings[] = subjectResult.subjects
		.map((row: { id: string; name: string }) => ({ id: row.id, name: row.name }))
		.filter((s: ResolvedSubjectForSettings) => Boolean(s.id && s.name));

	const prefs = await getNotificationPrefs(user.id);
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
						key: "settings",
						content: (
							<StudentProfileSettingsForm
								userId={user.id}
								loginEmail={user.email ?? ""}
								profile={profile}
								electiveSubjectName={electiveSubjectName}
								resolvedSubjects={resolvedSubjects}
								subjectsLoadError={subjectResult.loadError}
							/>
						),
					},
					{
						key: "notification-preferences",
						content: <NotificationPreferencesForm initial={initialNotificationPrefs} />,
					},
				]}
			/>
		</div>
	);
}

import Link from "next/link";
import type { Metadata } from "next";

import { TeacherIndependentStudentsPanel } from "./independent-students-panel";
import { subjects } from "@/db/schema/academic";
import { db } from "@/db";
import { SensitiveLinkCode } from "@/components/teacher/sensitive-link-code";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import { getActiveTeacherOrganizationSnapshot, listActiveTeacherLinkedStudentProfiles } from "@/lib/organizations/queries";
import { listOrganizationStudentsForTeachingRoster } from "@/lib/teachers/roster-queries";
import { eq } from "drizzle-orm";

// Authenticated teacher rosters are organization/link-code scoped and should not be statically cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Linked students",
	robots: { index: false, follow: false },
};

export default async function TeacherStudentsPage() {
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user, profile } = session;

	const activeOrgSnapshot = await getActiveTeacherOrganizationSnapshot(user.id);

	if (!activeOrgSnapshot) {
		const linkedRows = await listActiveTeacherLinkedStudentProfiles(user.id);
		return (
			<div className="mx-auto w-full max-w-3xl space-y-6 py-6">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Link Student</h1>
					<p className="text-sm text-muted-foreground">
						Add or remove learners with their six-character link codes while you&apos;re not connected to an organization.
					</p>
				</div>
				<TeacherIndependentStudentsPanel linkedStudents={linkedRows} />
			</div>
		);
	}

	const activeOrganization = activeOrgSnapshot;

	const grade = profile.teacher_roster_grade;
	const subjectId = profile.teacher_roster_subject_id;

	if (grade == null || subjectId == null) {
		return (
			<div className="mx-auto w-full max-w-3xl space-y-6 py-6">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight">Link Student</h1>
					<p className="text-sm text-muted-foreground">
						Set grade and subject in Account settings to show learners from{" "}
						<span className="text-foreground">{activeOrganization.name}</span> here.
					</p>
				</div>
				<div className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-10 text-center text-sm text-muted-foreground">
					<p className="font-medium text-foreground">Choose teaching filters first</p>
					<p className="mt-2">
						Open{" "}
						<Link href="/teacher/settings" className="underline underline-offset-4">
							Account settings
						</Link>{" "}
						and save a grade and subject for{" "}
						<span className="text-foreground">{activeOrganization.name}</span>.
					</p>
				</div>
			</div>
		);
	}

	const [subjectRow] = await db
		.select({ name: subjects.name })
		.from(subjects)
		.where(eq(subjects.id, subjectId))
		.limit(1);

	const roster = await listOrganizationStudentsForTeachingRoster({
		organizationId: activeOrganization.id,
		grade,
		subjectId,
	});

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6 py-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Link Student</h1>
				<p className="text-sm text-muted-foreground">
					Your roster · <span className="text-foreground">{activeOrganization.name}</span> · Grade {grade}
					{subjectRow?.name ? (
						<>
							{" "}
							taking <span className="text-foreground">{subjectRow.name}</span>
						</>
					) : null}
					.
				</p>
			</div>

			{roster.length === 0 ? (
				<div className="rounded-xl border border-border/80 bg-muted/15 px-6 py-12 text-center text-sm text-muted-foreground">
					No students match these filters yet. Try another grade or subject in account settings, or confirm students are
					linked to your organization with the right placement.
				</div>
			) : (
				<div className="overflow-hidden rounded-xl border border-border/80 shadow-sm">
					<div className="border-b border-border bg-muted/40 px-4 py-2">
						<div className="grid grid-cols-[1fr_auto_auto] gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
							<span>Name</span>
							<span className="hidden sm:block">Section</span>
							<span className="text-right sm:text-left">Link code</span>
						</div>
						<p className="mt-1 text-[11px] text-muted-foreground">
							Codes are sensitive. Reveal them only when you need to copy or share one.
						</p>
					</div>
					<ul>
						{roster.map((row) => (
							<li
								key={row.id}
								className="grid grid-cols-1 gap-1 border-b border-border/80 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3"
							>
								<span className="font-medium">{row.fullName}</span>
								<span className="text-muted-foreground sm:text-left">{row.section?.trim() || "—"}</span>
								<span className="sm:text-left">
									<SensitiveLinkCode code={row.studentLinkCode} />
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

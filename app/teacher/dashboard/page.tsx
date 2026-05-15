import Link from "next/link";
import { redirect } from "next/navigation";

import { getProfile } from "@/lib/auth/routing";
import {
	getActiveTeacherOrganizationSnapshot,
	listActiveTeacherLinkedStudentProfiles,
} from "@/lib/organizations/queries";

export default async function TeacherDashboardPage() {
	const profile = await getProfile();
	if (!profile?.is_verified) {
		redirect("/teacher/pending");
	}

	const activeOrganization = await getActiveTeacherOrganizationSnapshot(profile.id);
	const linkCodeStudents = activeOrganization
		? []
		: await listActiveTeacherLinkedStudentProfiles(profile.id);

	return (
		<div className="w-full min-w-0 space-y-8 py-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Teacher dashboard</h1>
				<p className="text-sm text-muted-foreground">
					{activeOrganization ? (
						<>
							Your roster appears under <span className="text-foreground">Link Student</span> once grade and subject are
							saved in Account settings. Open <span className="text-foreground">Student performance</span> to browse
							learners and topic mastery (same view families see).
						</>
					) : (
						<>
							Use Account settings to join an institution, or open <span className="text-foreground">Link Student</span>{" "}
							(or the Linked students tab there) to see learners connected with a link code.{" "}
							<span className="text-foreground">Student performance</span> lists linked learners for analytics.
						</>
					)}
				</p>
			</div>

			<div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-8 py-16 text-center">
				<p className="text-sm font-medium text-foreground">
					{activeOrganization
						? "Configure your roster filters"
						: linkCodeStudents.length > 0
							? `${linkCodeStudents.length} linked student${linkCodeStudents.length === 1 ? "" : "s"}`
							: "No linked students yet"}
				</p>
				<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
					{activeOrganization ? (
						<>
							In Account settings, choose the grade and subject you teach at{" "}
							<span className="text-foreground">{activeOrganization.name}</span>, then open Link Student to view learners.
						</>
					) : linkCodeStudents.length > 0 ? (
						<>
							Names below match your active link-code connections. Open{" "}
							<Link href="/teacher/students" className="text-foreground underline underline-offset-4">
								Link Student
							</Link>{" "}
							to add or remove access.
						</>
					) : (
						<>
							From Link Student, add learners with their six-character link codes — available only while you&apos;re not
							connected to an organization.
						</>
					)}
				</p>
				{!activeOrganization && linkCodeStudents.length > 0 ? (
					<ul className="mx-auto mt-6 max-w-md divide-y divide-border rounded-lg border border-border/80 text-left text-sm">
						{linkCodeStudents.map((s) => (
							<li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5">
								<span className="font-medium">{s.fullName}</span>
								<span className="font-mono text-muted-foreground text-xs tabular-nums">
									{s.studentLinkCode ?? "—"}
								</span>
							</li>
						))}
					</ul>
				) : null}
			</div>

			<p className="text-sm">
				<Link href="/teacher/students" className="underline underline-offset-4">
					Open Link Student
				</Link>
				{" · "}
				<Link href="/teacher/student-performance" className="underline underline-offset-4">
					Student performance
				</Link>
				{" · "}
				<Link href="/teacher/settings" className="underline underline-offset-4">
					Account settings
				</Link>
			</p>
		</div>
	);
}

import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { requireAdmin } from "@/lib/admin/guards";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { db } from "@/db";
import { assignments } from "@/db/schema/teaching";
import { desc } from "drizzle-orm";

export const metadata = {
	title: "Admin assignments · EduAI",
	robots: { index: false, follow: false },
};

export default async function AdminAssignmentsPage() {
	await requireAdmin();
	const rows = await db.select().from(assignments).orderBy(desc(assignments.updatedAt)).limit(50);

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Assessments", href: "/admin/assessments/tests" },
					{ label: "Assignments" },
				]}
				title="Assignments"
				description="Teacher assignments — admin edit and lifecycle."
			/>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.assessmentsAssignments}
					filenameBase="assignments"
					headers={["id", "title", "status", "due_date", "teacher_id", "subject_id"]}
					rows={rows.map((a) => ({
						id: a.id,
						title: a.title,
						status: a.status ?? "",
						due_date: a.dueDate ? new Date(a.dueDate).toISOString() : "",
						teacher_id: a.teacherId,
						subject_id: a.subjectId,
					}))}
				/>
			</Suspense>
			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[640px] text-left text-sm">
					<thead className="border-b border-border bg-muted/40">
						<tr>
							<th className="px-2 py-1.5">Title</th>
							<th className="px-2 py-1.5">Status</th>
							<th className="px-2 py-1.5">Due</th>
							<th className="px-2 py-1.5">Open</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((a) => (
							<tr key={a.id} className="border-b border-border/70">
								<td className="px-2 py-1.5">{a.title}</td>
								<td className="px-2 py-1.5">{a.status}</td>
								<td className="px-2 py-1.5 font-mono text-xs">{a.dueDate ? new Date(a.dueDate).toISOString() : "—"}</td>
								<td className="px-2 py-1.5">
									<Link href={`/admin/assessments/assignments/${a.id}`} className="text-primary underline-offset-2 hover:underline">
										Detail
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

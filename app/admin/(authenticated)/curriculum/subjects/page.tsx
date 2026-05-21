import { asc } from "drizzle-orm";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminSubjectsReorderTable } from "@/components/admin/curriculum/admin-subjects-reorder-table";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { subjects } from "@/db/schema/academic";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

export const metadata = {
	title: "Subjects · 24Vertex Admin",
	robots: { index: false, follow: false },
};


export default async function AdminSubjectsPage() {
	const rows = await db.select().from(subjects).orderBy(asc(subjects.grade), asc(subjects.sortOrder), asc(subjects.name));

	const byGrade = new Map<number, typeof rows>();
	for (const r of rows) {
		const g = r.grade;
		const list = byGrade.get(g) ?? [];
		list.push(r);
		byGrade.set(g, list);
	}
	const grades = [...byGrade.keys()].sort((a, b) => a - b);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Curriculum", href: "/admin/curriculum/subjects" },
					{ label: "Subjects" },
				]}
				title="Subjects"
				description="Grouped by grade. Edit a subject to change stream/elective rules (11–12 only)."
			/>
			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.curriculumSubjects}
					filenameBase="curriculum-subjects"
					headers={["id", "name", "grade", "stream", "is_elective", "is_active", "sort_order"]}
					rows={rows.map((s) => ({
						id: s.id,
						name: s.name,
						grade: s.grade,
						stream: s.stream ?? "",
						is_elective: s.isElective ?? false,
						is_active: s.isActive ?? true,
						sort_order: s.sortOrder ?? "",
					}))}
				/>
			</Suspense>
			<div className="space-y-6">
				{grades.map((g) => (
					<section key={g}>
						<h2 className="mb-2 text-sm font-semibold text-muted-foreground">Grade {g}</h2>
						<AdminSubjectsReorderTable
							grade={g}
							initialSubjects={(byGrade.get(g) ?? []).map((s) => ({
								id: s.id,
								name: s.name,
								stream: s.stream,
								isElective: s.isElective ?? false,
								isActive: s.isActive ?? true,
							}))}
						/>
					</section>
				))}
			</div>
		</div>
	);
}

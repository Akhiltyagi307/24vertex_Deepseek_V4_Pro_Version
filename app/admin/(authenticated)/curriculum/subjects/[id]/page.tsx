import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminSubjectForm } from "@/components/admin/curriculum/subject-form";
import { db } from "@/db";
import { subjects } from "@/db/schema/academic";

export default async function AdminSubjectEditPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const rows = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
	const s = rows[0];
	if (!s) notFound();

	return (
		<div className="mx-auto max-w-lg space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Subjects", href: "/admin/curriculum/subjects" },
					{ label: s.name },
				]}
				title={s.name}
			/>
			<AdminSubjectForm subject={s} />
			<p className="text-center text-sm text-muted-foreground">
				<Link href="/admin/curriculum/subjects" className="hover:underline">
					← Back to subjects
				</Link>
			</p>
		</div>
	);
}

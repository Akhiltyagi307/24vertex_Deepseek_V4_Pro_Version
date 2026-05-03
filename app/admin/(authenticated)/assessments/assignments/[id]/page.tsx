import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAssignmentActions } from "@/components/admin/assessments/admin-assignment-actions";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { requireAdmin } from "@/lib/admin/guards";
import { db } from "@/db";
import { assignments } from "@/db/schema/teaching";
import { eq } from "drizzle-orm";

export const metadata = {
	title: "Admin assignment · EduAI",
	robots: { index: false, follow: false },
};

export default async function AdminAssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
	await requireAdmin();
	const { id } = await params;
	const rows = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
	const row = rows[0];
	if (!row) notFound();

	return (
		<div className="space-y-4">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Assignments", href: "/admin/assessments/assignments" },
					{ label: "Detail" },
				]}
				title={row.title}
				description={`Assignment ${id}`}
			/>
			<AdminAssignmentActions assignmentId={id} />
			<pre className="max-h-[480px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{JSON.stringify(row, null, 2)}</pre>
			<Link href="/admin/assessments/assignments" className="text-sm text-primary underline-offset-2 hover:underline">
				← Back
			</Link>
		</div>
	);
}

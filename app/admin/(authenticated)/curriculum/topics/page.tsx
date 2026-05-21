import { Suspense } from "react";
import { asc } from "drizzle-orm";

import { AdminTopicsBrowser } from "@/components/admin/curriculum/admin-topics-browser";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { subjects } from "@/db/schema/academic";

export const metadata = {
	title: "Admin topics · 24Vertex",
	robots: { index: false, follow: false },
};

export default async function AdminTopicsPage() {
	const subRows = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).orderBy(asc(subjects.grade), asc(subjects.sortOrder), asc(subjects.name));

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Curriculum", href: "/admin/curriculum/subjects" },
					{ label: "Topics" },
				]}
				title="Topics"
				description="Virtualized list with cursor pagination. Select a subject, then load more pages as needed."
			/>
			<Suspense fallback={<p className="text-sm text-muted-foreground">Loading topic browser…</p>}>
				<AdminTopicsBrowser subjects={subRows} />
			</Suspense>
		</div>
	);
}

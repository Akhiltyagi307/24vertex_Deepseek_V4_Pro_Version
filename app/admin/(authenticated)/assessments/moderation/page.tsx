import { desc } from "drizzle-orm";

import { AdminModerationQueue } from "@/components/admin/moderation/admin-moderation-queue";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { moderationFlags } from "@/db/schema/moderation-flags";

export const metadata = {
	title: "Moderation · 24Vertex Admin",
	robots: { index: false, follow: false },
};

export default async function AdminModerationPage() {
	const rows = await db.select().from(moderationFlags).orderBy(desc(moderationFlags.createdAt)).limit(150);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Assessments", href: "/admin/assessments/tests" },
					{ label: "Moderation" },
				]}
				title="Moderation queue"
				description="User reports and heuristic flags. Resolve from this page or manage blacklist via API."
			/>
			<AdminModerationQueue
				flags={rows.map((r) => ({
					id: r.id,
					entityType: r.entityType,
					entityId: r.entityId,
					source: r.source,
					severity: r.severity,
					status: r.status,
					reason: r.reason,
					createdAt: r.createdAt?.toISOString() ?? "",
				}))}
			/>
		</div>
	);
}

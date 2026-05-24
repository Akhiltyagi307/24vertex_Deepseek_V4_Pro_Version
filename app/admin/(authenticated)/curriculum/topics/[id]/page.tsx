import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { AdminContextChunksEditor } from "@/components/admin/curriculum/admin-context-chunks-editor";
import { AdminTopicEditForm } from "@/components/admin/curriculum/admin-topic-edit-form";
import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { db } from "@/db";
import { topics } from "@/db/schema/academic";

export const metadata = {
	title: "Admin topic · 24Vertex",
	robots: { index: false, follow: false },
};

export default async function AdminTopicDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const rows = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
	const t = rows[0];
	if (!t) notFound();

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Curriculum", href: "/admin/curriculum/subjects" },
					{ label: "Topics", href: "/admin/curriculum/topics" },
					{ label: t.topicName },
				]}
				title={t.topicName}
				description={`Grade ${t.grade} · Unit ${t.unitNumber} · Chapter ${t.chapterNumber}`}
			/>
			<AdminTopicEditForm topic={t} />
			<AdminContextChunksEditor topicId={t.id} />
			<p className="text-center text-sm text-muted-foreground">
				<Link href="/admin/curriculum/topics" className="hover:underline">
					← Back to topics
				</Link>
			</p>
		</div>
	);
}

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { AdminAiPromptActions } from "@/components/admin/ai/admin-ai-prompt-actions";
import { db } from "@/db";
import { aiPrompts } from "@/db/schema/ai-prompts";

export const metadata = {
	title: "AI prompt · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminAiPromptDetailPage(props: { params: Promise<{ id: string }> }) {
	const { id } = await props.params;
	const [row] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id)).limit(1);
	if (!row) notFound();

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">{row.name}</h1>
				<p className="font-mono text-xs text-muted-foreground">
					{row.feature} · v{row.version} · {row.model}
				</p>
			</div>
			<AdminAiPromptActions id={row.id} />
			<pre className="max-h-[480px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{row.template}</pre>
		</div>
	);
}

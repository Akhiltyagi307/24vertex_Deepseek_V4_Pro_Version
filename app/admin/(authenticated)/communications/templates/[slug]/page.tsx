import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { emailTemplates } from "@/db/schema/email-templates";

export const metadata = {
	title: "Email template versions · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminEmailTemplateSlugPage(props: { params: Promise<{ slug: string }> }) {
	const { slug } = await props.params;
	const decoded = decodeURIComponent(slug);

	const rows = await db
		.select()
		.from(emailTemplates)
		.where(eq(emailTemplates.slug, decoded))
		.orderBy(desc(emailTemplates.version));

	if (rows.length === 0) {
		notFound();
	}

	return (
		<div className="space-y-4">
			<div>
				<h1 className="font-mono text-xl font-semibold tracking-tight">{decoded}</h1>
				<p className="text-sm text-muted-foreground">Version history (immutable rows).</p>
			</div>
			<ul className="space-y-2 text-sm">
				{rows.map((r) => (
					<li key={r.id} className="rounded-md border border-border px-3 py-2">
						<span className="font-medium">v{r.version}</span>
						{r.isActive ?
							<span className="ml-2 text-emerald-600">active</span>
						:	null}
						<span className="ml-2 text-muted-foreground">{r.id}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

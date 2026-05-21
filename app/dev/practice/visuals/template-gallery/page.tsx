import { notFound } from "next/navigation";

import {
	VISUAL_TEMPLATE_REGISTRY,
	type VisualTemplateDefinition,
} from "@/lib/practice/visuals/templates";

/**
 * Dev-only metadata browser for the live visual template registry.
 *
 * Lists every entry in `VISUAL_TEMPLATE_REGISTRY` so engineers can audit
 * coverage (which subjects / topics / kinds the registry actually covers)
 * and spot drift between the template catalogue and the rendered output.
 *
 * Gated to non-production environments. Production returns 404 so the
 * catalogue doesn't leak.
 */

export const metadata = {
	title: "Practice visual template catalogue (dev only) · 24Vertex",
};

export default function TemplateGalleryPage(): React.ReactElement {
	if (process.env.NODE_ENV === "production") {
		notFound();
	}

	const bySubject = groupBySubject(VISUAL_TEMPLATE_REGISTRY);

	return (
		<main className="mx-auto max-w-5xl px-6 py-10">
			<header className="mb-8">
				<p className="text-xs uppercase tracking-wider text-muted-foreground">Dev only</p>
				<h1 className="mt-1 text-3xl font-semibold tracking-tight">
					Visual template catalogue
				</h1>
				<p className="mt-3 max-w-2xl text-sm text-muted-foreground">
					Read-only view of <code>VISUAL_TEMPLATE_REGISTRY</code>. Use it to
					audit which subjects / topics / visual kinds the registry covers
					before flipping <code>PRACTICE_VISUAL_TEMPLATE_ENGINE</code> on.
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Templates loaded: <strong>{VISUAL_TEMPLATE_REGISTRY.length}</strong>
				</p>
			</header>

			<div className="flex flex-col gap-12">
				{Object.entries(bySubject).map(([subject, templates]) => (
					<section key={subject} className="rounded-lg border border-border bg-card p-6">
						<header className="mb-4 flex flex-wrap items-baseline gap-3 border-b border-border pb-4">
							<h2 className="text-xl font-semibold tracking-tight">{subject}</h2>
							<span className="text-xs text-muted-foreground">
								{templates.length} {templates.length === 1 ? "template" : "templates"}
							</span>
						</header>
						<ul className="flex flex-col gap-4">
							{templates.map((t) => (
								<li key={t.id} className="rounded-md border border-border/50 p-3">
									<div className="flex flex-wrap items-baseline gap-3">
										<h3 className="text-base font-semibold">{t.title}</h3>
										<code className="text-xs text-muted-foreground">{t.id}</code>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">
										{t.description}
									</p>
									<div className="mt-2 flex flex-wrap gap-2 text-xs">
										<Pill>{t.kind}</Pill>
										<Pill>Priority · {t.priority}</Pill>
										<Pill>Grades · {t.gradeBands.join(", ")}</Pill>
										{t.topicTags.slice(0, 4).map((tag) => (
											<Pill key={tag} muted>
												{tag}
											</Pill>
										))}
									</div>
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</main>
	);
}

function groupBySubject(
	templates: readonly VisualTemplateDefinition[],
): Record<string, VisualTemplateDefinition[]> {
	const out: Record<string, VisualTemplateDefinition[]> = {};
	for (const template of templates) {
		const subject = template.subjects[0] ?? "Uncategorised";
		if (!out[subject]) out[subject] = [];
		out[subject].push(template);
	}
	return out;
}

function Pill({
	children,
	muted = false,
}: {
	children: React.ReactNode;
	muted?: boolean;
}): React.ReactElement {
	return (
		<span
			className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${
				muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
			}`}
		>
			{children}
		</span>
	);
}

"use client";

import { useMemo, useState } from "react";

import type { EmailPreviewSample, EmailPreviewSource } from "@/lib/email/email-preview-types";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<EmailPreviewSource, string> = {
	app: "App (Resend)",
	supabase: "Supabase Auth",
	admin: "Admin / ops",
};

const SOURCE_STYLE: Record<EmailPreviewSource, string> = {
	app: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
	supabase: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
	admin: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
};

type Props = {
	samples: EmailPreviewSample[];
};

export function EmailPreviewGallery({ samples }: Props): React.ReactElement {
	const [selectedSlug, setSelectedSlug] = useState(samples[0]?.slug ?? "");
	const [query, setQuery] = useState("");

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return samples;
		return samples.filter(
			(s) =>
				s.slug.toLowerCase().includes(q) ||
				s.displayName.toLowerCase().includes(q) ||
				s.category.toLowerCase().includes(q) ||
				s.description.toLowerCase().includes(q),
		);
	}, [samples, query]);

	const selected = samples.find((s) => s.slug === selectedSlug) ?? filtered[0] ?? samples[0];

	const byCategory = useMemo(() => {
		const map = new Map<string, EmailPreviewSample[]>();
		for (const s of filtered) {
			const list = map.get(s.category) ?? [];
			list.push(s);
			map.set(s.category, list);
		}
		return [...map.entries()];
	}, [filtered]);

	return (
		<div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6 xl:flex-row">
			<aside className="w-full shrink-0 xl:w-80">
				<label className="sr-only" htmlFor="email-preview-search">
					Search templates
				</label>
				<input
					id="email-preview-search"
					type="search"
					placeholder="Search slug or name…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
				/>
				<nav className="max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card pr-1">
					{byCategory.length === 0 ? (
						<p className="p-4 text-sm text-muted-foreground">No templates match your search.</p>
					) : (
						byCategory.map(([category, items]) => (
							<div key={category} className="border-b border-border/60 last:border-0">
								<p className="sticky top-0 z-10 bg-card/95 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
									{category}
								</p>
								<ul>
									{items.map((s) => (
										<li key={s.slug}>
											<button
												type="button"
												onClick={() => setSelectedSlug(s.slug)}
												className={cn(
													"w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
													selected?.slug === s.slug && "bg-primary/10",
												)}
											>
												<span className="block font-medium leading-snug">{s.displayName}</span>
												<code className="mt-0.5 block text-[10px] text-muted-foreground">{s.slug}</code>
											</button>
										</li>
									))}
								</ul>
							</div>
						))
					)}
				</nav>
				<p className="mt-3 text-xs text-muted-foreground">
					{filtered.length} of {samples.length} templates
				</p>
			</aside>

			<div className="min-w-0 flex-1">
				{selected ? (
					<>
						<div className="mb-4 flex flex-wrap items-start gap-3">
							<div className="min-w-0 flex-1">
								<h2 className="text-xl font-semibold tracking-tight">{selected.displayName}</h2>
								<p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
							</div>
							<span
								className={cn(
									"inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
									SOURCE_STYLE[selected.source],
								)}
							>
								{SOURCE_LABEL[selected.source]}
							</span>
						</div>
						<p className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
							<span className="font-medium text-muted-foreground">Subject: </span>
							{selected.subject}
						</p>
						{selected.source === "supabase" && (
							<p className="mb-4 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-xs text-violet-900 dark:text-violet-200">
								Preview uses <code>renderEmailShell</code> for visual parity. Production copy and
								layout are edited in the Supabase project&apos;s Auth email templates (dev + main).
							</p>
						)}
						<div className="overflow-hidden rounded-lg border border-border bg-[#f5f5f4] shadow-sm">
							<iframe
								title={`Email preview: ${selected.slug}`}
								sandbox=""
								srcDoc={selected.html}
								className="h-[min(720px,75vh)] w-full border-0 bg-[#f5f5f4]"
							/>
						</div>
					</>
				) : (
					<p className="text-sm text-muted-foreground">Select a template from the list.</p>
				)}
			</div>
		</div>
	);
}

import Link from "next/link";

export type AdminCrumb = { label: string; href?: string };

export function AdminBreadcrumbs({ items }: { items: AdminCrumb[] }) {
	return (
		<nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
			<ol className="flex flex-wrap items-center gap-1">
				{items.map((c, i) => (
					<li key={`${c.label}-${i}`} className="flex items-center gap-1">
						{i > 0 ? <span className="text-border">/</span> : null}
						{c.href ?
							<Link href={c.href} className="hover:text-foreground">
								{c.label}
							</Link>
						:	<span className="text-foreground">{c.label}</span>}
					</li>
				))}
			</ol>
		</nav>
	);
}

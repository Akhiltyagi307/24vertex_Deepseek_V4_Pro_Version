import Link from "next/link";

import type { AdminCrumb } from "@/components/admin/shell/breadcrumbs";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ items, title, description }: { items: AdminCrumb[]; title: string; description?: string }) {
	return (
		<div className="mb-6 space-y-2">
			<nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
				<ol className="flex flex-wrap items-center gap-1">
					{items.map((c, i) => (
						<li key={`${c.label}-${i}`} className="flex items-center gap-1">
							{i > 0 ?
								<span aria-hidden className="text-muted-foreground">
									/
								</span>
							:	null}
							{c.href ?
								<Link href={c.href} className="hover:text-foreground hover:underline">
									{c.label}
								</Link>
							:	<span className="text-foreground">{c.label}</span>}
						</li>
					))}
				</ol>
			</nav>
			<div>
				<h1 className={cn("text-2xl font-semibold tracking-tight")}>{title}</h1>
				{description ?
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				:	null}
			</div>
		</div>
	);
}

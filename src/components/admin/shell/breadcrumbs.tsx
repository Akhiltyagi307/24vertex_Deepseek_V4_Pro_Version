import Link from "next/link";

export type AdminCrumb = { label: string; href?: string };

const SEGMENT_LABELS: Record<string, string> = {
	dashboard: "Dashboard",
	"action-failures": "Action failures",
	"approval-queue": "Teacher approvals",
	"active-sessions": "Sessions",
	"email-log": "Email log",
	"maintenance-readiness": "Maintenance",
	"question-visuals": "Question visuals",
	"sql-console": "SQL console",
	"trial-claims": "Trial claims",
	"context-chunks": "Chunks",
	suppressions: "Suppressions",
	queues: "Queues",
	schedules: "Schedules",
};

function formatSegment(segment: string): string {
	return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function looksLikeDynamicId(segment: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment) || /^[0-9a-f]{24,}$/i.test(segment);
}

/** Path-aware crumbs for the authenticated admin shell (replaces static layout defaults). */
export function buildAdminBreadcrumbs(pathname: string): AdminCrumb[] {
	const normalized = pathname.startsWith("/admin") ? pathname : `/admin${pathname}`;
	if (normalized === "/admin" || normalized === "/admin/dashboard") {
		return [
			{ label: "Admin", href: "/admin/dashboard" },
			{ label: "Dashboard" },
		];
	}
	const segments = normalized.replace(/^\/admin\/?/, "").split("/").filter(Boolean);
	const crumbs: AdminCrumb[] = [{ label: "Admin", href: "/admin/dashboard" }];
	let acc = "/admin";
	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i]!;
		acc += `/${segment}`;
		const label = formatSegment(segment);
		const isLast = i === segments.length - 1;
		if (isLast || looksLikeDynamicId(segment)) {
			crumbs.push({ label });
		} else {
			crumbs.push({ label, href: acc });
		}
	}
	return crumbs;
}

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

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
	BarChart3,
	BookOpen,
	ChevronDown,
	ClipboardCheck,
	CreditCard,
	LayoutDashboard,
	type LucideIcon,
	Megaphone,
	Settings2,
	ShieldCheck,
	Sparkles,
	TrendingUp,
	Users,
} from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type SidebarItem = { href: string; label: string };
type SidebarGroup = { id: string; label: string; icon: LucideIcon; items: SidebarItem[] };

const STORAGE_KEY = "admin-sidebar-groups";

const dashboard: SidebarItem = { href: "/admin/dashboard", label: "Dashboard" };

const groups: SidebarGroup[] = [
	{
		id: "compliance",
		label: "Compliance",
		icon: ShieldCheck,
		items: [
			{ href: "/admin/compliance/requests", label: "Requests" },
			{ href: "/admin/compliance/consents", label: "Consents" },
			{ href: "/admin/compliance/retention", label: "Retention" },
			{ href: "/admin/audit", label: "Audit log" },
		],
	},
	{
		id: "users",
		label: "Users",
		icon: Users,
		items: [
			{ href: "/admin/users/students", label: "Students" },
			{ href: "/admin/users/parents", label: "Parents" },
			{ href: "/admin/users/teachers", label: "Teachers" },
			{ href: "/admin/users/teachers/approval-queue", label: "Teacher approvals" },
		],
	},
	{
		id: "curriculum",
		label: "Curriculum",
		icon: BookOpen,
		items: [
			{ href: "/admin/curriculum/subjects", label: "Subjects" },
			{ href: "/admin/curriculum/topics", label: "Topics" },
			{ href: "/admin/curriculum/context-chunks", label: "Chunks" },
			{ href: "/admin/curriculum/context-chunks/tools", label: "Chunk tools" },
			{ href: "/admin/curriculum/import", label: "Import" },
		],
	},
	{
		id: "assessments",
		label: "Assessments",
		icon: ClipboardCheck,
		items: [
			{ href: "/admin/assessments/tests", label: "Tests" },
			{ href: "/admin/assessments/live", label: "Live" },
			{ href: "/admin/assessments/moderation", label: "Moderation" },
			{ href: "/admin/assessments/assignments", label: "Assignments" },
		],
	},
	{
		id: "performance",
		label: "Performance",
		icon: TrendingUp,
		items: [
			{ href: "/admin/performance/tracker", label: "Tracker" },
			{ href: "/admin/performance/tools", label: "Tools" },
		],
	},
	{
		id: "comms",
		label: "Comms",
		icon: Megaphone,
		items: [
			{ href: "/admin/communications/broadcasts", label: "Broadcasts" },
			{ href: "/admin/communications/email-log", label: "Email log" },
			{ href: "/admin/communications/templates", label: "Email templates" },
		],
	},
	{
		id: "ai",
		label: "AI",
		icon: Sparkles,
		items: [
			{ href: "/admin/ai/prompts", label: "Prompts" },
			{ href: "/admin/ai/evals", label: "Evals" },
			{ href: "/admin/ai/usage", label: "Usage" },
		],
	},
	{
		id: "analytics",
		label: "Analytics",
		icon: BarChart3,
		items: [
			{ href: "/admin/analytics/overview", label: "Overview" },
			{ href: "/admin/analytics/funnel", label: "Funnel" },
			{ href: "/admin/analytics/cohorts", label: "Cohorts" },
			{ href: "/admin/analytics/export", label: "Export" },
		],
	},
	{
		id: "billing",
		label: "Billing",
		icon: CreditCard,
		items: [
			{ href: "/admin/billing/plans", label: "Plans" },
			{ href: "/admin/billing/subscriptions", label: "Subscriptions" },
			{ href: "/admin/billing/payments", label: "Payments" },
			{ href: "/admin/billing/events", label: "Webhook events" },
			{ href: "/admin/billing/coupons", label: "Coupons" },
			{ href: "/admin/billing/trial-claims", label: "Trial claims" },
			{ href: "/admin/billing/action-failures", label: "Action failures" },
			{ href: "/admin/billing/reconciliation", label: "Reconciliation" },
		],
	},
	{
		id: "system",
		label: "System",
		icon: Settings2,
		items: [
			{ href: "/admin/system/sql-console", label: "SQL" },
			{ href: "/admin/system/jobs", label: "Jobs" },
			{ href: "/admin/system/health", label: "Health" },
			{ href: "/admin/system/integrity", label: "Integrity" },
			{ href: "/admin/system/active-sessions", label: "Sessions" },
			{ href: "/admin/system/maintenance-readiness", label: "Maintenance" },
		],
	},
];

function isActive(pathname: string, href: string) {
	return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveGroupId(pathname: string): string | null {
	for (const g of groups) {
		if (g.items.some((i) => isActive(pathname, i.href))) return g.id;
	}
	return null;
}

export function AdminSidebar({ pathname }: { pathname: string }) {
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		let initial: Record<string, boolean> | null = null;
		try {
			const saved = window.localStorage.getItem(STORAGE_KEY);
			if (saved) initial = JSON.parse(saved) as Record<string, boolean>;
		} catch {
			// ignore corrupted entry
		}
		if (!initial) {
			const activeId = getActiveGroupId(pathname);
			initial = activeId ? { [activeId]: true } : {};
		}
		setOpenGroups(initial);
		setHydrated(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!hydrated) return;
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
		} catch {
			// ignore quota / private mode failures
		}
	}, [openGroups, hydrated]);

	const toggle = (id: string, open: boolean) => {
		setOpenGroups((prev) => ({ ...prev, [id]: open }));
	};

	const dashboardActive = isActive(pathname, dashboard.href);

	return (
		<aside className="hidden w-52 shrink-0 border-r border-border bg-muted/20 medium:block">
			<div className="flex h-14 items-center border-b border-border px-4">
				<Link href="/admin/dashboard" className="text-sm font-semibold tracking-tight">
					EduAI Admin
				</Link>
			</div>
			<nav className="space-y-0.5 p-2">
				<Link
					href={dashboard.href}
					className={cn(
						"flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
						dashboardActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
					)}
				>
					<LayoutDashboard className="h-4 w-4" />
					{dashboard.label}
				</Link>
				{groups.map((group) => {
					const hasActiveChild = group.items.some((i) => isActive(pathname, i.href));
					const open = openGroups[group.id] ?? false;
					const Icon = group.icon;
					return (
						<Collapsible key={group.id} open={open} onOpenChange={(o) => toggle(group.id, o)}>
							<CollapsibleTrigger
								type="button"
								className={cn(
									"flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
									hasActiveChild ? "text-foreground" : "text-muted-foreground",
								)}
							>
								<span className="flex items-center gap-2">
									<Icon className="h-4 w-4" />
									{group.label}
									{hasActiveChild && !open ? (
										<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
									) : null}
								</span>
								<ChevronDown
									className={cn(
										"h-4 w-4 shrink-0 transition-transform duration-200",
										open && "rotate-180",
									)}
								/>
							</CollapsibleTrigger>
							<CollapsibleContent className="mt-0.5 space-y-0.5">
								{group.items.map((item) => {
									const itemActive = isActive(pathname, item.href);
									return (
										<Link
											key={item.href}
											href={item.href}
											className={cn(
												"block rounded-md py-1.5 pl-9 pr-3 text-sm transition-colors hover:bg-muted",
												itemActive
													? "bg-muted font-medium text-foreground"
													: "text-muted-foreground",
											)}
										>
											{item.label}
										</Link>
									);
								})}
							</CollapsibleContent>
						</Collapsible>
					);
				})}
			</nav>
		</aside>
	);
}

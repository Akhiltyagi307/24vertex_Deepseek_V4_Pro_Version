import Link from "next/link";

import { cn } from "@/lib/utils";

const links = [
	{ href: "/admin/dashboard", label: "Dashboard" },
	{ href: "/admin/compliance/requests", label: "Compliance · Requests" },
	{ href: "/admin/compliance/consents", label: "Compliance · Consents" },
	{ href: "/admin/compliance/retention", label: "Compliance · Retention" },
	{ href: "/admin/audit", label: "Audit log" },
	{ href: "/admin/users/students", label: "Users · Students" },
	{ href: "/admin/users/parents", label: "Users · Parents" },
	{ href: "/admin/users/teachers", label: "Users · Teachers" },
	{ href: "/admin/users/teachers/approval-queue", label: "Teacher approvals" },
	{ href: "/admin/curriculum/subjects", label: "Curriculum · Subjects" },
	{ href: "/admin/curriculum/topics", label: "Curriculum · Topics" },
	{ href: "/admin/curriculum/context-chunks", label: "Curriculum · Chunks" },
	{ href: "/admin/curriculum/context-chunks/tools", label: "Curriculum · Chunk tools" },
	{ href: "/admin/curriculum/import", label: "Curriculum · Import" },
	{ href: "/admin/assessments/tests", label: "Assessments · Tests" },
	{ href: "/admin/assessments/live", label: "Assessments · Live" },
	{ href: "/admin/assessments/moderation", label: "Assessments · Moderation" },
	{ href: "/admin/assessments/assignments", label: "Assessments · Assignments" },
	{ href: "/admin/performance/tracker", label: "Performance · Tracker" },
	{ href: "/admin/performance/tools", label: "Performance · Tools" },
	{ href: "/admin/communications/broadcasts", label: "Comms · Broadcasts" },
	{ href: "/admin/communications/email-log", label: "Comms · Email log" },
	{ href: "/admin/communications/templates", label: "Comms · Email templates" },
	{ href: "/admin/ai/prompts", label: "AI · Prompts" },
	{ href: "/admin/ai/usage", label: "AI · Usage" },
	{ href: "/admin/analytics/overview", label: "Analytics · Overview" },
	{ href: "/admin/analytics/funnel", label: "Analytics · Funnel" },
	{ href: "/admin/analytics/cohorts", label: "Analytics · Cohorts" },
	{ href: "/admin/analytics/export", label: "Analytics · Export" },
	{ href: "/admin/billing/plans", label: "Billing · Plans" },
	{ href: "/admin/billing/subscriptions", label: "Billing · Subscriptions" },
	{ href: "/admin/billing/payments", label: "Billing · Payments" },
	{ href: "/admin/billing/events", label: "Billing · Webhook events" },
	{ href: "/admin/billing/coupons", label: "Billing · Coupons" },
	{ href: "/admin/billing/trial-claims", label: "Billing · Trial claims" },
	{ href: "/admin/system/sql-console", label: "System · SQL" },
	{ href: "/admin/system/jobs", label: "System · Jobs" },
	{ href: "/admin/system/health", label: "System · Health" },
	{ href: "/admin/system/integrity", label: "System · Integrity" },
	{ href: "/admin/system/active-sessions", label: "System · Sessions" },
	{ href: "/admin/system/maintenance-readiness", label: "System · Maintenance" },
];

export function AdminSidebar({ pathname }: { pathname: string }) {
	return (
		<aside className="hidden w-52 shrink-0 border-r border-border bg-muted/20 medium:block">
			<div className="flex h-14 items-center border-b border-border px-4">
				<Link href="/admin/dashboard" className="text-sm font-semibold tracking-tight">
					EduAI Admin
				</Link>
			</div>
			<nav className="space-y-0.5 p-2">
				{links.map((l) => (
					<Link
						key={l.href}
						href={l.href}
						className={cn(
							"block rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
							pathname === l.href || pathname.startsWith(`${l.href}/`) ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
						)}
					>
						{l.label}
					</Link>
				))}
			</nav>
		</aside>
	);
}

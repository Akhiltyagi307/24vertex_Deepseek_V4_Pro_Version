/**
 * Command palette entries (PDR §3.3): jumps are navigation-only; actions may require confirmation.
 * Keep labels stable; hrefs must match real admin routes.
 */

export type CommandPaletteJump = {
	id: string;
	label: string;
	href: string;
	shortcut?: string;
};

export type CommandPaletteNavAction = {
	id: string;
	kind: "nav";
	label: string;
	description?: string;
	href: string;
	variant?: "default" | "destructive";
};

export type CommandPaletteConfirmFetchAction = {
	id: string;
	kind: "confirm_fetch";
	label: string;
	description: string;
	confirmLabel: string;
	url: string;
	method: "POST";
	variant: "destructive";
};

export type CommandPaletteAction = CommandPaletteNavAction | CommandPaletteConfirmFetchAction;

export const COMMAND_PALETTE_JUMPS: CommandPaletteJump[] = [
	{ id: "dash", label: "Dashboard", href: "/admin/dashboard" },
	{ id: "compliance_requests", label: "Compliance · Requests", href: "/admin/compliance/requests" },
	{ id: "compliance_consents", label: "Compliance · Consents", href: "/admin/compliance/consents" },
	{ id: "compliance_retention", label: "Compliance · Retention", href: "/admin/compliance/retention" },
	{ id: "audit", label: "Audit log", href: "/admin/audit" },
	{ id: "students", label: "Users · Students", href: "/admin/users/students" },
	{ id: "teachers", label: "Users · Teachers", href: "/admin/users/teachers" },
	{ id: "tests", label: "Assessments · Tests", href: "/admin/assessments/tests" },
	{ id: "live", label: "Assessments · Live", href: "/admin/assessments/live" },
	{ id: "question_visuals", label: "Curriculum · Question visuals", href: "/admin/curriculum/question-visuals" },
	{ id: "billing_plans", label: "Billing · Plans", href: "/admin/billing/plans" },
	{ id: "billing_subs", label: "Billing · Subscriptions", href: "/admin/billing/subscriptions" },
	{ id: "billing_payments", label: "Billing · Payments", href: "/admin/billing/payments" },
	{ id: "billing_events", label: "Billing · Webhook events", href: "/admin/billing/events" },
	{ id: "coupons", label: "Billing · Coupons", href: "/admin/billing/coupons" },
	{ id: "billing_trial_claims", label: "Billing · Trial claims", href: "/admin/billing/trial-claims" },
	{ id: "sql", label: "System · SQL console", href: "/admin/system/sql-console" },
	{ id: "sessions", label: "System · Active sessions", href: "/admin/system/active-sessions" },
	{ id: "maintenance", label: "System · Maintenance readiness", href: "/admin/system/maintenance-readiness" },
	{ id: "performance_tracker", label: "Performance · Tracker", href: "/admin/performance/tracker" },
	{ id: "performance_tools", label: "Performance · Tools", href: "/admin/performance/tools" },
];

export const COMMAND_PALETTE_ACTIONS: CommandPaletteAction[] = [
	{
		id: "broadcast_compose",
		kind: "nav",
		label: "Open broadcast compose",
		description: "Create or schedule a broadcast draft.",
		href: "/admin/communications/broadcasts/compose",
	},
	{
		id: "teacher_approvals",
		kind: "nav",
		label: "Open teacher approval queue",
		href: "/admin/users/teachers/approval-queue",
	},
	{
		id: "coupons_ops",
		kind: "nav",
		label: "Coupons",
		description: "Create, edit, disable codes and view redemptions.",
		href: "/admin/billing/coupons",
	},
	{
		id: "maintenance_readiness",
		kind: "nav",
		label: "Maintenance mode readiness",
		description: "How MAINTENANCE_MODE affects traffic (admin stays reachable).",
		href: "/admin/system/maintenance-readiness",
	},
	{
		id: "kill_other_sessions",
		kind: "confirm_fetch",
		label: "Kill all other admin sessions",
		description:
			"Revokes every admin session except this browser. Other tabs and devices must sign in again on the next request.",
		confirmLabel: "Revoke others",
		url: "/api/admin/sessions/revoke-others",
		method: "POST",
		variant: "destructive",
	},
];

import {
	AlertTriangleIcon,
	BellIcon,
	FileBarChartIcon,
	MegaphoneIcon,
	ShieldIcon,
	SparklesIcon,
} from "lucide-react";
import type { ComponentType } from "react";

import type { NotificationListItem } from "@/lib/notifications/types";

export type NotificationTypeMeta = {
	label: string;
	Icon: ComponentType<{ className?: string }>;
	iconBg: string;
	iconFg: string;
};

export function typeMetaForRow(row: NotificationListItem): NotificationTypeMeta {
	if (row.type === "test_result") {
		return {
			label: "Report",
			Icon: FileBarChartIcon,
			iconBg: "bg-emerald-500/10",
			iconFg: "text-emerald-600 dark:text-emerald-400",
		};
	}
	if (row.type === "alert") {
		return {
			label: "Usage alert",
			Icon: AlertTriangleIcon,
			iconBg: "bg-amber-500/10",
			iconFg: "text-amber-600 dark:text-amber-400",
		};
	}
	if (row.type === "announcement") {
		return {
			label: "Announcement",
			Icon: MegaphoneIcon,
			iconBg: "bg-sky-500/10",
			iconFg: "text-sky-600 dark:text-sky-400",
		};
	}
	if (row.type === "encouragement") {
		return {
			label: "For you",
			Icon: SparklesIcon,
			iconBg: "bg-violet-500/10",
			iconFg: "text-violet-600 dark:text-violet-400",
		};
	}
	if (
		row.type === "system" &&
		typeof row.category === "string" &&
		(row.category === "account_password_changed" ||
			row.category === "account_email_changed" ||
			row.category === "parent_linked_student" ||
			row.category === "parent_child_link_confirmed")
	) {
		return {
			label: "Account",
			Icon: ShieldIcon,
			iconBg: "bg-rose-500/10",
			iconFg: "text-rose-600 dark:text-rose-400",
		};
	}
	return {
		label: row.type === "system" ? "System" : "Reminder",
		Icon: BellIcon,
		iconBg: "bg-muted",
		iconFg: "text-muted-foreground",
	};
}

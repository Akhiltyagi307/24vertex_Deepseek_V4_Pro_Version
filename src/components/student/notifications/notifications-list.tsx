"use client";

import Link from "next/link";
import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { CheckCheckIcon, LoaderIcon } from "lucide-react";

import { NotificationsEmptyState } from "@/components/student/notifications/notification-empty-state";
import { typeMetaForRow } from "@/components/student/notifications/notification-type-meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/components/student/notifications/relative-time";
import { subscribeToMyNotifications } from "@/lib/notifications/realtime-client";
import {
	deriveCta,
	type NotificationListItem,
	type NotificationPortal,
} from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread";

export type NotificationsListProps = {
	userId: string;
	apiBasePath?: string;
	portal?: NotificationPortal;
	initialItems: NotificationListItem[];
	initialNextCursor: string | null;
	initialUnreadCount: number;
};

export function NotificationsList({
	userId,
	apiBasePath = "/api/student/notifications",
	portal = "student",
	initialItems,
	initialNextCursor,
	initialUnreadCount,
}: NotificationsListProps) {
	const [items, setItems] = React.useState<NotificationListItem[]>(initialItems);
	const [nextCursor, setNextCursor] = React.useState<string | null>(initialNextCursor);
	const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
	const [filter, setFilter] = React.useState<Filter>("all");
	const [loadingMore, setLoadingMore] = React.useState(false);
	const [markingAll, setMarkingAll] = React.useState(false);

	React.useEffect(() => {
		const unsubscribe = subscribeToMyNotifications(
			userId,
			(row) => {
				setItems((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
				if (!row.isRead) setUnreadCount((n) => n + 1);
			},
			"list",
		);
		return unsubscribe;
	}, [userId, apiBasePath]);

	const visible = React.useMemo(
		() => (filter === "unread" ? items.filter((r) => !r.isRead) : items),
		[items, filter],
	);

	async function markRead(id: string, nextRead: boolean) {
		setItems((prev) =>
			prev.map((r) => (r.id === id ? { ...r, isRead: nextRead } : r)),
		);
		setUnreadCount((n) => {
			const delta = nextRead ? -1 : 1;
			return Math.max(0, n + delta);
		});
		try {
			const res = await fetch(`${apiBasePath}/${id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ is_read: nextRead }),
			});
			if (!res.ok) throw new Error(`status=${res.status}`);
		} catch (err) {
			// Revert on failure and surface in Sentry.
			setItems((prev) =>
				prev.map((r) => (r.id === id ? { ...r, isRead: !nextRead } : r)),
			);
			setUnreadCount((n) => Math.max(0, n + (nextRead ? 1 : -1)));
			Sentry.captureException(err, { tags: { area: "notifications", op: "mark_read" } });
		}
	}

	async function markAllRead() {
		if (markingAll || unreadCount === 0) return;
		setMarkingAll(true);
		const snapshot = items;
		setItems((prev) => prev.map((r) => ({ ...r, isRead: true })));
		setUnreadCount(0);
		try {
			const res = await fetch(`${apiBasePath}/read-all`, { method: "POST" });
			if (!res.ok) throw new Error(`status=${res.status}`);
		} catch (err) {
			setItems(snapshot);
			setUnreadCount(snapshot.filter((r) => !r.isRead).length);
			Sentry.captureException(err, { tags: { area: "notifications", op: "read_all" } });
		} finally {
			setMarkingAll(false);
		}
	}

	async function loadMore() {
		if (!nextCursor || loadingMore) return;
		setLoadingMore(true);
		try {
			const url = new URL(
				apiBasePath,
				typeof window !== "undefined" ? window.location.origin : "http://localhost",
			);
			url.searchParams.set("cursor", nextCursor);
			url.searchParams.set("filter", filter);
			const res = await fetch(url.toString());
			if (!res.ok) throw new Error(`status=${res.status}`);
			const json = (await res.json()) as {
				items: NotificationListItem[];
				nextCursor: string | null;
				unreadCount: number;
			};
			setItems((prev) => [
				...prev,
				...json.items.filter((r) => !prev.some((p) => p.id === r.id)),
			]);
			setNextCursor(json.nextCursor);
			setUnreadCount(json.unreadCount);
		} catch (err) {
			Sentry.captureException(err, { tags: { area: "notifications", op: "load_more" } });
		} finally {
			setLoadingMore(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
				<div className="flex items-center gap-2">
					<FilterPill
						active={filter === "all"}
						onClick={() => setFilter("all")}
						label="All"
					/>
					<FilterPill
						active={filter === "unread"}
						onClick={() => setFilter("unread")}
						label="Unread"
						badge={unreadCount > 0 ? unreadCount : undefined}
					/>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={markAllRead}
					disabled={markingAll || unreadCount === 0}
					className="gap-1.5 text-muted-foreground"
				>
					<CheckCheckIcon /> Mark all read
				</Button>
			</header>

			<ul
				className="flex flex-col gap-2"
				role="log"
				aria-live="polite"
				aria-label="Notifications"
			>
				{visible.length === 0 ? (
					<li className="list-none">
						<NotificationsEmptyState filter={filter} />
					</li>
				) : (
					visible.map((row) => (
						<NotificationCard
							key={row.id}
							row={row}
							portal={portal}
							onMarkRead={markRead}
						/>
					))
				)}
			</ul>

			{nextCursor ? (
				<div className="flex justify-center pt-2">
					<Button
						variant="outline"
						size="sm"
						onClick={loadMore}
						disabled={loadingMore}
						className="gap-1.5"
					>
						{loadingMore ? <LoaderIcon className="animate-spin" /> : null}
						{loadingMore ? "Loading" : "Load more"}
					</Button>
				</div>
			) : null}
		</div>
	);
}

function FilterPill({
	active,
	onClick,
	label,
	badge,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	badge?: number;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={cn(
				"inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
				active
					? "border-primary/60 bg-primary/10 text-foreground"
					: "border-border bg-background text-muted-foreground hover:bg-muted",
			)}
		>
			{label}
			{badge != null ? (
				<span className="rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
					{badge > 99 ? "99+" : badge}
				</span>
			) : null}
		</button>
	);
}

function NotificationCard({
	row,
	portal,
	onMarkRead,
}: {
	row: NotificationListItem;
	portal: NotificationPortal;
	onMarkRead: (id: string, nextRead: boolean) => void;
}) {
	const cta = deriveCta(row, { portal });
	const typeMeta = typeMetaForRow(row);

	function trackCtaClick() {
		try {
			Sentry.addBreadcrumb({
				category: "notifications",
				message: "notification_cta_clicked",
				level: "info",
				data: {
					category: row.category ?? "",
					type: row.type,
					referenceType: row.referenceType ?? "",
				},
			});
		} catch {
			/* never block nav */
		}
		if (!row.isRead) onMarkRead(row.id, true);
	}

	return (
		<li
			className={cn(
				"group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 ring-1 ring-foreground/5 transition-colors",
				!row.isRead && "bg-primary/5 border-primary/30",
			)}
		>
			<div className="flex items-start gap-3">
				<div
					className={cn(
						"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
						typeMeta.iconBg,
					)}
					aria-hidden
				>
					<typeMeta.Icon className={cn("size-4", typeMeta.iconFg)} />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm font-medium text-foreground">{row.title}</span>
						{row.priority === "urgent" ? (
							<Badge variant="destructive">Urgent</Badge>
						) : null}
						{!row.isRead ? (
							<span
								aria-hidden
								className="inline-flex size-2 rounded-full bg-primary"
							/>
						) : null}
					</div>
					<p className="line-clamp-2 text-sm text-muted-foreground">{row.body}</p>
					<div className="flex flex-wrap items-center gap-2 pt-1">
						{row.relatedStudentName ? (
							<Badge variant="secondary" className="max-w-[14rem] truncate font-normal">
								For {row.relatedStudentName}
							</Badge>
						) : null}
						<Badge variant="outline" className="font-normal text-muted-foreground">
							{typeMeta.label}
						</Badge>
						<span className="text-xs text-muted-foreground">
							{formatRelativeTime(row.createdAt)}
						</span>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{cta ? (
						<Button
							size="sm"
							variant={cta.variant === "primary" ? "default" : "outline"}
							render={<Link href={cta.href} prefetch={false} />}
							onClick={trackCtaClick}
						>
							{cta.label}
						</Button>
					) : null}
					{!row.isRead ? (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => onMarkRead(row.id, true)}
							aria-label="Mark as read"
							className="text-muted-foreground"
						>
							Mark read
						</Button>
					) : null}
				</div>
			</div>
		</li>
	);
}


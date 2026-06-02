"use client";

import Link from "next/link";
import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import { BellIcon, CheckCheckIcon, ChevronRightIcon, LoaderIcon } from "lucide-react";

import { fetchJson, isAbortError } from "@/lib/http/fetch-json";
import { NotificationsEmptyState } from "@/components/student/notifications/notification-empty-state";
import { typeMetaForRow } from "@/components/student/notifications/notification-type-meta";
import { formatRelativeTime } from "@/components/student/notifications/relative-time";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	deriveCta,
	type NotificationListItem,
	type NotificationPortal,
} from "@/lib/notifications/types";
import { subscribeToMyNotifications } from "@/lib/notifications/realtime-client";
import { useNotificationUnreadCount } from "@/lib/notifications/use-notification-unread-count";
import { NotificationUnreadPill } from "@/components/student/notifications/notification-unread-pill";
import { cn } from "@/lib/utils";

/** Chrome aligned with other top-bar controls */
const topBarControlChrome =
	"border border-border/90 bg-sidebar-accent shadow-sm dark:border-border dark:bg-sidebar-accent";

const TRAY_LIMIT = 12;

export type StudentNotificationsBellProps = {
	userId: string;
	initialUnreadCount?: number;
	apiBasePath?: string;
	notificationsPageHref?: string;
	portal?: NotificationPortal;
};

/**
 * Top-bar bell: opens an iOS-style tray (popover) with recent notifications,
 * empty state, and a link to the full page. Unread count uses the same API +
 * Realtime as before; badge follows iOS conventions (red pill, white type).
 */
export function StudentNotificationsBell({
	userId,
	initialUnreadCount = 0,
	apiBasePath = "/api/student/notifications",
	notificationsPageHref = "/student/notifications",
	portal = "student",
}: StudentNotificationsBellProps) {
	const [open, setOpen] = React.useState(false);
	const { count, setCount } = useNotificationUnreadCount({
		userId,
		apiBasePath,
		initialCount: initialUnreadCount,
		skipMountRefresh: true,
		realtimeScope: "bell",
	});
	const [items, setItems] = React.useState<NotificationListItem[]>([]);
	const [loadingTray, setLoadingTray] = React.useState(false);
	const [markingAll, setMarkingAll] = React.useState(false);

	const trayReqIdRef = React.useRef(0);
	const trayAcRef = React.useRef<AbortController | null>(null);

	const loadTray = React.useCallback(async () => {
		const id = ++trayReqIdRef.current;
		trayAcRef.current?.abort();
		const ac = new AbortController();
		trayAcRef.current = ac;
		setLoadingTray(true);
		try {
			const url = new URL(
				apiBasePath,
				typeof window !== "undefined" ? window.location.origin : "http://localhost",
			);
			url.searchParams.set("limit", String(TRAY_LIMIT));
			url.searchParams.set("filter", "all");
			const json = await fetchJson<{
				items: NotificationListItem[];
				unreadCount: number;
			}>(url.toString(), { signal: ac.signal, report: { area: "notifications", op: "tray_load" } });
			if (id !== trayReqIdRef.current) return;
			setItems(json.items ?? []);
			if (typeof json.unreadCount === "number") {
				setCount(Math.max(0, json.unreadCount));
			}
		} catch (err) {
			if (isAbortError(err) || id !== trayReqIdRef.current) return;
			setItems([]);
		} finally {
			if (id === trayReqIdRef.current) setLoadingTray(false);
		}
	}, [apiBasePath, setCount]);

	React.useEffect(() => {
		if (!open) return;
		void loadTray();
		return () => {
			trayAcRef.current?.abort();
		};
	}, [open, loadTray]);

	React.useEffect(() => {
		if (!open) return;
		const unsubscribe = subscribeToMyNotifications(
			userId,
			(row) => {
				setItems((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
			},
			"tray",
		);
		return unsubscribe;
	}, [open, userId]);

	async function markRead(id: string, nextRead: boolean) {
		setItems((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: nextRead } : r)));
		setCount((n) => Math.max(0, n + (nextRead ? -1 : 1)));
		try {
			const res = await fetch(`${apiBasePath}/${id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ is_read: nextRead }),
			});
			if (!res.ok) throw new Error(`status=${res.status}`);
		} catch (err) {
			setItems((prev) => prev.map((r) => (r.id === id ? { ...r, isRead: !nextRead } : r)));
			setCount((n) => Math.max(0, n + (nextRead ? 1 : -1)));
			Sentry.captureException(err, { tags: { area: "notifications", op: "tray_mark_read" } });
		}
	}

	async function markAllRead() {
		if (markingAll || count === 0) return;
		setMarkingAll(true);
		const snapshot = items;
		setItems((prev) => prev.map((r) => ({ ...r, isRead: true })));
		setCount(0);
		try {
			const res = await fetch(`${apiBasePath}/read-all`, { method: "POST" });
			if (!res.ok) throw new Error(`status=${res.status}`);
		} catch (err) {
			setItems(snapshot);
			setCount(snapshot.filter((r) => !r.isRead).length);
			Sentry.captureException(err, { tags: { area: "notifications", op: "tray_read_all" } });
		} finally {
			setMarkingAll(false);
		}
	}

	const ariaLabel =
		count === 0
			? "Notifications"
			: count === 1
				? "Notifications, 1 unread"
				: `Notifications, ${count} unread`;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				type="button"
				aria-label={ariaLabel}
				aria-expanded={open}
				className={cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"relative size-8 shrink-0 rounded-md text-foreground outline-none transition-colors",
					"hover:bg-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:bg-foreground/15",
					topBarControlChrome,
				)}
				onClick={() => {
					Sentry.addBreadcrumb({
						category: "notifications",
						message: "bell_tray_toggle",
						level: "info",
						data: { unread: count, open: !open },
					});
				}}
			>
				<BellIcon className="size-4" aria-hidden />
				<NotificationUnreadPill count={count} />
			</PopoverTrigger>
			<PopoverContent
				align="end"
				side="bottom"
				sideOffset={10}
				className={cn(
					"w-[min(calc(100vw-1.25rem),22rem)] max-h-[min(28rem,72vh)] overflow-hidden p-0",
					"rounded-[14px] border border-border/60 bg-popover/95 shadow-2xl ring-1 ring-black/[0.06] backdrop-blur-xl",
					"dark:border-border dark:bg-popover/95 dark:ring-white/[0.08]",
				)}
			>
				<div className="flex max-h-[min(28rem,72vh)] flex-col">
					{/* iOS-style grab / header */}
					<div className="flex shrink-0 flex-col items-center border-b border-border/50 bg-muted/20 px-3 pb-2 pt-2">
						<div
							className="mb-2 h-1 w-9 shrink-0 rounded-full bg-muted-foreground/25"
							aria-hidden
						/>
						<div className="flex w-full items-center justify-between gap-2 px-1">
							<h2 className="text-[17px] font-semibold tracking-tight text-foreground">
								Notifications
							</h2>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 gap-1 px-2 text-[13px] font-medium text-[#007AFF] hover:bg-transparent hover:text-[#007AFF]/80 dark:text-sky-400"
								disabled={markingAll || count === 0}
								onClick={() => void markAllRead()}
							>
								<CheckCheckIcon className="size-3.5 opacity-80" />
								Clear
							</Button>
						</div>
					</div>

					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 pt-2">
						{loadingTray && items.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
								<LoaderIcon className="size-6 animate-spin opacity-60" aria-hidden />
								<span className="text-sm">Loading…</span>
							</div>
						) : items.length === 0 ? (
							<NotificationsEmptyState filter="all" className="border-0 bg-transparent py-8" />
						) : (
							<div className="overflow-hidden rounded-xl border border-border/50 bg-background/80 dark:bg-background/40">
								<ul className="divide-y divide-border/60" role="list">
									{items.map((row) => (
										<TrayNotificationRow
											key={row.id}
											row={row}
											portal={portal}
											defaultHref={notificationsPageHref}
											onAfterNavigate={() => setOpen(false)}
											onMarkRead={markRead}
										/>
									))}
								</ul>
							</div>
						)}
					</div>

					<div className="shrink-0 border-t border-border/50 bg-muted/15 px-2 py-2">
						<Button
							variant="ghost"
							size="sm"
							className="h-10 w-full justify-between rounded-xl px-3 text-[15px] font-normal text-foreground hover:bg-muted/80"
							render={<Link href={notificationsPageHref} prefetch={false} />}
							onClick={() => setOpen(false)}
						>
							Show all
							<ChevronRightIcon className="size-4 text-muted-foreground" />
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function TrayNotificationRow({
	row,
	portal,
	defaultHref,
	onMarkRead,
	onAfterNavigate,
}: {
	row: NotificationListItem;
	portal: NotificationPortal;
	defaultHref: string;
	onMarkRead: (id: string, nextRead: boolean) => void;
	onAfterNavigate: () => void;
}) {
	const cta = deriveCta(row, { portal });
	const href = cta?.href ?? defaultHref;
	const meta = typeMetaForRow(row);

	function onCtaClick() {
		try {
			Sentry.addBreadcrumb({
				category: "notifications",
				message: "notification_cta_clicked",
				level: "info",
				data: {
					category: row.category ?? "",
					type: row.type,
					referenceType: row.referenceType ?? "",
					surface: "tray",
				},
			});
		} catch {
			/* ignore */
		}
		if (!row.isRead) void onMarkRead(row.id, true);
		onAfterNavigate();
	}

	return (
		<li>
			<Link
				href={href}
				prefetch={false}
				onClick={onCtaClick}
				className={cn(
					"flex gap-3 px-3 py-2.5 transition-colors active:bg-muted/70",
					!row.isRead && "bg-primary/[0.04]",
				)}
			>
				<div
					className={cn(
						"mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[10px]",
						meta.iconBg,
					)}
					aria-hidden
				>
					<meta.Icon className={cn("size-[18px]", meta.iconFg)} />
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<p className="text-[15px] font-medium leading-snug tracking-tight text-foreground">
							{row.title}
						</p>
						{!row.isRead ? (
							<span
								className="mt-1.5 size-2 shrink-0 rounded-full bg-[#FF3B30]"
								aria-label="Unread"
							/>
						) : null}
					</div>
					<p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
						{row.body}
					</p>
					<div className="mt-1 flex items-center justify-between gap-2">
						<span className="text-[12px] text-muted-foreground/90">
							{formatRelativeTime(row.createdAt)}
						</span>
						{cta ? (
							<span className="text-[13px] font-medium text-[#007AFF] dark:text-sky-400">
								{cta.label}
							</span>
						) : null}
					</div>
				</div>
				<ChevronRightIcon
					className="mt-3 size-4 shrink-0 text-muted-foreground/50"
					aria-hidden
				/>
			</Link>
		</li>
	);
}

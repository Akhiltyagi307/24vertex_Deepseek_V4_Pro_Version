"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	COMMAND_PALETTE_ACTIONS,
	COMMAND_PALETTE_JUMPS,
	type CommandPaletteAction,
	type CommandPaletteConfirmFetchAction,
} from "@/lib/admin/command-palette-registry";
import { adminHttpErrorMessage } from "@/lib/admin/http-error-message";
import { cn } from "@/lib/utils";

const RECENT_KEY = "admin_cmdk_recent_v1";
const MAX_RECENT = 5;

type RecentEntry = { type: string; id: string; label: string; href: string };

type AdminSearchHit = {
	type: string;
	id: string;
	label: string;
	subtitle?: string;
	href: string;
};

function readRecent(): RecentEntry[] {
	if (typeof window === "undefined") return [];
	try {
		const raw = localStorage.getItem(RECENT_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(x): x is RecentEntry =>
				x && typeof x === "object" && "href" in x && typeof (x as RecentEntry).href === "string",
		) as RecentEntry[];
	} catch {
		return [];
	}
}

function writeRecent(entry: RecentEntry) {
	const prev = readRecent().filter((r) => r.href !== entry.href);
	const next = [entry, ...prev].slice(0, MAX_RECENT);
	localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function actionMatchesQuery(a: CommandPaletteAction, q: string): boolean {
	if (!q) return true;
	const hay = `${a.label} ${"description" in a ? (a.description ?? "") : ""} ${a.kind === "nav" ? a.href : a.url}`.toLowerCase();
	return hay.includes(q);
}

export function AdminCommandPalette({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [hits, setHits] = useState<AdminSearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [recent, setRecent] = useState<RecentEntry[]>([]);
	const [confirmFetch, setConfirmFetch] = useState<CommandPaletteConfirmFetchAction | null>(null);

	useEffect(() => {
		if (open) setRecent(readRecent());
	}, [open]);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setHits([]);
			return;
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const q = query.trim();
		if (q.length < 2) {
			setHits([]);
			return;
		}
		const t = window.setTimeout(() => {
			void (async () => {
				setLoading(true);
				try {
					const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
					const json = (await res.json()) as { data?: AdminSearchHit[] };
					setHits(Array.isArray(json.data) ? json.data : []);
				} catch {
					setHits([]);
				} finally {
					setLoading(false);
				}
			})();
		}, 220);
		return () => window.clearTimeout(t);
	}, [query, open]);

	const navigate = useCallback(
		(href: string, entry?: RecentEntry) => {
			if (entry) writeRecent(entry);
			onOpenChange(false);
			router.push(href);
		},
		[onOpenChange, router],
	);

	const qLower = query.trim().toLowerCase();

	const filteredJumps = useMemo(() => {
		if (!qLower) return COMMAND_PALETTE_JUMPS;
		return COMMAND_PALETTE_JUMPS.filter(
			(j) => j.label.toLowerCase().includes(qLower) || j.href.toLowerCase().includes(qLower),
		);
	}, [qLower]);

	const filteredActions = useMemo(
		() => COMMAND_PALETTE_ACTIONS.filter((a) => actionMatchesQuery(a, qLower)),
		[qLower],
	);

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent
					className="max-h-[min(560px,85vh)] w-full max-w-[640px] gap-0 overflow-hidden p-0 medium:max-w-[640px]"
					showCloseButton
				>
					<DialogHeader className="sr-only">
						<DialogTitle>Command palette</DialogTitle>
						<DialogDescription>Search or jump to admin destinations</DialogDescription>
					</DialogHeader>
					<Command
						shouldFilter={false}
						className="flex flex-col bg-popover"
						label="Admin command palette"
					>
						<div className="flex items-center gap-2 border-b border-border px-3">
							<Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
							<Command.Input
								value={query}
								onValueChange={setQuery}
								placeholder="Search or jump to…"
								className="h-11 w-full border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
							/>
							<span className="shrink-0 text-xs text-muted-foreground">esc</span>
						</div>
						<Command.List className="max-h-[420px] overflow-y-auto p-2">
							{loading ?
								<div className="px-2 py-6 text-center text-sm text-muted-foreground">Searching…</div>
							:	null}

							<Command.Group
								heading="Jump to"
								className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
							>
								{filteredJumps.map((j) => (
									<Command.Item
										key={j.id}
										value={`jump-${j.id}`}
										onSelect={() =>
											navigate(j.href, { type: "jump", id: j.id, label: j.label, href: j.href })
										}
										className={cn(
											"flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm",
											"aria-selected:bg-accent/80 aria-selected:text-accent-foreground",
										)}
									>
										<span>{j.label}</span>
										{j.shortcut ?
											<span className="rounded border border-border bg-muted/50 px-1.5 font-mono text-[10px] text-muted-foreground">
												{j.shortcut}
											</span>
										:	null}
									</Command.Item>
								))}
							</Command.Group>

							<Command.Group
								heading="Actions"
								className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
							>
								{filteredActions.map((a) => (
									<Command.Item
										key={a.id}
										value={`action-${a.id}`}
										onSelect={() => {
											if (a.kind === "nav") {
												navigate(a.href, { type: "action", id: a.id, label: a.label, href: a.href });
												return;
											}
											setConfirmFetch(a);
										}}
										className={cn(
											"cursor-pointer rounded-md px-2 py-2 text-sm",
											a.variant === "destructive" ?
												"text-destructive aria-selected:bg-destructive/10 aria-selected:text-destructive"
											:	"aria-selected:bg-accent/80 aria-selected:text-accent-foreground",
										)}
									>
										<span className="font-medium">{a.label}</span>
										{"description" in a && a.description ?
											<span className="mt-0.5 block text-xs text-muted-foreground">{a.description}</span>
										:	null}
									</Command.Item>
								))}
							</Command.Group>

							{recent.length > 0 ?
								<Command.Group
									heading="Recent"
									className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
								>
									{recent.map((r) => (
										<Command.Item
											key={`${r.type}-${r.id}`}
											value={`recent-${r.href}`}
											onSelect={() => navigate(r.href)}
											className={cn(
												"cursor-pointer rounded-md px-2 py-2 text-sm",
												"aria-selected:bg-accent/80 aria-selected:text-accent-foreground",
											)}
										>
											<span className="block font-medium">{r.label}</span>
											<span className="block text-xs text-muted-foreground">{r.href}</span>
										</Command.Item>
									))}
								</Command.Group>
							:	null}

							{hits.length > 0 ?
								<Command.Group
									heading="Search results"
									className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
								>
									{hits.map((h) => (
										<Command.Item
											key={`${h.type}-${h.id}`}
											value={`hit-${h.type}-${h.id}`}
											onSelect={() =>
												navigate(h.href, { type: h.type, id: h.id, label: h.label, href: h.href })
											}
											className={cn(
												"cursor-pointer rounded-md px-2 py-2 text-sm",
												"aria-selected:bg-accent/80 aria-selected:text-accent-foreground",
											)}
										>
											<div className="flex items-center justify-between gap-2">
												<span className="font-medium">{h.label}</span>
												<span className="rounded bg-muted px-1.5 text-[10px] uppercase text-muted-foreground">
													{h.type}
												</span>
											</div>
											{h.subtitle ?
												<div className="text-xs text-muted-foreground">{h.subtitle}</div>
											:	null}
										</Command.Item>
									))}
								</Command.Group>
							:	query.trim().length >= 2 && !loading ?
								<Command.Empty className="px-2 py-6 text-center text-sm text-muted-foreground">
									No matches.
								</Command.Empty>
							:	null}
						</Command.List>
					</Command>
				</DialogContent>
			</Dialog>

			<Dialog open={confirmFetch != null} onOpenChange={(v) => !v && setConfirmFetch(null)}>
				<DialogContent className="medium:max-w-md" showCloseButton>
					{confirmFetch ?
						<>
							<DialogHeader>
								<DialogTitle>{confirmFetch.label}</DialogTitle>
								<DialogDescription>{confirmFetch.description}</DialogDescription>
							</DialogHeader>
							<div className="flex flex-col-reverse gap-2 medium:flex-row medium:justify-end">
								<Button type="button" variant="outline" onClick={() => setConfirmFetch(null)}>
									Cancel
								</Button>
								<Button
									type="button"
									variant="destructive"
									onClick={async () => {
										const action = confirmFetch;
										if (!action) return;
										setConfirmFetch(null);
										onOpenChange(false);
										try {
											const res = await fetch(action.url, {
												method: action.method,
												credentials: "include",
												headers: { "Content-Type": "application/json" },
											});
											if (!res.ok) {
												toast.error(await adminHttpErrorMessage(res, "Action failed"));
											}
										} catch {
											toast.error("Network error");
										}
									}}
								>
									{confirmFetch.confirmLabel}
								</Button>
							</div>
						</>
					:	null}
				</DialogContent>
			</Dialog>
		</>
	);
}

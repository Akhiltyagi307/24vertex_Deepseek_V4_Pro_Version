"use client";

import Link from "next/link";
import { BookOpen, Loader2, MoreHorizontal, PlusIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	groupConversationsByRecency,
	parseDoubtChatListLabel,
} from "@/lib/doubt/doubt-conversation-list";
import type { DoubtChatConversationRow } from "@/lib/doubt/loaders";
import { cn } from "@/lib/utils";

export type ConversationSidebarLayout = "stacked" | "rail" | "drawer";

export type ConversationSidebarProps = {
	conversations: DoubtChatConversationRow[];
	activeConversationId: string | null;
	deletingId: string | null;
	showPicker: boolean;
	onConfirmDelete: (id: string) => void;
	/**
	 * `stacked`: legacy capped-height strip (tests / rare use).
	 * `rail`: fixed left column for `medium+` only (parent should `hidden medium:flex`).
	 * `drawer`: full-height body inside a `Sheet` on small screens.
	 */
	layout?: ConversationSidebarLayout;
};

export function ConversationSidebar({
	conversations,
	activeConversationId,
	deletingId,
	showPicker,
	onConfirmDelete,
	layout = "stacked",
}: ConversationSidebarProps) {
	const groupedConversations = groupConversationsByRecency(conversations);

	const shellClass =
		layout === "rail"
			? cn(
					"flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden self-stretch border-r",
					"border-zinc-200/90 bg-emerald-50/35 text-sidebar-foreground",
					"dark:border-sidebar-border dark:bg-sidebar",
				)
			: layout === "drawer"
				? cn(
						"flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden",
						"border-0 bg-emerald-50/35 text-sidebar-foreground",
						"dark:bg-sidebar",
					)
				: cn(
						"flex max-h-[min(40vh,240px)] w-full shrink-0 flex-col overflow-hidden border-b",
						"border-zinc-200/90 bg-emerald-50/35 text-sidebar-foreground",
						"dark:border-sidebar-border dark:bg-sidebar dark:border-b",
						"medium:h-full medium:max-h-none medium:min-h-0 medium:w-72 medium:self-stretch medium:border-r medium:border-b-0",
					);

	return (
		<aside className={shellClass}>
			<div
				className={cn(
					"shrink-0 border-b px-3 py-3",
					"border-zinc-200/90 dark:border-sidebar-border",
				)}
			>
				<Button
					variant="default"
					size="lg"
					className={cn(
						"h-9 w-full justify-start gap-2 font-semibold",
						"bg-emerald-500 text-white shadow-md shadow-emerald-600/25 ring-1 ring-white/30",
						"hover:bg-emerald-400 hover:brightness-100",
						"focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
						"dark:shadow-sm dark:ring-0",
						"dark:bg-emerald-500 dark:hover:bg-emerald-500/90 dark:focus-visible:ring-white/30 dark:focus-visible:ring-offset-0",
						showPicker &&
							"pointer-events-auto cursor-default bg-emerald-600/88 shadow-none ring-emerald-800/25 hover:bg-emerald-600/88 dark:opacity-55 dark:shadow-sm dark:ring-0 dark:hover:opacity-55",
					)}
					aria-current={showPicker ? "page" : undefined}
					render={<Link href="/student/doubt-chat" />}
				>
					<PlusIcon className="size-3.5 shrink-0 text-white" aria-hidden />
					New chat
				</Button>
			</div>
			<div
				className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2"
				aria-label="Past conversations"
			>
				{conversations.length === 0 ? (
					<div
						className={cn(
							"text-muted-foreground flex items-start gap-2.5 rounded-lg border border-dashed px-3 py-3 text-[13px] leading-snug",
							"border-emerald-200/80 bg-white/50 dark:border-sidebar-border/80 dark:bg-transparent",
						)}
					>
						<BookOpen
							className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-primary/55"
							strokeWidth={1.75}
							aria-hidden
						/>
						<p>No chats yet. Start one from a topic to see it here.</p>
					</div>
				) : null}
				{groupedConversations.map((group) => (
					<div key={group.label} className="mb-3 last:mb-0">
						<div
							className={cn(
								"px-2 pt-0.5 pb-2 text-[10px] font-semibold tracking-[0.12em] uppercase",
								"text-emerald-900/50 dark:text-muted-foreground/90",
							)}
						>
							{group.label}
						</div>
						<div className="space-y-1">
							{group.rows.map((row) => {
								const { headline, subjectMeta } = parseDoubtChatListLabel(row);
								const active = activeConversationId === row.id;
								const isDeleting = deletingId === row.id;
								return (
									<div
										key={row.id}
										className={cn(
											"group/card border-sidebar-border/60 flex w-full min-w-0 items-stretch overflow-hidden rounded-lg border transition-[background-color,border-color,opacity] duration-150",
											"hover:border-zinc-300/80 hover:bg-white/80",
											"dark:border-sidebar-border/60 dark:hover:border-border/50 dark:hover:bg-sidebar-accent/80",
											active && [
												"border-emerald-500/35 bg-white/90",
												"dark:border-primary/25 dark:bg-primary/[0.08]",
											],
											!active && "border-transparent",
											isDeleting && "pointer-events-none opacity-50",
										)}
									>
										<Link
											href={`/student/doubt-chat?c=${row.id}`}
											className={cn(
												"relative min-w-0 flex-1 px-2.5 py-2.5 pr-1 text-left transition-[background-color] duration-150",
												"focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none",
												"dark:focus-visible:ring-sidebar-ring/45",
											)}
										>
											<div className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-foreground">
												{headline}
											</div>
											{subjectMeta ? (
												<div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-zinc-600 dark:text-muted-foreground">
													<BookOpen
														className="size-3 shrink-0 text-emerald-600 dark:text-primary/55"
														strokeWidth={2}
														aria-hidden
													/>
													<span className="line-clamp-1">{subjectMeta}</span>
												</div>
											) : null}
										</Link>
										<DropdownMenu>
											<DropdownMenuTrigger
												aria-label="Chat options"
												render={
													<Button
														type="button"
														variant="ghost"
														size="icon-sm"
														className={cn(
															"text-muted-foreground hover:text-foreground h-8 w-8 shrink-0 self-start rounded-md",
															"opacity-60 group-hover/card:opacity-100 data-[popup-open]:opacity-100",
														)}
														disabled={isDeleting}
													>
														{isDeleting ? (
															<Loader2 className="size-3.5 animate-spin" aria-hidden />
														) : (
															<MoreHorizontal className="size-4" aria-hidden />
														)}
													</Button>
												}
											/>
											<DropdownMenuContent
												align="end"
												side="bottom"
												sideOffset={4}
												className="min-w-40 p-1"
											>
												<DropdownMenuItem
													variant="destructive"
													className="cursor-pointer gap-2"
													onClick={() => onConfirmDelete(row.id)}
												>
													<Trash2 className="size-3.5" aria-hidden />
													Delete chat
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</aside>
	);
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { UIMessage } from "ai";
import { BookOpen } from "lucide-react";

import { TutorMarkdown } from "@/components/student/doubt/tutor-markdown";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import type { DoubtConversationListRow } from "@/lib/doubt/doubt-conversation-list";
import { groupConversationsByRecency, parseDoubtChatListLabel } from "@/lib/doubt/doubt-conversation-list";
import { cn } from "@/lib/utils";

type Props = {
	conversations: DoubtConversationListRow[];
	initialConversationId: string | null;
	initialMessages: UIMessage[];
	subjectsLoadError: string | null;
};

function messageText(m: UIMessage): string {
	const part = m.parts?.find((p) => p.type === "text");
	if (part && part.type === "text" && "text" in part) {
		return String(part.text ?? "");
	}
	return "";
}

export function ParentDoubtHistoryView({
	conversations,
	initialConversationId,
	initialMessages,
	subjectsLoadError,
}: Props) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const activeId =
		(typeof searchParams.get("c") === "string" ? searchParams.get("c") : null) ??
		initialConversationId;

	const conversationHref = React.useCallback(
		(id: string | null) => {
			const next = new URLSearchParams(searchParams.toString());
			if (id) next.set("c", id);
			else next.delete("c");
			const qs = next.toString();
			return qs ? `${pathname}?${qs}` : pathname;
		},
		[pathname, searchParams],
	);

	const groupedConversations = React.useMemo(
		() => groupConversationsByRecency(conversations),
		[conversations],
	);

	return (
		<div className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden md:flex-row">
			<aside
				className={cn(
					"flex max-h-[min(40vh,240px)] w-full shrink-0 flex-col overflow-hidden border-b",
					"border-zinc-200/90 bg-emerald-50/35 text-sidebar-foreground",
					"dark:border-sidebar-border dark:bg-sidebar dark:border-b",
					"md:max-h-none md:min-h-0 md:w-72 md:self-stretch md:border-r md:border-b-0",
				)}
			>
				<div
					className={cn(
						"shrink-0 border-b px-3 py-3",
						"border-zinc-200/90 dark:border-sidebar-border",
					)}
				>
					<p className="font-medium text-sm">Learning chats</p>
					<p className="text-muted-foreground text-xs">Read-only — your child starts chats</p>
				</div>
				<div
					className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 py-2"
					aria-label="Past conversations"
				>
					{subjectsLoadError ? (
						<p className="text-destructive text-xs px-2 py-2">{subjectsLoadError}</p>
					) : null}
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
							<p>No tutor chats yet.</p>
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
									const active = activeId === row.id;
									return (
										<div
											key={row.id}
											className={cn(
												"group/card border-sidebar-border/60 flex w-full min-w-0 items-stretch overflow-hidden rounded-lg border transition-[background-color,border-color,opacity] duration-150",
												"hover:border-zinc-300/80 hover:bg-white/80",
												"dark:border-sidebar-border/60 dark:hover:border-border/50 dark:hover:bg-sidebar-accent/80",
												active && [
													"border-emerald-400/70 bg-white shadow-sm shadow-emerald-600/5 ring-1 ring-emerald-500/20",
													"dark:border-primary/30 dark:bg-primary/10 dark:shadow-none dark:ring-0",
												],
												!active && "border-transparent",
											)}
										>
											<Link
												href={conversationHref(row.id)}
												scroll={false}
												className={cn(
													"relative min-w-0 flex-1 px-2.5 py-2.5 text-left transition-[background-color] duration-150",
													"focus-visible:ring-2 focus-visible:ring-emerald-500/30 focus-visible:outline-none",
													"dark:focus-visible:ring-sidebar-ring/45",
												)}
											>
												{active ? (
													<span
														aria-hidden
														className={cn(
															"absolute inset-y-2 left-0 w-0.5 rounded-full bg-emerald-500",
															"dark:bg-primary",
														)}
													/>
												) : null}
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
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</aside>
			<section className="flex min-h-0 min-w-0 flex-1 flex-col">
				<header className="shrink-0 border-b px-4 py-3">
					<h1 className="font-semibold text-lg tracking-tight">Learning chats</h1>
					<PageHeaderSubtext>
						Read your child&apos;s past conversations with the tutor for context on what they&apos;re asking
						about. New chats can only be started from the student app.
					</PageHeaderSubtext>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto p-4">
					{!activeId ? (
						<p className="text-muted-foreground text-sm">Pick a conversation to read the transcript.</p>
					) : initialMessages.length === 0 ? (
						<p className="text-muted-foreground text-sm">No messages in this thread.</p>
					) : (
						<div className="flex w-full min-w-0 flex-col gap-4">
							{initialMessages.map((m) => {
								const isUser = m.role === "user";
								return (
									<div
										key={m.id}
										className={cn("flex", isUser ? "justify-end" : "justify-start")}
									>
										<div
											className={cn(
												"max-w-[min(100%,36rem)] rounded-2xl border px-4 py-3 text-sm leading-relaxed",
												isUser
													? "border-primary/25 bg-primary/10"
													: "border-border bg-card",
											)}
										>
											{isUser ? (
												<p className="whitespace-pre-wrap">{messageText(m)}</p>
											) : (
												<TutorMarkdown>{messageText(m)}</TutorMarkdown>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</section>
		</div>
	);
}

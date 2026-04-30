"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { UIMessage } from "ai";
import { MessageCircleIcon } from "lucide-react";

import { TutorMarkdown } from "@/components/student/doubt/tutor-markdown";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { Button } from "@/components/ui/button";
import { cardSurfaceFrameClassName } from "@/components/ui/card";
import type { DoubtChatConversationRow } from "@/lib/doubt/loaders";
import { cn } from "@/lib/utils";

type Props = {
	conversations: DoubtChatConversationRow[];
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

	return (
		<div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
			<aside
				className={cn(
					cardSurfaceFrameClassName,
					"flex w-[min(100%,18rem)] shrink-0 flex-col border-e bg-muted/15",
				)}
			>
				<div className="shrink-0 border-b px-3 py-3">
					<p className="font-medium text-sm">Learning chats</p>
					<p className="text-muted-foreground text-xs">Read-only — your child starts chats</p>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto p-2">
					{subjectsLoadError ? (
						<p className="text-destructive text-xs px-2 py-2">{subjectsLoadError}</p>
					) : null}
					{conversations.length === 0 ? (
						<p className="text-muted-foreground text-sm px-2 py-3">No tutor chats yet.</p>
					) : (
						<ul className="flex flex-col gap-1">
							{conversations.map((c) => (
								<li key={c.id}>
									<Button
										type="button"
										variant={activeId === c.id ? "secondary" : "ghost"}
										className="h-auto w-full justify-start gap-2 py-2 whitespace-normal text-left"
										render={<Link href={conversationHref(c.id)} scroll={false} />}
									>
										<MessageCircleIcon className="size-4 shrink-0 opacity-70" aria-hidden />
										<span className="min-w-0">
											<span className="line-clamp-2 text-sm leading-snug">
												{c.title?.trim() || "Untitled"}
											</span>
											<span className="text-muted-foreground text-2xs block">{c.subjectName}</span>
										</span>
									</Button>
								</li>
							))}
						</ul>
					)}
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

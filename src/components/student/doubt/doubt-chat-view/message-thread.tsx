"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Sparkles } from "lucide-react";

import { usePaywall } from "@/components/student/subscription/paywall-dialog";
import { getDoubtUsageSummaryAction } from "@/lib/doubt/doubt-actions";
import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import { cn } from "@/lib/utils";

import { TutorMarkdown } from "../tutor-markdown";
import { ChatComposer } from "./chat-composer";
import { EmptyState } from "./empty-state";
import { MessageActions, TypingIndicator } from "./message-actions";
import { extractText, type DoubtChatThreadProps, type UsageSummary } from "./types";

export function MessageThread({
	conversationId,
	subjectId,
	topicId,
	subjectName,
	topicName,
	chapterName,
	initialMessages,
	initialUsage,
	initialTutorMode,
}: DoubtChatThreadProps) {
	const router = useRouter();
	const [input, setInput] = useState("");
	const [tutorMode, setTutorMode] = useState<DoubtTutorMode>(initialTutorMode ?? "explain");
	const [usage, setUsage] = useState<UsageSummary>(initialUsage);
	const [showScrollDown, setShowScrollDown] = useState(false);
	const paywall = usePaywall();

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/student/doubt-chat",
				credentials: "same-origin",
				body: () => ({
					subjectId,
					topicId,
					conversationId,
					tutorMode,
				}),
			}),
		[subjectId, topicId, conversationId, tutorMode],
	);

	const { messages, sendMessage, status, error, stop } = useChat({
		id: `doubt-${conversationId}`,
		messages: initialMessages,
		transport,
		onError: (err) => {
			const raw = err instanceof Error ? err.message : "";
			try {
				const parsed = JSON.parse(raw) as { paywall?: boolean; code?: string; error?: string };
				if (parsed.paywall) {
					const reason: "quota_tokens" | "trial_expired" | "expired" =
						parsed.code === "quota_tokens"
							? "quota_tokens"
							: parsed.code === "trial_expired"
								? "trial_expired"
								: "expired";
					paywall.show({ reason, message: parsed.error, surface: "doubt_chat" });
					return;
				}
			} catch {
				// fall through
			}
			console.error("doubt chat", err);
		},
		onFinish: () => {
			// fire-and-forget: useChat's onFinish expects `() => void`; reject inside this branch must not become an unhandled rejection
			void (async () => {
				try {
					const res = await getDoubtUsageSummaryAction({ conversationId });
					if (res.ok) {
						setUsage(res.summary);
					}
					router.refresh();
				} catch (err) {
					console.error("doubt chat onFinish", err);
				}
			})();
		},
	});

	const busy = status === "submitted" || status === "streaming";
	const thinking = status === "submitted";
	const streaming = status === "streaming";

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		const onScroll = () => {
			const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
			setShowScrollDown(distanceFromBottom > 180);
		};
		onScroll();
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		if (!showScrollDown) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages, showScrollDown]);

	const scrollToBottom = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
	}, []);

	const submit = useCallback(
		(text: string) => {
			const t = text.trim();
			if (!t || busy) return;
			setInput("");
			void sendMessage({ text: t });
		},
		[busy, sendMessage],
	);

	const onSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			submit(input);
		},
		[submit, input],
	);

	const placeholder =
		tutorMode === "solve_with_me"
			? topicName
				? `Work through a problem on ${topicName}…`
				: "Describe a problem to solve together…"
			: topicName
				? `Ask anything about ${topicName}…`
				: "Ask a question about this topic…";

	const empty = messages.length === 0;
	const lastAssistantIsStreaming =
		streaming &&
		messages.length > 0 &&
		messages[messages.length - 1]?.role === "assistant";

	return (
		<div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
			<header className="border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 shrink-0 border-b px-4 py-2.5 backdrop-blur medium:px-6">
				<div className="flex w-full min-w-0 items-center gap-3">
					<div
						aria-hidden
						className="border-emerald-500/30 bg-emerald-500/10 flex size-8 shrink-0 items-center justify-center rounded-lg border text-emerald-600 dark:text-emerald-400"
					>
						<Sparkles className="size-4" strokeWidth={2} />
					</div>
					<div className="min-w-0 flex-1">
						<h2 className="text-foreground truncate text-sm font-semibold tracking-tight">
							{topicName ?? "Topic tutor"}
						</h2>
						<p className="text-muted-foreground truncate text-[11.5px] leading-tight">
							{[subjectName, chapterName].filter(Boolean).join(" · ") ||
								"Topic-scoped tutor"}
						</p>
					</div>
					<span
						className={cn(
							"hidden shrink-0 items-center gap-1.5 rounded-full border bg-emerald-500/5 px-2 py-0.5 text-[10.5px] font-medium tracking-wide uppercase medium:inline-flex",
							"border-emerald-500/25 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300",
						)}
					>
						<span className="inline-block size-1.5 rounded-full bg-emerald-500" />
						Topic-scoped
					</span>
				</div>
			</header>

			<div className="relative min-h-0 flex-1">
				<div
					ref={scrollRef}
					className="min-h-0 h-full overflow-y-auto overscroll-y-contain"
					aria-label="Conversation messages"
					aria-live="polite"
					aria-atomic="false"
					aria-relevant="additions text"
				>
					<div className="flex w-full min-w-0 flex-col gap-6 px-4 py-6 medium:px-6 medium:py-8">
						{empty ? (
							<EmptyState
								topicName={topicName}
								onPick={(text) => {
									setInput(text);
									textareaRef.current?.focus();
								}}
							/>
						) : null}

						{messages.map((m) => {
							const text = extractText(m);
							if (m.role === "user") {
								return (
									<div
										key={m.id}
										className="group/msg flex w-full min-w-0 justify-end pl-10 medium:pl-16"
									>
										<div
											className={cn(
												"bg-muted/70 text-foreground border-border/50 max-w-[min(92%,34rem)] rounded-[16px] rounded-tr-[4px] border px-3.5 py-2 text-[14.5px] leading-relaxed",
												"shadow-[0_1px_0_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.04)]",
												"dark:border-zinc-700/60 dark:bg-zinc-800/70",
											)}
										>
											<p className="whitespace-pre-wrap [text-wrap:pretty]">{text}</p>
										</div>
									</div>
								);
							}
							return (
								<div
									key={m.id}
									className="group/msg flex w-full min-w-0 items-start gap-3 pr-2 medium:pr-6"
								>
									<div
										aria-hidden
										className="border-emerald-500/30 bg-emerald-500/10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-emerald-600 dark:text-emerald-400"
									>
										<Sparkles className="size-3.5" strokeWidth={2} />
									</div>
									<div className="min-w-0 flex-1">
										<TutorMarkdown>{text || ""}</TutorMarkdown>
										{!text && thinking ? <TypingIndicator /> : null}
										{text ? <MessageActions text={text} /> : null}
									</div>
								</div>
							);
						})}

						{thinking && !lastAssistantIsStreaming ? (
							<div className="flex w-full min-w-0 items-start gap-3 pr-2 medium:pr-6">
								<div
									aria-hidden
									className="border-emerald-500/30 bg-emerald-500/10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-emerald-600 dark:text-emerald-400"
								>
									<Sparkles className="size-3.5" strokeWidth={2} />
								</div>
								<div className="pt-1.5">
									<TypingIndicator />
								</div>
							</div>
						) : null}
					</div>
				</div>

				<div
					aria-hidden
					className="from-background pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t to-transparent"
				/>

				{showScrollDown ? (
					<button
						type="button"
						onClick={scrollToBottom}
						aria-label="Scroll to latest"
						className={cn(
							"border-border/70 bg-background text-foreground absolute right-4 bottom-3 inline-flex size-9 items-center justify-center rounded-full border shadow-md transition-colors",
							"hover:bg-muted",
							"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
						)}
					>
						<ArrowDown className="size-4" aria-hidden />
					</button>
				) : null}
			</div>

			<ChatComposer
				textareaRef={textareaRef}
				input={input}
				onInputChange={setInput}
				onSubmit={onSubmit}
				onStop={() => void stop()}
				busy={busy}
				placeholder={placeholder}
				tutorMode={tutorMode}
				onTutorModeChange={setTutorMode}
				usage={usage}
				error={error ?? null}
			/>
		</div>
	);
}

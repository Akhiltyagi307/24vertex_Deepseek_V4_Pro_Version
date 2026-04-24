"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { usePaywall } from "@/components/student/subscription/paywall-dialog";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
	ArrowDown,
	ArrowUp,
	BookMarked,
	BookOpen,
	Check,
	ChevronRight,
	Copy,
	FileText,
	Lightbulb,
	Loader2,
	Lock,
	MoreHorizontal,
	PlusIcon,
	Sparkles,
	Square,
	Trash2,
	X,
} from "lucide-react";
import { toast } from "sonner";

import {
	createDoubtConversation,
	deleteDoubtConversationAction,
	getDoubtTopicsForSubjectAction,
	getDoubtUsageSummaryAction,
} from "@/lib/doubt/doubt-actions";
import { chapterKeyFromRow, groupTopicRowsByChapter } from "@/lib/doubt/chapter-group";
import type { DoubtChatTopicRow, DoubtChatConversationRow } from "@/lib/doubt/loaders";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { TutorMarkdown } from "./tutor-markdown";

type Enrolled = { id: string; name: string; subject_group: string | null; sort_order: number };

type IconComponent = React.ComponentType<{
	className?: string;
	strokeWidth?: number;
	"aria-hidden"?: boolean;
}>;

function PickerField({
	icon: Icon,
	label,
	htmlFor,
	locked = false,
	children,
}: {
	icon: IconComponent;
	label: string;
	htmlFor: string;
	locked?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<label
				htmlFor={htmlFor}
				className={cn(
					"text-foreground/90 flex items-center gap-2 text-[12.5px] font-medium",
					locked && "text-muted-foreground/80",
				)}
			>
				<Icon
					className={cn(
						"text-muted-foreground size-3.5",
						!locked && "text-foreground/80",
					)}
					strokeWidth={1.75}
					aria-hidden
				/>
				<span>{label}</span>
				{locked ? (
					<Lock
						className="text-muted-foreground/60 ml-auto size-3"
						strokeWidth={2}
						aria-hidden
					/>
				) : null}
			</label>
			{children}
		</div>
	);
}

function ScopeSteps({
	done,
}: {
	done: { subject: boolean; chapter: boolean; topic: boolean };
}) {
	const items: Array<{ key: keyof typeof done; label: string }> = [
		{ key: "subject", label: "Subject" },
		{ key: "chapter", label: "Chapter" },
		{ key: "topic", label: "Topic" },
	];
	return (
		<div
			className="flex items-center gap-1.5 text-[11px]"
			aria-label="Scope progress"
		>
			{items.map((item, i) => {
				const isDone = done[item.key];
				const isCurrent =
					!isDone &&
					items.slice(0, i).every((prev) => done[prev.key]);
				return (
					<div key={item.key} className="flex items-center gap-1.5">
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] font-medium tabular-nums transition-colors",
								isDone && "text-emerald-700 dark:text-emerald-300",
								!isDone && isCurrent && "text-foreground",
								!isDone && !isCurrent && "text-muted-foreground/60",
							)}
						>
							<span
								aria-hidden
								className={cn(
									"inline-block size-1.5 rounded-full",
									isDone && "bg-emerald-500",
									!isDone && isCurrent && "bg-foreground/60",
									!isDone && !isCurrent && "bg-muted-foreground/40",
								)}
							/>
							{item.label}
						</span>
						{i < items.length - 1 ? (
							<span aria-hidden className="text-muted-foreground/40">
								/
							</span>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

type UsageSummary = {
	totalPromptTokens: number;
	totalCompletionTokens: number;
	lastPromptTokens: number | null;
	lastCompletionTokens: number | null;
};

type DoubtChatThreadProps = {
	conversationId: string;
	subjectId: string;
	topicId: string;
	subjectName: string | null;
	topicName: string | null;
	chapterName: string | null;
	initialMessages: UIMessage[];
	initialUsage: UsageSummary;
};

const SUGGESTED_PROMPTS = [
	"Give me a 3-line summary",
	"Explain the main idea in simple words",
	"Ask me 5 practice questions",
] as const;

function extractText(m: UIMessage): string {
	if (!m.parts) return "";
	return m.parts
		.map((p) => (p.type === "text" ? p.text : ""))
		.join("")
		.trim();
}

function MessageActions({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1400);
		} catch {
			// ignore — clipboard may be unavailable (e.g. insecure context)
		}
	}

	return (
		<div
			className={cn(
				"mt-1.5 flex items-center gap-1 transition-opacity duration-150",
				"opacity-0 focus-within:opacity-100 group-hover/msg:opacity-100",
				"motion-reduce:opacity-100 motion-reduce:transition-none",
			)}
		>
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							onClick={() => void onCopy()}
							aria-label={copied ? "Copied" : "Copy message"}
							className={cn(
								"text-muted-foreground hover:text-foreground hover:bg-muted/70 inline-flex size-7 items-center justify-center rounded-md",
								"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
							)}
						/>
					}
				>
					{copied ? (
						<Check className="size-3.5" aria-hidden />
					) : (
						<Copy className="size-3.5" aria-hidden />
					)}
				</TooltipTrigger>
				<TooltipContent>{copied ? "Copied" : "Copy"}</TooltipContent>
			</Tooltip>
		</div>
	);
}

function TypingIndicator() {
	return (
		<span
			className="text-muted-foreground inline-flex items-center gap-1 motion-reduce:hidden"
			aria-label="Tutor is thinking"
			role="status"
		>
			<span className="bg-muted-foreground/70 inline-block size-1.5 animate-pulse rounded-full [animation-delay:-240ms]" />
			<span className="bg-muted-foreground/70 inline-block size-1.5 animate-pulse rounded-full [animation-delay:-120ms]" />
			<span className="bg-muted-foreground/70 inline-block size-1.5 animate-pulse rounded-full" />
		</span>
	);
}

function EmptyState({
	topicName,
	onPick,
}: {
	topicName: string | null;
	onPick: (text: string) => void;
}) {
	return (
		<div className="flex flex-col items-start gap-4 pt-4 sm:pt-8">
			<div className="border-emerald-500/25 bg-emerald-500/10 flex size-10 items-center justify-center rounded-xl border text-emerald-600 dark:text-emerald-400">
				<Sparkles className="size-5" strokeWidth={1.75} aria-hidden />
			</div>
			<div className="max-w-xl space-y-1.5">
				<h3 className="text-foreground text-[17px] font-semibold tracking-tight">
					{topicName ? `Let's unpack ${topicName}` : "Let's unpack this topic together"}
				</h3>
				<p className="text-muted-foreground text-[14px] leading-relaxed [text-wrap:pretty]">
					Ask anything about this topic — concepts, worked examples, or practice
					questions. The tutor stays scoped to your curriculum for this chapter.
				</p>
			</div>
			<div className="flex flex-wrap gap-2">
				{SUGGESTED_PROMPTS.map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => onPick(p)}
						className={cn(
							"text-foreground/85 hover:text-foreground hover:bg-muted/70 border-border/70 bg-background rounded-full border px-3 py-1.5 text-[13px] transition-colors",
							"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
						)}
					>
						{p}
					</button>
				))}
			</div>
		</div>
	);
}

function DoubtChatThread({
	conversationId,
	subjectId,
	topicId,
	subjectName,
	topicName,
	chapterName,
	initialMessages,
	initialUsage,
}: DoubtChatThreadProps) {
	const router = useRouter();
	const [input, setInput] = useState("");
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
				}),
			}),
		[subjectId, topicId, conversationId],
	);

	const { messages, sendMessage, status, error, stop } = useChat({
		id: `doubt-${conversationId}`,
		messages: initialMessages,
		transport,
		onError: (err) => {
			// The AI SDK surfaces server 402 responses as an Error whose `message`
			// is the JSON body. Parse it and pop the paywall when present.
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
		onFinish: async () => {
			const res = await getDoubtUsageSummaryAction({ conversationId });
			if (res.ok) {
				setUsage(res.summary);
			}
			router.refresh();
		},
	});

	// Note: parent passes `key={conversationId}`, so the component remounts on
	// conversation change and `useState(initialUsage)` above re-initializes.

	const busy = status === "submitted" || status === "streaming";
	const thinking = status === "submitted";
	const streaming = status === "streaming";

	// Autoresize the composer up to ~10 lines.
	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
	}, [input]);

	// Track scroll position to toggle the "scroll to latest" button.
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

	// Auto-scroll on new messages or streamed tokens unless user scrolled up.
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		if (!showScrollDown) {
			el.scrollTop = el.scrollHeight;
		}
	}, [messages, showScrollDown]);

	function scrollToBottom() {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
	}

	function submit(text: string) {
		const t = text.trim();
		if (!t || busy) return;
		setInput("");
		void sendMessage({ text: t });
	}

	function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		submit(input);
	}

	function onComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key !== "Enter" || e.shiftKey) return;
		e.preventDefault();
		submit(input);
	}

	const placeholder = topicName
		? `Ask anything about ${topicName}…`
		: "Ask a question about this topic…";

	const empty = messages.length === 0;
	const lastAssistantIsStreaming =
		streaming &&
		messages.length > 0 &&
		messages[messages.length - 1]?.role === "assistant";

	return (
		<div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
			<header className="border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 shrink-0 border-b px-4 py-2.5 backdrop-blur sm:px-6">
				<div className="mx-auto flex w-full min-w-0 max-w-4xl items-center gap-3">
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
							"hidden shrink-0 items-center gap-1.5 rounded-full border bg-emerald-500/5 px-2 py-0.5 text-[10.5px] font-medium tracking-wide uppercase sm:inline-flex",
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
				>
					<div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
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
										className="group/msg flex w-full min-w-0 justify-end pl-10 sm:pl-16"
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
									className="group/msg flex w-full min-w-0 items-start gap-3 pr-2 sm:pr-6"
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
							<div className="flex w-full min-w-0 items-start gap-3 pr-2 sm:pr-6">
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

			<div className="shrink-0 px-4 pt-1 pb-4 sm:px-6">
				{error ? (
					<Alert variant="destructive" className="mx-auto mb-3 max-w-4xl rounded-xl">
						<AlertTitle>Something went wrong</AlertTitle>
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : null}

				<form onSubmit={onSubmit} className="mx-auto max-w-4xl">
					<div
						className={cn(
							"group/composer relative rounded-xl border shadow-sm transition-[border-color,box-shadow] duration-150",
							"border-border/70 bg-muted/40",
							"dark:border-zinc-600/50 dark:bg-zinc-900/55",
							"focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/15",
							"dark:focus-within:border-emerald-400/50 dark:focus-within:ring-emerald-400/10",
						)}
					>
						<label htmlFor="doubt-chat-composer" className="sr-only">
							Message to tutor
						</label>
						<textarea
							id="doubt-chat-composer"
							ref={textareaRef}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={onComposerKeyDown}
							placeholder={placeholder}
							disabled={busy}
							rows={1}
							data-gramm="false"
							data-gramm_editor="false"
							data-enable-grammarly="false"
							spellCheck
							className={cn(
								"block max-h-[200px] min-h-[52px] w-full resize-none bg-transparent py-3.5 pr-14 pl-4 text-[15px] leading-relaxed",
								"text-foreground placeholder:text-muted-foreground/75",
								"outline-none focus-visible:outline-none",
								"disabled:cursor-not-allowed disabled:opacity-60",
							)}
						/>

						<div className="absolute right-2 bottom-2 flex items-center gap-1.5">
							{busy ? (
								<Tooltip>
									<TooltipTrigger
										render={
											<button
												type="button"
												onClick={() => void stop()}
												aria-label="Stop response"
												className={cn(
													"border-border/70 bg-background text-foreground inline-flex size-9 items-center justify-center rounded-lg border transition-colors",
													"hover:bg-muted",
													"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
												)}
											/>
										}
									>
										<Square className="size-3.5 fill-current" aria-hidden />
									</TooltipTrigger>
									<TooltipContent>Stop</TooltipContent>
								</Tooltip>
							) : null}
							<Tooltip>
								<TooltipTrigger
									render={
										<button
											type="submit"
											aria-label="Send message"
											disabled={busy || !input.trim()}
											className={cn(
												"inline-flex size-9 items-center justify-center rounded-lg font-medium shadow-sm transition-[background-color,transform] duration-150",
												"bg-emerald-600 text-white hover:bg-emerald-600/90 active:scale-[0.97]",
												"disabled:pointer-events-none disabled:opacity-40",
												"focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none",
												"dark:bg-emerald-600 dark:hover:bg-emerald-600/90",
											)}
										/>
									}
								>
									{busy ? (
										<Loader2 className="size-4 animate-spin" aria-hidden />
									) : (
										<ArrowUp className="size-4" strokeWidth={2.5} aria-hidden />
									)}
								</TooltipTrigger>
								<TooltipContent>
									<span>
										<kbd
											data-slot="kbd"
											className="bg-background/15 mr-1 rounded px-1 py-px text-[10px] font-medium"
										>
											Enter
										</kbd>
										Send
									</span>
								</TooltipContent>
							</Tooltip>
						</div>
					</div>
				</form>

				<div className="text-muted-foreground/80 mx-auto mt-2 flex max-w-4xl items-center justify-between gap-3 px-1 text-[11px] leading-snug">
					<span className="truncate">
						Tutor can be wrong — double-check important facts.
					</span>
					<Tooltip>
						<TooltipTrigger
							render={
								<button
									type="button"
									className="hover:text-foreground flex shrink-0 cursor-help items-center gap-1 tabular-nums transition-colors focus-visible:outline-none"
								/>
							}
						>
							<span>
								{usage.lastPromptTokens != null ? usage.lastPromptTokens : "—"} in ·{" "}
								{usage.lastCompletionTokens != null ? usage.lastCompletionTokens : "—"} out
							</span>
						</TooltipTrigger>
						<TooltipContent>
							<span className="tabular-nums">
								Session: {usage.totalPromptTokens} in / {usage.totalCompletionTokens} out
							</span>
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</div>
	);
}

type ConversationGroup = { label: string; rows: DoubtChatConversationRow[] };

/** Titles are stored as "TopicName — Subject name" (see createDoubtConversation). Split for hierarchy in the list. */
function parseDoubtChatListLabel(row: DoubtChatConversationRow): {
	headline: string;
	subjectMeta: string | null;
} {
	const title = (row.title ?? "").trim();
	const subject = (row.subjectName ?? "").trim();

	if (!title) {
		return { headline: "Chat", subjectMeta: subject || null };
	}

	const parts = title.split(/\s[—–]\s/);
	if (parts.length >= 2) {
		const left = parts[0] ?? "";
		const right = parts.slice(1).join(" — ").trim();
		return {
			headline: left.trim() || title,
			subjectMeta: right || null,
		};
	}

	if (subject && !title.toLowerCase().includes(subject.toLowerCase())) {
		return { headline: title, subjectMeta: subject };
	}
	return { headline: title, subjectMeta: null };
}

function groupConversationsByRecency(
	rows: readonly DoubtChatConversationRow[],
): ConversationGroup[] {
	if (rows.length === 0) return [];
	const now = new Date();
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const oneDay = 86_400_000;
	const startOfYesterday = startOfToday - oneDay;
	const startOfLast7 = startOfToday - 6 * oneDay;
	const startOfLast30 = startOfToday - 29 * oneDay;

	const buckets: Record<string, DoubtChatConversationRow[]> = {
		Today: [],
		Yesterday: [],
		"Previous 7 days": [],
		"Previous 30 days": [],
		Older: [],
	};

	for (const row of rows) {
		const t = new Date(row.updatedAt).getTime();
		if (Number.isNaN(t)) {
			buckets.Older.push(row);
			continue;
		}
		if (t >= startOfToday) buckets.Today.push(row);
		else if (t >= startOfYesterday) buckets.Yesterday.push(row);
		else if (t >= startOfLast7) buckets["Previous 7 days"].push(row);
		else if (t >= startOfLast30) buckets["Previous 30 days"].push(row);
		else buckets.Older.push(row);
	}

	const order = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];
	return order
		.map((label) => ({ label, rows: buckets[label] }))
		.filter((g) => g.rows.length > 0);
}

export function DoubtChatView(props: {
	enrolledSubjects: Enrolled[];
	subjectsLoadError: string | null;
	conversations: DoubtChatConversationRow[];
	initialFromUrl: null | {
		conversation: {
			id: string;
			subjectId: string;
			topicId: string;
			title: string | null;
			subjectName: string | null;
			topicName: string | null;
			chapterName: string | null;
		};
		messages: UIMessage[];
		usage: UsageSummary;
	};
}) {
	const router = useRouter();
	const sp = useSearchParams();
	const c = sp.get("c");

	const [createError, setCreateError] = useState<string | null>(null);
	const [loadTopicsPending, setLoadTopicsPending] = useState(false);
	const [topicRows, setTopicRows] = useState<DoubtChatTopicRow[]>([]);
	const [subjectId, setSubjectId] = useState<string | null>(null);
	const [chapterKey, setChapterKey] = useState<string | null>(null);
	const [topicId, setTopicId] = useState<string | null>(null);
	const [startPending, setStartPending] = useState(false);

	const [conversations, setConversations] = useState(props.conversations);
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const deleteDialogTitleId = useId();
	const deleteDialogDescriptionId = useId();

	useEffect(() => {
		setConversations(props.conversations);
	}, [props.conversations]);

	const confirmDeleteRow = useMemo(() => {
		if (!confirmDeleteId) return null;
		return conversations.find((r) => r.id === confirmDeleteId) ?? null;
	}, [confirmDeleteId, conversations]);

	const performDeleteConversation = useCallback(
		async (id: string) => {
			setDeletingId(id);
			try {
				const res = await deleteDoubtConversationAction({ conversationId: id });
				if (!res.ok) {
					toast.error(res.message);
					return;
				}
				setConversations((prev) => prev.filter((r) => r.id !== id));
				setConfirmDeleteId(null);
				if (c === id) {
					router.push("/student/doubt-chat");
				}
				router.refresh();
				toast.success("Chat deleted");
			} finally {
				setDeletingId(null);
			}
		},
		[c, router],
	);

	const showThread =
		Boolean(c) && props.initialFromUrl != null && props.initialFromUrl.conversation.id === c;
	const showPicker = !c;
	const notFound = Boolean(c) && props.initialFromUrl == null;

	const chapters = useMemo(() => groupTopicRowsByChapter(topicRows), [topicRows]);

	const topicsInChapter = useMemo(() => {
		if (!chapterKey) return [] as DoubtChatTopicRow[];
		const g = chapters.find((x) => x.key === chapterKey);
		return g?.topics ?? [];
	}, [chapters, chapterKey]);

	const loadTopics = useCallback(async (sid: string) => {
		setLoadTopicsPending(true);
		setCreateError(null);
		try {
			const res = await getDoubtTopicsForSubjectAction({ subjectId: sid });
			if (res.ok) {
				setTopicRows(res.topics);
			} else {
				setCreateError(res.message);
				setTopicRows([]);
			}
		} finally {
			setLoadTopicsPending(false);
		}
	}, []);

	useEffect(() => {
		if (!subjectId) {
			setTopicRows([]);
			setChapterKey(null);
			setTopicId(null);
			return;
		}
		if (showPicker) {
			void loadTopics(subjectId);
		}
	}, [subjectId, loadTopics, showPicker]);

	useEffect(() => {
		if (!showPicker) {
			return;
		}
		if (topicRows.length === 0) {
			setChapterKey(null);
			setTopicId(null);
			return;
		}
		if (!chapterKey) {
			const first = topicRows[0];
			setChapterKey(chapterKeyFromRow(first));
		}
	}, [topicRows, chapterKey, showPicker]);

	useEffect(() => {
		if (!showPicker) {
			return;
		}
		if (topicsInChapter.length === 0) {
			setTopicId(null);
			return;
		}
		const stillIn = topicId && topicsInChapter.some((t) => t.id === topicId);
		if (!stillIn) {
			setTopicId(topicsInChapter[0].id);
		}
	}, [topicsInChapter, topicId, showPicker]);

	async function onStartChat() {
		if (!subjectId || !topicId) {
			setCreateError("Select a subject, chapter, and topic first.");
			return;
		}
		setStartPending(true);
		setCreateError(null);
		try {
			const res = await createDoubtConversation({ subjectId, topicId });
			if (!res.ok) {
				setCreateError(res.message);
				return;
			}
			router.push(`/student/doubt-chat?c=${res.conversationId}`);
		} finally {
			setStartPending(false);
		}
	}

	const sortedSubjects = useMemo(() => {
		return [...props.enrolledSubjects].sort((a, b) => {
			const ga = a.subject_group ?? "\uffff";
			const gb = b.subject_group ?? "\uffff";
			if (ga !== gb) return ga.localeCompare(gb);
			if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
			return a.name.localeCompare(b.name);
		});
	}, [props.enrolledSubjects]);

	const groupedConversations = useMemo(
		() => groupConversationsByRecency(conversations),
		[conversations],
	);

	const deleteInProgress = confirmDeleteId != null && deletingId === confirmDeleteId;
	const deleteHeadline = confirmDeleteRow
		? parseDoubtChatListLabel(confirmDeleteRow).headline
		: "this chat";

	return (
		<>
		<div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden md:flex-row">
			<aside
				className={cn(
					"flex max-h-[min(40vh,240px)] w-full shrink-0 flex-col overflow-hidden border-b",
					"border-zinc-200/90 bg-emerald-50/35 text-sidebar-foreground",
					"dark:border-sidebar-border dark:bg-sidebar dark:border-b",
					"md:h-full md:max-h-none md:min-h-0 md:w-72 md:border-r md:border-b-0",
				)}
			>
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
							// Light: saturated green + depth (theme primary in light is very pale elsewhere)
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
									const active = c === row.id;
									const isDeleting = deletingId === row.id;
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
																<Loader2
																	className="size-3.5 animate-spin"
																	aria-hidden
																/>
															) : (
																<MoreHorizontal
																	className="size-4"
																	aria-hidden
																/>
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
														onClick={() => setConfirmDeleteId(row.id)}
													>
														<Trash2
															className="size-3.5"
															aria-hidden
														/>
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

			<div
				className={cn(
					"flex min-h-0 min-w-0 flex-1 flex-col",
					showPicker ? "overflow-y-auto overscroll-contain" : "overflow-hidden",
				)}
			>
				{props.subjectsLoadError ? (
					<Alert variant="destructive" className="m-4 shrink-0">
						<AlertTitle>Subjects</AlertTitle>
						<AlertDescription>{props.subjectsLoadError}</AlertDescription>
					</Alert>
				) : null}

				{notFound ? (
					<Alert variant="destructive" className="m-4 shrink-0">
						<AlertTitle>Chat not found</AlertTitle>
						<AlertDescription>
							This link may be invalid, or the chat is no longer available.{" "}
							<Link href="/student/doubt-chat" className="text-primary font-medium underline">
								Start a new chat
							</Link>
							.
						</AlertDescription>
					</Alert>
				) : null}

				{showPicker && (
					<div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-10 sm:py-14">
						<div className="flex w-full max-w-xl flex-col gap-6">
							{/* Hero */}
							<div className="flex flex-col items-start gap-3">
								<div
									aria-hidden
									className="border-emerald-500/25 bg-emerald-500/10 flex size-10 items-center justify-center rounded-xl border text-emerald-600 dark:text-emerald-400"
								>
									<Sparkles className="size-5" strokeWidth={1.75} />
								</div>
								<div className="space-y-1.5">
									<h1 className="text-foreground text-[22px] font-semibold tracking-tight sm:text-[24px]">
										Start a new chat
									</h1>
									<p className="text-muted-foreground text-[14.5px] leading-relaxed [text-wrap:pretty]">
										Pick a topic and the tutor stays scoped to that chapter of your
										curriculum. Ask for summaries, worked examples, or practice
										questions.
									</p>
								</div>
							</div>

							{/* Scope card */}
							<div
								className={cn(
									"border-border/70 bg-card/40 rounded-xl border shadow-sm",
									"divide-border/60 divide-y",
								)}
							>
								<div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
									<p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
										Scope
									</p>
									<ScopeSteps
										done={{
											subject: Boolean(subjectId),
											chapter: Boolean(chapterKey),
											topic: Boolean(topicId),
										}}
									/>
								</div>

								<div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
									<PickerField
										icon={BookOpen}
										label="Subject"
										htmlFor="doubt-subject"
									>
										<Select
											id="doubt-subject"
											value={subjectId}
											onValueChange={(v) => {
												setSubjectId(v ?? null);
												setChapterKey(null);
												setTopicId(null);
											}}
										>
											<SelectTrigger aria-label="Subject">
												<SelectValue placeholder="Pick a subject…">
													{(v) =>
														v == null
															? "Pick a subject…"
															: (sortedSubjects.find((s) => s.id === v)?.name ??
																"Pick a subject…")
													}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{sortedSubjects.map((s) => (
													<SelectItem key={s.id} value={s.id}>
														{s.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</PickerField>

									<PickerField
										icon={BookMarked}
										label="Chapter"
										htmlFor="doubt-chapter"
										locked={!subjectId || loadTopicsPending}
									>
										<Select
											id="doubt-chapter"
											value={chapterKey}
											onValueChange={(v) => setChapterKey(v ?? null)}
											disabled={
												!subjectId || loadTopicsPending || chapters.length === 0
											}
										>
											<SelectTrigger aria-label="Chapter">
												{(() => {
													const chapterPlaceholder = !subjectId
														? "Pick a subject first"
														: loadTopicsPending
															? "Loading chapters…"
															: chapters.length === 0
																? "No chapters available"
																: "Pick a chapter…";
													return (
														<SelectValue placeholder={chapterPlaceholder}>
															{(v) =>
																v == null
																	? chapterPlaceholder
																	: (chapters.find((ch) => ch.key === v)?.label ??
																		chapterPlaceholder)
															}
														</SelectValue>
													);
												})()}
											</SelectTrigger>
											<SelectContent>
												{chapters.map((ch) => (
													<SelectItem key={ch.key} value={ch.key}>
														<span className="truncate">
															<span className="text-foreground">{ch.label}</span>
															<span className="text-muted-foreground">
																{" "}
																— {ch.topics[0]?.unitName}
															</span>
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</PickerField>

									<PickerField
										icon={FileText}
										label="Topic"
										htmlFor="doubt-topic"
										locked={!chapterKey || loadTopicsPending}
									>
										<Select
											id="doubt-topic"
											value={topicId}
											onValueChange={(v) => setTopicId(v ?? null)}
											disabled={
												!chapterKey ||
												loadTopicsPending ||
												topicsInChapter.length === 0
											}
										>
											<SelectTrigger aria-label="Topic">
												{(() => {
													const topicPlaceholder = !chapterKey
														? "Pick a chapter first"
														: loadTopicsPending
															? "Loading topics…"
															: topicsInChapter.length === 0
																? "No topics in this chapter"
																: "Pick a topic…";
													return (
														<SelectValue placeholder={topicPlaceholder}>
															{(v) =>
																v == null
																	? topicPlaceholder
																	: (topicsInChapter.find((t) => t.id === v)
																			?.topicName ?? topicPlaceholder)
															}
														</SelectValue>
													);
												})()}
											</SelectTrigger>
											<SelectContent>
												{topicsInChapter.map((t) => (
													<SelectItem key={t.id} value={t.id}>
														{t.topicName}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</PickerField>

									{createError ? (
										<Alert variant="destructive" className="rounded-lg">
											<AlertDescription>{createError}</AlertDescription>
										</Alert>
									) : null}
								</div>

								<div className="flex flex-col-reverse items-stretch gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
									<p className="text-muted-foreground text-[12px] leading-snug">
										The tutor only answers within this topic.
									</p>
									<Button
										type="button"
										size="lg"
										className="h-10 gap-1.5 px-4 font-medium shadow-sm sm:w-auto"
										onClick={() => void onStartChat()}
										disabled={!subjectId || !topicId || startPending}
									>
										{startPending ? (
											<>
												<Loader2 className="size-4 animate-spin" aria-hidden />
												Starting…
											</>
										) : (
											<>
												Start chat
												<ChevronRight
													className="size-4"
													strokeWidth={2.25}
													aria-hidden
												/>
											</>
										)}
									</Button>
								</div>
							</div>

							{/* Tips — no identical-card-grid, just a single tip block */}
							<div className="border-border/50 bg-muted/20 flex items-start gap-3 rounded-lg border p-3.5">
								<Lightbulb
									className="text-muted-foreground/80 mt-0.5 size-4 shrink-0"
									strokeWidth={1.75}
									aria-hidden
								/>
								<div className="text-muted-foreground text-[12.5px] leading-relaxed">
									<span className="text-foreground font-medium">Good prompts are specific.</span>{" "}
									Try <span className="text-foreground">“Summarise in 3 lines,”</span>{" "}
									<span className="text-foreground">“Explain the main theme,”</span> or{" "}
									<span className="text-foreground">“Give me 5 practice questions.”</span>
								</div>
							</div>
						</div>
					</div>
				)}

				{showThread && props.initialFromUrl ? (
					<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
						<DoubtChatThread
							key={props.initialFromUrl.conversation.id}
							conversationId={props.initialFromUrl.conversation.id}
							subjectId={props.initialFromUrl.conversation.subjectId}
							topicId={props.initialFromUrl.conversation.topicId}
							subjectName={props.initialFromUrl.conversation.subjectName}
							topicName={props.initialFromUrl.conversation.topicName}
							chapterName={props.initialFromUrl.conversation.chapterName}
							initialMessages={props.initialFromUrl.messages}
							initialUsage={props.initialFromUrl.usage}
						/>
					</div>
				) : null}
			</div>
		</div>

		<Dialog.Root
			open={confirmDeleteId != null}
			onOpenChange={(open) => {
				if (!open) {
					if (deleteInProgress) return;
					setConfirmDeleteId(null);
				}
			}}
		>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={cn(
						"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				/>
				<Dialog.Popup
					aria-labelledby={deleteDialogTitleId}
					aria-describedby={deleteDialogDescriptionId}
					className={cn(
						"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-xl",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-3 right-3"
						onClick={() => setConfirmDeleteId(null)}
						disabled={deleteInProgress}
						aria-label="Close"
					>
						<X className="size-4" />
					</Button>
					<div className="flex flex-col gap-2 pe-8">
						<Dialog.Title
							id={deleteDialogTitleId}
							className="font-heading text-lg font-semibold tracking-tight sm:text-xl"
						>
							Delete this chat?
						</Dialog.Title>
						<Dialog.Description
							id={deleteDialogDescriptionId}
							className="text-muted-foreground text-sm [text-wrap:pretty]"
						>
							<span className="text-foreground font-medium">{deleteHeadline}</span> and its messages
							will be removed from your account. This cannot be undone.
						</Dialog.Description>
					</div>
					<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							type="button"
							variant="outline"
							onClick={() => setConfirmDeleteId(null)}
							disabled={deleteInProgress}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							className="gap-1.5"
							onClick={() => {
								if (confirmDeleteId) void performDeleteConversation(confirmDeleteId);
							}}
							disabled={deleteInProgress || !confirmDeleteId}
						>
							{deleteInProgress ? (
								<>
									<Loader2 className="size-4 animate-spin" aria-hidden />
									Deleting…
								</>
							) : (
								<>
									<Trash2 className="size-3.5" aria-hidden />
									Delete chat
								</>
							)}
						</Button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
		</>
	);
}

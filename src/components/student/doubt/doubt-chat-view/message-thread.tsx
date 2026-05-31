"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, FileText, Image as ImageIcon, PanelLeft, Sparkles } from "lucide-react";

import { usePaywall } from "@/components/student/subscription/paywall-dialog";
import {
	getDoubtEntitlementSummaryAction,
	getDoubtUsageSummaryAction,
	regenerateLastAssistantAction,
} from "@/lib/doubt/doubt-actions";
import type { AttachmentRow } from "@/lib/doubt/attachments/types";
import { captureDoubtChatError } from "@/lib/doubt/capture-doubt-chat-error";
import type { DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { TutorMarkdown } from "../tutor-markdown";
import { ChatComposer } from "./chat-composer";
import { EmptyState } from "./empty-state";
import { MessageActions, TypingIndicator } from "./message-actions";
import {
	extractText,
	type DoubtChatThreadProps,
	type EntitlementSummary,
	type UsageSummary,
} from "./types";

function formatAttachmentSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageThread({
	conversationId,
	subjectId,
	topicId,
	subjectName,
	topicName,
	chapterName,
	initialMessages,
	initialMessageAttachments,
	initialUsage,
	initialTutorMode,
	initialEntitlement,
	onOpenChats,
}: DoubtChatThreadProps) {
	const router = useRouter();
	const [input, setInput] = useState("");
	const [tutorMode, setTutorMode] = useState<DoubtTutorMode>(initialTutorMode ?? "explain");
	// "Mode-just-changed" UI signal — set when the user toggles the composer
	// to a different mode than the last actually-sent turn used, cleared after
	// the next message is sent. Purely visual; the server-side handoff goes
	// through `previousTutorMode` in the request body.
	const [pendingModeSwitch, setPendingModeSwitch] = useState<{
		from: DoubtTutorMode;
		to: DoubtTutorMode;
	} | null>(null);
	const [usage, setUsage] = useState<UsageSummary>(initialUsage);
	const [entitlement, setEntitlement] = useState<EntitlementSummary>(initialEntitlement);
	const [regenPending, setRegenPending] = useState(false);
	const [pendingAttachments, setPendingAttachments] = useState<AttachmentRow[]>([]);
	const [messageAttachmentsById, setMessageAttachmentsById] = useState(initialMessageAttachments);
	const [optimisticLatestUserAttachments, setOptimisticLatestUserAttachments] = useState<
		AttachmentRow[] | null
	>(null);
	const [showScrollDown, setShowScrollDown] = useState(false);
	const paywall = usePaywall();

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const nextRequestAttachmentIdsRef = useRef<string[] | null>(null);

	// Tracks the mode the last actually-sent turn was tagged with. When the
	// user toggles the mode selector mid-chat this stays at the *old* mode
	// until the next message goes out; the request body then surfaces both
	// `tutorMode` (current) and `previousTutorMode` (this ref) so the server
	// can append a one-line ephemeral "mode just switched" note to the system
	// prompt for that turn. Initialised from the persisted last-user-message
	// mode so a reload doesn't false-positive-switch on first send.
	const lastSentModeRef = useRef<DoubtTutorMode>(initialTutorMode ?? "explain");

	// Latest pending attachments are read via a ref so the transport closure
	// doesn't re-create on every chip add/remove (which would tear down useChat).
	const pendingAttachmentsRef = useRef<AttachmentRow[]>(pendingAttachments);
	useEffect(() => {
		pendingAttachmentsRef.current = pendingAttachments;
	}, [pendingAttachments]);

	useEffect(() => {
		setMessageAttachmentsById(initialMessageAttachments);
	}, [initialMessageAttachments]);

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/student/doubt-chat",
				credentials: "same-origin",
				body: () => {
					const attachmentIds = nextRequestAttachmentIdsRef.current ?? [];
					nextRequestAttachmentIdsRef.current = null;
					const previousMode = lastSentModeRef.current;
					// Bump the ref *here*, not in onFinish, because the server-side
					// system-prompt build happens at request time — once the request
					// goes out under `tutorMode`, future requests should treat that
					// as their predecessor regardless of whether this one succeeds.
					lastSentModeRef.current = tutorMode;
					return {
						subjectId,
						topicId,
						conversationId,
						tutorMode,
						attachmentIds,
						...(previousMode !== tutorMode ? { previousTutorMode: previousMode } : {}),
					};
				},
			}),
		[subjectId, topicId, conversationId, tutorMode],
	);

	const chat = useChat({
		id: `doubt-${conversationId}`,
		messages: initialMessages,
		transport,
		onError: (err) => {
			nextRequestAttachmentIdsRef.current = null;
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
				if (parsed.code === "off_topic") {
					toast.info(
						parsed.error ??
							"This looks like a different topic — try opening a new doubt chat on that topic.",
					);
					return;
				}
			} catch {
				// fall through
			}
			captureDoubtChatError("send", err, { conversationId });
		},
		onFinish: () => {
			// fire-and-forget: useChat's onFinish expects `() => void`; reject inside this branch must not become an unhandled rejection
			void (async () => {
				try {
					const [usageRes, entRes] = await Promise.all([
						getDoubtUsageSummaryAction({ conversationId }),
						getDoubtEntitlementSummaryAction(),
					]);
					if (usageRes.ok) {
						setUsage(usageRes.summary);
					}
					if (entRes.ok) {
						setEntitlement(entRes.entitlement);
					}
					router.refresh();
				} catch (err) {
					captureDoubtChatError("onFinish", err, { conversationId });
				}
			})();
		},
	});

	const { messages, sendMessage, status, error, stop, regenerate, setMessages } = chat;

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
			const attachmentSnapshot = [...pendingAttachmentsRef.current];
			nextRequestAttachmentIdsRef.current = attachmentSnapshot.map((a) => a.id);
			setOptimisticLatestUserAttachments(attachmentSnapshot.length > 0 ? attachmentSnapshot : null);
			setInput("");
			void sendMessage({ text: t });
			// Clear chips after the message goes — they're now bound to the row.
			setPendingAttachments([]);
			// The mode change has been carried out; clear the visual banner.
			setPendingModeSwitch(null);
		},
		[busy, sendMessage],
	);

	const onTutorModeChange = useCallback(
		(next: DoubtTutorMode) => {
			if (next === tutorMode) return;
			// Show the banner only when there's already history under the previous
			// mode — a brand-new chat doesn't need a "switched from" hint.
			const previousIsLive = lastSentModeRef.current;
			if (messages.length > 0 && next !== previousIsLive) {
				setPendingModeSwitch({ from: previousIsLive, to: next });
			} else {
				setPendingModeSwitch(null);
			}
			setTutorMode(next);
		},
		[tutorMode, messages.length],
	);

	const onRegenerate = useCallback(async () => {
		if (busy || regenPending) return;
		setRegenPending(true);
		try {
			const res = await regenerateLastAssistantAction({ conversationId });
			if (!res.ok) {
				toast.error(res.message);
				return;
			}
			// Optimistically drop any trailing assistant rows from the local
			// `messages` state so the UI matches the server before we re-stream.
			// Without this, the old (now stale) assistant bubble lingers until
			// the new stream replaces it.
			setMessages((prev) => {
				const out = [...prev];
				while (out.length > 0 && out[out.length - 1]!.role === "assistant") {
					out.pop();
				}
				return out;
			});
			// `regenerate` is part of the AI SDK v6 useChat return type — it
			// re-fetches the AI response for the current latest user message
			// without appending a new one.
			await regenerate();
		} catch (err) {
			captureDoubtChatError("regenerate", err, { conversationId });
			toast.error("Could not regenerate. Try again.");
		} finally {
			setRegenPending(false);
		}
	}, [busy, regenPending, conversationId, regenerate, setMessages]);

	const onSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			submit(input);
		},
		[submit, input],
	);

	const scopeNoun = topicName ?? chapterName ?? "this chapter";
	const placeholder =
		tutorMode === "solve_with_me"
			? `Work through a problem on ${scopeNoun}…`
			: tutorMode === "quiz_me"
				? `Say "quiz me" to start, or pick a focus on ${scopeNoun}…`
				: `Ask anything about ${scopeNoun}…`;

	const empty = messages.length === 0;
	const lastAssistantIsStreaming =
		streaming &&
		messages.length > 0 &&
		messages[messages.length - 1]?.role === "assistant";
	const latestUserMessageIndex = useMemo(() => {
		for (let i = messages.length - 1; i >= 0; i--) {
			if (messages[i]?.role === "user") return i;
		}
		return -1;
	}, [messages]);

	return (
		<div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
			<header className="border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 shrink-0 border-b px-4 py-2.5 backdrop-blur medium:px-6">
				<div className="flex w-full min-w-0 items-center gap-2 medium:gap-3">
					{onOpenChats ? (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="text-muted-foreground hover:text-foreground medium:hidden -ml-1 shrink-0"
							onClick={onOpenChats}
							aria-label="Past chats"
						>
							<PanelLeft className="size-4" aria-hidden />
						</Button>
					) : null}
					<div
						aria-hidden
						className="border-emerald-500/30 bg-emerald-500/10 flex size-8 shrink-0 items-center justify-center rounded-lg border text-emerald-600 dark:text-emerald-400"
					>
						<Sparkles className="size-4" strokeWidth={2} />
					</div>
					<div className="min-w-0 flex-1">
						<h2 className="text-foreground truncate text-sm font-semibold tracking-tight">
							{topicName ?? chapterName ?? "Doubt tutor"}
						</h2>
						<p className="text-muted-foreground truncate text-[11.5px] leading-tight">
							{[subjectName, topicName ? chapterName : null].filter(Boolean).join(" · ") ||
								(subjectName ?? "Syllabus-scoped tutor")}
						</p>
					</div>
					<span
						className={cn(
							"hidden shrink-0 items-center gap-1.5 rounded-full border bg-emerald-500/5 px-2 py-0.5 text-[10.5px] font-medium tracking-wide uppercase medium:inline-flex",
							"border-emerald-500/25 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300",
						)}
					>
						<span className="inline-block size-1.5 rounded-full bg-emerald-500" />
						{topicName ? "Topic-scoped" : "Chapter-scoped"}
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
								chapterName={chapterName}
								tutorMode={tutorMode}
								onPick={(text) => {
									setInput(text);
									textareaRef.current?.focus();
								}}
							/>
						) : null}

						{messages.map((m, idx) => {
							const text = extractText(m);
							if (m.role === "user") {
								const persistedAttachments =
									typeof m.id === "string" ? (messageAttachmentsById[m.id] ?? []) : [];
								const userAttachments =
									persistedAttachments.length > 0
										? persistedAttachments
										: optimisticLatestUserAttachments && idx === latestUserMessageIndex
											? optimisticLatestUserAttachments
											: [];
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
											{userAttachments.length > 0 ? (
												<div
													className="mb-2 flex flex-wrap gap-1.5"
													aria-label="Message attachments"
												>
													{userAttachments.map((attachment) => (
														<div
															key={attachment.id}
															className="inline-flex items-center gap-1.5 rounded-full border border-border/65 bg-background/55 px-2 py-1 text-[11.5px] text-foreground/85"
														>
															{attachment.kind === "image" ? (
																<ImageIcon className="size-3.5 text-emerald-600" aria-hidden />
															) : (
																<FileText className="size-3.5 text-emerald-600" aria-hidden />
															)}
															<span className="max-w-[11rem] truncate">
																{attachment.storagePath.split("/").at(-1) ?? "attachment"}
															</span>
															<span className="text-muted-foreground tabular-nums text-[10.5px]">
																{formatAttachmentSize(attachment.sizeBytes)}
															</span>
														</div>
													))}
												</div>
											) : null}
											<p className="whitespace-pre-wrap [text-wrap:pretty]">{text}</p>
										</div>
									</div>
								);
							}
							const isLastAssistant =
								idx === messages.length - 1 ||
								messages.slice(idx + 1).every((later) => later.role !== "assistant");
							const canRegenerate =
								isLastAssistant && !busy && !regenPending && Boolean(text);
							// "Similar problem" affordance: only meaningful in solve-with-me
							// on the last assistant turn, and only once the model has
							// actually produced a non-trivial reply. We don't try to
							// detect "this contains a final answer" with a regex — false
							// negatives there would be annoying; better to show the chip
							// liberally and trust the model to handle "give me another"
							// gracefully if the prior turn was just a diagnostic question.
							const canRequestSimilar =
								isLastAssistant && !busy && tutorMode === "solve_with_me" && text.length > 40;
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
									<div className="min-w-0 flex-1 max-w-[68ch] xl:max-w-none">
										<TutorMarkdown>{text || ""}</TutorMarkdown>
										{!text && thinking ? <TypingIndicator /> : null}
										{text ? (
											<MessageActions
												text={text}
												subjectId={subjectId}
												topicId={topicId}
												canRegenerate={canRegenerate}
												regenPending={regenPending && isLastAssistant}
												onRegenerate={canRegenerate ? () => void onRegenerate() : undefined}
												canRequestSimilar={canRequestSimilar}
												onRequestSimilar={
													canRequestSimilar
														? () =>
																submit(
																	"Give me a similar problem with different numbers, then let me try it.",
																)
														: undefined
												}
											/>
										) : null}
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
				onTutorModeChange={onTutorModeChange}
				pendingModeSwitch={pendingModeSwitch}
				usage={usage}
				entitlement={entitlement}
				error={error ?? null}
				conversationId={conversationId}
				pendingAttachments={pendingAttachments}
				onAttachmentAdded={(a) => setPendingAttachments((prev) => [...prev, a])}
				onAttachmentRemoved={(id) =>
					setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
				}
			/>
		</div>
	);
}

"use client";

import * as Sentry from "@sentry/nextjs";
import { useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useOnboardingFlag } from "@/components/onboarding/use-onboarding-flag";
import { TopicChatComposer } from "@/components/ui/multimodal-ai-chat-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AnimatedMeter } from "@/components/student/subscription/animated-meter";
import { formatTokens } from "@/lib/billing/format-tokens";
import { doubtTutorModeLabel, type DoubtTutorMode } from "@/lib/doubt/doubt-tutor-mode";
import {
	ATTACHMENT_MAX_PER_TURN,
	IMAGE_MIME_ALLOWLIST,
	PDF_MIME,
	type AttachmentRow,
} from "@/lib/doubt/attachments/types";
import { uploadDoubtAttachment } from "@/lib/doubt/attachments/upload";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

import type { EntitlementSummary, UsageSummary } from "./types";

export type ChatComposerProps = {
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	input: string;
	onInputChange: (value: string) => void;
	onSubmit: (e: React.FormEvent) => void;
	onStop: () => void;
	busy: boolean;
	placeholder: string;
	tutorMode: DoubtTutorMode;
	onTutorModeChange: (mode: DoubtTutorMode) => void;
	/**
	 * Set when the user just toggled to a different mode than the last
	 * actually-sent turn used; rendered as a small inline note above the
	 * composer until the next message goes out. Null when no pending switch.
	 */
	pendingModeSwitch?: { from: DoubtTutorMode; to: DoubtTutorMode } | null;
	usage: UsageSummary;
	entitlement: EntitlementSummary;
	error: Error | null;
	conversationId: string;
	pendingAttachments: AttachmentRow[];
	onAttachmentAdded: (a: AttachmentRow) => void;
	onAttachmentRemoved: (id: string) => void;
};

const ACCEPT = [...IMAGE_MIME_ALLOWLIST, PDF_MIME].join(",");

function bytesToHuman(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatComposer({
	textareaRef,
	input,
	onInputChange,
	onSubmit,
	onStop,
	busy,
	placeholder,
	tutorMode,
	onTutorModeChange,
	pendingModeSwitch,
	usage,
	entitlement,
	error,
	conversationId,
	pendingAttachments,
	onAttachmentAdded,
	onAttachmentRemoved,
}: ChatComposerProps) {
	const reduceMotion = useReducedMotion();
	const showMeter = entitlement.tokensQuota > 0;
	const usagePct = showMeter
		? Math.min(100, Math.round((entitlement.tokensUsed / entitlement.tokensQuota) * 100))
		: 0;
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [uploadPending, setUploadPending] = useState(false);

	// One-time first-use coach-mark explaining the three tutor modes. Open state is
	// derived from the localStorage flag (SSR-safe `false`, reconciles on the
	// client) plus a per-session dismissal — no setState-in-effect needed.
	const doubtModesTip = useOnboardingFlag("doubt-modes-tip");
	const [tipDismissed, setTipDismissed] = useState(false);
	const showDoubtModesTip = !doubtModesTip.done && !tipDismissed;
	function dismissDoubtModesTip() {
		setTipDismissed(true);
		doubtModesTip.markDone();
	}

	async function handleFiles(filesList: FileList | null) {
		if (!filesList) return;
		const remaining = ATTACHMENT_MAX_PER_TURN - pendingAttachments.length;
		if (remaining <= 0) {
			toast.error(`Up to ${ATTACHMENT_MAX_PER_TURN} attachments per message.`);
			return;
		}
		const files = Array.from(filesList).slice(0, remaining);
		setUploadPending(true);
		try {
			const supabase = createClient();
			const { data: userData } = await supabase.auth.getUser();
			const studentId = userData.user?.id;
			if (!studentId) {
				toast.error("Sign in to attach files.");
				return;
			}
			for (const file of files) {
				const res = await uploadDoubtAttachment(supabase, conversationId, studentId, file);
				if (!res.ok) {
					toast.error(res.message);
					continue;
				}
				onAttachmentAdded(res.attachment);
			}
		} finally {
			setUploadPending(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	}

	async function removeAttachment(att: AttachmentRow) {
		const supabase = createClient();
		// RLS scopes this to the owner (migration
		// 20260530000200_doubt_message_attachments.sql, "Students manage own
		// doubt attachments"). Supabase `.delete()` resolves `{ error }` instead
		// of throwing, so the old empty `catch` silently orphaned the row + its
		// storage object on any failure. Surface failures; only remove the blob
		// once the row is actually gone.
		const { error } = await supabase.from("doubt_message_attachments").delete().eq("id", att.id);
		if (error) {
			Sentry.captureException(error, {
				tags: { area: "doubt_attachment", op: "delete" },
				extra: { attachmentId: att.id },
			});
		} else {
			const { error: storageError } = await supabase.storage
				.from("doubt-attachments")
				.remove([att.storagePath]);
			if (storageError) {
				Sentry.captureException(storageError, {
					tags: { area: "doubt_attachment", op: "storage_remove" },
					extra: { attachmentId: att.id, storagePath: att.storagePath },
				});
			}
		}
		onAttachmentRemoved(att.id);
	}

	const attachDisabled =
		busy || uploadPending || pendingAttachments.length >= ATTACHMENT_MAX_PER_TURN;

	return (
		<div className="shrink-0 px-4 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))] medium:px-6 medium:pt-1.5 medium:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
			<div className="mx-auto w-full min-w-0 max-w-full">
				{error ? (
					<Alert variant="destructive" className="mb-3 w-full min-w-0 rounded-xl">
						<AlertTitle>Something went wrong</AlertTitle>
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				) : null}

				{pendingModeSwitch && !error ? (
					<div
						role="status"
						aria-live="polite"
						className={cn(
							"mb-2 inline-flex w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]",
							"border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300",
						)}
					>
						<span className="inline-block size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
						<span className="min-w-0 truncate">
							Switched to <strong className="font-semibold">{doubtTutorModeLabel(pendingModeSwitch.to)}</strong>{" "}
							— your next message will be answered under that mode (previously{" "}
							{doubtTutorModeLabel(pendingModeSwitch.from)}).
						</span>
					</div>
				) : null}

				{pendingAttachments.length > 0 ? (
					<div className="mb-2 flex w-full min-w-0 flex-wrap gap-1.5" aria-label="Attachments">
						{pendingAttachments.map((a) => (
							<div
								key={a.id}
								className={cn(
									"inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-1 text-[12px]",
									"border-border/70 text-foreground/85",
								)}
							>
								{a.kind === "image" ? (
									<ImageIcon className="size-3.5 text-emerald-600" aria-hidden />
								) : (
									<FileText className="size-3.5 text-emerald-600" aria-hidden />
								)}
								<span className="max-w-[12rem] truncate">{a.storagePath.split("/").at(-1)}</span>
								<span className="text-muted-foreground tabular-nums text-[11px]">
									{bytesToHuman(a.sizeBytes)}
								</span>
								<button
									type="button"
									onClick={() => void removeAttachment(a)}
									aria-label={`Remove ${a.kind} attachment`}
									className="text-muted-foreground hover:text-foreground inline-flex size-4 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
								>
									<X className="size-3" aria-hidden />
								</button>
							</div>
						))}
					</div>
				) : null}

				<input
					ref={fileInputRef}
					type="file"
					accept={ACCEPT}
					multiple
					className="sr-only"
					aria-label="Attach worksheet image or PDF"
					onChange={(e) => void handleFiles(e.target.files)}
				/>

				<TopicChatComposer
					id="doubt-chat-composer"
					textareaRef={textareaRef}
					value={input}
					onChange={onInputChange}
					onSubmit={onSubmit}
					busy={busy}
					onStop={onStop}
					placeholder={placeholder}
					toolbar={
						<div className="flex min-w-0 flex-nowrap items-center gap-2">
							<Tooltip>
								<TooltipTrigger
									render={
										<button
											type="button"
											aria-label="Attach worksheet image or PDF"
											disabled={attachDisabled}
											onClick={() => fileInputRef.current?.click()}
											className={cn(
												"text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex size-10 medium:size-9 items-center justify-center rounded-md",
												"focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
												"disabled:opacity-50 disabled:cursor-not-allowed",
											)}
										/>
									}
								>
									{uploadPending ? (
										<Loader2 className="size-4 animate-spin" aria-hidden />
									) : (
										<Paperclip className="size-4" aria-hidden />
									)}
								</TooltipTrigger>
								<TooltipContent>
									{pendingAttachments.length >= ATTACHMENT_MAX_PER_TURN
										? `Up to ${ATTACHMENT_MAX_PER_TURN} attachments`
										: "Attach image or PDF"}
								</TooltipContent>
							</Tooltip>
							{/*
							 * First-use coach-mark. Anchored to a dedicated invisible anchor
							 * span beside the selector so it never intercepts the Select's own
							 * open/close clicks. Auto-opens once (flag-derived), then stays
							 * dismissed.
							 */}
							<Popover
								open={showDoubtModesTip}
								onOpenChange={(next) => {
									// Ignore "open" toggles from the anchor; any close (Esc,
									// outside click, "Got it") permanently dismisses the tip.
									if (!next) dismissDoubtModesTip();
								}}
							>
								<span className="relative flex min-w-0 items-center gap-2">
									<span className="text-muted-foreground hidden shrink-0 text-[12px] font-medium medium:inline">
										Mode
									</span>
									<Select
										value={tutorMode}
										onValueChange={(v) => onTutorModeChange(v as DoubtTutorMode)}
										disabled={busy}
									>
										<SelectTrigger
											id="doubt-tutor-mode"
											aria-label="Tutor mode"
											className="border-input bg-background h-10 medium:h-9 min-w-0 max-w-[10.5rem] shrink medium:min-w-[9.5rem] medium:max-w-[14rem]"
										>
											<SelectValue placeholder="Explain">
												{(v) =>
													v === "solve_with_me"
														? "Solve with me"
														: v === "quiz_me"
															? "Quiz me"
															: "Explain"
												}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="explain">Explain</SelectItem>
											<SelectItem value="solve_with_me">Solve with me</SelectItem>
											<SelectItem value="quiz_me">Quiz me</SelectItem>
										</SelectContent>
									</Select>
									<PopoverTrigger
										aria-hidden
										tabIndex={-1}
										render={
											<span className="pointer-events-none absolute inset-x-0 bottom-0 h-0 w-full" />
										}
									/>
								</span>
								<PopoverContent side="top" align="end" className="w-[min(100vw-2rem,20rem)]">
									<div className="flex flex-col gap-2.5">
										<p className="font-heading text-sm font-semibold leading-snug text-foreground">
											Pick how the tutor helps
										</p>
										<ul className="flex flex-col gap-1.5 text-sm leading-snug text-muted-foreground">
											<li>
												<strong className="font-medium text-foreground">Explain</strong> — a clear,
												step-by-step walkthrough of the concept.
											</li>
											<li>
												<strong className="font-medium text-foreground">Solve with me</strong> —
												work the problem together, one hint at a time.
											</li>
											<li>
												<strong className="font-medium text-foreground">Quiz me</strong> — the
												tutor asks you questions to check your understanding.
											</li>
										</ul>
										<div className="flex justify-end">
											<Button size="sm" onClick={dismissDoubtModesTip}>
												Got it
											</Button>
										</div>
									</div>
								</PopoverContent>
							</Popover>
						</div>
					}
				/>

				<div className="text-muted-foreground/80 mt-2.5 flex w-full min-w-0 flex-col gap-2 text-[11px] leading-snug medium:flex-row medium:items-center medium:justify-between medium:gap-3">
					<span className="min-w-0 truncate">
						Tutor can be wrong; double-check important facts.
					</span>
					<div className="flex min-w-0 items-center gap-3">
						{showMeter ? (
							<Tooltip>
								<TooltipTrigger
									render={
										<button
											type="button"
											className="flex min-w-0 max-w-full cursor-help items-center gap-2 rounded px-1 transition-colors hover:text-foreground focus-visible:outline-none"
										/>
									}
								>
									<AnimatedMeter
										label="Tokens"
										display={`${formatTokens(entitlement.tokensUsed)}/${formatTokens(entitlement.tokensQuota)}`}
										pct={usagePct}
										reduceMotion={Boolean(reduceMotion)}
										className="w-full max-w-full medium:w-[14rem]"
									/>
								</TooltipTrigger>
								<TooltipContent>
									<div className="flex flex-col gap-1 tabular-nums">
										<span>
											Last turn:{" "}
											{usage.lastPromptTokens != null ? usage.lastPromptTokens : "—"} in ·{" "}
											{usage.lastCompletionTokens != null ? usage.lastCompletionTokens : "—"} out
										</span>
										<span>
											Session: {usage.totalPromptTokens} in / {usage.totalCompletionTokens} out
										</span>
									</div>
								</TooltipContent>
							</Tooltip>
						) : (
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
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

"use client";

import { Dialog } from "@base-ui/react/dialog";
import * as Sentry from "@sentry/nextjs";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	FEEDBACK_CATEGORIES,
	FEEDBACK_CATEGORIES_WITH_IMPACT,
	FEEDBACK_IMPACTS,
	type FeedbackCategory,
	type FeedbackImpact,
	type FeedbackPortal,
} from "@/lib/feedback/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
	bug: "Bug",
	crash: "Crash",
	stuck: "Can't complete a task",
	suggestion: "Improvement idea",
	other: "Other",
};

const IMPACT_LABELS: Record<FeedbackImpact, string> = {
	blocked: "Blocked — I can't continue",
	major: "Major — very disruptive",
	minor: "Minor — annoying but workable",
};

export type FeedbackReportDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	portal: FeedbackPortal;
	defaultCategory?: FeedbackCategory;
	errorDigest?: string;
	sentryEventId?: string;
};

export function FeedbackReportDialog({
	open,
	onOpenChange,
	portal,
	defaultCategory = "bug",
	errorDigest,
	sentryEventId: sentryEventIdProp,
}: FeedbackReportDialogProps) {
	const pathname = usePathname();
	const [category, setCategory] = React.useState<FeedbackCategory>(defaultCategory);
	const [impact, setImpact] = React.useState<FeedbackImpact | "">("");
	const [title, setTitle] = React.useState("");
	const [description, setDescription] = React.useState("");
	const [submitting, setSubmitting] = React.useState(false);
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
	const [successReportId, setSuccessReportId] = React.useState<string | null>(null);

	const showImpact = FEEDBACK_CATEGORIES_WITH_IMPACT.includes(category);
	const descriptionTrimmed = description.trim();
	const canSubmit = descriptionTrimmed.length >= 20 && !submitting && !successReportId;

	React.useEffect(() => {
		if (!open) return;
		setCategory(defaultCategory);
		setImpact("");
		setTitle("");
		setDescription("");
		setSubmitting(false);
		setErrorMessage(null);
		setSuccessReportId(null);
	}, [open, defaultCategory]);

	React.useEffect(() => {
		if (!showImpact) setImpact("");
	}, [showImpact]);

	const handleSubmit = async () => {
		if (!canSubmit) return;
		setSubmitting(true);
		setErrorMessage(null);

		const sentryEventId =
			sentryEventIdProp ??
			(typeof Sentry.lastEventId === "function" ? Sentry.lastEventId() : undefined);

		try {
			const res = await fetch("/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					portal,
					category,
					description: descriptionTrimmed,
					title: title.trim() || undefined,
					impact: showImpact && impact ? impact : undefined,
					pagePath: pathname || "/",
					sentryEventId: sentryEventId || undefined,
					errorDigest: errorDigest || undefined,
					clientContext: {
						viewport:
							typeof window !== "undefined" ?
								{ w: window.innerWidth, h: window.innerHeight }
							:	undefined,
						locale: typeof navigator !== "undefined" ? navigator.language : undefined,
					},
				}),
			});
			const data = (await res.json()) as { ok?: boolean; message?: string; reportId?: string };
			if (!res.ok || !data.ok || !data.reportId) {
				setErrorMessage(data.message ?? "Could not submit your report. Please try again.");
				return;
			}
			setSuccessReportId(data.reportId);
		} catch {
			setErrorMessage("Could not submit your report. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	const shortRef = successReportId ? successReportId.slice(0, 8) : null;

	return (
		<Dialog.Root open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={cn(
						"fixed inset-0 z-50 bg-black/45 backdrop-blur-xl backdrop-saturate-150",
						"[-webkit-backdrop-filter:blur(24px)_saturate(1.5)] transition-opacity duration-150",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				/>
				<Dialog.Popup
					className={cn(
						"fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,40rem)] w-[min(calc(100vw-2rem),32rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl border-2 bg-popover p-6 text-popover-foreground shadow-xl",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				>
					<Dialog.Title className="font-heading text-xl font-bold tracking-tight">
						Report a problem or send feedback
					</Dialog.Title>
					<Dialog.Description className="text-foreground/80 text-sm leading-relaxed">
						Tell us about bugs, crashes, something you couldn&apos;t finish, or ideas to improve
						24Vertex. We attach this page and technical context to help us investigate.
					</Dialog.Description>

					{successReportId ?
						<div className="space-y-4">
							<p className="text-emerald-700 dark:text-emerald-400 text-sm" role="status">
								Thanks — we received your report.
								{shortRef ?
									<>
										{" "}
										Reference: <span className="font-mono">{shortRef}</span>
									</>
								:	null}
							</p>
							<div className="flex justify-end">
								<Button type="button" onClick={() => onOpenChange(false)}>
									Close
								</Button>
							</div>
						</div>
					:	<>
							<div className="space-y-2">
								<label htmlFor="feedback-category" className="text-sm font-medium text-foreground">
									Category
								</label>
								<Select
									value={category}
									onValueChange={(v) => setCategory(v as FeedbackCategory)}
									disabled={submitting}
								>
									<SelectTrigger id="feedback-category" aria-label="Feedback category">
										<SelectValue placeholder="Select category">
											{(v) => CATEGORY_LABELS[v as FeedbackCategory] ?? v}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{FEEDBACK_CATEGORIES.map((c) => (
											<SelectItem key={c} value={c}>
												{CATEGORY_LABELS[c]}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{showImpact ?
								<div className="space-y-2">
									<label htmlFor="feedback-impact" className="text-sm font-medium text-foreground">
										How much did this affect you?
									</label>
									<Select
										value={impact}
										onValueChange={(v) => setImpact(v as FeedbackImpact)}
										disabled={submitting}
									>
										<SelectTrigger id="feedback-impact" aria-label="Impact">
											<SelectValue placeholder="Optional">
												{(v) => (v ? IMPACT_LABELS[v as FeedbackImpact] : "Optional")}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{FEEDBACK_IMPACTS.map((i) => (
												<SelectItem key={i} value={i}>
													{IMPACT_LABELS[i]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							:	null}

							{(category === "bug" || category === "suggestion") && (
								<div className="space-y-2">
									<label htmlFor="feedback-title" className="text-sm font-medium text-foreground">
										Short title <span className="text-muted-foreground font-normal">(optional)</span>
									</label>
									<input
										id="feedback-title"
										type="text"
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										maxLength={200}
										disabled={submitting}
										className="border-input bg-background focus-visible:ring-ring w-full rounded-md border-2 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
										placeholder="One-line summary"
									/>
								</div>
							)}

							<div className="space-y-2">
								<label htmlFor="feedback-description" className="text-sm font-medium text-foreground">
									Description
								</label>
								<textarea
									id="feedback-description"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={4}
									maxLength={4000}
									disabled={submitting}
									className="border-input bg-background focus-visible:ring-ring w-full rounded-md border-2 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
									placeholder="What happened? What did you expect? Steps to reproduce help for bugs."
								/>
								<p className="text-muted-foreground text-xs">
									{descriptionTrimmed.length}/4000 (minimum 20 characters)
								</p>
							</div>

							{errorMessage ?
								<p className="text-destructive text-sm" role="alert">
									{errorMessage}
								</p>
							:	null}

							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => onOpenChange(false)}
									disabled={submitting}
								>
									Cancel
								</Button>
								<Button type="button" disabled={!canSubmit} onClick={() => void handleSubmit()}>
									{submitting ? "Submitting…" : "Submit"}
								</Button>
							</div>
						</>
					}
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { PracticeCanonicalTopic } from "@/lib/practice";

import { WizardSummaryCard } from "./wizard-summary-card";

export type ReviewSummary = {
	subjectName: string | null;
	topicNames: string[];
	difficultyLabel: string;
	durationLabel: string;
};

export type StepReviewProps = {
	showPromptPreview: boolean;
	nonPreviewSuccess: boolean;
	previewPayload: {
		userMessageJson: string;
		systemPrompt: string;
		canonicalTopics: PracticeCanonicalTopic[];
	} | null;
	reviewConfigSummary: ReviewSummary;
	onCopy: (label: string, text: string) => void;
};

export function StepReview({
	showPromptPreview,
	nonPreviewSuccess,
	previewPayload,
	reviewConfigSummary,
	onCopy,
}: StepReviewProps) {
	if (!showPromptPreview && nonPreviewSuccess) {
		return (
			<div className="relative space-y-5">
				<WizardSummaryCard
					title="Ready to generate"
					description="We've saved your choices. When you're ready, generate the paper—you'll go straight to the timed test screen after."
					subjectName={reviewConfigSummary.subjectName}
					topicNames={reviewConfigSummary.topicNames}
					difficultyLabel={reviewConfigSummary.difficultyLabel}
					durationLabel={reviewConfigSummary.durationLabel}
				/>
			</div>
		);
	}

	if (showPromptPreview && previewPayload) {
		return (
			<div className="space-y-5">
				<WizardSummaryCard
					title="Configuration saved"
					description="Your choices are stored. The prompt preview below is for developers (when PRACTICE_PROMPT_PREVIEW is on)."
					subjectName={reviewConfigSummary.subjectName}
					topicNames={reviewConfigSummary.topicNames}
					difficultyLabel={reviewConfigSummary.difficultyLabel}
					durationLabel={reviewConfigSummary.durationLabel}
				/>
				<p className="text-muted-foreground text-base leading-relaxed">
					Server-assembled user JSON and system prompt. Shown when{" "}
					<code className="text-xs">PRACTICE_PROMPT_PREVIEW=true</code>.
				</p>
				<div className="flex flex-col gap-2">
					<p className="text-base font-medium">Verified topic selections (from database)</p>
					<div className="border-border overflow-x-auto overflow-y-hidden rounded-lg border">
						<table className="w-full min-w-[36rem] text-left text-xs">
							<thead className="bg-muted/50 border-b">
								<tr>
									<th className="p-2 font-medium">Topic name</th>
									<th className="p-2 font-medium">Topic ID</th>
									<th className="p-2 font-medium">Tracker ID</th>
								</tr>
							</thead>
							<tbody>
								{previewPayload.canonicalTopics.map((t) => (
									<tr key={t.trackerId} className="border-border border-b last:border-b-0">
										<td className="p-2">{t.topicName}</td>
										<td className="text-muted-foreground p-2 font-mono">{t.topicId}</td>
										<td className="text-muted-foreground p-2 font-mono">{t.trackerId}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
				<Separator />
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="text-base font-medium">User message (JSON)</p>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => onCopy("user message", previewPayload.userMessageJson)}
						>
							Copy
						</Button>
					</div>
					<pre className="bg-muted max-h-64 overflow-auto rounded-lg p-3 text-xs wrap-break-word whitespace-pre-wrap">
						{previewPayload.userMessageJson}
					</pre>
				</div>
				<Separator />
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="text-base font-medium">System prompt</p>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => onCopy("system prompt", previewPayload.systemPrompt)}
						>
							Copy
						</Button>
					</div>
					<pre className="bg-muted max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
						{previewPayload.systemPrompt}
					</pre>
				</div>
			</div>
		);
	}

	return null;
}

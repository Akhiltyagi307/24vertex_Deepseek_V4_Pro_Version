"use client";

import type { ReactElement } from "react";
import Link from "next/link";

import { QuestionVisual } from "@/components/student/practice/visuals/question-visual";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";

export function AdminQuestionVisualTile(props: {
	questionId: string;
	testId: string;
	questionNumber: number;
	subjectName: string | null;
	questionTextPreview: string;
	visual: QuestionVisualEnvelope | null;
	parseError: string | null;
}): ReactElement {
	const { questionId, testId, questionNumber, subjectName, questionTextPreview, visual, parseError } = props;

	return (
		<article
			className="space-y-3 rounded-lg border border-border bg-card p-4"
			data-admin-question-visual-tile={questionId}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
				<div className="font-medium">
					Q{questionNumber}
					{subjectName ? (
						<span className="text-muted-foreground font-normal"> · {subjectName}</span>
					) : null}
				</div>
				<Link
					href={`/admin/assessments/tests/${testId}`}
					className="text-primary hover:underline"
				>
					Test {testId.slice(0, 8)}…
				</Link>
			</div>
			<p className="text-muted-foreground line-clamp-3 text-xs">{questionTextPreview}</p>
			{parseError ?
				<p className="text-destructive text-xs">Invalid stored visual: {parseError}</p>
			:	null}
			{visual ?
				<QuestionVisual visual={visual} className="max-w-xl" />
			:	!parseError ?
					<p className="text-muted-foreground text-xs">No parsable visual envelope.</p>
				:	null}
		</article>
	);
}

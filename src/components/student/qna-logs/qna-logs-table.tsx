"use client";

import { Badge } from "@/components/ui/badge";
import { formatDateTimeMediumShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { questionTypeLabel } from "@/lib/practice/practice-session-utils";
import type { QnaLogListRow } from "@/lib/student/qna-logs/types";
import { cn } from "@/lib/utils";

type Props = {
	rows: QnaLogListRow[];
	highlightAnswerId?: string | null;
	onOpenRow: (row: QnaLogListRow, rowIndex: number) => void;
};

function sourceLabel(source: QnaLogListRow["source"]): string {
	return source === "assignment" ? "Assignment" : "Practice";
}

function performanceBadgeClassName(performance: QnaLogListRow["performance"]): string {
	switch (performance) {
		case "correct":
			return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
		case "partial":
			return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";
		case "incorrect":
			return "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300";
		case "pending":
		default:
			return "border-border/70 bg-muted text-muted-foreground";
	}
}

function performanceLabel(performance: QnaLogListRow["performance"]): string {
	switch (performance) {
		case "correct":
			return "Correct";
		case "partial":
			return "Partial";
		case "incorrect":
			return "Incorrect";
		case "pending":
		default:
			return "Pending";
	}
}

function formatDate(iso: string | null): string {
	if (!iso) return "—";
	return formatDateTimeMediumShortInAppTimeZone(iso);
}

function QnaLogCardField({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-3">
			<dt className="text-muted-foreground shrink-0 text-xs font-medium">{label}</dt>
			<dd className="min-w-0 text-right text-sm">{children}</dd>
		</div>
	);
}

export function QnaLogsTable({ rows, highlightAnswerId, onOpenRow }: Props) {
	return (
		<>
			<ul className="flex flex-col gap-3 border-border border-t p-3 medium:hidden">
				{rows.map((row, rowIndex) => (
					<li key={row.answerId}>
						<div
							role="button"
							tabIndex={0}
							aria-label={`Open question ${row.questionNumber} details`}
							onClick={() => onOpenRow(row, rowIndex)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									onOpenRow(row, rowIndex);
								}
							}}
							className={cn(
								"flex cursor-pointer flex-col gap-2.5 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/50 dark:bg-transparent dark:hover:bg-muted/20",
								highlightAnswerId === row.answerId &&
									"bg-primary/[0.07] ring-2 ring-primary/30 ring-inset dark:bg-primary/[0.12]",
							)}
						>
							<p className="line-clamp-2 font-medium text-foreground">{row.questionPreview || "—"}</p>
							<dl className="flex flex-col gap-2 border-border border-t pt-2.5">
								<QnaLogCardField label="Date">
									<span className="tabular-nums text-muted-foreground">{formatDate(row.dateIso)}</span>
								</QnaLogCardField>
								<QnaLogCardField label="Subject">{row.subjectName}</QnaLogCardField>
								<QnaLogCardField label="Source">
									<Badge variant="secondary" className="font-normal">
										{sourceLabel(row.source)}
									</Badge>
								</QnaLogCardField>
								<QnaLogCardField label="Performance">
									<Badge
										variant="outline"
										className={cn("font-normal", performanceBadgeClassName(row.performance))}
									>
										{performanceLabel(row.performance)}
									</Badge>
								</QnaLogCardField>
								<QnaLogCardField label="Topic">
									<span className="text-muted-foreground">{row.topicName}</span>
								</QnaLogCardField>
								<QnaLogCardField label="Chapter">
									<span className="text-muted-foreground">{row.chapterName ?? "—"}</span>
								</QnaLogCardField>
								<QnaLogCardField label="Type">{questionTypeLabel(row.questionType)}</QnaLogCardField>
							</dl>
						</div>
					</li>
				))}
			</ul>
			<div className="hidden overflow-x-auto border-border border-t medium:block">
				<table className="w-full min-w-[1020px] border-collapse text-left text-sm">
				<thead>
					<tr className="border-border border-b bg-muted/85 dark:bg-muted/70">
						<th scope="col" className="px-4 py-3 font-medium">
							Question
						</th>
						<th scope="col" className="px-4 py-3 font-medium">
							Date
						</th>
						<th scope="col" className="px-4 py-3 font-medium">
							Subject
						</th>
						<th scope="col" className="px-4 py-3 font-medium">
							Source
						</th>
						<th scope="col" className="px-4 py-3 font-medium">
							Performance
						</th>
						<th scope="col" className="px-4 py-3 font-medium">
							Topic
						</th>
						<th scope="col" className="px-4 py-3 font-medium">
							Chapter
						</th>
						<th scope="col" className="px-4 py-3 font-medium">
							Type
						</th>
					</tr>
				</thead>
				<tbody className="[&_tr]:bg-background dark:[&_tr]:bg-transparent">
					{rows.map((row, rowIndex) => (
						<tr
							key={row.answerId}
							className={cn(
								"cursor-pointer border-border border-b transition-colors last:border-b-0 hover:bg-muted/50 dark:hover:bg-muted/20",
								highlightAnswerId === row.answerId &&
									"bg-primary/[0.07] ring-2 ring-primary/30 ring-inset dark:bg-primary/[0.12]",
							)}
							tabIndex={0}
							aria-label={`Open question ${row.questionNumber} details`}
							onClick={() => onOpenRow(row, rowIndex)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									onOpenRow(row, rowIndex);
								}
							}}
						>
							<td className="max-w-[230px] truncate px-4 py-3 font-medium text-foreground">
								{row.questionPreview || "—"}
							</td>
							<td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDate(row.dateIso)}</td>
							<td className="max-w-[180px] truncate px-4 py-3">{row.subjectName}</td>
							<td className="px-4 py-3">
								<Badge variant="secondary" className="font-normal">
									{sourceLabel(row.source)}
								</Badge>
							</td>
							<td className="px-4 py-3">
								<Badge variant="outline" className={cn("font-normal", performanceBadgeClassName(row.performance))}>
									{performanceLabel(row.performance)}
								</Badge>
							</td>
							<td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">{row.topicName}</td>
							<td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">{row.chapterName ?? "—"}</td>
							<td className="px-4 py-3">{questionTypeLabel(row.questionType)}</td>
						</tr>
					))}
				</tbody>
				</table>
			</div>
		</>
	);
}

import { Check, Clock3, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { landingFeatureBentoShell } from "@/lib/marketing/landing-feature-surface";
import {
	landingMasteryPreviewChipClassNames,
	landingMasteryPreviewDotClassNames,
	landingMasteryPreviewTextClassNames,
} from "@/lib/marketing/landing-mastery-preview-styles";
import { landingMarketingSectionEyebrowBadgeClassName } from "@/lib/marketing/landing-marketing-badge";
import { cn } from "@/lib/utils";

/**
 * Product-faithful preview of the teacher dashboard for an assigned practice
 * set: which chapters were flagged after a class test, the per-student attempt
 * grid, and the lost-marks signal that drove the assignment. Static SSR.
 */

type AttemptStatus = "completed" | "started" | "not-started";

type StudentAttempt = {
	initials: string;
	name: string;
	status: AttemptStatus;
	/** "8 of 15", or null for not-started. */
	progress: string | null;
};

type FlaggedChapter = {
	chapter: string;
	lostMarks: number;
	students: number;
};

const FLAGGED: ReadonlyArray<FlaggedChapter> = [
	{ chapter: "Trig identities", lostMarks: 64, students: 18 },
	{ chapter: "Ratios in right triangles", lostMarks: 41, students: 12 },
	{ chapter: "Word problems", lostMarks: 33, students: 9 },
];

const STUDENTS: ReadonlyArray<StudentAttempt> = [
	{ initials: "AM", name: "Aarav Mehta", status: "completed", progress: "15 of 15" },
	{ initials: "DV", name: "Diya Verma", status: "completed", progress: "15 of 15" },
	{ initials: "IS", name: "Ishaan Shah", status: "started", progress: "9 of 15" },
	{ initials: "KR", name: "Kavya Rao", status: "completed", progress: "15 of 15" },
	{ initials: "NP", name: "Neel Patel", status: "started", progress: "4 of 15" },
	{ initials: "PS", name: "Priya Singh", status: "completed", progress: "15 of 15" },
	{ initials: "RG", name: "Rohan Gupta", status: "not-started", progress: null },
	{ initials: "SK", name: "Sara Khan", status: "started", progress: "11 of 15" },
	{ initials: "TJ", name: "Tara Joshi", status: "completed", progress: "15 of 15" },
	{ initials: "VN", name: "Vikram N.", status: "not-started", progress: null },
	{ initials: "YB", name: "Yash Bhatia", status: "completed", progress: "15 of 15" },
	{ initials: "ZR", name: "Zara Reddy", status: "started", progress: "13 of 15" },
];

const STATUS_PRESENTATION: Record<
	AttemptStatus,
	{ label: string; chip: string; dot: string; icon: typeof Check }
> = {
	completed: {
		label: "Attempted",
		chip: landingMasteryPreviewChipClassNames.green,
		dot: landingMasteryPreviewDotClassNames.green,
		icon: Check,
	},
	started: {
		label: "In progress",
		chip: landingMasteryPreviewChipClassNames.amber,
		dot: landingMasteryPreviewDotClassNames.amber,
		icon: Clock3,
	},
	"not-started": {
		label: "Not started",
		chip: landingMasteryPreviewChipClassNames.red,
		dot: landingMasteryPreviewDotClassNames.red,
		icon: Minus,
	},
};

function CountSummary({ status, count }: { status: AttemptStatus; count: number }) {
	const presentation = STATUS_PRESENTATION[status];
	return (
		<div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium", presentation.chip)}>
			<span className={cn("inline-block size-1.5 rounded-full ring-2", presentation.dot)} aria-hidden />
			<span className="tabular-nums">{count}</span>
			<span>{presentation.label.toLowerCase()}</span>
		</div>
	);
}

export function LandingAssignmentsPreview() {
	const counts = STUDENTS.reduce<Record<AttemptStatus, number>>(
		(acc, student) => {
			acc[student.status] += 1;
			return acc;
		},
		{ completed: 0, started: 0, "not-started": 0 },
	);

	return (
		<section
			id="assignments-proof"
			className="bg-background px-4 py-20 medium:px-6 medium:py-24 xl:px-8 xl:py-28"
			aria-labelledby="assignments-proof-title"
		>
			<div className="mx-auto w-full max-w-7xl">
				<div className="mx-auto mb-10 max-w-3xl text-center medium:mb-12">
					<Badge variant="outline" className={cn("mb-4", landingMarketingSectionEyebrowBadgeClassName)}>
						The teacher view
					</Badge>
					<h2
						id="assignments-proof-title"
						className="text-balance text-3xl font-semibold tracking-tight text-foreground medium:text-4xl"
					>
						The class after a class test, on one screen.
					</h2>
					<p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground medium:text-lg">
						Three flagged chapters, twelve students, attempt status on the practice you pushed. Class 10A trigonometry, two days after the unit test.
					</p>
				</div>

				<div
					className={cn(
						"relative overflow-hidden rounded-3xl",
						landingFeatureBentoShell,
						"p-5 medium:p-8 xl:p-10",
					)}
				>
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4 medium:pb-6">
						<div className="flex items-center gap-3">
							<span className="border-border bg-[var(--subject-grid-icon)]/10 ring-[var(--subject-grid-icon)]/30 flex size-9 shrink-0 items-center justify-center rounded-xl border ring-1 text-[var(--subject-grid-icon)] font-semibold text-sm">
								10A
							</span>
							<div>
								<p className="text-sm font-semibold text-card-foreground">Trigonometry assignment</p>
								<p className="text-[12px] text-muted-foreground">Class 10A · 15 questions · Due Friday</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<CountSummary status="completed" count={counts.completed} />
							<CountSummary status="started" count={counts.started} />
							<CountSummary status="not-started" count={counts["not-started"]} />
						</div>
					</div>

					<div className="grid gap-6 pt-6 medium:pt-8 xl:grid-cols-[1fr_1.4fr] xl:gap-8">
						<div className="flex flex-col gap-5">
							<div>
								<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
									Lost marks on the unit test
								</p>
								<p className="mt-1 text-[13px] text-muted-foreground medium:text-sm">
									The chapters this practice set is targeting.
								</p>
							</div>
							<ul className="flex flex-col gap-3">
								{FLAGGED.map((chapter, index) => {
									const maxLost = FLAGGED[0].lostMarks;
									const width = Math.max(8, Math.round((chapter.lostMarks / maxLost) * 100));
									const tone = index === 0 ? "high" : index === 1 ? "medium" : "low";
									const accent =
										tone === "high"
											? "bg-[var(--mastery-critical)]"
											: tone === "medium"
												? "bg-[var(--mastery-attention)]"
												: "bg-[var(--subject-grid-icon)]";

									return (
										<li
											key={chapter.chapter}
											className="border-border/60 rounded-2xl border bg-muted/30 px-4 py-3.5 medium:px-5"
										>
											<div className="flex items-baseline justify-between gap-2">
												<p className="text-sm font-semibold text-card-foreground">
													{chapter.chapter}
												</p>
												<p className="text-[12px] tabular-nums text-muted-foreground">
													<span className="font-semibold text-card-foreground">{chapter.lostMarks}</span>
													<span> marks · {chapter.students} students</span>
												</p>
											</div>
											<div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
												<div className={cn("h-full rounded-full", accent)} style={{ width: `${width}%` }} />
											</div>
										</li>
									);
								})}
							</ul>
						</div>

						<div className="flex flex-col gap-4">
							<div className="flex items-baseline justify-between gap-2">
								<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--link)] dark:text-[var(--subject-grid-icon)]">
									Who attempted (12 students)
								</p>
								<p className="text-[12px] text-muted-foreground tabular-nums">
									Updated 14 minutes ago
								</p>
							</div>
							<ul className="grid grid-cols-2 gap-2 medium:grid-cols-3 medium:gap-2.5">
								{STUDENTS.map((student) => {
									const presentation = STATUS_PRESENTATION[student.status];
									const StatusIcon = presentation.icon;
									return (
										<li
											key={student.name}
											className="border-border/60 bg-card flex items-center gap-2.5 rounded-xl border px-2.5 py-2 medium:px-3"
										>
											<span
												className="border-border bg-muted/45 ring-border/60 flex size-8 shrink-0 items-center justify-center rounded-lg border ring-1 text-[11px] font-semibold text-card-foreground"
												aria-hidden
											>
												{student.initials}
											</span>
											<div className="min-w-0 flex-1">
												<p className="truncate text-[12px] font-medium text-card-foreground medium:text-[13px]">
													{student.name}
												</p>
												<p
													className={cn(
														"flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide medium:text-[11px]",
														student.status === "completed" && landingMasteryPreviewTextClassNames.green,
														student.status === "started" && landingMasteryPreviewTextClassNames.amber,
														student.status === "not-started" && landingMasteryPreviewTextClassNames.red,
													)}
												>
													<StatusIcon className="size-3" aria-hidden />
													<span>{student.progress ?? "Not started"}</span>
												</p>
											</div>
										</li>
									);
								})}
							</ul>
							<p className="text-[12px] italic text-muted-foreground medium:text-[13px]">
								Tap a student to send a one-line nudge from your name, not a forwarded WhatsApp message.
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

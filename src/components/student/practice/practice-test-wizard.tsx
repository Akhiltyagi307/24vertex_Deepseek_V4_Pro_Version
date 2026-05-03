"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import {
	CheckIcon,
	ChevronDownIcon,
	MinusIcon,
	TrendingDownIcon,
	TrendingUpIcon,
	XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
	abandonPracticeTest,
	finalizePracticeConfig,
	generatePracticeTest,
} from "../../../../app/student/practice/actions";
import type { GeneratePracticeResult } from "../../../../app/student/practice/actions/types";
import { SubmitButton } from "@/components/auth/submit-button";
import { AnimateFormAlert } from "@/components/motion/animate-form-alert";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { usePaywall } from "@/components/student/subscription/paywall-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	cardSurfaceFrameClassName,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { GridLoader } from "@/components/ui/grid-loader";
import { Separator } from "@/components/ui/separator";
import {
	getPracticeQuestionPlan,
	PRACTICE_DURATION_OPTIONS,
	PRACTICE_MIN_TOPICS,
	practiceDifficultySchema,
	practiceDurationSecondsInputSchema,
	type PracticeCanonicalTopic,
} from "@/lib/practice";
import type { PracticeDifficulty } from "@/lib/practice/types";
import {
	groupByUnitChapter,
	type ChapterGroup,
	type PerformanceRowSerialized,
	sortPerformanceRows,
	type TrackerStatus,
} from "@/lib/student/performance-matrix";
import { getSubjectCardIconConfig } from "@/lib/student/subject-lucide-icon";
import { cn } from "@/lib/utils";

/** NDJSON from `/api/student/practice/generate-stream` when `PRACTICE_STREAM` + `NEXT_PUBLIC_PRACTICE_STREAM` are enabled. */
async function readPracticeGenerateNdjsonResponse(res: Response): Promise<GeneratePracticeResult> {
	const reader = res.body?.getReader();
	if (!reader) {
		throw new Error("No response body from generation stream.");
	}
	const dec = new TextDecoder();
	let buffer = "";
	let final: GeneratePracticeResult | null = null;
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	while (true) {
		const { done, value } = await reader.read();
		if (value) {
			buffer += dec.decode(value, { stream: true });
		}
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const msg = JSON.parse(trimmed) as
				| { type: "partial"; partial: unknown }
				| { type: "done"; result: GeneratePracticeResult }
				| { type: "error"; message: string };
			if (msg.type === "error") {
				throw new Error(msg.message);
			}
			if (msg.type === "done") {
				final = msg.result;
			}
		}
		if (done) break;
	}
	if (buffer.trim()) {
		const msg = JSON.parse(buffer.trim()) as { type: string; result?: GeneratePracticeResult };
		if (msg.type === "done" && msg.result) {
			final = msg.result;
		}
	}
	if (!final) {
		throw new Error("Could not read generation result from stream.");
	}
	return final;
}

export type PracticeEnrolledSubject = {
	id: string;
	name: string;
	sort_order: number;
	subject_group: string | null;
};

export type PracticeSubjectProgress = {
	testId: string;
	answeredCount: number;
	totalQuestions: number;
	/** Phase 4: optional extras surfaced on the subject card. */
	timeLimitSeconds?: number | null;
	startedAt?: string | null;
	topicsCovered?: number | null;
	lastTestScore?: number | null;
};

export type PracticeTestWizardProps = {
	enrolledSubjects: PracticeEnrolledSubject[];
	performanceRows: PerformanceRowSerialized[];
	loadError: string | null;
	profileGrade: number | null;
	showPromptPreview: boolean;
	subjectProgressBySubjectId: Record<string, PracticeSubjectProgress>;
	/** Phase 4: gates the dev-only "Build prompt preview" affordance. */
	isAdmin?: boolean;
};

/** Phase 4: focus-area radio choices on the topics step. */
const FOCUS_AREA_OPTIONS = [
	{ value: "all", label: "All topics" },
	{ value: "weak", label: "Weak topics only" },
	{ value: "not_tested", label: "Not yet tested" },
	{ value: "recent_errors", label: "Recent mistakes" },
] as const;
type FocusArea = (typeof FOCUS_AREA_OPTIONS)[number]["value"];

/** Same emerald as step progress; `!` ensures filled CTAs never pick up soft `--primary` mint. */
const practiceSolidCtaClassName =
	"!bg-emerald-600 hover:!bg-emerald-600/90 dark:!bg-emerald-500 dark:hover:!bg-emerald-500/90";

/** Shown in sequence on the generating overlay so the line “rotates” instead of staying static. */
const GENERATING_STATUS_MESSAGES = [
	"Generating your test…",
	"Choosing questions for your topics…",
	"Matching difficulty and length…",
	"Almost ready…",
] as const;

/** How long each line stays visible before rotating to the next. */
const GENERATING_STATUS_ROTATE_MS = 15_000;

/** Match `StudentPerformanceView` topic matrix badges. */
function statusBadgeVariant(
	status: TrackerStatus,
): "default" | "secondary" | "destructive" | "outline" {
	if (status === "good") return "default";
	if (status === "bad") return "destructive";
	if (status === "satisfactory") return "secondary";
	return "outline";
}

function performanceStatusBadgeClass(status: TrackerStatus): string {
	if (status === "not_tested") {
		return "h-6 border-transparent bg-muted px-2.5 text-[13px] font-medium text-muted-foreground";
	}
	return "h-6 px-2.5 text-[13px] font-semibold";
}

function statusLabel(status: TrackerStatus): string {
	switch (status) {
		case "good":
			return "Good";
		case "satisfactory":
			return "Satisfactory";
		case "bad":
			return "Needs improvement";
		default:
			return "Not tested";
	}
}

function trendLabel(t: PerformanceRowSerialized["trend"]): string {
	if (t === "improving") return "Improving";
	if (t === "declining") return "Declining";
	return "Stable";
}

function formatLastTest(iso: string | null): string {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
	} catch {
		return "—";
	}
}

function formatScore(n: number | null): string {
	if (n == null || Number.isNaN(n)) return "—";
	return `${Math.round(n)}%`;
}

/** Left border on topic rows — same as performance matrix. */
function statusRowAccentClass(status: TrackerStatus): string {
	switch (status) {
		case "good":
			return "border-s-primary";
		case "satisfactory":
			return "border-s-primary/45";
		case "bad":
			return "border-s-destructive";
		default:
			return "border-s-muted-foreground/35";
	}
}

function trendIcon(row: PerformanceRowSerialized) {
	const common = "size-3.5 shrink-0";
	if (row.trend === "improving") {
		return <TrendingUpIcon className={cn(common, "text-primary")} aria-hidden />;
	}
	if (row.trend === "declining") {
		return <TrendingDownIcon className={cn(common, "text-destructive")} aria-hidden />;
	}
	return <MinusIcon className={cn(common, "text-muted-foreground")} aria-hidden />;
}

function trackerIdsForChapter(ch: ChapterGroup): string[] {
	return ch.rows.map((r) => r.trackerId);
}

const uuidStringSchema = z.string().uuid();

function parseTopicIdsSearchParam(raw: string | null): string[] {
	if (!raw?.trim()) return [];
	return raw
		.split(",")
		.map((s) => s.trim())
		.filter((s) => uuidStringSchema.safeParse(s).success);
}

function selectionFlagsForIds(selected: Set<string>, ids: string[]) {
	if (ids.length === 0) return { all: false, some: false };
	let n = 0;
	for (const id of ids) {
		if (selected.has(id)) n += 1;
	}
	return { all: n === ids.length, some: n > 0 && n < ids.length };
}

function IndeterminateCheckbox({
	indeterminate,
	className,
	...props
}: Omit<React.ComponentProps<"input">, "ref" | "type"> & { indeterminate?: boolean }) {
	const ref = React.useRef<HTMLInputElement>(null);
	React.useEffect(() => {
		if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
	}, [indeterminate]);
	return <input ref={ref} type="checkbox" className={className} {...props} />;
}

/**
 * Supabase-like round selection: bright emerald fill when on, soft outer glow, white glyph.
 * Check / indeterminate icons are styled in `app/globals.css` (`.practice-matrix-check-circle`).
 */
const practiceTopicMatrixCheckCircleClass = [
	"practice-matrix-check-circle",
	"size-4 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-muted-foreground/35 bg-background/90",
	"transition-[background-color,border-color,box-shadow,background-size] duration-150",
	"hover:border-emerald-400/60 hover:shadow-[0_0_8px_-2px_rgba(52,211,153,0.38)]",
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
	"checked:border-emerald-400 checked:bg-emerald-500 checked:bg-center checked:bg-no-repeat",
	"checked:shadow-[0_0_0_1px_rgba(167,243,208,0.5),0_0_10px_2px_rgba(16,185,129,0.4),0_0_18px_4px_rgba(16,185,129,0.14)]",
	"indeterminate:border-emerald-400 indeterminate:bg-emerald-500 indeterminate:bg-center indeterminate:bg-no-repeat",
	"indeterminate:shadow-[0_0_0_1px_rgba(167,243,208,0.5),0_0_10px_2px_rgba(16,185,129,0.4),0_0_18px_4px_rgba(16,185,129,0.14)]",
	"disabled:cursor-not-allowed disabled:opacity-40",
].join(" ");

/**
 * Chapter list surface — reads as an inset region inside the step card.
 * Not a bold surface on its own: subtle background tint + border only.
 * The emerald glow on hover remains as the "signature detail" for this view.
 */
const practiceTopicMatrixSurfaceClass =
	"border border-border/70 bg-background/40 shadow-none ring-0 transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/45 hover:shadow-[0_0_28px_-12px_color-mix(in_oklab,var(--primary)_38%,transparent)] dark:bg-background/25";

/**
 * Topic matrix sits in horizontal `overflow-x-auto` regions. Some browsers do not
 * route vertical wheel deltas to the main content column. When the inset can scroll,
 * apply the delta there (single scroll surface for the practice hub).
 */
function forwardWheelToWizardStepScroll(e: React.WheelEvent<HTMLDivElement>) {
	if (e.ctrlKey) return;
	if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

	const inset = e.currentTarget.closest<HTMLElement>("[data-slot='sidebar-inset']");
	if (!inset) return;
	if (inset.scrollHeight <= inset.clientHeight) return;

	inset.scrollTop += e.deltaY;
	e.preventDefault();
}

function formatStepErrors(err: z.ZodError): string {
	const flat = err.flatten();
	const fieldMsgs = Object.values(flat.fieldErrors).flat().filter(Boolean);
	const formMsgs = flat.formErrors.filter(Boolean);
	return [...fieldMsgs, ...formMsgs].join(" ") || "Please check this step.";
}

const practiceStep0Schema = z.object({
	subjectId: z.string().uuid({ message: "Select a subject." }),
});

const practiceStep1Schema = z
	.object({
		trackerIds: z.array(z.string().uuid()),
	})
	.superRefine((data, ctx) => {
		const unique = new Set(data.trackerIds);
		if (unique.size !== data.trackerIds.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Each topic can only be selected once.",
				path: ["trackerIds"],
			});
		}
		if (data.trackerIds.length < PRACTICE_MIN_TOPICS) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					PRACTICE_MIN_TOPICS === 1 ?
						"Select at least one topic."
					:	`Select at least ${PRACTICE_MIN_TOPICS} topics.`,
				path: ["trackerIds"],
			});
		}
	});

const practiceStep2FieldsSchema = z.object({
	difficulty: practiceDifficultySchema,
	durationSeconds: practiceDurationSecondsInputSchema,
});

const DIFFICULTY_OPTIONS = [
	["easy", "Easy"],
	["medium", "Medium"],
	["hard", "Hard"],
] as const satisfies readonly (readonly [PracticeDifficulty, string])[];

function clusterSubjectsByGroup(subjects: PracticeEnrolledSubject[]) {
	const clusters: { groupLabel: string | null; items: PracticeEnrolledSubject[] }[] = [];
	for (const s of subjects) {
		const g = s.subject_group?.trim() ? s.subject_group : null;
		const prev = clusters[clusters.length - 1];
		if (prev && prev.groupLabel === g) {
			prev.items.push(s);
		} else {
			clusters.push({ groupLabel: g, items: [s] });
		}
	}
	return clusters;
}

function PracticeReviewSummaryCard({
	title,
	description,
	subjectName,
	topicNames,
	difficultyLabel,
	durationLabel,
}: {
	title: string;
	description: string;
	subjectName: string | null;
	topicNames: string[];
	difficultyLabel: string;
	durationLabel: string;
}) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-lg">{title}</CardTitle>
				<CardDescription className="text-base leading-relaxed">{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5 pt-0">
				<Separator />
				<dl className="space-y-5">
					<div>
						<dt className="text-muted-foreground text-sm font-medium">Subject</dt>
						<dd className="mt-1.5 text-foreground text-base leading-snug">
							{subjectName ?? "—"}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-sm font-medium">
							Topics ({topicNames.length})
						</dt>
						<dd className="mt-2">
							{topicNames.length ? (
								<ul className="text-foreground list-inside list-disc space-y-1.5 text-base leading-snug">
									{topicNames.map((name, i) => (
										<li key={`${i}-${name}`}>{name}</li>
									))}
								</ul>
							) : (
								<p className="text-muted-foreground text-base">—</p>
							)}
						</dd>
					</div>
					<div className="grid gap-5 medium:grid-cols-2">
						<div>
							<dt className="text-muted-foreground text-sm font-medium">Difficulty</dt>
							<dd className="mt-1.5 text-foreground text-base leading-snug">
								{difficultyLabel}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground text-sm font-medium">Duration</dt>
							<dd className="mt-1.5 text-foreground text-base leading-snug">
								{durationLabel}
							</dd>
						</div>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}

function PracticeStepIndicator({
	step,
	labels,
}: {
	step: number;
	labels: readonly string[];
}) {
	const total = labels.length;
	const currentLabel = labels[step] ?? "";

	return (
		<nav
			aria-label={`Practice setup. Step ${step + 1} of ${total}: ${currentLabel}`}
			className="w-full"
		>
			<div
				className="flex w-full gap-1.5 medium:gap-2"
				aria-hidden
				role="presentation"
			>
				{labels.map((_, i) => {
					const isCurrent = i === step;
					const isDone = i < step;
					return (
						<div
							key={`practice-step-seg-${i}`}
							className={cn(
								"h-1.5 min-h-0 flex-1 rounded-full transition-colors medium:h-2",
								isDone && "bg-emerald-600 dark:bg-emerald-500",
								isCurrent &&
									"bg-emerald-600 ring-1 ring-emerald-500/45 ring-offset-1 ring-offset-background dark:bg-emerald-500",
								!isDone && !isCurrent && "bg-muted",
							)}
						/>
					);
				})}
			</div>
			<p className="text-muted-foreground mt-3 text-left text-sm tabular-nums">
				Step <span className="text-foreground font-medium">{step + 1}</span> of {total}
			</p>
		</nav>
	);
}

export function PracticeTestWizard({
	enrolledSubjects,
	performanceRows,
	loadError,
	profileGrade,
	showPromptPreview,
	subjectProgressBySubjectId,
}: PracticeTestWizardProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const paywall = usePaywall();
	const STEP_LABELS = [
		"Subject",
		"Topics",
		"Difficulty & time",
		showPromptPreview ? "Prompt preview" : "Confirm & generate",
	] as const;

	const subjectClusters = React.useMemo(() => clusterSubjectsByGroup(enrolledSubjects), [enrolledSubjects]);

	const [step, setStep] = React.useState(0);
	const [subjectId, setSubjectId] = React.useState<string | null>(null);
	const [selectedTrackerIds, setSelectedTrackerIds] = React.useState<Set<string>>(() => new Set());
	const [focusArea, setFocusArea] = React.useState<FocusArea>("all");
	// Only show the inline red "Select at least one topic" nag after the
	// student actively tries to continue — so a fresh form never reads as wrong.
	const [attemptedContinueStep1, setAttemptedContinueStep1] = React.useState(false);
	// Drives bulk expand / collapse of chapter collapsibles via a version key.
	const [chapterOpenMode, setChapterOpenMode] = React.useState<"initial" | "all" | "none">(
		"initial",
	);
	const [chapterVersion, setChapterVersion] = React.useState(0);
	const [difficulty, setDifficulty] = React.useState<PracticeDifficulty>("medium");
	const [durationSeconds, setDurationSeconds] = React.useState<number>(3600);
	const practicePlan = React.useMemo(() => getPracticeQuestionPlan(durationSeconds), [durationSeconds]);
	const [stepError, setStepError] = React.useState<string | null>(null);
	const [actionError, setActionError] = React.useState<string | null>(null);
	const [pending, setPending] = React.useState(false);
	const [nonPreviewSuccess, setNonPreviewSuccess] = React.useState(false);
	const [previewPayload, setPreviewPayload] = React.useState<{
		userMessageJson: string;
		systemPrompt: string;
		canonicalTopics: PracticeCanonicalTopic[];
	} | null>(null);
	const [generating, setGenerating] = React.useState(false);
	const [generatingStatusIndex, setGeneratingStatusIndex] = React.useState(0);
	const generateAbortRef = React.useRef<AbortController | null>(null);
	// Phase 4: preview payload (a fully-generated test ready for inspection).
	const [generatedPreview, setGeneratedPreview] = React.useState<{
		testId: string;
		subjectName: string;
		questions: { question_number: number; question_text: string; question_type: string; topic_id: string; topic_name: string }[];
		topicDistribution: Record<string, number>;
	} | null>(null);
	// Phase 4: cache the last successful finalize result to avoid re-calling
	// the server action when the student toggles back and forth.
	const finalizeCacheRef = React.useRef<{
		key: string;
		payload: {
			userMessageJson: string;
			systemPrompt: string;
			canonicalTopics: PracticeCanonicalTopic[];
		} | null;
	} | null>(null);

	const subjectRows = React.useMemo(
		() => (subjectId ? performanceRows.filter((r) => r.subjectId === subjectId) : []),
		[performanceRows, subjectId],
	);

	const sortedSubjectRows = React.useMemo(
		() => sortPerformanceRows(subjectRows, "curriculum"),
		[subjectRows],
	);

	const topicGroups = React.useMemo(() => groupByUnitChapter(sortedSubjectRows), [sortedSubjectRows]);

	const practiceChapterSections = React.useMemo(() => {
		const sections: { sectionKey: string; unitName: string; chapter: ChapterGroup }[] = [];
		for (const unit of topicGroups) {
			for (const chapter of unit.chapters) {
				sections.push({
					sectionKey: `${unit.unitNumber}-${chapter.chapterNumber}-${chapter.chapterName}`,
					unitName: unit.unitName,
					chapter,
				});
			}
		}
		return sections;
	}, [topicGroups]);

	const selectedSubjectName = enrolledSubjects.find((s) => s.id === subjectId)?.name ?? null;

	const reviewConfigSummary = React.useMemo(() => {
		const difficultyLabel =
			DIFFICULTY_OPTIONS.find(([value]) => value === difficulty)?.[1] ?? String(difficulty);
		const durationLabel =
			PRACTICE_DURATION_OPTIONS.find((opt) => opt.seconds === durationSeconds)?.label ?? "—";
		const topicNames =
			previewPayload?.canonicalTopics?.length ?
				previewPayload.canonicalTopics.map((t) => t.topicName)
			:	sortedSubjectRows.filter((r) => selectedTrackerIds.has(r.trackerId)).map((r) => r.topicName);

		return {
			subjectName: selectedSubjectName,
			difficultyLabel,
			durationLabel,
			topicNames,
		};
	}, [
		selectedSubjectName,
		difficulty,
		durationSeconds,
		previewPayload,
		sortedSubjectRows,
		selectedTrackerIds,
	]);

	const canPickEnoughTopics = subjectRows.length >= PRACTICE_MIN_TOPICS;
	const selectionOk = selectedTrackerIds.size >= PRACTICE_MIN_TOPICS;

	const isSubmitStep = !showPromptPreview && step === 2;
	const isResultStep = step === 3;

	const prevSubjectIdForResetRef = React.useRef<string | null>(null);
	React.useEffect(() => {
		const prev = prevSubjectIdForResetRef.current;
		if (prev !== null && prev !== subjectId) {
			setSelectedTrackerIds(new Set());
			setAttemptedContinueStep1(false);
		}
		prevSubjectIdForResetRef.current = subjectId;
	}, [subjectId]);

	// Clear the red nag the moment the student makes their first selection.
	React.useEffect(() => {
		if (attemptedContinueStep1 && selectedTrackerIds.size > 0) {
			setAttemptedContinueStep1(false);
		}
	}, [attemptedContinueStep1, selectedTrackerIds]);

	const appliedPracticeUrlRef = React.useRef(false);
	React.useLayoutEffect(() => {
		if (appliedPracticeUrlRef.current) return;
		if (!performanceRows.length) return;

		const rawTopics = searchParams.get("topicIds");
		const rawSubject = searchParams.get("subjectId");
		const markHandled = (replaceUrl: boolean) => {
			appliedPracticeUrlRef.current = true;
			if (replaceUrl) router.replace("/student/practice", { scroll: false });
		};

		if (!rawTopics?.trim()) {
			markHandled(false);
			return;
		}

		const topicIdsOrdered = parseTopicIdsSearchParam(rawTopics);
		if (!topicIdsOrdered.length) {
			markHandled(true);
			return;
		}

		const paramSubjectOk =
			rawSubject && uuidStringSchema.safeParse(rawSubject).success ? rawSubject : null;

		const rowByTopicId = new Map(performanceRows.map((r) => [r.topicId, r]));
		const matchedOrdered: PerformanceRowSerialized[] = [];
		const seenTracker = new Set<string>();
		for (const tid of topicIdsOrdered) {
			const row = rowByTopicId.get(tid);
			if (!row || seenTracker.has(row.trackerId)) continue;
			if (paramSubjectOk && row.subjectId !== paramSubjectOk) continue;
			seenTracker.add(row.trackerId);
			matchedOrdered.push(row);
		}

		if (!matchedOrdered.length) {
			markHandled(true);
			return;
		}

		const anchorSubjectId = paramSubjectOk ?? matchedOrdered[0].subjectId;
		const coherentRows = matchedOrdered.filter((r) => r.subjectId === anchorSubjectId);
		if (!coherentRows.length) {
			markHandled(true);
			return;
		}

		const trackerIds = new Set(coherentRows.map((r) => r.trackerId));
		setSubjectId(anchorSubjectId);
		setSelectedTrackerIds(trackerIds);
		setStepError(null);
		setActionError(null);

		const n = trackerIds.size;
		const skipToDifficulty = n >= PRACTICE_MIN_TOPICS;
		setStep(skipToDifficulty ? 2 : 1);

		// Phase 4: surface dropped topics in a non-blocking toast.
		const droppedCount = topicIdsOrdered.length - coherentRows.length;
		if (droppedCount > 0) {
			toast.warning(
				`${droppedCount} topic${droppedCount === 1 ? "" : "s"} from the link ${droppedCount === 1 ? "was" : "were"} skipped`,
				{
					description: "Those topics are no longer available for this subject.",
				},
			);
		}

		markHandled(true);
	}, [performanceRows, router, searchParams]);

	React.useEffect(() => {
		if (!generating) {
			setGeneratingStatusIndex(0);
			return;
		}
		const id = window.setInterval(() => {
			setGeneratingStatusIndex((i) => (i + 1) % GENERATING_STATUS_MESSAGES.length);
		}, GENERATING_STATUS_ROTATE_MS);
		return () => window.clearInterval(id);
	}, [generating]);

	const bulkSelectTrackers = React.useCallback((trackerIds: string[], shouldSelect: boolean) => {
		setSelectedTrackerIds((prev) => {
			const next = new Set(prev);
			if (!shouldSelect) {
				for (const id of trackerIds) next.delete(id);
				return next;
			}
			for (const id of trackerIds) {
				next.add(id);
			}
			return next;
		});
	}, []);

	const toggleTracker = (id: string) => {
		setSelectedTrackerIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
				return next;
			}
			next.add(id);
			return next;
		});
	};

	const addFocusAreaTopics = (area: FocusArea) => {
		if (area === "all") {
			setSelectedTrackerIds(new Set(subjectRows.map((r) => r.trackerId)));
			return;
		}
		const previous = new Set(selectedTrackerIds);
		let toAdd: string[] = [];
		if (area === "weak") {
			toAdd = subjectRows.filter((r) => r.status === "bad" || r.status === "satisfactory").map((r) => r.trackerId);
		} else if (area === "not_tested") {
			toAdd = subjectRows.filter((r) => r.status === "not_tested").map((r) => r.trackerId);
		} else if (area === "recent_errors") {
			// Closest approximation from the matrix alone: declining trend or bad status.
			toAdd = subjectRows
				.filter((r) => r.trend === "declining" || r.status === "bad")
				.map((r) => r.trackerId);
		}
		if (toAdd.length === 0) {
			toast.warning("No matching topics", { description: "Nothing to add for this filter." });
			return;
		}
		setSelectedTrackerIds((prev) => {
			const next = new Set(prev);
			for (const id of toAdd) next.add(id);
			return next;
		});
		toast.success(`Added ${toAdd.length} topic${toAdd.length === 1 ? "" : "s"}`, {
			description: `Focus area: ${FOCUS_AREA_OPTIONS.find((o) => o.value === area)?.label ?? area}.`,
			action: {
				label: "Undo",
				onClick: () => setSelectedTrackerIds(previous),
			},
		});
	};

	const goBack = () => {
		setStepError(null);
		setActionError(null);
		setAttemptedContinueStep1(false);
		if (step === 3) {
			// Do NOT clear previewPayload; it's cached in finalizeCacheRef and
			// restored if the config is unchanged. Do clear a staged preview test
			// because it has a live DB row; abandon it so nothing dangles.
			setNonPreviewSuccess(false);
			if (generatedPreview) {
				const testId = generatedPreview.testId;
				setGeneratedPreview(null);
				void abandonPracticeTest({ testId });
			}
		}
		setStep((s) => Math.max(0, s - 1));
	};

	const runGenerate = async (): Promise<void> => {
		setActionError(null);
		const parsedDifficulty = practiceDifficultySchema.safeParse(difficulty);
		const parsedDuration = practiceDurationSecondsInputSchema.safeParse(durationSeconds);
		if (!subjectId || !parsedDifficulty.success || !parsedDuration.success) {
			setActionError("Invalid configuration. Go back and check your choices.");
			return;
		}
		const abort = new AbortController();
		generateAbortRef.current = abort;
		setGenerating(true);
		try {
			const payload = {
				subjectId,
				trackerIds: [...selectedTrackerIds],
				difficulty: parsedDifficulty.data,
				durationSeconds: parsedDuration.data,
			};
			const useClientStream = process.env.NEXT_PUBLIC_PRACTICE_STREAM === "true";

			const resultPromise: Promise<GeneratePracticeResult> = (async () => {
				if (useClientStream) {
					const res = await fetch(
						`${typeof window !== "undefined" ? window.location.origin : ""}/api/student/practice/generate-stream`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(payload),
							signal: abort.signal,
						},
					);
					if (res.status === 404) {
						return generatePracticeTest(payload);
					}
					if (res.status === 402) {
						const j = (await res.json()) as {
							ok?: boolean;
							paywall?: boolean;
							message?: string;
							code?: string;
						};
						return {
							ok: false,
							code:
								j.code === "quota_tests" ? "quota_tests"
								: j.code === "trial_expired" ? "trial_expired"
								: "subscription_expired",
							message: j.message ?? "Subscription required.",
							paywall: true,
						} as GeneratePracticeResult;
					}
					if (!res.ok) {
						const j = (await res.json().catch(() => ({}))) as { message?: string };
						return {
							ok: false,
							code: "generation_failed",
							message: j.message ?? "Could not generate the test.",
						} as GeneratePracticeResult;
					}
					return readPracticeGenerateNdjsonResponse(res);
				}
				return generatePracticeTest(payload);
			})();

			const result = await Promise.race([
				resultPromise,
				new Promise<never>((_, reject) => {
					abort.signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
				}),
			]);
			if (abort.signal.aborted) return;
			if (!result.ok) {
				if (result.paywall) {
					const reason =
						result.code === "quota_tests"
							? "quota_tests"
							: result.code === "trial_expired"
								? "trial_expired"
								: "expired";
					paywall.show({ reason, message: result.message, surface: "practice" });
					return;
				}
				setActionError(result.message);
				return;
			}
			// Phase 4: instead of navigating straight to the session, stage the
			// generated test for Preview & Confirm.
			const topicDistribution: Record<string, number> = {};
			for (const q of result.questions) {
				topicDistribution[q.topic_name] = (topicDistribution[q.topic_name] ?? 0) + 1;
			}
			setGeneratedPreview({
				testId: result.testId,
				subjectName: result.subjectName,
				questions: result.questions.map((q) => ({
					question_number: q.question_number,
					question_text: q.question_text,
					question_type: q.question_type,
					topic_id: q.topic_id,
					topic_name: q.topic_name,
				})),
				topicDistribution,
			});
			router.refresh();
		} catch (e) {
			if ((e as Error).message !== "cancelled") {
				setActionError(e instanceof Error ? e.message : "Generation failed.");
			}
		} finally {
			setGenerating(false);
			generateAbortRef.current = null;
		}
	};

	const cancelGenerate = React.useCallback(() => {
		generateAbortRef.current?.abort();
	}, []);

	const runFinalize = async (): Promise<boolean> => {
		setActionError(null);
		setNonPreviewSuccess(false);
		const parsedDifficulty = practiceDifficultySchema.safeParse(difficulty);
		const parsedDuration = practiceDurationSecondsInputSchema.safeParse(durationSeconds);
		if (!subjectId || !parsedDifficulty.success || !parsedDuration.success) {
			setActionError("Invalid configuration. Go back and check your choices.");
			return false;
		}
		// Cache key: config hash. If identical to the last successful call,
		// reuse the cached payload without hitting the server again.
		const cacheKey = JSON.stringify({
			subjectId,
			difficulty: parsedDifficulty.data,
			durationSeconds: parsedDuration.data,
			trackers: [...selectedTrackerIds].sort(),
		});
		if (finalizeCacheRef.current?.key === cacheKey) {
			const cached = finalizeCacheRef.current.payload;
			if (cached) {
				setPreviewPayload(cached);
			} else {
				setNonPreviewSuccess(true);
			}
			setStep(3);
			return true;
		}
		setPending(true);
		try {
			const result = await finalizePracticeConfig({
				subjectId,
				trackerIds: [...selectedTrackerIds],
				difficulty: parsedDifficulty.data,
				durationSeconds: parsedDuration.data,
			});
			if (!result.ok) {
				setActionError(result.message);
				return false;
			}
			if (showPromptPreview && result.userMessageJson && result.systemPrompt) {
				const payload = {
					userMessageJson: result.userMessageJson,
					systemPrompt: result.systemPrompt,
					canonicalTopics: result.canonicalTopics ?? [],
				};
				setPreviewPayload(payload);
				finalizeCacheRef.current = { key: cacheKey, payload };
				setStep(3);
			} else {
				setNonPreviewSuccess(true);
				finalizeCacheRef.current = { key: cacheKey, payload: null };
				setStep(3);
			}
			return true;
		} finally {
			setPending(false);
		}
	};

	function goNext() {
		setStepError(null);
		setActionError(null);

		if (step === 0) {
			const parsed = practiceStep0Schema.safeParse({ subjectId });
			if (!parsed.success) {
				setStepError(formatStepErrors(parsed.error));
				return;
			}
			setStep(1);
			return;
		}

		if (step === 1) {
			const parsed = practiceStep1Schema.safeParse({
				trackerIds: [...selectedTrackerIds],
			});
			if (!canPickEnoughTopics) {
				setStepError("This subject has no topics in your tracker. Choose another subject.");
				return;
			}
			if (!parsed.success) {
				setAttemptedContinueStep1(true);
				setStepError(formatStepErrors(parsed.error));
				return;
			}
			setAttemptedContinueStep1(false);
			setStep(2);
			return;
		}

		if (step === 2 && showPromptPreview) {
			const fields = practiceStep2FieldsSchema.safeParse({ difficulty, durationSeconds });
			if (!fields.success) {
				setStepError(formatStepErrors(fields.error));
				return;
			}
			void runFinalize();
		}
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (showPromptPreview) return;
		if (step !== 2) return;

		setStepError(null);
		setActionError(null);

		const fields = practiceStep2FieldsSchema.safeParse({ difficulty, durationSeconds });
		if (!fields.success) {
			setStepError(formatStepErrors(fields.error));
			return;
		}

		await runFinalize();
	}

	const copyText = async (label: string, text: string) => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			setActionError(`Could not copy ${label} to the clipboard.`);
		}
	};

	if (loadError) {
		return (
			<div className="py-6 medium:py-8">
				<Alert variant="destructive">
					<AlertTitle>Could not load practice data</AlertTitle>
					<AlertDescription>{loadError}</AlertDescription>
				</Alert>
			</div>
		);
	}

	if (!enrolledSubjects.length) {
		return (
			<div className="py-6 medium:py-8">
				<Alert>
					<AlertTitle>No subjects found</AlertTitle>
					<AlertDescription>
						We couldn’t find subjects for your account yet. Wait a few minutes, refresh, or ask your school if
						enrollment is still being set up.
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return (
		<div className="w-full py-6 medium:py-8">
			<div className="flex w-full min-w-0 flex-col gap-6 medium:gap-8">
				<div className="flex shrink-0 flex-col gap-1.5">
					<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">Practice</h1>
					<PageHeaderSubtext>
						Build a timed practice test from the topics you’re already tracking, with questions matched to your class and syllabus.
					</PageHeaderSubtext>
				</div>

				<form onSubmit={handleSubmit} className="flex w-full flex-col gap-7" noValidate>
					<div className="shrink-0 px-1">
						<PracticeStepIndicator step={step} labels={STEP_LABELS} />
					</div>

					<div className="flex flex-col gap-7 pr-1">
						{step === 0 ? (
					<div className={cn(cardSurfaceFrameClassName, "space-y-6 p-5 medium:p-7")}>
						<div className="space-y-1.5">
							<h2 className="font-semibold text-foreground text-xl tracking-tight medium:text-[1.375rem]">
								Choose a subject
							</h2>
							<p className="text-muted-foreground text-sm leading-relaxed medium:text-base">
								Choose the subject you want to revise. We’ll use your performance tracker for that subject—you
								can go back and change it before you start the test.
							</p>
						</div>
						<FieldSet className="gap-5">
							<FieldLegend variant="label" className="sr-only">
								Subjects
							</FieldLegend>
							<FieldGroup data-slot="radio-group" className="gap-10">
								{subjectClusters.map((cluster, clusterIndex) => (
									<div
										key={
											cluster.groupLabel
												? `${cluster.groupLabel}-${clusterIndex}`
												: `subjects-${clusterIndex}`
										}
										className="flex flex-col gap-4"
									>
										{cluster.groupLabel ? (
											<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
												<p className="text-muted-foreground font-mono text-[12.375px] font-medium tracking-[0.08em] uppercase">
													{cluster.groupLabel}
												</p>
												<p className="text-muted-foreground text-xs tabular-nums">
													{cluster.items.length} subject{cluster.items.length === 1 ? "" : "s"}
												</p>
											</div>
										) : null}
										<div className="grid grid-cols-1 gap-3 medium:grid-cols-2">
											{cluster.items.map((s) => {
												const selected = subjectId === s.id;
												const {
													Icon: SubjectIcon,
													shellClassName,
													iconClassName,
												} = getSubjectCardIconConfig(s.name);
												const progress = subjectProgressBySubjectId[s.id];
												return (
													<button
														key={s.id}
														type="button"
														aria-pressed={selected}
														onClick={() => setSubjectId(s.id)}
														className={cn(
															"flex min-h-[4.25rem] w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow] medium:gap-4 medium:px-4",
															"focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
															selected
																? "border-emerald-600 bg-emerald-600/[0.09] dark:border-emerald-500 dark:bg-emerald-500/12"
																: "border-border bg-background/70 hover:border-emerald-600/40 hover:bg-muted/35 dark:bg-card/50",
														)}
													>
														<span
															className={cn(
																"flex size-10 shrink-0 items-center justify-center rounded-lg border medium:size-11",
																selected
																	? "border-emerald-600/35 bg-emerald-600/12 text-emerald-800 ring-1 ring-emerald-600/25 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30"
																	: cn("border-border/80 ring-1", shellClassName),
															)}
															aria-hidden
														>
															<SubjectIcon
																className={cn(
																	"size-[1.125rem] medium:size-5",
																	selected ?
																		"text-emerald-800 dark:text-emerald-200"
																	:	iconClassName,
																)}
																strokeWidth={1.75}
															/>
														</span>
														<div className="min-w-0 flex-1">
															<span className="block text-[1.0546875rem] font-medium leading-snug medium:text-base">
																{s.name}
															</span>
															{progress ?
																<span className="text-muted-foreground mt-1 block space-y-0.5 text-xs leading-snug tabular-nums">
																	<span className="block">
																		{progress.totalQuestions > 0 ?
																			<>
																				{progress.answeredCount}/{progress.totalQuestions} answered
																			</>
																		:	<>{progress.answeredCount} answered</>}
																		{typeof progress.topicsCovered === "number" && progress.topicsCovered > 0 ? (
																			<>
																				{" · "}
																				{progress.topicsCovered} topic
																				{progress.topicsCovered === 1 ? "" : "s"}
																			</>
																		) : null}
																		{(() => {
																			const started = progress.startedAt
																				? Date.parse(progress.startedAt)
																				: 0;
																			const limit = progress.timeLimitSeconds ?? 0;
																			if (!started || !limit) return null;
																			const left = Math.max(
																				0,
																				limit - Math.floor((Date.now() - started) / 1000),
																			);
																			if (left <= 0) {
																				return (
																					<span className="text-destructive"> · time up</span>
																				);
																			}
																			const mm = Math.floor(left / 60);
																			return (
																				<span>
																					{" · "}
																					{mm}m left
																				</span>
																			);
																		})()}
																		{" · "}
																		<Link
																			href={`/student/practice/${progress.testId}`}
																			className="text-emerald-800 underline-offset-4 hover:text-emerald-950 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
																			onClick={(e) => e.stopPropagation()}
																		>
																			Continue
																		</Link>
																	</span>
																	{typeof progress.lastTestScore === "number" ? (
																		<span className="text-foreground/70 block">
																			Last graded: {Math.round(progress.lastTestScore)}%
																		</span>
																	) : null}
																</span>
															:	null}
														</div>
														<span
															className={cn(
																"flex size-8 shrink-0 items-center justify-center rounded-full border medium:size-9",
																selected
																	? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
																	: "border-border/70 bg-transparent",
															)}
															aria-hidden
														>
															{selected ? <CheckIcon className="size-4" strokeWidth={2.5} /> : null}
														</span>
													</button>
												);
											})}
										</div>
									</div>
								))}
							</FieldGroup>
						</FieldSet>
					</div>
				) : null}

				{step === 1 && subjectId ? (
					<div className={cn(cardSurfaceFrameClassName, "flex flex-col gap-6 p-5 medium:p-7")}>
						<div className="space-y-1.5 shrink-0">
							<h2 className="font-semibold text-foreground text-xl tracking-tight medium:text-[1.375rem]">
								Topics
							</h2>
							<p className="text-muted-foreground text-sm leading-relaxed medium:text-base">
								Select the chapters or topics you want in this test for{" "}
								<span className="text-foreground font-medium">{selectedSubjectName}</span>. Need a refresher?{" "}
								<Link
									href="/student/performance"
									className="font-medium text-emerald-800 underline-offset-4 hover:text-emerald-950 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
								>
									Open your performance grid
									<span aria-hidden> →</span>
								</Link>
							</p>
						</div>
						{!canPickEnoughTopics ? (
							<Alert>
								<AlertTitle>Not enough topics</AlertTitle>
								<AlertDescription>
									This subject doesn’t have topics in your tracker yet. Pick a different subject or reach out to
									support if the list should be there.
								</AlertDescription>
							</Alert>
						) : (
							<div className="flex flex-col gap-6">
								<div className="flex flex-col gap-2.5 shrink-0">
									<span className="font-mono text-muted-foreground text-[11.5px] font-medium uppercase tracking-[0.09em]">
										Quick pick
									</span>
									<div
										role="radiogroup"
										aria-label="Quick pick"
										className="flex flex-wrap items-center gap-1.5"
									>
										{FOCUS_AREA_OPTIONS.map((opt) => (
											<button
												key={opt.value}
												type="button"
												role="radio"
												aria-checked={focusArea === opt.value}
												onClick={() => {
													setFocusArea(opt.value);
													addFocusAreaTopics(opt.value);
												}}
												className={cn(
													"rounded-full border px-3 py-1.5 text-sm transition-colors",
													"focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
													focusArea === opt.value
														? "border-emerald-600 bg-emerald-600/10 text-emerald-900 dark:border-emerald-500 dark:text-emerald-200"
														: "border-border bg-background hover:border-emerald-600/40 hover:bg-muted/40",
												)}
											>
												{opt.label}
											</button>
										))}
									</div>
									<p className="text-muted-foreground text-xs leading-snug">
										Quick picks add related topics; adjust the list below if you need something specific.
									</p>
								</div>

								<Separator className="shrink-0" />

								<div className="flex flex-col gap-3">
									<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
										<h3 className="font-mono text-muted-foreground text-[11.5px] font-medium uppercase tracking-[0.09em]">
											Chapters
										</h3>
										<div className="flex items-center gap-3 text-xs tabular-nums">
											<span
												className={cn(
													"transition-colors",
													selectedTrackerIds.size > 0
														? "text-foreground font-medium"
														: "text-muted-foreground",
												)}
											>
												{selectedTrackerIds.size} selected
											</span>
											{selectedTrackerIds.size > 0 ? (
												<>
													<span aria-hidden className="text-border">
														·
													</span>
													<button
														type="button"
														onClick={() => setSelectedTrackerIds(new Set())}
														className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
													>
														Clear
													</button>
												</>
											) : null}
											<span aria-hidden className="text-border">
												·
											</span>
											<button
												type="button"
												onClick={() => {
													setChapterOpenMode("all");
													setChapterVersion((v) => v + 1);
												}}
												className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
											>
												Expand all
											</button>
											<span aria-hidden className="text-border">
												·
											</span>
											<button
												type="button"
												onClick={() => {
													setChapterOpenMode("none");
													setChapterVersion((v) => v + 1);
												}}
												className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
											>
												Collapse all
											</button>
										</div>
									</div>
									<p className="text-muted-foreground text-xs leading-snug">
										Expand a chapter to pick topics, or use the chapter checkbox to select the whole
										chapter.
									</p>
									{attemptedContinueStep1 && !selectionOk ? (
										<p className="text-destructive text-sm" role="status">
											Select at least one topic to continue.
										</p>
									) : null}
									<div
										className={cn("rounded-lg", practiceTopicMatrixSurfaceClass)}
										onWheel={forwardWheelToWizardStepScroll}
									>
										<div className="flex flex-col gap-2.5 p-2 medium:p-2.5">
													{practiceChapterSections.map(({ sectionKey, unitName, chapter }, ci) => {
														const chapterIds = trackerIdsForChapter(chapter);
														const chSel = selectionFlagsForIds(selectedTrackerIds, chapterIds);
														const selectedCountInChapter = chapterIds.reduce(
															(n, id) => (selectedTrackerIds.has(id) ? n + 1 : n),
															0,
														);
														const defaultOpen =
															chapterOpenMode === "all"
																? true
																: chapterOpenMode === "none"
																	? false
																	: ci === 0;
														return (
															<Collapsible
																key={`${sectionKey}-v${chapterVersion}`}
																defaultOpen={defaultOpen}
																className="rounded-lg border border-border/80 bg-muted/20 dark:bg-muted/10"
															>
																<div className="flex w-full items-center gap-1.5 px-3 medium:px-3.5">
																	<div
																		className="flex shrink-0 items-center"
																		onClick={(e) => e.stopPropagation()}
																		onKeyDown={(e) => e.stopPropagation()}
																	>
																		<IndeterminateCheckbox
																			checked={chSel.all}
																			indeterminate={chSel.some}
																			disabled={chapterIds.length === 0}
																			aria-label={`Select all topics in chapter ${chapter.chapterNumber}: ${chapter.chapterName}`}
																			className={practiceTopicMatrixCheckCircleClass}
																			onClick={(e) => e.stopPropagation()}
																			onChange={(e) => {
																				e.stopPropagation();
																				bulkSelectTrackers(chapterIds, e.target.checked);
																			}}
																		/>
																	</div>
																	<CollapsibleTrigger
																		className={cn(
																			"group flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-3.5 text-left outline-none transition-colors",
																			"hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
																		)}
																	>
																		<ChevronDownIcon
																			className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
																			aria-hidden
																		/>
																		<span className="min-w-0 flex-1 truncate text-base font-bold leading-snug tracking-tight text-foreground medium:text-lg">
																			Chapter {chapter.chapterNumber}: {chapter.chapterName}
																		</span>
																		{selectedCountInChapter > 0 ? (
																			<span
																				className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/12 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-800 tabular-nums dark:bg-emerald-500/15 dark:text-emerald-300"
																				aria-label={`${selectedCountInChapter} selected in this chapter`}
																			>
																				<span
																					aria-hidden
																					className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"
																				/>
																				{selectedCountInChapter} selected
																			</span>
																		) : null}
																		<span className="font-mono text-muted-foreground text-[11px] tabular-nums">
																			{chapter.rows.length} topics
																		</span>
																	</CollapsibleTrigger>
																</div>
																<CollapsibleContent className="p-3 medium:p-3.5">
																	<div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border/90 bg-background/70 p-3 shadow-sm dark:bg-background/50">
																		<table className="w-full min-w-[42rem] text-sm">
																			<caption className="sr-only">
																				Topics for Chapter {chapter.chapterNumber}: {chapter.chapterName}. Syllabus unit:{" "}
																				{unitName}.
																			</caption>
																								<thead>
																									<tr className="border-border border-b bg-muted/40 text-left">
																										<th
																											scope="col"
																											className="w-10 px-2 py-2.5 font-mono text-muted-foreground text-xs uppercase tracking-wider"
																										>
																											<span className="sr-only">Select topic</span>
																										</th>
																										<th
																											scope="col"
																											className="min-w-[12rem] px-3 py-2.5 text-start font-medium text-foreground text-xs"
																										>
																											Topic</th>
																										<th
																											scope="col"
																											className="min-w-[10.5rem] px-3 py-2.5 font-medium text-foreground text-xs"
																										>
																											Performance</th>
																										<th
																											scope="col"
																											className="min-w-[5.5rem] px-3 py-2.5 font-medium text-foreground text-xs"
																										>
																											Tests taken
																										</th>
																										<th
																											scope="col"
																											className="min-w-[7rem] px-3 py-2.5 font-medium text-muted-foreground text-xs"
																										>
																											Last test</th>
																										<th
																											scope="col"
																											className="min-w-[6.5rem] px-3 py-2.5 font-medium text-muted-foreground text-xs"
																										>
																											Trend
																										</th>
																									</tr>
																								</thead>
																								<tbody>
																									{chapter.rows.map((row) => {
																										const checked = selectedTrackerIds.has(row.trackerId);
																										return (
																											<tr
																												key={row.trackerId}
																												className={cn(
																													"border-border border-s-4 border-b last:border-b-0",
																													statusRowAccentClass(row.status),
																													"cursor-pointer hover:bg-muted/35",
																												)}
																												onClick={() => {
																													toggleTracker(row.trackerId);
																												}}
																												onKeyDown={(e) => {
																													if (e.key === "Enter" || e.key === " ") {
																														e.preventDefault();
																														toggleTracker(row.trackerId);
																													}
																												}}
																												tabIndex={0}
																												title={`${row.subjectName} — ${statusLabel(row.status)}. Average ${formatScore(row.averageScore)}, ${row.testsTaken} tests taken.`}
																											>
																												<td
																													className="px-2 py-2.5 align-middle"
																													onClick={(e) => e.stopPropagation()}
																												>
																													<input
																														type="checkbox"
																														checked={checked}
																														aria-label={`Select ${row.topicName}`}
																														className={practiceTopicMatrixCheckCircleClass}
																														onChange={() => toggleTracker(row.trackerId)}
																													/>
																												</td>
																												<th
																													scope="row"
																													className="max-w-[20rem] px-3 py-2.5 text-start align-middle text-sm text-foreground/95 leading-snug font-normal medium:text-[15px]"
																												>
																													{row.topicName}
																												</th>
																												<td className="px-3 py-2.5 align-middle">
																													<div className="flex flex-wrap items-center gap-1.5">
																														<Badge
																															variant={statusBadgeVariant(row.status)}
																															className={performanceStatusBadgeClass(row.status)}
																														>
																															{statusLabel(row.status)}
																														</Badge>
																														{row.averageScore != null ? (
																															<span className="text-muted-foreground text-xs tabular-nums">
																																Avg {Math.round(row.averageScore)}%
																															</span>
																														) : null}
																													</div>
																												</td>
																												<td className="px-3 py-2.5 align-middle">
																													<div className="flex flex-col gap-0.5">
																														<span className="font-semibold text-foreground text-xl tabular-nums tracking-tight leading-none">
																															{row.testsTaken}
																														</span>
																														<span className="text-[11px] text-muted-foreground leading-tight">
																															{row.testsTaken === 1 ? "test" : "tests"}
																														</span>
																													</div>
																												</td>
																												<td className="px-3 py-2.5 align-middle font-mono text-muted-foreground text-xs tabular-nums">
																													{formatLastTest(row.lastTestDate)}
																												</td>
																												<td className="px-3 py-2.5 align-middle">
																													<span className="inline-flex items-center gap-1.5">
																														{trendIcon(row)}
																														<span className="text-muted-foreground text-xs">
																															{trendLabel(row.trend)}
																														</span>
																													</span>
																												</td>
																											</tr>
																										);
																									})}
																								</tbody>
																							</table>
																						</div>
																	</CollapsibleContent>
																</Collapsible>
														);
													})}
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				) : null}

				{step === 2 && subjectId ? (
					<section
						className={cn(cardSurfaceFrameClassName, "space-y-6 p-5 medium:p-7")}
						aria-labelledby="practice-wizard-step-2-title"
					>
						<header className="space-y-1.5">
							<h2
								id="practice-wizard-step-2-title"
								className="font-semibold text-foreground text-xl tracking-tight medium:text-[1.375rem]"
							>
								Difficulty &amp; time
							</h2>
							<p className="text-muted-foreground text-sm leading-relaxed medium:text-base">
								Set how hard the questions should feel and how long you have—closer to an exam, or a quick
								sprint.
							</p>
						</header>

						<FieldSet>
							<FieldLegend variant="label" className="text-base">
								Difficulty
							</FieldLegend>
							<FieldGroup data-slot="radio-group" className="gap-4">
								{DIFFICULTY_OPTIONS.map(([value, label]) => (
									<Field key={value} orientation="horizontal">
										<input
											type="radio"
											name="difficulty"
											id={`diff-${value}`}
											checked={difficulty === value}
											onChange={() => setDifficulty(value)}
											className="size-5 border-input"
										/>
										<FieldLabel htmlFor={`diff-${value}`}>
											<Label className="text-base" htmlFor={`diff-${value}`}>
												{label}
											</Label>
										</FieldLabel>
									</Field>
								))}
							</FieldGroup>
						</FieldSet>

						<Separator />

						<FieldSet>
							<FieldLegend variant="label" className="text-base">
								Time limit
							</FieldLegend>
							<FieldGroup data-slot="radio-group" className="flex flex-wrap gap-3">
								{PRACTICE_DURATION_OPTIONS.map((opt) => (
									<Field key={opt.seconds} orientation="horizontal">
										<input
											type="radio"
											name="duration"
											id={`dur-${opt.seconds}`}
											checked={durationSeconds === opt.seconds}
											onChange={() => setDurationSeconds(opt.seconds)}
											className="size-5 border-input"
										/>
										<FieldLabel htmlFor={`dur-${opt.seconds}`}>
											<Label className="text-base" htmlFor={`dur-${opt.seconds}`}>
												{opt.label}
											</Label>
										</FieldLabel>
									</Field>
								))}
							</FieldGroup>
						</FieldSet>

						<Separator />

						<FieldSet>
							<FieldLegend variant="label" className="text-base">
								Question mix
							</FieldLegend>
							<p className="text-foreground text-sm leading-relaxed">
								<span className="font-medium tabular-nums">{practicePlan.total}</span> questions:{" "}
								<span className="tabular-nums">{practicePlan.counts.multiple_choice}</span> multiple choice,{" "}
								<span className="tabular-nums">{practicePlan.counts.fill_in_blank}</span> fill-in-the-blank,{" "}
								<span className="tabular-nums">{practicePlan.counts.short_answer}</span> short answer,{" "}
								<span className="tabular-nums">{practicePlan.counts.long_answer}</span> long answer.
							</p>
							<p className="text-muted-foreground text-sm">
								For each time limit, we pick a set number and mix of question types (MCQ, short, long, and
								so on).
							</p>
						</FieldSet>
					</section>
				) : null}

				{step === 3 && !showPromptPreview && nonPreviewSuccess ?
					<div className="relative space-y-5">
						<PracticeReviewSummaryCard
							title="Ready to generate"
							description="We’ve saved your choices. When you’re ready, generate the paper—you’ll go straight to the timed test screen after."
							subjectName={reviewConfigSummary.subjectName}
							topicNames={reviewConfigSummary.topicNames}
							difficultyLabel={reviewConfigSummary.difficultyLabel}
							durationLabel={reviewConfigSummary.durationLabel}
						/>
					</div>
				:	null}

				{step === 3 && showPromptPreview && previewPayload ?
					<div className="space-y-5">
							<PracticeReviewSummaryCard
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
									onClick={() => void copyText("user message", previewPayload.userMessageJson)}
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
									onClick={() => void copyText("system prompt", previewPayload.systemPrompt)}
								>
									Copy
								</Button>
							</div>
							<pre className="bg-muted max-h-64 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
								{previewPayload.systemPrompt}
							</pre>
						</div>
					</div>
				:	null}

				<AnimateFormAlert show={Boolean(stepError)} motionKey="practice-step-error">
					<Alert variant="destructive">
						<AlertTitle>Check this step</AlertTitle>
						<AlertDescription>{stepError}</AlertDescription>
					</Alert>
				</AnimateFormAlert>

				<AnimateFormAlert show={Boolean(actionError)} motionKey="practice-action-error">
					<Alert variant="destructive">
						<AlertTitle>Something went wrong</AlertTitle>
						<AlertDescription className="flex flex-col gap-2">
							<span>{actionError}</span>
							{(actionError?.includes("Refresh") || actionError?.includes("no longer")) && (
								<Link
									href="/student/practice"
									className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
								>
									Refresh page
								</Link>
							)}
						</AlertDescription>
					</Alert>
				</AnimateFormAlert>
					</div>

					{!isResultStep ? (
					<div className="flex shrink-0 flex-col gap-3 medium:flex-row medium:flex-wrap medium:items-center">
						{step > 0 ? (
							<Button
								type="button"
								variant="ghost"
								className="order-2 h-11 min-h-11 w-full px-5 text-base text-muted-foreground hover:text-foreground medium:order-1 medium:mr-auto medium:w-auto medium:min-w-32"
								onClick={goBack}
								disabled={pending}
							>
								<ChevronDownIcon
									className="mr-1.5 size-4 rotate-90"
									aria-hidden
									strokeWidth={2}
								/>
								Back
							</Button>
						) : null}
						{isSubmitStep ? (
							<div className="order-1 w-full medium:order-2 medium:ml-auto medium:w-auto medium:min-w-52">
								<SubmitButton
									label="Save configuration"
									pendingLabel="Working…"
									busy={pending}
									className={cn(
										"h-11 min-h-11 px-6 text-base",
										practiceSolidCtaClassName,
									)}
								/>
							</div>
						) : step === 2 && showPromptPreview ? (
							<Button
								type="button"
								className={cn(
									"order-1 h-11 min-h-11 w-full px-6 text-base medium:order-2 medium:ml-auto medium:w-auto medium:min-w-52",
									practiceSolidCtaClassName,
								)}
								variant="default"
								disabled={pending}
								onClick={goNext}
							>
								{pending ? "Working…" : "Build prompt preview"}
							</Button>
						) : (
							<Button
								type="button"
								className={cn(
									"order-1 h-11 min-h-11 w-full px-6 text-base medium:order-2 medium:ml-auto medium:w-auto medium:min-w-52",
									practiceSolidCtaClassName,
								)}
								variant="default"
								onClick={goNext}
								disabled={
									(step === 0 && !subjectId) ||
									(step === 1 && !canPickEnoughTopics)
								}
							>
								Continue
							</Button>
						)}
					</div>
				) : !generatedPreview ? (
					<div className="flex shrink-0 flex-col gap-3 medium:flex-row medium:flex-wrap medium:items-center">
						<Button
							type="button"
							variant="ghost"
							className="order-3 h-11 min-h-11 w-full px-5 text-base text-muted-foreground hover:text-foreground medium:order-1 medium:mr-auto medium:w-auto medium:min-w-32"
							onClick={goBack}
							disabled={pending || generating}
						>
							<ChevronDownIcon className="mr-1.5 size-4 rotate-90" aria-hidden strokeWidth={2} />
							Back
						</Button>
						<Button
							type="button"
							className={cn(
								"order-1 h-11 min-h-11 w-full px-6 text-base medium:order-2 medium:ml-auto medium:w-auto medium:min-w-52",
								practiceSolidCtaClassName,
							)}
							onClick={() => void runGenerate()}
							disabled={pending || generating}
						>
							{generating ? "Generating…" : "Generate practice test"}
						</Button>
					</div>
				) : null}
				{generating || generatedPreview ?
					<div
						className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background/85 px-6 backdrop-blur-sm"
						aria-busy={generating}
						aria-live="polite"
					>
						{generating ? (
							<>
								<GridLoader size="lg" />
								<p
									key={generatingStatusIndex}
									className="text-muted-foreground max-w-sm px-4 text-center text-base leading-relaxed motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 motion-reduce:animate-none"
								>
									{GENERATING_STATUS_MESSAGES[generatingStatusIndex]}
								</p>
								<p className="text-muted-foreground px-4 text-center text-sm">
									This might take a minute or two.
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={cancelGenerate}
									className="mt-2"
								>
									<XIcon className="mr-1.5 size-4" aria-hidden />
									Cancel
								</Button>
							</>
						) : generatedPreview ? (
							<Card
								role="dialog"
								aria-modal="true"
								aria-labelledby="practice-ready-title"
								className="border-border/80 w-full max-w-md shadow-lg"
							>
								<CardHeader className="gap-3 text-center medium:text-left">
									<div
										className="mx-auto flex size-14 items-center justify-center rounded-full border border-emerald-600/35 bg-emerald-600/10 medium:mx-0"
										aria-hidden
									>
										<CheckIcon className="size-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
									</div>
									<CardTitle id="practice-ready-title" className="text-xl">
										Your test is ready
									</CardTitle>
									<CardDescription className="text-base leading-relaxed">
										The timer starts when you begin—get comfortable, then start when you’re ready to focus.
									</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-col gap-3 pt-0">
									<Button
										type="button"
										className={cn("h-11 w-full text-base", practiceSolidCtaClassName)}
										onClick={() => {
											if (!generatedPreview) return;
											router.push(`/student/practice/${generatedPreview.testId}`);
										}}
										disabled={pending}
									>
										Start test
									</Button>
									<Button
										type="button"
										variant="ghost"
										className="text-muted-foreground h-11 w-full"
										onClick={goBack}
										disabled={pending}
									>
										<ChevronDownIcon className="mr-1.5 size-4 rotate-90" aria-hidden strokeWidth={2} />
										Back
									</Button>
								</CardContent>
							</Card>
						) : null}
					</div>
				:	null}
				</form>
			</div>
		</div>
	);
}

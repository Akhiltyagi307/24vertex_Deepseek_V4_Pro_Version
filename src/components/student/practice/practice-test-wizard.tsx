"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import {
	abandonPracticeTest,
	finalizePracticeConfig,
	generatePracticeTest,
} from "../../../../app/student/practice/actions";
import type { GeneratePracticeResult } from "../../../../app/student/practice/actions/types";
import {
	initialWizardDraft,
	wizardDraftReducer,
} from "@/components/student/practice/wizard/wizard-draft-state";
import { AnimateFormAlert } from "@/components/motion/animate-form-alert";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { usePaywall } from "@/components/student/subscription/paywall-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
	getPracticeQuestionPlan,
	PRACTICE_DURATION_OPTIONS,
	PRACTICE_MAX_TOPICS,
	PRACTICE_MIN_TOPICS,
	practiceDifficultySchema,
	practiceDurationSecondsInputSchema,
	type PracticeCanonicalTopic,
} from "@/lib/practice";
import { BUCKET_TOTAL, GENERATION_BUCKETS } from "@/lib/practice/generation-progress-buckets";
import {
	clearPracticeWizardDraft,
	readPracticeWizardDraft,
	writePracticeWizardDraft,
} from "@/lib/practice/practice-session-storage";
import {
	groupByUnitChapter,
	type ChapterGroup,
	type PerformanceRowSerialized,
	sortPerformanceRows,
} from "@/lib/student/performance-matrix";
import { cn } from "@/lib/utils";

import {
	PracticeStreamError,
	readPracticeGenerateNdjsonResponse,
} from "./practice-test-wizard/generate-stream";
import { GenerationOverlay } from "./practice-test-wizard/generation-overlay";
import {
	formatStepErrors,
	parseTopicIdsSearchParam,
	uuidStringSchema,
} from "./practice-test-wizard/helpers";
import { StepConfig } from "./practice-test-wizard/step-config";
import { StepReview } from "./practice-test-wizard/step-review";
import { StepSubject } from "./practice-test-wizard/step-subject";
import { StepTopics } from "./practice-test-wizard/step-topics";
import {
	DIFFICULTY_OPTIONS,
	FOCUS_AREA_OPTIONS,
	type FocusArea,
	GENERATING_STATUS_ROTATE_MS,
	practiceStep0Schema,
	practiceStep1Schema,
	practiceStep2FieldsSchema,
	type PracticeEnrolledSubject,
	type PracticeSubjectProgress,
} from "./practice-test-wizard/types";
import { WizardFooter } from "./practice-test-wizard/wizard-footer";
import { WizardStepIndicator } from "./practice-test-wizard/wizard-step-indicator";

export type {
	PracticeEnrolledSubject,
	PracticeSubjectProgress,
} from "./practice-test-wizard/types";

export type PracticeTestWizardProps = {
	enrolledSubjects: PracticeEnrolledSubject[];
	performanceRows: PerformanceRowSerialized[];
	loadError: string | null;
	profileGrade?: number | null;
	showPromptPreview: boolean;
	subjectProgressBySubjectId: Record<string, PracticeSubjectProgress>;
	/** Phase 4: gates the dev-only "Build prompt preview" affordance. */
	isAdmin?: boolean;
	/** Required for wizard draft persistence cache key. */
	userId: string;
};

export function PracticeTestWizard({
	enrolledSubjects,
	performanceRows,
	loadError,
	showPromptPreview,
	subjectProgressBySubjectId,
	userId,
}: PracticeTestWizardProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const paywall = usePaywall();
	// Memoized so the array identity is stable across renders — the D22 step-
	// focus effect depends on this and would re-fire on every render otherwise.
	const STEP_LABELS = React.useMemo(
		() => [
			"Subject",
			"Topics",
			"Difficulty & time",
			showPromptPreview ? "Prompt preview" : "Confirm & generate",
		],
		[showPromptPreview],
	);

	const [draft, draftDispatch] = React.useReducer(wizardDraftReducer, initialWizardDraft);
	const { step, subjectId, focusArea, difficulty, durationSeconds } = draft;
	const [selectedTrackerIds, setSelectedTrackerIds] = React.useState<Set<string>>(() => new Set());
	const [attemptedContinueStep1, setAttemptedContinueStep1] = React.useState(false);
	const [chapterOpenMode, setChapterOpenMode] = React.useState<"initial" | "all" | "none">(
		"initial",
	);
	const [chapterVersion, setChapterVersion] = React.useState(0);
	const [stepError, setStepError] = React.useState<string | null>(null);
	const [actionError, setActionError] = React.useState<string | null>(null);
	const [actionErrorCorrelationId, setActionErrorCorrelationId] = React.useState<string | null>(null);
	const [pending, setPending] = React.useState(false);
	const [nonPreviewSuccess, setNonPreviewSuccess] = React.useState(false);
	const [previewPayload, setPreviewPayload] = React.useState<{
		userMessageJson: string;
		systemPrompt: string;
		canonicalTopics: PracticeCanonicalTopic[];
	} | null>(null);
	const [generating, setGenerating] = React.useState(false);
	const [generationDoneThrough, setGenerationDoneThrough] = React.useState(0);
	const [generationDraftedCount, setGenerationDraftedCount] = React.useState<number | null>(null);
	const generateAbortRef = React.useRef<AbortController | null>(null);
	/** Prevents overlapping `runGenerate` calls (e.g. rapid double activation before `generating` re-renders). */
	const generateInFlightRef = React.useRef(false);
	const [generatedPreview, setGeneratedPreview] = React.useState<{
		testId: string;
		subjectName: string;
		questions: { question_number: number; question_text: string; question_type: string; topic_id: string; topic_name: string }[];
		topicDistribution: Record<string, number>;
	} | null>(null);
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
	const selectionOk =
		selectedTrackerIds.size >= PRACTICE_MIN_TOPICS &&
		selectedTrackerIds.size <= PRACTICE_MAX_TOPICS;

	const isSubmitStep = !showPromptPreview && step === 2;
	const isResultStep = step === 3;

	// D22 (wizard step focus management): move keyboard focus to the active
	// step's container when `step` changes, and announce the new step's name to
	// assistive tech via the polite live region below. The first render is
	// skipped (`hasMountedRef`) so screen readers don't bark "Step 1: Subject"
	// on every page visit.
	const stepContainerRef = React.useRef<HTMLDivElement | null>(null);
	const hasMountedRef = React.useRef(false);
	const [liveAnnouncement, setLiveAnnouncement] = React.useState("");
	React.useEffect(() => {
		if (!hasMountedRef.current) {
			hasMountedRef.current = true;
			return;
		}
		const label = STEP_LABELS[step] ?? `Step ${step + 1}`;
		setLiveAnnouncement(`Step ${step + 1} of ${STEP_LABELS.length}: ${label}`);
		stepContainerRef.current?.focus();
	}, [step, STEP_LABELS]);

	const prevSubjectIdForResetRef = React.useRef<string | null>(null);
	React.useEffect(() => {
		const prev = prevSubjectIdForResetRef.current;
		if (prev !== null && prev !== subjectId) {
			setSelectedTrackerIds(new Set());
			setAttemptedContinueStep1(false);
		}
		prevSubjectIdForResetRef.current = subjectId;
	}, [subjectId]);

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

		const linkedTrackerIds = coherentRows.map((r) => r.trackerId);
		const cappedTrackerIds = linkedTrackerIds.slice(0, PRACTICE_MAX_TOPICS);
		const droppedAtCap = linkedTrackerIds.length - cappedTrackerIds.length;
		const trackerIds = new Set(cappedTrackerIds);
		draftDispatch({ type: "set_subject", subjectId: anchorSubjectId });
		setSelectedTrackerIds(trackerIds);
		setStepError(null);
		setActionError(null);
		setActionErrorCorrelationId(null);

		const n = trackerIds.size;
		const skipToDifficulty = n >= PRACTICE_MIN_TOPICS;
		draftDispatch({ type: "go_to_step", step: skipToDifficulty ? 2 : 1 });

		const droppedCount = topicIdsOrdered.length - coherentRows.length;
		if (droppedCount > 0) {
			toast.warning(
				`${droppedCount} topic${droppedCount === 1 ? "" : "s"} from the link ${droppedCount === 1 ? "was" : "were"} skipped`,
				{
					description: "Those topics are no longer available for this subject.",
				},
			);
		}
		if (droppedAtCap > 0) {
			toast.warning(`${PRACTICE_MAX_TOPICS}-topic limit applied`, {
				description: `Selected the first ${PRACTICE_MAX_TOPICS} of ${linkedTrackerIds.length} topics from the link.`,
			});
		}

		markHandled(true);
	}, [performanceRows, router, searchParams]);

	// Hydrate wizard draft from localStorage on first mount (per-user). Skipped
	// when the URL deep-link path already seeded state, so a `?topicIds=` link
	// always wins over a stale draft.
	const hydratedDraftRef = React.useRef(false);
	React.useEffect(() => {
		if (hydratedDraftRef.current) return;
		if (appliedPracticeUrlRef.current === false && searchParams.get("topicIds")?.trim()) {
			// Wait for URL hydrator to run first.
			return;
		}
		hydratedDraftRef.current = true;
		const draft = readPracticeWizardDraft(userId);
		if (!draft) return;
		// Filter trackerIds to ones that still exist for this user (subject /
		// curriculum may have changed since the draft was saved).
		const validTrackerIds = new Set(performanceRows.map((r) => r.trackerId));
		const restoredTrackerIds = draft.trackerIds.filter((id) => validTrackerIds.has(id));
		if (draft.subjectId) {
			draftDispatch({ type: "set_subject", subjectId: draft.subjectId });
		}
		draftDispatch({ type: "set_focus_area", value: draft.focusArea });
		draftDispatch({ type: "set_difficulty", value: draft.difficulty });
		draftDispatch({
			type: "set_duration",
			seconds: draft.durationSeconds as never,
		});
		setSelectedTrackerIds(new Set(restoredTrackerIds));
		// Clamp restored step to a sane value: never resume past step 2 since
		// step 3 is the result/preview surface and shouldn't auto-restore.
		const safeStep = Math.max(0, Math.min(2, draft.step));
		draftDispatch({ type: "go_to_step", step: safeStep });
		if (restoredTrackerIds.length < draft.trackerIds.length) {
			toast.info("Some saved topics are no longer available", {
				description: "We restored what we could from your previous session.",
			});
		}
	}, [userId, performanceRows, searchParams]);

	// Persist on every wizard-draft change (debounced via React batching). Skip
	// the very first render so we don't immediately overwrite the saved draft
	// with the initial empty state before hydration completes.
	const draftWriteEnabledRef = React.useRef(false);
	React.useEffect(() => {
		if (!draftWriteEnabledRef.current) {
			draftWriteEnabledRef.current = true;
			return;
		}
		writePracticeWizardDraft({
			userId,
			step,
			subjectId,
			trackerIds: [...selectedTrackerIds],
			difficulty,
			durationSeconds,
			focusArea,
		});
	}, [userId, step, subjectId, selectedTrackerIds, difficulty, durationSeconds, focusArea]);

	React.useEffect(() => {
		if (!generating) {
			setGenerationDoneThrough(0);
			setGenerationDraftedCount(null);
			return;
		}
		// When streaming is on, real `stage` events drive the checklist. Otherwise
		// (server-action fallback) advance it gently so it animates instead of
		// sitting on a bare spinner, but never auto-complete the last step.
		if (process.env.NEXT_PUBLIC_PRACTICE_STREAM === "true") return;
		const id = window.setInterval(() => {
			setGenerationDoneThrough((d) => (d < BUCKET_TOTAL - 1 ? d + 1 : d));
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
			let droppedAtCap = 0;
			for (const id of trackerIds) {
				if (next.has(id)) continue;
				if (next.size >= PRACTICE_MAX_TOPICS) {
					droppedAtCap++;
					continue;
				}
				next.add(id);
			}
			if (droppedAtCap > 0) {
				toast.warning(`${PRACTICE_MAX_TOPICS}-topic limit reached`, {
					description: `${droppedAtCap} topic${droppedAtCap === 1 ? " was" : "s were"} not added. Deselect some to add more.`,
				});
			}
			return next;
		});
	}, []);

	const toggleTracker = React.useCallback((id: string) => {
		setSelectedTrackerIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
				return next;
			}
			if (next.size >= PRACTICE_MAX_TOPICS) {
				toast.warning(`${PRACTICE_MAX_TOPICS}-topic limit reached`, {
					description: "Deselect a topic before adding another.",
				});
				return prev;
			}
			next.add(id);
			return next;
		});
	}, []);

	const addFocusAreaTopics = React.useCallback(
		(area: FocusArea) => {
			if (area === "all") {
				const all = subjectRows.map((r) => r.trackerId);
				const capped = all.slice(0, PRACTICE_MAX_TOPICS);
				setSelectedTrackerIds(new Set(capped));
				if (all.length > PRACTICE_MAX_TOPICS) {
					toast.warning(`${PRACTICE_MAX_TOPICS}-topic limit applied`, {
						description: `Selected the first ${PRACTICE_MAX_TOPICS} of ${all.length} topics.`,
					});
				}
				return;
			}
			const previous = new Set(selectedTrackerIds);
			let candidate: string[] = [];
			if (area === "weak") {
				candidate = subjectRows.filter((r) => r.status === "bad" || r.status === "satisfactory").map((r) => r.trackerId);
			} else if (area === "not_tested") {
				candidate = subjectRows.filter((r) => r.status === "not_tested").map((r) => r.trackerId);
			} else if (area === "recent_errors") {
				candidate = subjectRows
					.filter((r) => r.trend === "declining" || r.status === "bad")
					.map((r) => r.trackerId);
			}
			if (candidate.length === 0) {
				toast.warning("No matching topics", { description: "Nothing to add for this filter." });
				return;
			}
			const newOnes = candidate.filter((id) => !previous.has(id));
			const remaining = Math.max(0, PRACTICE_MAX_TOPICS - previous.size);
			const toAdd = newOnes.slice(0, remaining);
			if (toAdd.length === 0) {
				toast.warning(`${PRACTICE_MAX_TOPICS}-topic limit reached`, {
					description: "Deselect some topics before applying this quick pick.",
				});
				return;
			}
			setSelectedTrackerIds((prev) => {
				const next = new Set(prev);
				for (const id of toAdd) next.add(id);
				return next;
			});
			const droppedAtCap = newOnes.length - toAdd.length;
			toast.success(`Added ${toAdd.length} topic${toAdd.length === 1 ? "" : "s"}`, {
				description:
					droppedAtCap > 0 ?
						`${droppedAtCap} skipped. Limit is ${PRACTICE_MAX_TOPICS}.`
					:	`Focus area: ${FOCUS_AREA_OPTIONS.find((o) => o.value === area)?.label ?? area}.`,
				action: {
					label: "Undo",
					onClick: () => setSelectedTrackerIds(previous),
				},
			});
		},
		[subjectRows, selectedTrackerIds],
	);

	const goBack = () => {
		setStepError(null);
		setActionError(null);
		setActionErrorCorrelationId(null);
		setAttemptedContinueStep1(false);
		if (step === 3) {
			setNonPreviewSuccess(false);
			if (generatedPreview) {
				const testId = generatedPreview.testId;
				setGeneratedPreview(null);
				void abandonPracticeTest({ testId });
			}
		}
		draftDispatch({ type: "prev_step" });
	};

	const runGenerate = async (): Promise<void> => {
		setActionError(null);
		setActionErrorCorrelationId(null);
		const parsedDifficulty = practiceDifficultySchema.safeParse(difficulty);
		const parsedDuration = practiceDurationSecondsInputSchema.safeParse(durationSeconds);
		if (!subjectId || !parsedDifficulty.success || !parsedDuration.success) {
			setActionError("Invalid configuration. Go back and check your choices.");
			setActionErrorCorrelationId(null);
			return;
		}
		if (generateInFlightRef.current) {
			return;
		}
		generateInFlightRef.current = true;
		const abort = new AbortController();
		generateAbortRef.current = abort;
		setGenerating(true);
		setGenerationDoneThrough(0);
		setGenerationDraftedCount(null);
		try {
			const payload = {
				subjectId,
				trackerIds: [...selectedTrackerIds],
				difficulty: parsedDifficulty.data,
				durationSeconds: parsedDuration.data,
				focusArea,
			};
			// Durable async path (review H2 increment 3): enqueue a background job,
			// poll progress, then navigate into the finished test. Survives the 300s
			// ceiling / disconnects; idempotent via clientRequestId. Flag-gated;
			// streaming path below stays the default until this UX is proven.
			const useAsyncGenerate = process.env.NEXT_PUBLIC_PRACTICE_ASYNC_GENERATE === "true";
			if (useAsyncGenerate) {
				const origin = typeof window !== "undefined" ? window.location.origin : "";
				const clientRequestId = crypto.randomUUID();
				const enqueueRes = await fetch(`${origin}/api/student/practice/generate`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ...payload, clientRequestId }),
					signal: abort.signal,
				});
				if (enqueueRes.status === 402) {
					const j = (await enqueueRes.json().catch(() => ({}))) as { message?: string; code?: string };
					const reason = j.code === "quota_tests" ? "quota_tests" : j.code === "trial_expired" ? "trial_expired" : "expired";
					paywall.show({ reason, message: j.message ?? "Subscription required.", surface: "practice" });
					return;
				}
				if (!enqueueRes.ok) {
					const j = (await enqueueRes.json().catch(() => ({}))) as { message?: string };
					setActionError(j.message ?? "Could not start generation. Please try again.");
					setActionErrorCorrelationId(null);
					return;
				}
				const enq = (await enqueueRes.json()) as { testId?: string; alreadyGenerated?: boolean };
				if (enq.alreadyGenerated && enq.testId) {
					clearPracticeWizardDraft();
					router.push(`/student/practice/${enq.testId}`);
					return;
				}
				let polls = 0;
				const maxPolls = 200;
				while (!abort.signal.aborted) {
					await new Promise((resolve) => setTimeout(resolve, 2000));
					if (abort.signal.aborted) return;
					if (++polls > maxPolls) {
						setActionError(
							"This is taking longer than usual — your test will appear in your practice list when it's ready.",
						);
						setActionErrorCorrelationId(null);
						return;
					}
					let st: { status?: string; testId?: string; message?: string; doneThrough?: number };
					try {
						const statusRes = await fetch(`${origin}/api/student/practice/generate/status?key=${clientRequestId}`, {
							signal: abort.signal,
						});
						if (!statusRes.ok) continue;
						st = (await statusRes.json()) as typeof st;
					} catch {
						if (abort.signal.aborted) return;
						continue;
					}
					if (typeof st.doneThrough === "number") {
						const dt = st.doneThrough;
						setGenerationDoneThrough((d) => Math.max(d, dt));
						const nextLabel = GENERATION_BUCKETS[dt - 1]?.label;
						if (nextLabel) setLiveAnnouncement(nextLabel);
					}
					if (st.status === "failed") {
						setActionError(st.message ?? "Generation failed. Please try again.");
						setActionErrorCorrelationId(null);
						return;
					}
					if (st.status === "done" && st.testId) {
						clearPracticeWizardDraft();
						router.push(`/student/practice/${st.testId}`);
						return;
					}
				}
				return;
			}
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
					if (res.status === 429) {
						const j = (await res.json().catch(() => ({}))) as { message?: string };
						return {
							ok: false,
							code: "rate_limited",
							message:
								j.message ?? "You're generating tests too quickly. Please wait a moment and try again.",
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
					return readPracticeGenerateNdjsonResponse(res, {
						onPartialProgress: ({ draftedQuestions }) => {
							if (draftedQuestions <= 0) return;
							setGenerationDraftedCount((c) => Math.max(c ?? 0, draftedQuestions));
						},
						onStage: (stage) => {
							if (stage.status !== "done") return;
							setGenerationDoneThrough((d) => Math.max(d, stage.index));
							const nextLabel = GENERATION_BUCKETS[stage.index]?.label;
							if (nextLabel) setLiveAnnouncement(nextLabel);
						},
					});
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
				setActionErrorCorrelationId(result.correlationId ?? null);
				return;
			}
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
			// Successful generation — clear the saved draft so a return visit
			// to /student/practice doesn't auto-restore stale selections from
			// the test we just kicked off.
			clearPracticeWizardDraft();
			router.refresh();
		} catch (e) {
			if ((e as Error).message !== "cancelled") {
				if (e instanceof PracticeStreamError) {
					setActionError(e.message);
					setActionErrorCorrelationId(e.correlationId ?? null);
					return;
				}
				setActionError(e instanceof Error ? e.message : "Generation failed.");
				setActionErrorCorrelationId(null);
			}
		} finally {
			setGenerating(false);
			setGenerationDraftedCount(null);
			generateAbortRef.current = null;
			generateInFlightRef.current = false;
		}
	};

	const cancelGenerate = React.useCallback(() => {
		generateAbortRef.current?.abort();
		toast.info("Generation cancelled.");
	}, []);

	const generationDraftedTotal = React.useMemo(() => {
		const parsed = practiceDurationSecondsInputSchema.safeParse(durationSeconds);
		return parsed.success ? getPracticeQuestionPlan(parsed.data).total : null;
	}, [durationSeconds]);

	const runFinalize = async (): Promise<boolean> => {
		setActionError(null);
		setActionErrorCorrelationId(null);
		setNonPreviewSuccess(false);
		const parsedDifficulty = practiceDifficultySchema.safeParse(difficulty);
		const parsedDuration = practiceDurationSecondsInputSchema.safeParse(durationSeconds);
		if (!subjectId || !parsedDifficulty.success || !parsedDuration.success) {
			setActionError("Invalid configuration. Go back and check your choices.");
			setActionErrorCorrelationId(null);
			return false;
		}
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
			draftDispatch({ type: "go_to_step", step: 3 });
			return true;
		}
		setPending(true);
		try {
			const result = await finalizePracticeConfig({
				subjectId,
				trackerIds: [...selectedTrackerIds],
				difficulty: parsedDifficulty.data,
				durationSeconds: parsedDuration.data,
				focusArea,
			});
			if (!result.ok) {
				setActionError(result.message);
				setActionErrorCorrelationId(null);
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
				draftDispatch({ type: "go_to_step", step: 3 });
			} else {
				setNonPreviewSuccess(true);
				finalizeCacheRef.current = { key: cacheKey, payload: null };
				draftDispatch({ type: "go_to_step", step: 3 });
			}
			return true;
		} finally {
			setPending(false);
		}
	};

	function goNext() {
		setStepError(null);
		setActionError(null);
		setActionErrorCorrelationId(null);

		if (step === 0) {
			const parsed = practiceStep0Schema.safeParse({ subjectId });
			if (!parsed.success) {
				setStepError(formatStepErrors(parsed.error));
				return;
			}
			draftDispatch({ type: "go_to_step", step: 1 });
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
			draftDispatch({ type: "go_to_step", step: 2 });
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
		setActionErrorCorrelationId(null);

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
			setActionErrorCorrelationId(null);
		}
	};

	const onPickFocusArea = React.useCallback(
		(area: FocusArea) => {
			draftDispatch({ type: "set_focus_area", value: area });
			addFocusAreaTopics(area);
		},
		[addFocusAreaTopics],
	);

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
						We couldn&rsquo;t find subjects for your account yet. Wait a few minutes, refresh, or ask your school if
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
						Build a timed practice test from the topics you&rsquo;re already tracking, with questions matched to your class and syllabus.
					</PageHeaderSubtext>
				</div>

				<form onSubmit={handleSubmit} className="flex w-full flex-col gap-7" noValidate>
					<div className="shrink-0 px-1">
						<WizardStepIndicator step={step} labels={STEP_LABELS} />
					</div>

					{/*
					  D22: polite live region announces the active step's name on
					  transition without stealing focus.
					*/}
					<div className="sr-only" aria-live="polite" aria-atomic="true" role="status">
						{liveAnnouncement}
					</div>

					<div
						ref={stepContainerRef}
						tabIndex={-1}
						aria-label={`Step ${step + 1} of ${STEP_LABELS.length}: ${STEP_LABELS[step] ?? ""}`}
						className="flex flex-col gap-7 pr-1 outline-none"
					>
						{step === 0 ? (
							<StepSubject
								enrolledSubjects={enrolledSubjects}
								subjectId={subjectId}
								subjectProgressBySubjectId={subjectProgressBySubjectId}
								onPickSubject={(id) => draftDispatch({ type: "set_subject", subjectId: id })}
							/>
						) : null}

						{step === 1 && subjectId ? (
							<StepTopics
								subjectName={selectedSubjectName}
								canPickEnoughTopics={canPickEnoughTopics}
								focusArea={focusArea}
								selectedTrackerIds={selectedTrackerIds}
								maxTopics={PRACTICE_MAX_TOPICS}
								practiceChapterSections={practiceChapterSections}
								chapterOpenMode={chapterOpenMode}
								chapterVersion={chapterVersion}
								attemptedContinue={attemptedContinueStep1}
								selectionOk={selectionOk}
								onPickFocusArea={onPickFocusArea}
								onClearSelection={() => setSelectedTrackerIds(new Set())}
								onExpandAll={() => {
									setChapterOpenMode("all");
									setChapterVersion((v) => v + 1);
								}}
								onCollapseAll={() => {
									setChapterOpenMode("none");
									setChapterVersion((v) => v + 1);
								}}
								bulkSelectTrackers={bulkSelectTrackers}
								toggleTracker={toggleTracker}
							/>
						) : null}

						{step === 2 && subjectId ? (
							<StepConfig
								difficulty={difficulty}
								durationSeconds={durationSeconds}
								subjectName={selectedSubjectName}
								onPickDifficulty={(value) => draftDispatch({ type: "set_difficulty", value })}
								onPickDurationSeconds={(seconds) => draftDispatch({ type: "set_duration", seconds: seconds as never })}
							/>
						) : null}

						<StepReview
							showPromptPreview={showPromptPreview}
							nonPreviewSuccess={step === 3 && nonPreviewSuccess}
							previewPayload={step === 3 ? previewPayload : null}
							reviewConfigSummary={reviewConfigSummary}
							onCopy={(label, text) => void copyText(label, text)}
						/>

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
									{actionErrorCorrelationId ? (
										<span className="text-xs text-muted-foreground">
											Reference: {actionErrorCorrelationId}
										</span>
									) : null}
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

					<WizardFooter
						step={step}
						pending={pending}
						generating={generating}
						isResultStep={isResultStep}
						isSubmitStep={isSubmitStep}
						showPromptPreview={showPromptPreview}
						subjectId={subjectId}
						canPickEnoughTopics={canPickEnoughTopics}
						hasGeneratedPreview={Boolean(generatedPreview)}
						onBack={goBack}
						onContinue={goNext}
						onGenerate={() => void runGenerate()}
					/>

					<GenerationOverlay
						generating={generating}
						doneThrough={generationDoneThrough}
						draftedCount={generationDraftedCount}
						draftedTotal={generationDraftedTotal}
						generatedPreview={generatedPreview}
						pending={pending}
						onCancelGenerate={cancelGenerate}
						onStartTest={() => {
							if (!generatedPreview) return;
							router.push(`/student/practice/${generatedPreview.testId}`);
						}}
						onBack={goBack}
					/>
				</form>
			</div>
		</div>
	);
}

// Re-exports for compatibility with previous imports.
// `getPracticeQuestionPlan` is also still exposed from "@/lib/practice".
export { getPracticeQuestionPlan };

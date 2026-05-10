"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { submitPracticeTest } from "../../../../app/student/practice/session-actions";
import { useAdminTestMessageChannel } from "@/hooks/use-admin-test-message-channel";
import { useLowBatteryWarning } from "@/hooks/use-low-battery-warning";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { usePracticeDraftPersist } from "@/hooks/use-practice-draft-persist";
import { usePracticeSessionTimer } from "@/hooks/use-practice-session-timer";
import { usePracticeTabBlurReporter } from "@/hooks/use-practice-tab-blur-reporter";
import {
	clearPracticeDraft,
	clearPracticeSessionStart,
	mergeServerAndLocalDraft,
	readPracticeDraft,
	readPracticeSessionStart,
	writePracticeSessionStart,
} from "@/lib/practice/practice-session-storage";
import { useTestRowRealtimePoll } from "@/lib/practice/use-test-row-realtime-poll";
import type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";
import { Button } from "@/components/ui/button";
import {
	isAnswered,
	type SessionStudentAnswer,
} from "@/lib/practice/practice-session-utils";

import { ExitConfirmDialog } from "./practice-test-session/exit-confirm-dialog";
import { FinishConfirmDialog } from "./practice-test-session/finish-confirm-dialog";
import { QuestionCard } from "./practice-test-session/question-card";
import { ReportQuestionDialog } from "./practice-test-session/report-question-dialog";
import { SessionAppBar } from "./practice-test-session/session-app-bar";
import { SessionSidebar } from "./practice-test-session/session-sidebar";
import { ShortcutsDialog } from "./practice-test-session/shortcuts-dialog";
import { useKeyboardShortcuts } from "./practice-test-session/use-keyboard-shortcuts";
import {
	batchUpsertPracticeAnswers,
	buildBatchItems,
	buildInitialMapsFromInitialAnswers,
} from "./practice-test-session/session-storage";

export type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";
export type { PracticeSessionQuestion } from "@/components/student/practice/practice-session-types";

export type PracticeTestSessionProps = {
	testId: string;
	subjectName: string;
	timeLimitSeconds: number;
	questions: PracticeSessionQuestion[];
	initialAnswers: {
		questionId: string;
		studentAnswer: SessionStudentAnswer | null;
		flaggedForReview: boolean;
	}[];
	/**
	 * Phase 5: server-stamped session start. When provided, it overrides any
	 * localStorage-cached start so a tampered clock cannot stretch the timer.
	 */
	serverStartedAtIso?: string | null;
};

function scheduleFlush(
	timers: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout> | undefined>>,
	questionId: string,
	fn: () => void,
	delayMs: number,
) {
	const prev = timers.current[questionId];
	if (prev) clearTimeout(prev);
	timers.current[questionId] = setTimeout(() => {
		fn();
		delete timers.current[questionId];
	}, delayMs);
}

export function PracticeTestSession({
	testId,
	subjectName,
	timeLimitSeconds,
	questions,
	initialAnswers,
	serverStartedAtIso,
}: PracticeTestSessionProps) {
	const router = useRouter();
	const pathname = usePathname();
	const sorted = React.useMemo(
		() => [...questions].sort((a, b) => a.question_number - b.question_number),
		[questions],
	);

	const serverSnapshotRef = React.useRef(buildInitialMapsFromInitialAnswers(initialAnswers));

	const [activeIdx, setActiveIdx] = React.useState(0);
	const active = sorted[activeIdx] ?? sorted[0];

	// Phase 5: record time-on-question and visit count.
	React.useEffect(() => {
		const now = Date.now();
		const activeQuestionId = active?.id;
		const perQuestionMs = perQuestionMsRef.current;
		if (activeQuestionId) {
			perQuestionVisitsRef.current[activeQuestionId] = (perQuestionVisitsRef.current[activeQuestionId] ?? 0) + 1;
		}
		questionEnterRef.current = now;
		const startedAt = now;
		return () => {
			if (activeQuestionId) {
				const delta = Math.min(30 * 60_000, Math.max(0, Date.now() - startedAt));
				perQuestionMs[activeQuestionId] = (perQuestionMs[activeQuestionId] ?? 0) + delta;
				questionEnterRef.current = null;
			}
		};
	}, [active]);

	const [answers, setAnswers] = React.useState<Record<string, SessionStudentAnswer>>(
		() => buildInitialMapsFromInitialAnswers(initialAnswers).answers,
	);

	const [flagged, setFlagged] = React.useState<Record<string, boolean>>(
		() => buildInitialMapsFromInitialAnswers(initialAnswers).flagged,
	);

	React.useLayoutEffect(() => {
		const draft = readPracticeDraft(testId);
		if (!draft) return;
		const server = buildInitialMapsFromInitialAnswers(initialAnswers);
		const merged = mergeServerAndLocalDraft(questions, server, draft);
		setAnswers(merged.answers);
		setFlagged(merged.flagged);
	}, [testId, questions, initialAnswers]);

	const [saveError, setSaveError] = React.useState<string | null>(null);
	const [submitError, setSubmitError] = React.useState<string | null>(null);
	const [submitting, setSubmitting] = React.useState(false);
	const [submitOpen, setSubmitOpen] = React.useState(false);
	const [exitConfirmOpen, setExitConfirmOpen] = React.useState(false);
	const pendingExitHrefRef = React.useRef<string | null>(null);
	const [navOpen, setNavOpen] = React.useState(false);
	const [saveUi, setSaveUi] = React.useState<"idle" | "saving" | "saved" | "failed">("idle");
	const [skipped, setSkipped] = React.useState<Record<string, boolean>>({});
	const isOnline = useNetworkStatus();
	const [unsyncedCount, setUnsyncedCount] = React.useState(0);
	const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
	const [reportOpen, setReportOpen] = React.useState(false);
	const [reportReason, setReportReason] = React.useState("");
	const [reportSubmitting, setReportSubmitting] = React.useState(false);
	const [flagNotice, setFlagNotice] = React.useState<string | null>(null);
	const [pauseRemainingSec, setPauseRemainingSec] = React.useState(0);
	const [paused, setPaused] = React.useState(false);
	const serverRow = useTestRowRealtimePoll(testId, timeLimitSeconds);
	const [adminMessage, setAdminMessage] = React.useState<string | null>(null);

	useAdminTestMessageChannel({ testId, onMessage: setAdminMessage });
	usePracticeTabBlurReporter({ testId });
	useLowBatteryWarning({
		minSessionSeconds: timeLimitSeconds,
		onLowBattery: (level) => {
			setSaveError(
				`Battery low (${Math.round(level * 100)}%). Plug in to avoid losing progress. Answers auto-save while you're online.`,
			);
		},
	});

	React.useEffect(() => {
		let fp = "";
		try {
			const key = "eduai_practice_fp_v1";
			fp = sessionStorage.getItem(key) ?? "";
			if (!fp) {
				fp = crypto.randomUUID().replace(/-/g, "").slice(0, 40);
				sessionStorage.setItem(key, fp);
			}
		} catch {
			fp = `t${Date.now().toString(36)}`;
		}
		const deviceFingerprint = `${testId.replace(/-/g, "").slice(0, 8)}${fp}`.slice(0, 64);
		void fetch("/api/student/practice/session-meta", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ testId, deviceFingerprint }),
			keepalive: true,
		}).catch(() => {});
	}, [testId]);

	// Per-question timing
	const questionEnterRef = React.useRef<number | null>(null);
	const perQuestionMsRef = React.useRef<Record<string, number>>({});
	const perQuestionVisitsRef = React.useRef<Record<string, number>>({});

	const [sessionStartedAt, setSessionStartedAt] = React.useState<number | null>(null);
	const sessionStartedAtRef = React.useRef<number | null>(null);
	const allowUnloadRef = React.useRef(false);
	const answersRef = React.useRef(answers);
	const flaggedRef = React.useRef(flagged);
	const sortedRef = React.useRef(sorted);
	answersRef.current = answers;
	flaggedRef.current = flagged;
	sortedRef.current = sorted;
	const saveTimers = React.useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
	const clearDebouncedSaveTimers = React.useCallback(() => {
		for (const key of Object.keys(saveTimers.current)) {
			const t = saveTimers.current[key];
			if (t) clearTimeout(t);
			delete saveTimers.current[key];
		}
	}, []);
	const submitLock = React.useRef(false);
	const savedHideTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	React.useEffect(() => {
		sessionStartedAtRef.current = sessionStartedAt;
	}, [sessionStartedAt]);

	React.useLayoutEffect(() => {
		if (serverStartedAtIso) {
			const normalizedServerStartedAtIso =
				/(?:Z|[+-]\d{2}:?\d{2})$/i.test(serverStartedAtIso) ? serverStartedAtIso : `${serverStartedAtIso}Z`;
			const parsed = Date.parse(normalizedServerStartedAtIso);
			if (Number.isFinite(parsed)) {
				setSessionStartedAt(parsed);
				writePracticeSessionStart(testId, parsed, timeLimitSeconds);
				return;
			}
		}
		const existing = readPracticeSessionStart(testId, timeLimitSeconds);
		if (existing) {
			setSessionStartedAt(existing.startedAt);
			return;
		}
		const startedAt = Date.now();
		writePracticeSessionStart(testId, startedAt, timeLimitSeconds);
		setSessionStartedAt(startedAt);
	}, [testId, timeLimitSeconds, serverStartedAtIso]);

	const remainingSec = usePracticeSessionTimer({
		sessionStartedAt,
		clientPaused: paused,
		serverPaused: serverRow.isPaused,
		timeLimitSeconds: serverRow.timeLimitSeconds,
		accumulatedPauseSeconds: serverRow.accumulatedPauseSeconds,
	});

	React.useEffect(() => {
		if (sessionStartedAt == null) return;
		writePracticeSessionStart(testId, sessionStartedAt, serverRow.timeLimitSeconds);
	}, [testId, sessionStartedAt, serverRow.timeLimitSeconds]);

	React.useEffect(() => {
		if (!paused) return;
		if (pauseRemainingSec <= 0) {
			setPaused(false);
			return;
		}
		const id = window.setInterval(() => {
			setPauseRemainingSec((n) => {
				if (n <= 1) {
					window.clearInterval(id);
					setPaused(false);
					return 0;
				}
				return n - 1;
			});
		}, 1000);
		return () => window.clearInterval(id);
	}, [paused, pauseRemainingSec]);

	const answeredCount = React.useMemo(() => {
		return sorted.filter((q) => isAnswered(q, answers[q.id])).length;
	}, [sorted, answers]);

	const flaggedCount = React.useMemo(() => {
		return sorted.filter((q) => flagged[q.id]).length;
	}, [sorted, flagged]);

	const skippedCount = React.useMemo(
		() => sorted.filter((q) => skipped[q.id] && !isAnswered(q, answers[q.id])).length,
		[sorted, skipped, answers],
	);

	React.useEffect(() => {
		const server = serverSnapshotRef.current;
		let n = 0;
		for (const q of sorted) {
			const local = answers[q.id];
			const remote = server.answers[q.id];
			const sameAnswer = JSON.stringify(local ?? null) === JSON.stringify(remote ?? null);
			const sameFlag = (server.flagged[q.id] ?? false) === (flagged[q.id] ?? false);
			if (!sameAnswer || !sameFlag) n++;
		}
		setUnsyncedCount(n);
	}, [sorted, answers, flagged]);

	const unansweredCount = sorted.length - answeredCount;
	const progressPct = sorted.length > 0 ? Math.round((100 * answeredCount) / sorted.length) : 0;

	const flushSave = React.useCallback(
		async (questionId: string, payload: SessionStudentAnswer, markReview: boolean) => {
			if (savedHideTimer.current) {
				clearTimeout(savedHideTimer.current);
				savedHideTimer.current = undefined;
			}
			setSaveUi("saving");
			const res = await batchUpsertPracticeAnswers({
				testId,
				items: [
					{
						questionId,
						studentAnswer: payload,
						flaggedForReview: markReview,
						timeSpentMs: perQuestionMsRef.current[questionId] ?? 0,
						visits: perQuestionVisitsRef.current[questionId] ?? 0,
					},
				],
			});
			if (!res.ok) {
				setSaveError(res.message);
				setSaveUi("failed");
				return;
			}
			setSaveError(null);
			setSaveUi("saved");
		},
		[testId],
	);

	const queueSave = React.useCallback(
		(questionId: string, payload: SessionStudentAnswer, markReview: boolean) => {
			scheduleFlush(saveTimers, questionId, () => {
				void flushSave(questionId, payload, markReview);
			}, 750);
		},
		[flushSave],
	);

	const flushRemoteSnapshot = React.useCallback(async (): Promise<boolean> => {
		const items = buildBatchItems(sortedRef.current, answersRef.current, flaggedRef.current);
		if (items.length === 0) return true;
		setSaveUi("saving");
		const res = await batchUpsertPracticeAnswers({ testId, items });
		if (!res.ok) {
			setSaveError(res.message);
			setSaveUi("failed");
			return false;
		}
		serverSnapshotRef.current = {
			answers: { ...answersRef.current },
			flagged: { ...flaggedRef.current },
		};
		setSaveUi("saved");
		setUnsyncedCount(0);
		return true;
	}, [testId]);

	usePracticeDraftPersist({ testId, answers, flagged });

	React.useEffect(() => {
		const server = serverSnapshotRef.current;
		const items = buildBatchItems(sortedRef.current, answersRef.current, flaggedRef.current).filter(
			(it) => {
				const sa = server.answers[it.questionId];
				const sf = server.flagged[it.questionId] ?? false;
				const sameAnswer = JSON.stringify(sa) === JSON.stringify(it.studentAnswer);
				return !sameAnswer || sf !== it.flaggedForReview;
			},
		);
		if (items.length === 0) return;
		void batchUpsertPracticeAnswers({ testId, items }).then((res) => {
			if (!res.ok) setSaveError(res.message);
		});
	}, [testId]);

	React.useEffect(() => {
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			if (allowUnloadRef.current) return;
			e.preventDefault();
			e.returnValue = "";
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, []);

	React.useEffect(() => {
		const onPageHide = (e: PageTransitionEvent) => {
			if (e.persisted) return;
			if (allowUnloadRef.current) return;
			const items = buildBatchItems(sortedRef.current, answersRef.current, flaggedRef.current);
			if (items.length === 0) return;
			const payload = JSON.stringify({ testId, items });
			const blob = new Blob([payload], { type: "application/json" });
			const url = `${window.location.origin}/api/student/practice/batch-upsert-answers`;
			if (!navigator.sendBeacon(url, blob)) {
				void fetch(url, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: payload,
					keepalive: true,
				});
			}
		};
		window.addEventListener("pagehide", onPageHide);
		return () => window.removeEventListener("pagehide", onPageHide);
	}, [testId]);

	React.useEffect(() => {
		const onVis = () => {
			if (document.visibilityState === "hidden") {
				void flushRemoteSnapshot();
			}
		};
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, [flushRemoteSnapshot]);

	React.useEffect(() => {
		const onOnline = () => {
			void flushRemoteSnapshot();
		};
		window.addEventListener("online", onOnline);
		return () => window.removeEventListener("online", onOnline);
	}, [flushRemoteSnapshot]);

	const onMcqChange = React.useCallback(
		(q: PracticeSessionQuestion, letter: string) => {
			const payload: SessionStudentAnswer = { kind: "mcq", value: letter };
			setAnswers((prev) => ({ ...prev, [q.id]: payload }));
			queueSave(q.id, payload, flagged[q.id] ?? false);
		},
		[flagged, queueSave],
	);

	const onTextChange = React.useCallback(
		(q: PracticeSessionQuestion, value: string) => {
			const payload: SessionStudentAnswer = {
				kind: q.question_type === "numerical" ? "numerical" : "text",
				value,
			};
			setAnswers((prev) => ({ ...prev, [q.id]: payload }));
			queueSave(q.id, payload, flagged[q.id] ?? false);
		},
		[flagged, queueSave],
	);

	const onFlagToggle = React.useCallback(
		(q: PracticeSessionQuestion, next: boolean) => {
			setFlagged((prev) => ({ ...prev, [q.id]: next }));
			const payload = answers[q.id];
			if (payload) {
				void flushSave(q.id, payload, next);
			}
		},
		[answers, flushSave],
	);

	const onToggleSkip = React.useCallback((q: PracticeSessionQuestion) => {
		setSkipped((prev) => ({ ...prev, [q.id]: !(prev[q.id] ?? false) }));
	}, []);

	const onOpenReport = React.useCallback(() => {
		setReportReason("");
		setReportOpen(true);
	}, []);

	const onPrev = React.useCallback(() => {
		setActiveIdx((i) => Math.max(0, i - 1));
	}, []);

	const onNext = React.useCallback(() => {
		setActiveIdx((i) => Math.min(sorted.length - 1, i + 1));
	}, [sorted.length]);

	const retrySaveActiveQuestion = React.useCallback(() => {
		const q = active;
		if (!q) return;
		const payload = answers[q.id];
		if (payload) {
			void flushSave(q.id, payload, flagged[q.id] ?? false);
		}
	}, [active, answers, flagged, flushSave]);

	const runSubmit = React.useCallback(async () => {
		if (submitLock.current) return;
		if (sessionStartedAt == null) return;
		submitLock.current = true;
		setSubmitting(true);
		setSubmitError(null);
		try {
			const activeId = active?.id;
			if (activeId && saveTimers.current[activeId]) {
				const payload = answersRef.current[activeId];
				if (payload) {
					await flushSave(activeId, payload, flaggedRef.current[activeId] ?? false);
				}
			}
			clearDebouncedSaveTimers();
			const synced = await flushRemoteSnapshot();
			if (!synced) {
				setSubmitError("Could not save your latest answers before submitting. Check the message above or your connection.");
				return;
			}

			const wallElapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
			const effectiveElapsed = Math.max(0, wallElapsed - serverRow.accumulatedPauseSeconds);
			const elapsed = Math.min(serverRow.timeLimitSeconds, effectiveElapsed);
			const res = await submitPracticeTest({ testId, elapsedSeconds: elapsed });
			if (!res.ok) {
				setSubmitError(res.message);
				return;
			}
			allowUnloadRef.current = true;
			clearPracticeDraft(testId);
			clearPracticeSessionStart(testId);
			router.push(res.redirectTo);
		} catch (e) {
			setSubmitError(e instanceof Error ? e.message : "Could not submit your test.");
		} finally {
			setSubmitting(false);
			if (!allowUnloadRef.current) {
				submitLock.current = false;
			}
		}
	}, [
		clearDebouncedSaveTimers,
		flushRemoteSnapshot,
		flushSave,
		router,
		testId,
		serverRow.timeLimitSeconds,
		serverRow.accumulatedPauseSeconds,
		sessionStartedAt,
		active,
	]);

	React.useEffect(() => {
		if (sessionStartedAt == null) return;
		if (remainingSec > 0) return;
		void runSubmit();
	}, [remainingSec, runSubmit, sessionStartedAt]);

	React.useEffect(() => {
		const timersRef = saveTimers;
		return () => {
			for (const t of Object.values(timersRef.current)) {
				if (t) clearTimeout(t);
			}
			if (savedHideTimer.current) clearTimeout(savedHideTimer.current);
		};
	}, []);

	useKeyboardShortcuts({
		sortedRef,
		answersRef,
		active,
		activeIdx,
		totalQuestions: sorted.length,
		answers,
		flagged,
		flushSave,
		onMcqChange,
		setActiveIdx,
		setFlagged,
		setSkipped,
		setShortcutsOpen,
	});

	React.useEffect(() => {
		const onClick = (e: MouseEvent) => {
			if (e.defaultPrevented) return;
			if (e.button !== 0) return;
			if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
			const el = e.target as Element | null;
			const a = el?.closest?.("a");
			if (!a) return;
			if (a.hasAttribute("download")) return;
			const href = a.getAttribute("href");
			if (!href || href.startsWith("#")) return;
			if (a.getAttribute("target") === "_blank") return;
			let url: URL;
			try {
				url = new URL(href, window.location.origin);
			} catch {
				return;
			}
			if (url.origin !== window.location.origin) return;
			if (url.pathname === pathname && url.search === window.location.search) return;
			const parts = url.pathname.split("/").filter(Boolean);
			const staying =
				parts.length === 3 &&
				parts[0] === "student" &&
				parts[1] === "practice" &&
				parts[2] === testId;
			if (staying) return;
			e.preventDefault();
			e.stopPropagation();
			pendingExitHrefRef.current = url.pathname + url.search + url.hash;
			setExitConfirmOpen(true);
		};
		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, [pathname, testId]);

	const cancelExitSession = React.useCallback(() => {
		pendingExitHrefRef.current = null;
		setExitConfirmOpen(false);
	}, []);

	const confirmExitSession = React.useCallback(() => {
		const href = pendingExitHrefRef.current;
		allowUnloadRef.current = true;
		pendingExitHrefRef.current = null;
		setExitConfirmOpen(false);
		void flushRemoteSnapshot().finally(() => {
			if (href) router.push(href);
		});
	}, [flushRemoteSnapshot, router]);

	const mm = Math.floor(remainingSec / 60);
	const ss = remainingSec % 60;
	const timeLabel = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
	const warnTime = remainingSec > 0 && remainingSec <= 600;
	const criticalTime = remainingSec > 0 && remainingSec <= 60;
	const finalCountdown = remainingSec > 0 && remainingSec <= 10;
	const pauseAllowed = false;

	const startPause = React.useCallback(() => {
		if (!pauseAllowed) return;
		setPauseRemainingSec(5 * 60);
		setPaused(true);
	}, [pauseAllowed]);

	const submitReport = React.useCallback(async () => {
		if (!active) return;
		setReportSubmitting(true);
		try {
			const res = await fetch("/api/student/practice/flag-question", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					questionId: active.id,
					reason: reportReason.trim().slice(0, 200),
					notes: reportReason.trim(),
				}),
			});
			const ok = res.ok;
			setReportSubmitting(false);
			if (ok) {
				setFlagNotice("Thanks! We'll review this question.");
				setTimeout(() => {
					setReportOpen(false);
					setFlagNotice(null);
					setReportReason("");
				}, 1200);
			} else {
				setFlagNotice("Could not submit the report. Try again later.");
			}
		} catch {
			setReportSubmitting(false);
			setFlagNotice("Network error — try again.");
		}
	}, [active, reportReason]);

	if (!active) {
		return (
			<div className="p-6">
				<p className="text-muted-foreground">No questions in this test.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 medium:p-6 xl:flex-row xl:items-stretch xl:gap-6">
			<SessionSidebar
				sorted={sorted}
				activeId={active.id}
				answers={answers}
				flagged={flagged}
				skipped={skipped}
				onPickIndex={setActiveIdx}
				onOpenShortcuts={() => setShortcutsOpen(true)}
			/>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
				<SessionAppBar
					subjectName={subjectName}
					sorted={sorted}
					activeId={active.id}
					answers={answers}
					flagged={flagged}
					skipped={skipped}
					answeredCount={answeredCount}
					flaggedCount={flaggedCount}
					skippedCount={skippedCount}
					progressPct={progressPct}
					timeLabel={timeLabel}
					remainingSec={remainingSec}
					warnTime={warnTime}
					criticalTime={criticalTime}
					finalCountdown={finalCountdown}
					pauseAllowed={pauseAllowed}
					paused={paused}
					pauseRemainingSec={pauseRemainingSec}
					serverIsPaused={serverRow.isPaused}
					adminMessage={adminMessage}
					isOnline={isOnline}
					unsyncedCount={unsyncedCount}
					saveUi={saveUi}
					navOpen={navOpen}
					onNavOpenChange={setNavOpen}
					onPickIndex={setActiveIdx}
					onOpenShortcuts={() => setShortcutsOpen(true)}
					onStartPause={startPause}
					onDismissAdminMessage={() => setAdminMessage(null)}
					onRetrySave={retrySaveActiveQuestion}
				/>

				{saveError ?
					<div
						className="border-destructive/50 bg-destructive/10 flex flex-col gap-2 rounded-lg border-2 px-3 py-2 medium:flex-row medium:items-center medium:justify-between"
						role="alert"
					>
						<p className="text-destructive text-sm">{saveError}</p>
						<Button type="button" variant="outline" size="sm" onClick={retrySaveActiveQuestion}>
							Try again
						</Button>
					</div>
				:	null}

				{submitError && !submitOpen ?
					<div
						className="border-destructive/50 bg-destructive/10 flex flex-col gap-2 rounded-lg border-2 px-3 py-2 medium:flex-row medium:items-center medium:justify-between"
						role="alert"
					>
						<p className="text-destructive text-sm font-medium">{submitError}</p>
						<Button type="button" variant="outline" size="sm" onClick={() => void runSubmit()}>
							Try submit again
						</Button>
					</div>
				:	null}

				<QuestionCard
					active={active}
					activeIdx={activeIdx}
					totalQuestions={sorted.length}
					answers={answers}
					flagged={flagged}
					skipped={skipped}
					submitting={submitting}
					onMcqChange={onMcqChange}
					onTextChange={onTextChange}
					onFlagToggle={onFlagToggle}
					onToggleSkip={onToggleSkip}
					onOpenReport={onOpenReport}
					onPrev={onPrev}
					onNext={onNext}
					onOpenSubmit={() => setSubmitOpen(true)}
				/>
			</div>

			<FinishConfirmDialog
				open={submitOpen}
				onOpenChange={setSubmitOpen}
				progressPct={progressPct}
				answeredCount={answeredCount}
				totalQuestions={sorted.length}
				unansweredCount={unansweredCount}
				flaggedCount={flaggedCount}
				submitting={submitting}
				submitError={submitError}
				onCancel={() => setSubmitOpen(false)}
				onConfirm={() => void runSubmit()}
			/>

			<ExitConfirmDialog
				open={exitConfirmOpen}
				onOpenChange={(open) => {
					if (!open) cancelExitSession();
				}}
				unsyncedCount={unsyncedCount}
				onCancel={cancelExitSession}
				onConfirm={confirmExitSession}
			/>

			<ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

			<ReportQuestionDialog
				open={reportOpen}
				onOpenChange={setReportOpen}
				reportReason={reportReason}
				onReportReasonChange={setReportReason}
				reportSubmitting={reportSubmitting}
				flagNotice={flagNotice}
				canSubmit={reportReason.trim().length >= 4}
				onSubmit={() => void submitReport()}
				onCancel={() => setReportOpen(false)}
			/>
		</div>
	);
}

"use client";

import { Dialog } from "@base-ui/react/dialog";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
	BookmarkIcon,
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	CircleDashedIcon,
	ClockIcon,
	KeyboardIcon,
	ListIcon,
	MenuIcon,
	XIcon,
} from "lucide-react";

import { submitPracticeTest } from "../../../../app/student/practice/session-actions";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { useTestRowRealtimePoll } from "@/lib/practice/use-test-row-realtime-poll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
	cardSurfaceFrameClassName,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	chapterTopicDisplayLabel,
	difficultyDisplayLabel,
	isAnswered,
	normalizeDifficultyLevel,
	optionEntries,
	type PracticeQuestionKind,
	type SessionStudentAnswer,
	questionTypeLabel,
	questionTypeNavLabel,
} from "@/lib/practice/practice-session-utils";
import { cn } from "@/lib/utils";

import { LatexText } from "./latex-text";

export type { SessionStudentAnswer } from "@/lib/practice/practice-session-utils";

const PracticeRichAnswerEditor = dynamic(
	() =>
		import("./practice-rich-answer-editor").then((m) => ({
			default: m.PracticeRichAnswerEditor,
		})),
	{
		loading: () => (
			<div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-4 py-8 text-center text-muted-foreground text-sm">
				Loading editor…
			</div>
		),
	},
);

export type PracticeSessionQuestion = {
	id: string;
	question_number: number;
	question_text: string;
	question_type: PracticeQuestionKind;
	difficulty_level: string | null;
	options: Record<string, string> | null;
	topic_id: string;
	topic_name: string;
	/** From `topics.chapter_name` when joined; used with `topic_name` for the header line. */
	chapter_name: string | null;
};

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

const confirmSubmitCta =
	"!bg-emerald-600 hover:!bg-emerald-600/90 dark:!bg-emerald-500 dark:hover:!bg-emerald-500/90";

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
	return (
		<kbd
			className={cn(
				"inline-flex min-h-7 min-w-7 items-center justify-center rounded-md px-1.5",
				"border border-b-2 border-foreground/18 bg-muted font-mono text-[11px] font-semibold tabular-nums",
				"text-foreground shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:border-border dark:bg-muted/90 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)]",
				className,
			)}
		>
			{children}
		</kbd>
	);
}

/** Difficulty pills: green (easy), yellow/amber (medium), red (hard). */
function difficultyClass(d: string | null): string {
	const n = normalizeDifficultyLevel(d);
	if (n === "hard") {
		return "border-red-800/55 bg-red-950/60 text-red-100 dark:border-red-700/55 dark:bg-red-950/65 dark:text-red-50";
	}
	if (n === "medium") {
		return "border-amber-600/50 bg-amber-950/45 text-amber-100 dark:border-amber-500/45 dark:bg-amber-950/50 dark:text-amber-50";
	}
	if (n === "easy") {
		return "border-emerald-700/45 bg-emerald-950/45 text-emerald-100 dark:border-emerald-600/45 dark:bg-emerald-950/50 dark:text-emerald-50";
	}
	return "border-border/55 bg-muted/35 text-foreground/70 dark:text-foreground/65";
}

function isTypingTarget(target: EventTarget | null): boolean {
	if (!target || !(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	if (target.closest("[data-practice-answer-field='true']")) return true;
	if (target instanceof HTMLTextAreaElement) return true;
	if (target instanceof HTMLInputElement) {
		const t = target.type;
		return t === "text" || t === "number" || t === "search" || t === "email" || t === "password";
	}
	return false;
}

function PracticeQuestionNavList({
	sorted,
	activeId,
	answers,
	flagged,
	skipped,
	onPickIndex,
}: {
	sorted: PracticeSessionQuestion[];
	activeId: string;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
	skipped: Record<string, boolean>;
	onPickIndex: (index: number) => void;
}) {
	return (
		<ol className="flex max-h-[70vh] flex-col gap-1 overflow-y-auto pr-1">
			{sorted.map((q, idx) => {
				const done = isAnswered(q, answers[q.id]);
				const isActive = q.id === activeId;
				const isFlagged = flagged[q.id];
				const isSkipped = skipped[q.id] && !done;
				return (
					<li key={q.id}>
						<button
							type="button"
							onClick={() => onPickIndex(idx)}
							className={cn(
								"flex w-full items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left text-sm shadow-sm transition-[background-color,border-color,box-shadow] motion-reduce:transition-none",
								done ?
									cn(
										"border-emerald-600 bg-emerald-600/[0.09] dark:border-emerald-500 dark:bg-emerald-500/12",
										isActive ?
											"ring-2 ring-emerald-500/45 ring-offset-2 ring-offset-background"
										:	"hover:bg-emerald-600/14 dark:hover:bg-emerald-500/16",
									)
								:	isActive ?
									"border-primary/60 bg-primary/8 text-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background dark:border-primary/50 dark:bg-primary/15"
								:	"border-foreground/15 bg-background text-foreground hover:border-foreground/25 hover:bg-muted/70 dark:border-border dark:bg-card dark:hover:bg-muted/50",
							)}
						>
							<span
								className={cn(
									"flex size-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-semibold tabular-nums",
									done ?
										"border-emerald-600/35 bg-emerald-600/12 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100"
									:	"border-foreground/25 bg-muted/90 text-foreground dark:border-border dark:bg-muted dark:text-foreground",
								)}
								aria-hidden
							>
								{q.question_number}
							</span>
							<span
								className={cn(
									"min-w-0 flex-1 truncate rounded-full px-2.5 py-1 text-left text-[11px] font-semibold leading-none tracking-tight",
									done ?
										"bg-emerald-600/18 text-emerald-950 dark:bg-emerald-500/22 dark:text-emerald-50"
									:	isActive ?
										"bg-primary/18 text-foreground dark:bg-primary/22"
									:	"bg-foreground/[0.08] text-foreground/90 dark:bg-muted dark:text-foreground/85",
								)}
								title={questionTypeLabel(q.question_type)}
							>
								{questionTypeNavLabel(q.question_type)}
							</span>
							<span className="flex shrink-0 items-center gap-1.5">
								{isSkipped ? (
									<span
										className="border-foreground/30 text-foreground/70 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide"
										title="Skipped"
									>
										Skip
									</span>
								) : null}
								{isFlagged ?
									<BookmarkIcon
										className="text-amber-600 dark:text-amber-400 size-4"
										aria-label="Marked for review"
									/>
								:	null}
								{done ?
									<span
										className="flex size-8 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
										aria-hidden
									>
										<CheckIcon className="size-4" strokeWidth={2.5} />
									</span>
								:	null}
							</span>
						</button>
					</li>
				);
			})}
		</ol>
	);
}

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

const PRACTICE_SESSION_START_KEY = (testId: string) => `eduai:practice-test-session:${testId}`;

type PracticeSessionStartPayload = {
	startedAt: number;
	timeLimitSeconds: number;
};

function readPracticeSessionStart(testId: string, timeLimitSeconds: number): PracticeSessionStartPayload | null {
	try {
		const raw = localStorage.getItem(PRACTICE_SESSION_START_KEY(testId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<PracticeSessionStartPayload>;
		if (
			typeof parsed.startedAt !== "number" ||
			!Number.isFinite(parsed.startedAt) ||
			parsed.timeLimitSeconds !== timeLimitSeconds
		) {
			return null;
		}
		return { startedAt: parsed.startedAt, timeLimitSeconds: parsed.timeLimitSeconds };
	} catch {
		return null;
	}
}

function writePracticeSessionStart(testId: string, startedAt: number, timeLimitSeconds: number) {
	try {
		const payload: PracticeSessionStartPayload = { startedAt, timeLimitSeconds };
		localStorage.setItem(PRACTICE_SESSION_START_KEY(testId), JSON.stringify(payload));
	} catch {
		/* quota / private mode */
	}
}

function clearPracticeSessionStart(testId: string) {
	try {
		localStorage.removeItem(PRACTICE_SESSION_START_KEY(testId));
	} catch {
		/* ignore */
	}
}

const PRACTICE_DRAFT_KEY = (testId: string) => `eduai:practice-answers-draft:${testId}`;

type PracticeAnswersDraftV1 = {
	v: 1;
	testId: string;
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
};

function buildInitialMapsFromInitialAnswers(initialAnswers: PracticeTestSessionProps["initialAnswers"]): {
	answers: Record<string, SessionStudentAnswer>;
	flagged: Record<string, boolean>;
} {
	const answers: Record<string, SessionStudentAnswer> = {};
	const flagged: Record<string, boolean> = {};
	for (const row of initialAnswers) {
		if (row.studentAnswer) {
			answers[row.questionId] = row.studentAnswer;
		}
		flagged[row.questionId] = row.flaggedForReview;
	}
	return { answers, flagged };
}

function readPracticeDraft(testId: string): PracticeAnswersDraftV1 | null {
	try {
		const raw = localStorage.getItem(PRACTICE_DRAFT_KEY(testId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<PracticeAnswersDraftV1>;
		if (parsed.v !== 1 || parsed.testId !== testId) return null;
		if (!parsed.answers || typeof parsed.answers !== "object") return null;
		if (!parsed.flagged || typeof parsed.flagged !== "object") return null;
		return {
			v: 1,
			testId,
			answers: parsed.answers as Record<string, SessionStudentAnswer>,
			flagged: parsed.flagged as Record<string, boolean>,
		};
	} catch {
		return null;
	}
}

function writePracticeDraft(testId: string, draft: PracticeAnswersDraftV1) {
	try {
		localStorage.setItem(PRACTICE_DRAFT_KEY(testId), JSON.stringify(draft));
	} catch {
		/* quota / private mode */
	}
}

function clearPracticeDraft(testId: string) {
	try {
		localStorage.removeItem(PRACTICE_DRAFT_KEY(testId));
	} catch {
		/* ignore */
	}
}

function mergeServerAndLocalDraft(
	testId: string,
	questions: PracticeSessionQuestion[],
	server: { answers: Record<string, SessionStudentAnswer>; flagged: Record<string, boolean> },
	draft: PracticeAnswersDraftV1 | null,
): { answers: Record<string, SessionStudentAnswer>; flagged: Record<string, boolean> } {
	if (!draft) return server;
	const ids = new Set(questions.map((q) => q.id));
	const mergedAnswers = { ...server.answers };
	for (const [qid, a] of Object.entries(draft.answers)) {
		if (ids.has(qid)) mergedAnswers[qid] = a;
	}
	const mergedFlagged = { ...server.flagged };
	for (const [qid, f] of Object.entries(draft.flagged)) {
		if (ids.has(qid)) mergedFlagged[qid] = f;
	}
	return { answers: mergedAnswers, flagged: mergedFlagged };
}

type PracticeBatchItem = {
	questionId: string;
	studentAnswer: SessionStudentAnswer;
	flaggedForReview: boolean;
	timeSpentMs?: number;
	visits?: number;
};

function buildBatchItems(
	sortedQs: PracticeSessionQuestion[],
	answers: Record<string, SessionStudentAnswer>,
	flagged: Record<string, boolean>,
): PracticeBatchItem[] {
	const items: PracticeBatchItem[] = [];
	for (const q of sortedQs) {
		const a = answers[q.id];
		if (!a) continue;
		items.push({
			questionId: q.id,
			studentAnswer: a,
			flaggedForReview: flagged[q.id] ?? false,
		});
	}
	return items;
}

async function batchUpsertPracticeAnswers(body: {
	testId: string;
	items: PracticeBatchItem[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
	try {
		const res = await fetch("/api/student/practice/batch-upsert-answers", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = (await res.json()) as { ok?: boolean; message?: string };
		if (!res.ok || !data.ok) {
			return { ok: false, message: data.message ?? "Could not save progress." };
		}
		return { ok: true };
	} catch {
		return { ok: false, message: "Could not save progress. Check your connection." };
	}
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

	// Phase 5: record time-on-question and visit count. When `activeIdx`
	// changes, we close the book on the previous question (adds the elapsed
	// milliseconds to its bucket) and open a new session for the next one.
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

	// Use only the server snapshot for initial state. Merging `readPracticeDraft()` (localStorage) in the
	// initializer would diverge from SSR HTML and cause a hydration mismatch—draft is applied after mount.
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
		const merged = mergeServerAndLocalDraft(testId, questions, server, draft);
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
	const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
	const [lastSavedAgo, setLastSavedAgo] = React.useState(0);
	const [skipped, setSkipped] = React.useState<Record<string, boolean>>({});
	const [isOnline, setIsOnline] = React.useState(true);
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
	const lastTabBlurSentRef = React.useRef(0);

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
	// Battery/fullscreen nudge one-shot
	const batteryNudgedRef = React.useRef(false);
	const submitDialogTitleId = React.useId();
	const submitDialogDescId = React.useId();
	const exitDialogTitleId = React.useId();
	const exitDialogDescId = React.useId();

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

	const [remainingSec, setRemainingSec] = React.useState(timeLimitSeconds);

	React.useLayoutEffect(() => {
		// Phase 5: the server stamp (set in Phase 1 on first GET) is authoritative.
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

	React.useEffect(() => {
		if (sessionStartedAt == null) return;
		if (paused || serverRow.isPaused) return;
		const tick = () => {
			const wallElapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
			const effectiveElapsed = Math.max(0, wallElapsed - serverRow.accumulatedPauseSeconds);
			setRemainingSec(Math.max(0, serverRow.timeLimitSeconds - effectiveElapsed));
		};
		tick();
		const id = window.setInterval(tick, 1000);
		return () => window.clearInterval(id);
	}, [serverRow.timeLimitSeconds, serverRow.accumulatedPauseSeconds, serverRow.isPaused, sessionStartedAt, paused]);

	React.useEffect(() => {
		if (sessionStartedAt == null) return;
		writePracticeSessionStart(testId, sessionStartedAt, serverRow.timeLimitSeconds);
	}, [testId, sessionStartedAt, serverRow.timeLimitSeconds]);

	React.useEffect(() => {
		const supabase = createBrowserSupabase();
		let cancelled = false;
		const channel = supabase
			.channel(`admin-test-messages-${testId}`)
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "admin_test_messages", filter: `test_id=eq.${testId}` },
				(payload) => {
					if (cancelled) return;
					const body = (payload.new as { body?: string } | null)?.body;
					if (typeof body === "string") setAdminMessage(body);
				},
			)
			.subscribe();
		return () => {
			cancelled = true;
			void supabase.removeChannel(channel);
		};
	}, [testId]);

	React.useEffect(() => {
		const onVis = () => {
			if (document.visibilityState !== "hidden") return;
			const now = Date.now();
			if (now - lastTabBlurSentRef.current < 25_000) return;
			lastTabBlurSentRef.current = now;
			void fetch("/api/student/practice/tab-blur", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ testId }),
			}).catch(() => {});
		};
		document.addEventListener("visibilitychange", onVis);
		return () => document.removeEventListener("visibilitychange", onVis);
	}, [testId]);

	// Phase 5: "Last saved Xs ago" ticker.
	React.useEffect(() => {
		if (lastSavedAt == null) return;
		const tick = () =>
			setLastSavedAgo(Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000)));
		tick();
		const id = window.setInterval(tick, 1000);
		return () => window.clearInterval(id);
	}, [lastSavedAt]);

	// Phase 5: pause countdown (when a pause is active).
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

	// Phase 5: online/offline indicator.
	React.useEffect(() => {
		const setOnline = () => setIsOnline(true);
		const setOffline = () => setIsOnline(false);
		window.addEventListener("online", setOnline);
		window.addEventListener("offline", setOffline);
		setIsOnline(navigator.onLine);
		return () => {
			window.removeEventListener("online", setOnline);
			window.removeEventListener("offline", setOffline);
		};
	}, []);

	// Phase 5: one-shot battery + fullscreen nudge.
	React.useEffect(() => {
		if (batteryNudgedRef.current) return;
		if (timeLimitSeconds < 60 * 60) return; // Only for >= 1h sessions.
		const nav = navigator as Navigator & {
			getBattery?: () => Promise<{ level: number; charging: boolean }>;
		};
		if (typeof nav.getBattery !== "function") return;
		batteryNudgedRef.current = true;
		void nav.getBattery().then((b) => {
			if (b.charging) return;
			if (b.level <= 0.25) {
				setSaveError(
					`Battery low (${Math.round(b.level * 100)}%). Plug in to avoid losing progress. Answers auto-save while you're online.`,
				);
			}
		});
	}, [timeLimitSeconds]);

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

	// Phase 5: recompute unsynced whenever local state drifts from the server snapshot.
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
			setLastSavedAt(Date.now());
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
		setLastSavedAt(Date.now());
		setUnsyncedCount(0);
		return true;
	}, [testId]);

	React.useEffect(() => {
		writePracticeDraft(testId, { v: 1, testId, answers, flagged });
	}, [testId, answers, flagged]);

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

	const onTextChange = (q: PracticeSessionQuestion, value: string) => {
		const payload: SessionStudentAnswer = {
			kind: q.question_type === "numerical" ? "numerical" : "text",
			value,
		};
		setAnswers((prev) => ({ ...prev, [q.id]: payload }));
		queueSave(q.id, payload, flagged[q.id] ?? false);
	};

	const onFlagToggle = (q: PracticeSessionQuestion, next: boolean) => {
		setFlagged((prev) => ({ ...prev, [q.id]: next }));
		const payload = answers[q.id];
		if (payload) {
			void flushSave(q.id, payload, next);
		}
	};

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
			// Phase 5: if there's a pending debounced write for the active
			// question, flush it synchronously before cancelling timers.
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

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (isTypingTarget(e.target)) return;
			const k = e.key;
			const gotoNextUnanswered = () => {
				const list = sortedRef.current;
				for (let i = activeIdx + 1; i < list.length; i++) {
					if (!isAnswered(list[i]!, answersRef.current[list[i]!.id])) {
						setActiveIdx(i);
						return;
					}
				}
				for (let i = 0; i < activeIdx; i++) {
					if (!isAnswered(list[i]!, answersRef.current[list[i]!.id])) {
						setActiveIdx(i);
						return;
					}
				}
			};
			const gotoPrevUnanswered = () => {
				const list = sortedRef.current;
				for (let i = activeIdx - 1; i >= 0; i--) {
					if (!isAnswered(list[i]!, answersRef.current[list[i]!.id])) {
						setActiveIdx(i);
						return;
					}
				}
				for (let i = list.length - 1; i > activeIdx; i--) {
					if (!isAnswered(list[i]!, answersRef.current[list[i]!.id])) {
						setActiveIdx(i);
						return;
					}
				}
			};
			if (k === "j" || k === "J" || k === "ArrowRight") {
				e.preventDefault();
				setActiveIdx((i) => Math.min(sorted.length - 1, i + 1));
				return;
			}
			if (k === "k" || k === "K" || k === "ArrowLeft") {
				e.preventDefault();
				setActiveIdx((i) => Math.max(0, i - 1));
				return;
			}
			if (k === "n" || k === "N") {
				e.preventDefault();
				gotoNextUnanswered();
				return;
			}
			if (k === "p" || k === "P") {
				e.preventDefault();
				gotoPrevUnanswered();
				return;
			}
			if (k === "f" || k === "F") {
				if (!active) return;
				e.preventDefault();
				const next = !(flagged[active.id] ?? false);
				setFlagged((prev) => ({ ...prev, [active.id]: next }));
				const payload = answers[active.id];
				if (payload) void flushSave(active.id, payload, next);
				return;
			}
			if (k === "s" || k === "S") {
				if (!active) return;
				e.preventDefault();
				setSkipped((prev) => ({ ...prev, [active.id]: !(prev[active.id] ?? false) }));
				return;
			}
			if (k === "?") {
				e.preventDefault();
				setShortcutsOpen((v) => !v);
				return;
			}
			if (active && active.question_type === "multiple_choice" && active.options && /^[a-dA-D]$/.test(k)) {
				e.preventDefault();
				const letter = k.toUpperCase();
				if (active.options[letter] != null) {
					onMcqChange(active, letter);
				}
				return;
			}
			if (active && active.question_type === "multiple_choice" && /^[1-4]$/.test(k)) {
				e.preventDefault();
				const letter = ["A", "B", "C", "D"][Number.parseInt(k, 10) - 1]!;
				if (active.options?.[letter] != null) {
					onMcqChange(active, letter);
				}
				return;
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [sorted.length, active, activeIdx, answers, flagged, flushSave, onMcqChange]);

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

	if (!active) {
		return (
			<div className="p-6">
				<p className="text-muted-foreground">No questions in this test.</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 p-4 medium:p-6 xl:flex-row xl:gap-6">
			<div
				className="border-border bg-muted hidden w-full shrink-0 rounded-xl border-2 p-4 shadow-sm dark:bg-muted/60 xl:block xl:w-72"
				aria-label="Question list"
			>
				<div className="mb-3 flex items-center gap-2">
					<ListIcon className="text-foreground/70 size-4" aria-hidden />
					<h2 className="text-foreground/80 text-xs font-medium tracking-wide">Questions</h2>
				</div>
				<PracticeQuestionNavList
					sorted={sorted}
					activeId={active.id}
					answers={answers}
					flagged={flagged}
					skipped={skipped}
					onPickIndex={setActiveIdx}
				/>
				<button
					type="button"
					onClick={() => setShortcutsOpen(true)}
					className={cn(
						"border-border bg-background text-foreground hover:bg-muted/80 mt-4 flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5",
						"text-left text-sm font-medium shadow-sm transition-[background-color,box-shadow] motion-reduce:transition-none",
						"focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
					)}
				>
					<KeyboardIcon className="text-foreground/65 size-4 shrink-0" aria-hidden />
					<span className="min-w-0 flex-1">Keyboard shortcuts</span>
					<Kbd className="shrink-0 px-2">?</Kbd>
				</button>
			</div>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
				<header className="border-border bg-muted/70 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.06)] flex flex-col gap-4 rounded-2xl border px-4 py-4 medium:px-5 medium:py-4 dark:bg-card/90 dark:border-border">
					<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
						<div className="min-w-0 space-y-1.5 xl:max-w-[min(100%,42rem)]">
							<p className="text-foreground/55 text-[11px] font-semibold uppercase tracking-[0.08em]">Practice session</p>
							<h1 className="text-foreground text-2xl font-semibold tracking-tight medium:text-3xl">{subjectName}</h1>
						</div>

						<div className="flex flex-col gap-2 medium:flex-row medium:items-stretch medium:justify-end medium:gap-2 xl:shrink-0">
							<Sheet open={navOpen} onOpenChange={setNavOpen}>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="gap-1.5 medium:shrink-0 xl:hidden"
									onClick={() => setNavOpen(true)}
								>
									<MenuIcon className="size-4" aria-hidden />
									Questions
								</Button>
								<SheetContent side="left" className="w-[min(100%,20rem)] gap-0">
									<SheetHeader className="border-border border-b pb-3">
										<SheetTitle>Jump to question</SheetTitle>
										<SheetDescription>Select a question to continue.</SheetDescription>
									</SheetHeader>
									<div className="flex-1 overflow-y-auto p-4">
										<PracticeQuestionNavList
											sorted={sorted}
											activeId={active.id}
											answers={answers}
											flagged={flagged}
											skipped={skipped}
											onPickIndex={(i) => {
												setActiveIdx(i);
												setNavOpen(false);
											}}
										/>
									</div>
									<SheetFooter className="border-border flex flex-col gap-2 border-t pt-4">
										<Button
											type="button"
											variant="outline"
											className="w-full justify-center gap-2"
											onClick={() => {
												setShortcutsOpen(true);
												setNavOpen(false);
											}}
										>
											<KeyboardIcon className="size-4" aria-hidden />
											Keyboard shortcuts
											<Kbd className="ml-0.5 px-2">?</Kbd>
										</Button>
										<SheetClose render={<Button type="button" variant="outline" className="w-full" />}>
											Close
										</SheetClose>
									</SheetFooter>
								</SheetContent>
							</Sheet>

							<div
								className={cn(
									cardSurfaceFrameClassName,
									"flex w-full overflow-hidden shadow-sm",
									"bg-background dark:bg-card",
									"flex-col divide-y divide-border/90 medium:w-auto medium:min-w-[min(100%,28rem)] medium:flex-row medium:divide-x medium:divide-y-0",
								)}
							>
								<div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-4 py-3.5 medium:max-w-md medium:py-3 medium:pr-5 medium:pl-4">
									<div className="flex items-baseline justify-between gap-3">
										<p className="text-foreground text-sm font-semibold tabular-nums medium:text-base">
											{answeredCount}/{sorted.length} answered
										</p>
										<span className="text-foreground/65 shrink-0 text-sm font-semibold tabular-nums">{progressPct}%</span>
									</div>
									<div
										className="bg-foreground/12 dark:bg-muted h-2 w-full overflow-hidden rounded-full"
										role="progressbar"
										aria-valuenow={progressPct}
										aria-valuemin={0}
										aria-valuemax={100}
										aria-label="Share of questions answered"
									>
										<div
											className="motion-safe:transition-[width] h-full rounded-full bg-emerald-600 motion-reduce:transition-none dark:bg-emerald-500"
											style={{ width: `${progressPct}%` }}
										/>
									</div>
									<div className="text-foreground/60 flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
										{flaggedCount > 0 ?
											<span className="text-amber-800 dark:text-amber-400 font-medium">
												{flaggedCount} marked for review
											</span>
										:	null}
										{skippedCount > 0 ?
											<span className="text-foreground/70 font-medium">
												{skippedCount} skipped
											</span>
										:	null}
										{!isOnline ? (
											<span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-300">
												Offline — {unsyncedCount} unsynced
											</span>
										) : saveUi === "saving" ? (
											<span className="text-foreground/65">Saving…</span>
										) : saveUi === "failed" ? (
											<button
												type="button"
												onClick={retrySaveActiveQuestion}
												className="text-destructive underline decoration-dotted underline-offset-2 hover:text-destructive/80"
											>
												Save failed — retry
											</button>
										) : saveUi === "saved" ? (
											<span className="text-emerald-700 dark:text-emerald-400/90 tabular-nums">
												{lastSavedAgo === 0
													? "Saved just now"
													: `Saved ${lastSavedAgo}s ago`}
											</span>
										) : null}
									</div>
								</div>

								<div
									className={cn(
										"flex flex-col justify-center gap-1 px-4 py-3.5 medium:min-w-[10.25rem] medium:shrink-0 medium:py-3 medium:pl-5 medium:pr-4",
										warnTime ?
											"bg-amber-500/[0.12] dark:bg-amber-500/15"
										:	"bg-muted/40 dark:bg-muted/25",
									)}
									aria-live="polite"
									aria-atomic="true"
								>
									<span className="text-foreground/65 flex items-center gap-1.5 text-xs font-semibold tracking-tight">
										<ClockIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
										Time left
									</span>
									<span className="font-mono text-3xl font-semibold tabular-nums tracking-tight medium:text-[2rem] medium:leading-none">
										{remainingSec <= 0 ? "0:00" : timeLabel}
									</span>
									{warnTime ?
										<span className="text-amber-900 dark:text-amber-200 text-xs font-semibold">
											{criticalTime ? `${remainingSec}s left` : "Low time"}
										</span>
									:	null}
									{pauseAllowed ? (
										<button
											type="button"
											onClick={startPause}
											className="text-foreground/70 hover:text-foreground mt-0.5 self-start text-[11px] underline decoration-dotted underline-offset-2"
										>
											Pause (5 min, once)
										</button>
									) : null}
								</div>
							</div>
						</div>
					</div>
					{serverRow.isPaused && !paused ? (
						<div
							className="rounded-lg border-2 border-sky-500/40 bg-sky-500/10 px-4 py-3 text-center"
							role="alert"
						>
							<p className="text-sky-950 dark:text-sky-100 text-sm font-semibold">
								Test paused by an operator. Your timer is frozen until they resume.
							</p>
						</div>
					) : null}
					{adminMessage ? (
						<div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
							<span className="text-foreground/90">
								<strong>Admin:</strong> {adminMessage}
							</span>
							<button
								type="button"
								className="text-foreground/70 shrink-0 text-xs underline"
								onClick={() => setAdminMessage(null)}
							>
								Dismiss
							</button>
						</div>
					) : null}
					{paused ? (
						<div
							className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center"
							role="alert"
						>
							<p className="text-amber-900 dark:text-amber-200 text-sm font-semibold">
								Paused · {Math.floor(pauseRemainingSec / 60)}:
								{String(pauseRemainingSec % 60).padStart(2, "0")} remaining
							</p>
						</div>
					) : null}
					{!paused && !serverRow.isPaused && finalCountdown ? (
						<div
							className="border-destructive/60 bg-destructive/10 rounded-lg border-2 px-4 py-2 text-center"
							role="alert"
						>
							<p className="text-destructive text-sm font-semibold">
								Submitting in {remainingSec}s
							</p>
						</div>
					) : null}
				</header>

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

				<Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden shadow-sm">
					<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
						<div className="flex min-h-full min-w-0 flex-1 flex-col">
						<CardHeader className="shrink-0 space-y-3 pb-3">
							<div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
								<div className="flex min-h-7 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
									<Badge
										variant="outline"
										className="border-border/60 bg-muted/30 text-muted-foreground shrink-0 font-mono tabular-nums font-normal"
									>
										Q{active.question_number}
									</Badge>
									<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
										<div className="flex items-center gap-2">
											<span className="text-xs font-medium whitespace-nowrap opacity-90">
												Difficulty:
											</span>
											{active.difficulty_level ?
												<Badge
													variant="outline"
													className={cn(
														"border-border/50 font-semibold tracking-tight",
														difficultyClass(active.difficulty_level),
													)}
												>
													{difficultyDisplayLabel(active.difficulty_level)}
												</Badge>
											:	<Badge
													variant="outline"
													className="border-border/50 text-muted-foreground bg-muted/25 font-normal"
												>
													—
												</Badge>}
										</div>
										<div className="flex min-w-0 max-w-full items-center gap-2">
											<span className="shrink-0 text-xs font-medium whitespace-nowrap opacity-90">
												Question type:
											</span>
											<Badge
												variant="outline"
												className="border-border/50 bg-muted/25 text-foreground/90 shrink-0 font-normal"
											>
												{questionTypeLabel(active.question_type)}
											</Badge>
										</div>
										<div className="flex min-w-0 max-w-full items-center gap-2">
											<span className="shrink-0 text-xs font-medium whitespace-nowrap opacity-90">
												Chapter/topic:
											</span>
											<Badge
												variant="outline"
												className="border-border/50 bg-muted/25 text-foreground/90 max-w-[min(100%,24rem)] truncate font-normal"
												title={chapterTopicDisplayLabel(active.chapter_name, active.topic_name)}
											>
												{chapterTopicDisplayLabel(active.chapter_name, active.topic_name)}
											</Badge>
										</div>
									</div>
								</div>
								<div
									className="flex min-h-7 shrink-0 flex-wrap items-center gap-2 opacity-95"
									role="group"
									aria-label="Review options"
								>
									<span className="flex size-7 shrink-0 items-center justify-center">
										<BookmarkIcon
											className={cn(
												"size-4",
												flagged[active.id] ?
													"text-amber-600 dark:text-amber-400"
												:	"text-muted-foreground/80",
											)}
											aria-hidden
										/>
									</span>
									<span className="flex h-7 shrink-0 items-center">
										<input
											type="checkbox"
											id={`review-${active.id}`}
											checked={flagged[active.id] ?? false}
											onChange={(e) => onFlagToggle(active, e.target.checked)}
											className="border-input/55 size-4 shrink-0 rounded"
										/>
									</span>
									<Label
										htmlFor={`review-${active.id}`}
										className="text-muted-foreground hover:text-foreground/80 cursor-pointer text-xs font-medium whitespace-nowrap"
									>
										Mark for review
									</Label>
									<Button
										type="button"
										variant={skipped[active.id] ? "secondary" : "ghost"}
										size="sm"
										onClick={() =>
											setSkipped((prev) => ({ ...prev, [active.id]: !(prev[active.id] ?? false) }))
										}
										className={cn(
											"h-7 px-2 text-xs font-normal",
											skipped[active.id] ?
												"bg-muted/50 text-muted-foreground"
											:	"text-muted-foreground hover:text-foreground/90",
										)}
									>
										{skipped[active.id] ? "Skipped" : "Skip"}
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => {
											setReportReason("");
											setReportOpen(true);
										}}
										className="text-muted-foreground hover:text-foreground/90 h-7 px-2 text-xs font-normal"
									>
										Report
									</Button>
								</div>
							</div>
							<CardTitle className="text-foreground max-w-prose text-balance text-base font-semibold leading-relaxed tracking-tight medium:text-lg">
								<LatexText text={active.question_text} />
							</CardTitle>
						</CardHeader>
						<Separator className="shrink-0" />
						<CardContent
							key={active.id}
							className="motion-safe:animate-in motion-safe:fade-in-0 flex min-h-0 flex-1 flex-col gap-6 pb-6 pt-5 motion-safe:duration-200 motion-reduce:animate-none"
						>
							{active.question_type === "multiple_choice" && active.options ?
								<FieldSet>
									<FieldLegend variant="label" className="text-foreground text-sm font-medium">
										Select an answer
									</FieldLegend>
									<FieldGroup className="gap-3">
										{optionEntries(active.options).map(([letter, text]) => {
											const id = `mcq-${active.id}-${letter}`;
											const selected =
												answers[active.id]?.kind === "mcq" && answers[active.id].value === letter;
											return (
												<Field key={letter} orientation="horizontal" className="items-start gap-3">
													<input
														type="radio"
														name={`mcq-${active.id}`}
														id={id}
														checked={selected}
														onChange={() => onMcqChange(active, letter)}
														className="mt-1 size-4 border-input"
													/>
													<FieldLabel htmlFor={id} className="flex-1 cursor-pointer leading-snug">
														<span className="border-foreground/15 bg-muted text-foreground/90 mr-2 inline-flex size-7 items-center justify-center rounded-md border-2 font-mono text-xs font-semibold tabular-nums dark:border-border">
															{letter}
														</span>
														<LatexText text={text} />
													</FieldLabel>
												</Field>
											);
										})}
									</FieldGroup>
								</FieldSet>
							:	null}

							{active.question_type === "fill_in_blank" ?
								<FieldSet>
									<FieldLegend variant="label" className="text-foreground text-sm font-medium">
										Your answer
									</FieldLegend>
									<Input
										data-practice-answer-field="true"
										value={answers[active.id]?.kind === "text" ? answers[active.id].value : ""}
										onChange={(e) => onTextChange(active, e.target.value)}
										placeholder="One word or short phrase…"
										className="max-w-xl border-2"
										autoComplete="off"
									/>
								</FieldSet>
							:	null}

							{active.question_type === "short_answer" || active.question_type === "long_answer" ?
								<FieldSet className="min-h-0 flex-1 gap-4">
									<FieldLegend variant="label" className="text-foreground shrink-0 text-sm font-medium">
										Your answer
									</FieldLegend>
									{(() => {
										const value = answers[active.id]?.kind === "text" ? answers[active.id].value : "";
										const softCap = active.question_type === "long_answer" ? 4000 : 2000;
										return (
											<PracticeRichAnswerEditor
												key={active.id}
												value={value}
												onChange={(html) => onTextChange(active, html)}
												placeholder={
													active.question_type === "long_answer" ?
														"Write your answer in full…"
													:	"Type your response…"
												}
												variant={active.question_type === "long_answer" ? "long" : "short"}
												softCap={softCap}
											/>
										);
									})()}
								</FieldSet>
							:	null}

							{active.question_type === "numerical" ?
								<FieldSet>
									<FieldLegend variant="label" className="text-foreground text-sm font-medium">
										Your answer
									</FieldLegend>
									<Input
										data-practice-answer-field="true"
										inputMode="decimal"
										value={answers[active.id]?.kind === "numerical" ? answers[active.id].value : ""}
										onChange={(e) => onTextChange(active, e.target.value)}
										placeholder="Enter a number (units if stated in the question)"
										className="max-w-md border-2"
									/>
								</FieldSet>
							:	null}
						</CardContent>
						</div>
					</div>
					<CardFooter className="border-border bg-background flex w-full flex-wrap items-center justify-between gap-2 border-t-2 dark:bg-card">
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={activeIdx <= 0}
								onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
							>
								<ChevronLeftIcon className="size-4" aria-hidden />
								Previous
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={activeIdx >= sorted.length - 1}
								onClick={() => setActiveIdx((i) => Math.min(sorted.length - 1, i + 1))}
							>
								Next
								<ChevronRightIcon className="size-4" aria-hidden />
							</Button>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="w-full medium:ms-auto medium:w-auto"
							onClick={() => setSubmitOpen(true)}
							disabled={submitting}
						>
							Submit test
						</Button>
					</CardFooter>
				</Card>
			</div>

			<Dialog.Root
				open={submitOpen}
				onOpenChange={(open) => {
					if (!open && submitting) return;
					setSubmitOpen(open);
				}}
			>
				<Dialog.Portal>
					<Dialog.Backdrop
						className={cn(
							"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					/>
					<Dialog.Popup
						className={cn(
							"fixed top-1/2 left-1/2 z-50 flex max-h-[min(92vh,44rem)] w-[min(calc(100vw-2rem),40rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-y-auto rounded-2xl border-2 border-border/80 bg-popover p-0 text-popover-foreground shadow-2xl ring-1 ring-foreground/[0.06] dark:ring-foreground/10",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					>
						<div
							className="h-1 w-full shrink-0 rounded-t-[0.9rem] bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 dark:from-emerald-500 dark:via-emerald-400 dark:to-teal-400"
							aria-hidden
						/>
						<div className="flex flex-col gap-6 p-6 medium:gap-7 medium:p-8">
							<Button
								type="button"
								variant="ghost"
								size="icon-lg"
								className="absolute top-5 right-4 shrink-0 rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground medium:top-6 medium:right-5"
								onClick={() => setSubmitOpen(false)}
								disabled={submitting}
								aria-label="Close"
							>
								<XIcon />
							</Button>

							<div className="flex flex-col gap-3 pe-10 medium:pe-12">
								<p className="text-emerald-700 dark:text-emerald-400/90 text-[11px] font-semibold uppercase tracking-[0.14em]">
									Practice test
								</p>
								<Dialog.Title
									id={submitDialogTitleId}
									className="font-heading text-foreground text-2xl font-bold tracking-tight medium:text-3xl"
								>
									Finish and submit?
								</Dialog.Title>
								<Dialog.Description
									id={submitDialogDescId}
									className="text-muted-foreground text-sm leading-relaxed medium:text-base"
								>
									You&apos;re about to hand in this test. Review the summary below — you can still go back
									and edit answers until you confirm.
								</Dialog.Description>
							</div>

							<div className="from-muted/40 border-border/80 bg-gradient-to-b to-muted/15 flex flex-col gap-4 rounded-2xl border p-4 medium:p-5">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h2 className="text-foreground text-sm font-semibold tracking-tight medium:text-base">
										Your progress
									</h2>
									<Badge
										variant="outline"
										className="border-emerald-600/35 bg-emerald-600/10 text-emerald-900 tabular-nums font-semibold dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-100"
									>
										{progressPct}% complete
									</Badge>
								</div>
								<div
									className="bg-foreground/10 dark:bg-muted h-2 w-full overflow-hidden rounded-full"
									role="progressbar"
									aria-valuenow={progressPct}
									aria-valuemin={0}
									aria-valuemax={100}
									aria-label="Share of questions answered"
								>
									<div
										className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none dark:bg-emerald-500"
										style={{ width: `${progressPct}%` }}
									/>
								</div>
								<div className="grid gap-3 medium:grid-cols-3">
									<div className="border-border/70 bg-background/60 flex gap-3 rounded-xl border px-3 py-3 medium:flex-col medium:px-3.5 medium:py-3.5">
										<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/12 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
											<CheckIcon className="size-4" strokeWidth={2.5} aria-hidden />
										</div>
										<div className="min-w-0">
											<p className="text-muted-foreground text-xs font-medium">Answered</p>
											<p className="text-foreground mt-0.5 text-xl font-bold tabular-nums leading-none medium:text-2xl">
												{answeredCount}
												<span className="text-muted-foreground text-base font-semibold">
													/{sorted.length}
												</span>
											</p>
										</div>
									</div>
									<div
										className={cn(
											"border-border/70 bg-background/60 flex gap-3 rounded-xl border px-3 py-3 medium:flex-col medium:px-3.5 medium:py-3.5",
											unansweredCount > 0 ?
												"border-amber-500/35 bg-amber-500/[0.06] dark:border-amber-400/30 dark:bg-amber-400/[0.07]"
											:	null,
										)}
									>
										<div
											className={cn(
												"flex size-9 shrink-0 items-center justify-center rounded-lg",
												unansweredCount > 0 ?
													"bg-amber-500/15 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100"
												:	"bg-muted text-muted-foreground",
											)}
										>
											<CircleDashedIcon className="size-4" strokeWidth={2} aria-hidden />
										</div>
										<div className="min-w-0">
											<p className="text-muted-foreground text-xs font-medium">Still blank</p>
											<p className="text-foreground mt-0.5 text-xl font-bold tabular-nums leading-none medium:text-2xl">
												{unansweredCount}
											</p>
											{unansweredCount === 0 ?
												<p className="text-muted-foreground mt-1 text-[11px] leading-snug">
													All questions have an answer.
												</p>
											:	null}
										</div>
									</div>
									<div
										className={cn(
											"border-border/70 bg-background/60 flex gap-3 rounded-xl border px-3 py-3 medium:flex-col medium:px-3.5 medium:py-3.5",
											flaggedCount > 0 ?
												"border-amber-600/25 bg-amber-500/[0.04] dark:border-amber-400/25"
											:	null,
										)}
									>
										<div
											className={cn(
												"flex size-9 shrink-0 items-center justify-center rounded-lg",
												flaggedCount > 0 ?
													"bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"
												:	"bg-muted text-muted-foreground",
											)}
										>
											<BookmarkIcon className="size-4" strokeWidth={2} aria-hidden />
										</div>
										<div className="min-w-0">
											<p className="text-muted-foreground text-xs font-medium">For review</p>
											<p className="text-foreground mt-0.5 text-xl font-bold tabular-nums leading-none medium:text-2xl">
												{flaggedCount}
											</p>
											<p className="text-muted-foreground mt-1 text-[11px] leading-snug">
												{flaggedCount > 0 ?
													"Reminder only — you can submit anytime."
												:	"No questions flagged."}
											</p>
										</div>
									</div>
								</div>
							</div>

							<p className="text-muted-foreground border-border/60 -mt-1 border-t pt-5 text-sm leading-relaxed medium:text-[0.9375rem]">
								After you submit, we grade your work and open your report for this subject, with this
								attempt highlighted.
							</p>

							{submitError ?
								<p className="text-destructive -mt-2 text-sm font-semibold medium:text-base" role="alert">
									{submitError}
								</p>
							:	null}

							<div className="border-border/70 flex flex-col-reverse gap-3 border-t pt-5 medium:flex-row medium:items-center medium:justify-end medium:gap-3 medium:pt-6">
								<p className="text-muted-foreground hidden text-center text-[11px] leading-snug medium:me-auto medium:block medium:text-left">
									<span className="font-medium text-foreground/80">Tip:</span>{" "}
									<kbd className="bg-muted border-border rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold">
										Esc
									</kbd>{" "}
									returns to the test.
								</p>
								<div className="flex flex-col-reverse gap-2.5 medium:flex-row medium:gap-3">
									<Button
										type="button"
										variant="outline"
										size="lg"
										className="h-11 min-h-11 rounded-xl px-6 text-base font-semibold medium:min-w-[10.5rem]"
										onClick={() => setSubmitOpen(false)}
										disabled={submitting}
									>
										Keep working
									</Button>
									<Button
										type="button"
										size="lg"
										className={cn(
											confirmSubmitCta,
											"h-11 min-h-11 rounded-xl px-6 text-base font-semibold shadow-sm medium:min-w-[10.5rem]",
										)}
										disabled={submitting}
										onClick={() => void runSubmit()}
									>
										{submitting ? "Submitting…" : "Submit test"}
									</Button>
								</div>
							</div>
						</div>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>

			<Dialog.Root
				open={exitConfirmOpen}
				onOpenChange={(open) => {
					if (!open) cancelExitSession();
				}}
			>
				<Dialog.Portal>
					<Dialog.Backdrop
						className={cn(
							"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					/>
					<Dialog.Popup
						className={cn(
							"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border-2 bg-popover p-6 text-popover-foreground shadow-xl medium:gap-6 medium:p-8",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					>
						<div className="flex flex-col gap-2 pe-8">
							<Dialog.Title
								id={exitDialogTitleId}
								className="font-heading text-foreground text-xl font-bold tracking-tight medium:text-2xl"
							>
								Leave practice session?
							</Dialog.Title>
							<Dialog.Description
								id={exitDialogDescId}
								className="text-foreground/85 text-sm font-medium leading-relaxed medium:text-base"
							>
								{unsyncedCount > 0 ? (
									<>
										You have <span className="text-destructive font-semibold">{unsyncedCount}</span>{" "}
										unsynced answer{unsyncedCount === 1 ? "" : "s"}. Clicking Leave will try to save
										them first. If you are offline, consider reconnecting before leaving.
									</>
								) : (
									<>
										All your answers are saved. You can return to this test from Practice at any time.
									</>
								)}
							</Dialog.Description>
						</div>
						<div className="border-border flex flex-col-reverse gap-3 border-t-2 pt-5 medium:flex-row medium:justify-end medium:gap-3 medium:pt-6">
							<Button
								type="button"
								variant="outline"
								size="lg"
								className="h-11 min-h-11 px-6 text-base font-semibold medium:min-w-[10rem]"
								onClick={cancelExitSession}
							>
								Stay
							</Button>
							<Button
								type="button"
								variant="destructive"
								size="lg"
								className="h-11 min-h-11 px-6 text-base font-semibold medium:min-w-[10rem]"
								onClick={() => void confirmExitSession()}
							>
								Leave
							</Button>
						</div>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>

			{/* Phase 5: keyboard shortcut help */}
			<Dialog.Root open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
				<Dialog.Portal>
					<Dialog.Backdrop
						className={cn(
							"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					/>
					<Dialog.Popup
						className={cn(
							"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-2xl border-2 bg-popover p-6 text-popover-foreground shadow-xl",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					>
						<div className="flex items-start gap-3">
							<div className="bg-muted/80 flex size-10 shrink-0 items-center justify-center rounded-xl border">
								<KeyboardIcon className="text-foreground/70 size-5" aria-hidden />
							</div>
							<div className="min-w-0 space-y-1">
								<Dialog.Title className="font-heading text-xl font-bold tracking-tight">
									Keyboard shortcuts
								</Dialog.Title>
								<Dialog.Description className="text-foreground/70 text-sm leading-snug">
									Use these keys when you are not typing in an answer field.
								</Dialog.Description>
							</div>
						</div>
						<dl className="flex flex-col gap-3.5 text-sm">
							<div className="flex items-start gap-3">
								<dt className="flex shrink-0 flex-wrap items-center gap-1">
									<Kbd>J</Kbd>
									<span className="text-muted-foreground px-0.5">/</span>
									<Kbd>→</Kbd>
								</dt>
								<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Next question</dd>
							</div>
							<div className="flex items-start gap-3">
								<dt className="flex shrink-0 flex-wrap items-center gap-1">
									<Kbd>K</Kbd>
									<span className="text-muted-foreground px-0.5">/</span>
									<Kbd>←</Kbd>
								</dt>
								<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Previous question</dd>
							</div>
							<div className="flex items-start gap-3">
								<dt>
									<Kbd>N</Kbd>
								</dt>
								<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Next unanswered</dd>
							</div>
							<div className="flex items-start gap-3">
								<dt>
									<Kbd>P</Kbd>
								</dt>
								<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Previous unanswered</dd>
							</div>
							<div className="flex items-start gap-3">
								<dt>
									<Kbd>F</Kbd>
								</dt>
								<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Flag / unflag for review</dd>
							</div>
							<div className="flex items-start gap-3">
								<dt>
									<Kbd>S</Kbd>
								</dt>
								<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Skip / unskip</dd>
							</div>
							<div className="flex items-start gap-3">
								<dt className="flex shrink-0 flex-wrap items-center gap-1">
									<Kbd>A</Kbd>
									<span className="text-muted-foreground">–</span>
									<Kbd>D</Kbd>
									<span className="text-muted-foreground px-0.5">·</span>
									<Kbd>1</Kbd>
									<span className="text-muted-foreground">–</span>
									<Kbd>4</Kbd>
								</dt>
								<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Choose MCQ option</dd>
							</div>
							<div className="flex items-start gap-3">
								<dt>
									<Kbd>?</Kbd>
								</dt>
								<dd className="text-foreground/85 min-w-0 pt-0.5 leading-snug">Open or close this panel</dd>
							</div>
						</dl>
						<div className="flex justify-end">
							<Button type="button" variant="outline" onClick={() => setShortcutsOpen(false)}>
								Close
							</Button>
						</div>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>

			{/* Phase 5: report-this-question dialog */}
			<Dialog.Root open={reportOpen} onOpenChange={(o) => !reportSubmitting && setReportOpen(o)}>
				<Dialog.Portal>
					<Dialog.Backdrop
						className={cn(
							"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					/>
					<Dialog.Popup
						className={cn(
							"fixed top-1/2 left-1/2 z-50 flex w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border-2 bg-popover p-6 text-popover-foreground shadow-xl",
							"data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					>
						<Dialog.Title className="font-heading text-xl font-bold tracking-tight">
							Report this question
						</Dialog.Title>
						<Dialog.Description className="text-foreground/80 text-sm leading-relaxed">
							Tell us what&apos;s wrong (ambiguous, factually incorrect, unclear wording…). Your answer
							is not affected.
						</Dialog.Description>
						<textarea
							value={reportReason}
							onChange={(e) => setReportReason(e.target.value)}
							rows={3}
							maxLength={1000}
							className="border-input bg-background focus-visible:ring-ring w-full rounded-md border-2 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
							placeholder="Describe the issue"
						/>
						{flagNotice ? (
							<p className="text-emerald-700 dark:text-emerald-400 text-sm" role="status">
								{flagNotice}
							</p>
						) : null}
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setReportOpen(false)}
								disabled={reportSubmitting}
							>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={reportSubmitting || reportReason.trim().length < 4 || !active}
								onClick={async () => {
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
								}}
							>
								{reportSubmitting ? "Reporting…" : "Submit"}
							</Button>
						</div>
					</Dialog.Popup>
				</Dialog.Portal>
			</Dialog.Root>
		</div>
	);
}

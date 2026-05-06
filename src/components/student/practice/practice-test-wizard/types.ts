import { z } from "zod";

import {
	PRACTICE_MAX_TOPICS,
	PRACTICE_MIN_TOPICS,
	practiceDifficultySchema,
	practiceDurationSecondsInputSchema,
} from "@/lib/practice";
import type { PracticeDifficulty } from "@/lib/practice/types";

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
	timeLimitSeconds?: number | null;
	startedAt?: string | null;
	topicsCovered?: number | null;
	lastTestScore?: number | null;
};

/** Phase 4: focus-area radio choices on the topics step. */
export const FOCUS_AREA_OPTIONS = [
	{ value: "all", label: "All topics" },
	{ value: "weak", label: "Weak topics only" },
	{ value: "not_tested", label: "Not yet tested" },
	{ value: "recent_errors", label: "Recent mistakes" },
] as const;
export type FocusArea = (typeof FOCUS_AREA_OPTIONS)[number]["value"];

/** Same emerald as step progress; `!` ensures filled CTAs never pick up soft `--primary` mint. */
export const practiceSolidCtaClassName =
	"!bg-emerald-600 hover:!bg-emerald-600/90 dark:!bg-emerald-500 dark:hover:!bg-emerald-500/90";

/** Shown in sequence on the generating overlay so the line "rotates" instead of staying static. */
export const GENERATING_STATUS_MESSAGES = [
	"Generating your test…",
	"Choosing questions for your topics…",
	"Matching difficulty and length…",
	"Almost ready…",
] as const;

/** How long each line stays visible before rotating to the next. */
export const GENERATING_STATUS_ROTATE_MS = 15_000;

export const DIFFICULTY_OPTIONS = [
	["easy", "Easy"],
	["medium", "Medium"],
	["hard", "Hard"],
] as const satisfies readonly (readonly [PracticeDifficulty, string])[];

export const practiceStep0Schema = z.object({
	subjectId: z.string().uuid({ message: "Select a subject." }),
});

export const practiceStep1Schema = z
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
		if (data.trackerIds.length > PRACTICE_MAX_TOPICS) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Select at most ${PRACTICE_MAX_TOPICS} topics per test.`,
				path: ["trackerIds"],
			});
		}
	});

export const practiceStep2FieldsSchema = z.object({
	difficulty: practiceDifficultySchema,
	durationSeconds: practiceDurationSecondsInputSchema,
});

/**
 * Supabase-like round selection: bright emerald fill when on, soft outer glow, white glyph.
 * Check / indeterminate icons are styled in `app/globals.css` (`.practice-matrix-check-circle`).
 */
export const practiceTopicMatrixCheckCircleClass = [
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
export const practiceTopicMatrixSurfaceClass =
	"border border-border/70 bg-background/40 shadow-none ring-0 transition-[border-color,box-shadow] duration-200 ease-out hover:border-primary/45 hover:shadow-[0_0_28px_-12px_color-mix(in_oklab,var(--primary)_38%,transparent)] dark:bg-background/25";

import {
	PRACTICE_DURATION_OPTIONS,
	type PracticeDurationSeconds,
} from "@/lib/practice/constants";
import type { PracticeDifficulty } from "@/lib/practice/types";

/**
 * Self-practice config draft — the simple, single-value fields the student is
 * building across the wizard's steps. Pure reducer; no React.
 *
 * Tracker selection is intentionally *not* in this state because its setters
 * use bulk add / remove semantics (focus-area presets, undo callbacks) that
 * don't fit a discriminated-action shape cleanly. It stays as a separate
 * useState in the wizard component.
 *
 * Async / preview / generation / error state also stays in the wizard since
 * those are short-lived flow states with their own lifecycle.
 *
 * The reducer treats `step` as ordinary state — clamping happens here so
 * dispatchers don't have to bounds-check.
 */

export const FOCUS_AREAS = ["all", "weak", "not_tested", "recent_errors"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

export type WizardDraft = {
	step: number;
	subjectId: string | null;
	focusArea: FocusArea;
	difficulty: PracticeDifficulty;
	durationSeconds: PracticeDurationSeconds;
};

export const MIN_STEP = 0;
export const MAX_STEP = 3;

export const initialWizardDraft: WizardDraft = {
	step: 0,
	subjectId: null,
	focusArea: "all",
	difficulty: "medium",
	durationSeconds: PRACTICE_DURATION_OPTIONS[0].seconds,
};

export type WizardDraftAction =
	| { type: "next_step" }
	| { type: "prev_step" }
	| { type: "go_to_step"; step: number }
	| { type: "set_subject"; subjectId: string | null }
	| { type: "set_focus_area"; value: FocusArea }
	| { type: "set_difficulty"; value: PracticeDifficulty }
	| { type: "set_duration"; seconds: PracticeDurationSeconds }
	| { type: "reset_draft" };

function clampStep(n: number): number {
	if (Number.isNaN(n)) return MIN_STEP;
	return Math.max(MIN_STEP, Math.min(MAX_STEP, Math.trunc(n)));
}

export function wizardDraftReducer(state: WizardDraft, action: WizardDraftAction): WizardDraft {
	switch (action.type) {
		case "next_step": {
			const next = clampStep(state.step + 1);
			return next === state.step ? state : { ...state, step: next };
		}
		case "prev_step": {
			const next = clampStep(state.step - 1);
			return next === state.step ? state : { ...state, step: next };
		}
		case "go_to_step": {
			const next = clampStep(action.step);
			return next === state.step ? state : { ...state, step: next };
		}
		case "set_subject":
			return state.subjectId === action.subjectId ? state : { ...state, subjectId: action.subjectId };
		case "set_focus_area":
			return state.focusArea === action.value ? state : { ...state, focusArea: action.value };
		case "set_difficulty":
			return state.difficulty === action.value ? state : { ...state, difficulty: action.value };
		case "set_duration":
			return state.durationSeconds === action.seconds
				? state
				: { ...state, durationSeconds: action.seconds };
		case "reset_draft":
			return { ...initialWizardDraft };
		default: {
			const _exhaustive: never = action;
			return _exhaustive;
		}
	}
}

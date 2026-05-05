import { describe, expect, it } from "vitest";

import {
	initialWizardDraft,
	wizardDraftReducer,
	MAX_STEP,
	MIN_STEP,
} from "@/components/student/practice/wizard/wizard-draft-state";

describe("wizardDraftReducer — step navigation", () => {
	it("next_step increments and clamps at MAX_STEP", () => {
		let s = initialWizardDraft;
		for (let i = 0; i < MAX_STEP + 5; i++) {
			s = wizardDraftReducer(s, { type: "next_step" });
		}
		expect(s.step).toBe(MAX_STEP);
	});

	it("prev_step decrements and clamps at MIN_STEP", () => {
		let s = { ...initialWizardDraft, step: 2 };
		s = wizardDraftReducer(s, { type: "prev_step" });
		expect(s.step).toBe(1);
		for (let i = 0; i < 5; i++) {
			s = wizardDraftReducer(s, { type: "prev_step" });
		}
		expect(s.step).toBe(MIN_STEP);
	});

	it("go_to_step clamps to range and is identity for in-range targets", () => {
		const out = wizardDraftReducer(initialWizardDraft, { type: "go_to_step", step: 99 });
		expect(out.step).toBe(MAX_STEP);
		const back = wizardDraftReducer(out, { type: "go_to_step", step: 1 });
		expect(back.step).toBe(1);
	});

	it("go_to_step with NaN snaps to MIN_STEP", () => {
		const out = wizardDraftReducer(initialWizardDraft, { type: "go_to_step", step: Number.NaN });
		expect(out.step).toBe(MIN_STEP);
	});
});

describe("wizardDraftReducer — set_subject", () => {
	it("updates subjectId", () => {
		const out = wizardDraftReducer(initialWizardDraft, { type: "set_subject", subjectId: "subj-a" });
		expect(out.subjectId).toBe("subj-a");
	});

	it("is a no-op when value is unchanged", () => {
		const out = wizardDraftReducer(initialWizardDraft, { type: "set_subject", subjectId: null });
		expect(out).toBe(initialWizardDraft);
	});
});

describe("wizardDraftReducer — focus / difficulty / duration", () => {
	it("set_focus_area updates value", () => {
		const out = wizardDraftReducer(initialWizardDraft, { type: "set_focus_area", value: "weak" });
		expect(out.focusArea).toBe("weak");
	});

	it("set_difficulty updates value", () => {
		const out = wizardDraftReducer(initialWizardDraft, { type: "set_difficulty", value: "hard" });
		expect(out.difficulty).toBe("hard");
	});

	it("set_duration updates value", () => {
		const out = wizardDraftReducer(initialWizardDraft, { type: "set_duration", seconds: 10800 });
		expect(out.durationSeconds).toBe(10800);
	});

	it("setters are no-ops when value is unchanged", () => {
		expect(
			wizardDraftReducer(initialWizardDraft, { type: "set_focus_area", value: "all" }),
		).toBe(initialWizardDraft);
		expect(
			wizardDraftReducer(initialWizardDraft, { type: "set_difficulty", value: "medium" }),
		).toBe(initialWizardDraft);
	});
});

describe("wizardDraftReducer — reset", () => {
	it("reset_draft returns the initial state shape", () => {
		const seeded = {
			...initialWizardDraft,
			step: 2,
			subjectId: "subj-a",
			focusArea: "weak" as const,
			difficulty: "hard" as const,
		};
		const out = wizardDraftReducer(seeded, { type: "reset_draft" });
		expect(out.step).toBe(0);
		expect(out.subjectId).toBeNull();
		expect(out.focusArea).toBe("all");
		expect(out.difficulty).toBe("medium");
	});
});

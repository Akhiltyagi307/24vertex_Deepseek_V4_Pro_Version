import { describe, expect, it } from "vitest";

import {
	arrayShallowEqual,
	filterAssignmentCandidateStudents,
	isAssignmentBandFilterActive,
	studentMatchesAssignmentBandFilter,
	studentMatchesAssignmentSectionFilter,
	type AssignmentBandCheckState,
} from "@/lib/assignments/recipient-selection";

const students = [
	{
		id: "s1",
		fullName: "A",
		grade: 8,
		section: "A",
		studentLinkCode: null,
	},
	{
		id: "s2",
		fullName: "B",
		grade: 8,
		section: "B",
		studentLinkCode: null,
	},
	{
		id: "s3",
		fullName: "C",
		grade: 8,
		section: null,
		studentLinkCode: null,
	},
];

const noBandChecks: AssignmentBandCheckState = {
	at_risk: false,
	near_target: false,
	needs_support: false,
};

describe("assignment recipient selection helpers", () => {
	it("matches section filters including empty-section sentinel", () => {
		expect(studentMatchesAssignmentSectionFilter({ section: "A" }, "")).toBe(true);
		expect(studentMatchesAssignmentSectionFilter({ section: "A" }, "A")).toBe(true);
		expect(studentMatchesAssignmentSectionFilter({ section: "A" }, "B")).toBe(false);
		expect(studentMatchesAssignmentSectionFilter({ section: null }, "__section_none__")).toBe(true);
		expect(studentMatchesAssignmentSectionFilter({ section: "A" }, "__section_none__")).toBe(false);
	});

	it("keeps all students when no band is selected", () => {
		expect(isAssignmentBandFilterActive(noBandChecks)).toBe(false);
		expect(
			studentMatchesAssignmentBandFilter({
				studentId: "s1",
				bandByStudentId: { s1: "at_risk" },
				bandChecks: noBandChecks,
				bandsPending: false,
			}),
		).toBe(true);
	});

	it("honors selected bands and excludes null band values", () => {
		const checks: AssignmentBandCheckState = {
			at_risk: true,
			near_target: false,
			needs_support: false,
		};
		expect(
			studentMatchesAssignmentBandFilter({
				studentId: "s1",
				bandByStudentId: { s1: "at_risk", s2: "near_target", s3: null },
				bandChecks: checks,
				bandsPending: false,
			}),
		).toBe(true);
		expect(
			studentMatchesAssignmentBandFilter({
				studentId: "s2",
				bandByStudentId: { s1: "at_risk", s2: "near_target", s3: null },
				bandChecks: checks,
				bandsPending: false,
			}),
		).toBe(false);
		expect(
			studentMatchesAssignmentBandFilter({
				studentId: "s3",
				bandByStudentId: { s1: "at_risk", s2: "near_target", s3: null },
				bandChecks: checks,
				bandsPending: false,
			}),
		).toBe(false);
	});

	it("applies section and performance filters as intersection", () => {
		const filtered = filterAssignmentCandidateStudents({
			students,
			sectionFilter: "A",
			bandByStudentId: { s1: "at_risk", s2: "at_risk", s3: "at_risk" },
			bandChecks: { at_risk: true, near_target: false, needs_support: false },
			bandsPending: false,
		});
		expect(filtered.map((student) => student.id)).toEqual(["s1"]);
	});

	it("compares shallow arrays for controlled id updates", () => {
		expect(arrayShallowEqual(["a", "b"], ["a", "b"])).toBe(true);
		expect(arrayShallowEqual(["a", "b"], ["a"])).toBe(false);
		expect(arrayShallowEqual(["a", "b"], ["b", "a"])).toBe(false);
	});
});

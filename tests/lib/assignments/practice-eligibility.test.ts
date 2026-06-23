import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Each awaited `db.select(...).from(...).where(...)` resolves to the next queued
// result. resolve() queries topics first (when topic_ids are present) then the
// student-subject membership rows.
let dbQueue: unknown[][] = [];
const selectSpy = vi.fn();

function chain() {
	const c: Record<string, unknown> = {
		from: () => c,
		where: () => c,
		orderBy: () => c,
		limit: () => c,
		innerJoin: () => c,
		groupBy: () => c,
		then: (resolve: (v: unknown) => unknown) => resolve(dbQueue.shift() ?? []),
	};
	return c;
}

vi.mock("@/db", () => ({
	db: {
		select: (...args: unknown[]) => {
			selectSpy(...args);
			return chain();
		},
	},
}));

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER_SUBJECT = "99999999-9999-4999-8999-999999999999";
const TOPIC = "22222222-2222-4222-8222-222222222222";
const STUDENT_A = "33333333-3333-4333-8333-333333333333";
const STUDENT_B = "44444444-4444-4444-8444-444444444444";

async function load() {
	return import("@/lib/assignments/queries");
}

beforeEach(() => {
	vi.resetAllMocks();
	dbQueue = [];
});

describe("resolvePracticeAssignmentEligibleStudentIds", () => {
	it("rejects when a scoped teacher picks a subject they do not teach", async () => {
		const { resolvePracticeAssignmentEligibleStudentIds } = await load();
		const result = await resolvePracticeAssignmentEligibleStudentIds({
			activeOrganizationId: "org-1",
			subjectsTaught: [OTHER_SUBJECT],
			config: { subject_id: SUBJECT, topic_ids: [] },
			studentIds: [STUDENT_A],
		});
		expect(result).toEqual({ ok: false, message: expect.stringMatching(/subject you teach/i) });
		expect(selectSpy).not.toHaveBeenCalled();
	});

	it("filters selected students to those who take the chosen subject", async () => {
		// topic-active check passes; membership query returns only STUDENT_A.
		dbQueue = [[{ id: TOPIC }], [{ id: STUDENT_A }]];
		const { resolvePracticeAssignmentEligibleStudentIds } = await load();
		const result = await resolvePracticeAssignmentEligibleStudentIds({
			activeOrganizationId: null,
			subjectsTaught: null,
			config: { subject_id: SUBJECT, topic_ids: [TOPIC] },
			studentIds: [STUDENT_A, STUDENT_B],
		});
		expect(result).toEqual({ ok: true, eligibleStudentIds: [STUDENT_A] });
	});

	it("returns an empty eligible set for an empty student list without querying", async () => {
		const { resolvePracticeAssignmentEligibleStudentIds } = await load();
		const result = await resolvePracticeAssignmentEligibleStudentIds({
			activeOrganizationId: null,
			subjectsTaught: null,
			config: { subject_id: SUBJECT, topic_ids: [] },
			studentIds: [],
		});
		expect(result).toEqual({ ok: true, eligibleStudentIds: [] });
		expect(selectSpy).not.toHaveBeenCalled();
	});
});

describe("validatePracticeAssignmentConfigForStudents (all-or-reject)", () => {
	it("fails when any selected student does not take the subject", async () => {
		dbQueue = [[{ id: TOPIC }], [{ id: STUDENT_A }]]; // B is dropped by the membership filter
		const { validatePracticeAssignmentConfigForStudents } = await load();
		const result = await validatePracticeAssignmentConfigForStudents({
			activeOrganizationId: null,
			subjectsTaught: null,
			config: { subject_id: SUBJECT, topic_ids: [TOPIC] },
			studentIds: [STUDENT_A, STUDENT_B],
		});
		expect(result).toEqual({ ok: false, message: expect.stringMatching(/do not take this subject/i) });
	});

	it("passes when every selected student takes the subject", async () => {
		dbQueue = [[{ id: TOPIC }], [{ id: STUDENT_A }, { id: STUDENT_B }]];
		const { validatePracticeAssignmentConfigForStudents } = await load();
		const result = await validatePracticeAssignmentConfigForStudents({
			activeOrganizationId: null,
			subjectsTaught: null,
			config: { subject_id: SUBJECT, topic_ids: [TOPIC] },
			studentIds: [STUDENT_A, STUDENT_B],
		});
		expect(result).toEqual({ ok: true });
	});

	it("passes for the empty-student edit path (0 selected ⇒ 0 eligible)", async () => {
		const { validatePracticeAssignmentConfigForStudents } = await load();
		const result = await validatePracticeAssignmentConfigForStudents({
			activeOrganizationId: null,
			subjectsTaught: null,
			config: { subject_id: SUBJECT, topic_ids: [] },
			studentIds: [],
		});
		expect(result).toEqual({ ok: true });
	});
});

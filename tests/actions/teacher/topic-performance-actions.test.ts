import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();
const getActiveTeacherOrganizationSnapshot = vi.fn();
const listTeacherTopicPerformanceRows = vi.fn();
const rlConsume = vi.fn();

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));
vi.mock("@/lib/organizations/queries", () => ({ getActiveTeacherOrganizationSnapshot }));
vi.mock("@/lib/teachers/teacher-topic-performance-queries", () => ({
	listTeacherTopicPerformanceRows,
}));
vi.mock("@/lib/ratelimit/consume", () => ({ rlConsume }));

describe("fetchTeacherTopicPerformanceDirectory", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	function arrangeAuthed() {
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: false,
		});
		rlConsume.mockResolvedValue({
			allowed: true,
			remaining: 119,
			resetAt: new Date("2026-05-19T00:00:00.000Z"),
		});
		getActiveTeacherOrganizationSnapshot.mockResolvedValue({ id: "org-1" });
	}

	it("returns scoped topic rows for the verified teacher", async () => {
		arrangeAuthed();
		const rows = [{ topicId: "t-1", topicName: "Algebra", testsTaken: 4, averagePercent: 78 }];
		listTeacherTopicPerformanceRows.mockResolvedValue(rows);

		const { fetchTeacherTopicPerformanceDirectory } = await import(
			"@/app/teacher/(protected)/topic-performance/teacher-topic-performance-actions"
		);
		const result = await fetchTeacherTopicPerformanceDirectory({
			grade: "all",
			section: "all",
			subjectId: "all",
		});

		expect(result).toEqual({ rows });
		expect(listTeacherTopicPerformanceRows).toHaveBeenCalledWith({
			teacherId: "teacher-1",
			activeOrganizationId: "org-1",
			grade: undefined,
			section: undefined,
			subjectId: undefined,
		});
	});

	it("rejects extra payload fields with .strict()", async () => {
		arrangeAuthed();
		const { fetchTeacherTopicPerformanceDirectory } = await import(
			"@/app/teacher/(protected)/topic-performance/teacher-topic-performance-actions"
		);
		const result = await fetchTeacherTopicPerformanceDirectory({
			grade: "all",
			section: "all",
			subjectId: "all",
			extra: "should-fail",
		});
		expect("error" in result).toBe(true);
		expect(listTeacherTopicPerformanceRows).not.toHaveBeenCalled();
	});

	it("short-circuits when the teacher session is missing", async () => {
		getServerUser.mockResolvedValue(null);
		const { fetchTeacherTopicPerformanceDirectory } = await import(
			"@/app/teacher/(protected)/topic-performance/teacher-topic-performance-actions"
		);
		const result = await fetchTeacherTopicPerformanceDirectory({
			grade: "all",
			section: "all",
			subjectId: "all",
		});
		expect(result).toEqual({ error: "Not signed in." });
		expect(listTeacherTopicPerformanceRows).not.toHaveBeenCalled();
	});
});

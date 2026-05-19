import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const insertValues = vi.fn();
const insert = vi.fn(() => ({ values: insertValues }));

vi.mock("@/db", () => ({
	db: { insert },
}));

describe("recordTeacherApprovalHistory", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		insertValues.mockResolvedValue(undefined);
	});

	it("inserts the expected row shape with optional fields defaulted to null", async () => {
		const { recordTeacherApprovalHistory } = await import(
			"@/lib/admin/teacher-approval-history"
		);
		await recordTeacherApprovalHistory({
			teacherUserId: "11111111-1111-4111-8111-111111111111",
			email: "teacher@example.com",
			action: "verified",
		});
		expect(insert).toHaveBeenCalledTimes(1);
		expect(insertValues).toHaveBeenCalledWith({
			teacherUserId: "11111111-1111-4111-8111-111111111111",
			email: "teacher@example.com",
			action: "verified",
			actorAdminId: null,
			reason: null,
		});
	});

	it("preserves actor + reason when provided", async () => {
		const { recordTeacherApprovalHistory } = await import(
			"@/lib/admin/teacher-approval-history"
		);
		await recordTeacherApprovalHistory({
			teacherUserId: "11111111-1111-4111-8111-111111111111",
			email: "teacher@example.com",
			action: "rejected",
			actorAdminId: "22222222-2222-4222-8222-222222222222",
			reason: "Duplicate signup",
		});
		expect(insertValues).toHaveBeenCalledWith({
			teacherUserId: "11111111-1111-4111-8111-111111111111",
			email: "teacher@example.com",
			action: "rejected",
			actorAdminId: "22222222-2222-4222-8222-222222222222",
			reason: "Duplicate signup",
		});
	});
});

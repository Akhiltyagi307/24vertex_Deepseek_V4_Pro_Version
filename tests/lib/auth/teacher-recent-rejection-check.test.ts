import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const select = vi.fn();

vi.mock("@/db", () => ({
	db: { select },
}));

function buildChain(rows: Array<{ createdAt: Date }>) {
	const limit = vi.fn().mockResolvedValue(rows);
	const orderBy = vi.fn(() => ({ limit }));
	const where = vi.fn(() => ({ orderBy }));
	const from = vi.fn(() => ({ where }));
	return { from };
}

describe("hasRecentTeacherRejection", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("returns cooldownActive=false when no rejection rows exist", async () => {
		select.mockImplementation(() => buildChain([]));
		const { hasRecentTeacherRejection } = await import(
			"@/lib/auth/teacher-recent-rejection-check"
		);
		const result = await hasRecentTeacherRejection("teacher@example.com");
		expect(result).toEqual({ cooldownActive: false });
	});

	it("returns cooldownActive with retryAfter when a recent rejection exists", async () => {
		const recent = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
		select.mockImplementation(() => buildChain([{ createdAt: recent }]));
		const { hasRecentTeacherRejection } = await import(
			"@/lib/auth/teacher-recent-rejection-check"
		);
		const result = await hasRecentTeacherRejection("teacher@example.com");
		expect(result.cooldownActive).toBe(true);
		expect(result.retryAfter).toBeInstanceOf(Date);
		// retryAfter == createdAt + 24h
		expect(result.retryAfter!.getTime()).toBe(recent.getTime() + 24 * 60 * 60 * 1000);
	});

	it("returns cooldownActive=false for empty email input", async () => {
		const { hasRecentTeacherRejection } = await import(
			"@/lib/auth/teacher-recent-rejection-check"
		);
		const result = await hasRecentTeacherRejection("   ");
		expect(result).toEqual({ cooldownActive: false });
		expect(select).not.toHaveBeenCalled();
	});
});

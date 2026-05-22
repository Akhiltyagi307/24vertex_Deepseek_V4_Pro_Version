import { afterEach, describe, expect, it, vi } from "vitest";

const USER_ID = "user-uuid-1111-1111-1111-111111111111";

const mockGetUser = vi.fn();
const mockFromInsert = vi.fn();
const mockConsumeFeedback = vi.fn();
const mockDbSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => ({
		auth: { getUser: mockGetUser },
		from: (table: string) => {
			if (table !== "user_feedback_reports") throw new Error(`unexpected table ${table}`);
			return {
				insert: () => ({
					select: () => ({
						single: mockFromInsert,
					}),
				}),
			};
		},
	}),
}));

vi.mock("@/lib/feedback/rate-limit", () => ({
	consumeFeedbackSubmitRateLimit: (...args: unknown[]) => mockConsumeFeedback(...args),
}));

vi.mock("@/db", () => ({
	db: {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: () => mockDbSelect(),
				}),
			}),
		}),
	},
}));

const validBody = {
	portal: "student",
	category: "bug",
	description: "Something broke when I tried to submit my practice test answers.",
	pagePath: "/student/practice/abc",
};

describe("POST /api/feedback", () => {
	afterEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockReset();
		mockFromInsert.mockReset();
		mockConsumeFeedback.mockReset();
		mockDbSelect.mockReset();
	});

	it("returns 400 for invalid JSON", async () => {
		const { POST } = await import("@/app/api/feedback/route");
		const res = await POST(new Request("http://localhost/api/feedback", { method: "POST", body: "{" }));
		expect(res.status).toBe(400);
	});

	it("returns 400 for invalid payload", async () => {
		const { POST } = await import("@/app/api/feedback/route");
		const res = await POST(
			new Request("http://localhost/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ portal: "student", category: "bug", description: "short" }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it("returns 401 when unauthenticated", async () => {
		mockGetUser.mockResolvedValue({ data: { user: null } });
		const { POST } = await import("@/app/api/feedback/route");
		const res = await POST(
			new Request("http://localhost/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validBody),
			}),
		);
		expect(res.status).toBe(401);
	});

	it("returns 403 when portal does not match profile role", async () => {
		mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
		mockConsumeFeedback.mockResolvedValue({ ok: true, remaining: 9, resetAt: new Date() });
		mockDbSelect.mockResolvedValue([{ role: "teacher" }]);
		const { POST } = await import("@/app/api/feedback/route");
		const res = await POST(
			new Request("http://localhost/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validBody),
			}),
		);
		expect(res.status).toBe(403);
	});

	it("returns 429 when rate limited", async () => {
		mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
		mockDbSelect.mockResolvedValue([{ role: "student" }]);
		mockConsumeFeedback.mockResolvedValue({
			ok: false,
			resetAt: new Date(Date.now() + 60_000),
		});
		const { POST } = await import("@/app/api/feedback/route");
		const res = await POST(
			new Request("http://localhost/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validBody),
			}),
		);
		expect(res.status).toBe(429);
	});

	it("returns 200 and reportId on success", async () => {
		const reportId = "report-uuid-2222-2222-2222-222222222222";
		mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
		mockDbSelect.mockResolvedValue([{ role: "student" }]);
		mockConsumeFeedback.mockResolvedValue({ ok: true, remaining: 9, resetAt: new Date() });
		mockFromInsert.mockResolvedValue({ data: { id: reportId }, error: null });
		const { POST } = await import("@/app/api/feedback/route");
		const res = await POST(
			new Request("http://localhost/api/feedback", {
				method: "POST",
				headers: { "Content-Type": "application/json", "User-Agent": "vitest" },
				body: JSON.stringify(validBody),
			}),
		);
		expect(res.status).toBe(200);
		const json = (await res.json()) as { ok: boolean; reportId: string };
		expect(json.ok).toBe(true);
		expect(json.reportId).toBe(reportId);
		expect(mockFromInsert).toHaveBeenCalled();
	});
});

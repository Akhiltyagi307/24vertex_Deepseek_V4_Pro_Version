import { afterEach, describe, expect, it, vi } from "vitest";

const verifyAdminJwt = vi.fn<(token: string) => Promise<{ jti: string; v: number } | null>>();
const cookieGet = vi.fn<(name: string) => { value: string } | undefined>();

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({ get: cookieGet })),
}));
vi.mock("@/lib/admin/auth", () => ({ verifyAdminJwt }));

describe("D32 Sprint C · GET /api/admin/auth/session", () => {
	afterEach(() => {
		verifyAdminJwt.mockReset();
		cookieGet.mockReset();
	});

	it("401 when cookie absent", async () => {
		cookieGet.mockReturnValueOnce(undefined);
		const { GET } = await import("@/app/api/admin/auth/session/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("401 when JWT invalid", async () => {
		cookieGet.mockReturnValueOnce({ value: "FAKE" });
		verifyAdminJwt.mockResolvedValueOnce(null);
		const { GET } = await import("@/app/api/admin/auth/session/route");
		const res = await GET();
		expect(res.status).toBe(401);
	});

	it("happy path: returns valid:true", async () => {
		cookieGet.mockReturnValueOnce({ value: "FAKE.JWT" });
		verifyAdminJwt.mockResolvedValueOnce({ jti: "j-1", v: 0 });
		const { GET } = await import("@/app/api/admin/auth/session/route");
		const res = await GET();
		expect(res.status).toBe(200);
		const body = (await res.json()) as { valid: boolean };
		expect(body.valid).toBe(true);
	});
});

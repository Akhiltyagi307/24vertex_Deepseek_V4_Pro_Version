/**
 * Server-action tests for `selectParentStudentAction`.
 *
 * Covers:
 *   - Invalid UUID input → redirect to /parent/select-student (no audit)
 *   - No active link → audit SELECT_STUDENT_UNAUTHORIZED + Sentry + redirect
 *   - Active link → cookie set with maxAge=30d + SELECT_STUDENT audit + redirect to /parent/dashboard
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockUser,
	assertLinkMock,
	auditMock,
	redirectMock,
	headersMock,
	cookiesMock,
	revalidateMock,
	sentryMessageMock,
} = vi.hoisted(() => {
	const cookieSet = vi.fn();
	return {
		mockUser: { current: null as null | { id: string } },
		assertLinkMock: { current: vi.fn(async (): Promise<boolean> => true) },
		auditMock: { current: vi.fn(async () => undefined) },
		redirectMock: {
			current: vi.fn((url: string) => {
				const err = new Error(`NEXT_REDIRECT:${url}`);
				(err as { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};308;`;
				throw err;
			}),
		},
		headersMock: {
			current: () => ({
				get: (k: string) => (k.toLowerCase() === "user-agent" ? "vitest" : null),
			}),
		},
		cookiesMock: { current: { set: cookieSet, get: vi.fn(), delete: vi.fn() } },
		revalidateMock: { current: vi.fn() },
		sentryMessageMock: { current: vi.fn() },
	};
});

vi.mock("@/lib/auth/get-server-user", () => ({
	getServerUser: async () => mockUser.current,
}));
vi.mock("@/lib/parent/linked-children", () => ({
	assertParentActiveLink: (...args: unknown[]) =>
		(assertLinkMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@/lib/parent/audit", () => ({
	writeParentAudit: (...args: unknown[]) =>
		(auditMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("next/navigation", () => ({
	redirect: (url: string) => redirectMock.current(url),
}));
vi.mock("next/headers", () => ({
	headers: async () => headersMock.current(),
	cookies: async () => cookiesMock.current,
}));
vi.mock("next/cache", () => ({
	revalidatePath: (...args: unknown[]) =>
		(revalidateMock.current as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@/lib/admin/api-request-meta", () => ({
	clientIpFromHeaders: () => "127.0.0.1",
}));
vi.mock("@sentry/nextjs", () => ({
	captureMessage: (...args: unknown[]) =>
		(sentryMessageMock.current as (...a: unknown[]) => unknown)(...args),
	startSpan: <T,>(_opts: unknown, fn: () => T) => fn(),
}));

import { selectParentStudentAction } from "@/app/parent/select-student/actions";

const PARENT_ID = "11111111-1111-1111-1111-111111111111";
const STUDENT_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
	mockUser.current = { id: PARENT_ID };
	assertLinkMock.current = vi.fn(async () => true);
	auditMock.current = vi.fn(async () => undefined);
	(cookiesMock.current.set as ReturnType<typeof vi.fn>).mockReset();
	redirectMock.current = vi.fn((url: string) => {
		const err = new Error(`NEXT_REDIRECT:${url}`);
		(err as { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};308;`;
		throw err;
	});
	revalidateMock.current = vi.fn();
	sentryMessageMock.current = vi.fn();
});

afterEach(() => {
	vi.clearAllMocks();
});

function fd(entries: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.append(k, v);
	return f;
}

describe("selectParentStudentAction", () => {
	it("redirects to picker when studentId is malformed", async () => {
		await expect(selectParentStudentAction(fd({ studentId: "not-a-uuid" }))).rejects.toThrow(
			/NEXT_REDIRECT:\/parent\/select-student/,
		);
		expect(auditMock.current).not.toHaveBeenCalled();
		expect(cookiesMock.current.set).not.toHaveBeenCalled();
	});

	it("redirects to /login when no signed-in user", async () => {
		mockUser.current = null;
		await expect(selectParentStudentAction(fd({ studentId: STUDENT_ID }))).rejects.toThrow(
			/NEXT_REDIRECT:\/login/,
		);
	});

	it("writes unauthorized audit + Sentry warning and redirects to picker when link is inactive", async () => {
		assertLinkMock.current = vi.fn(async () => false);
		await expect(selectParentStudentAction(fd({ studentId: STUDENT_ID }))).rejects.toThrow(
			/NEXT_REDIRECT:\/parent\/select-student/,
		);
		expect(auditMock.current).toHaveBeenCalledWith(
			expect.objectContaining({
				action: expect.stringMatching(/select_student_unauthorized/i),
				targetId: STUDENT_ID,
			}),
		);
		expect(sentryMessageMock.current).toHaveBeenCalled();
		expect(cookiesMock.current.set).not.toHaveBeenCalled();
	});

	it("sets active-student cookie with 30d max-age and writes select audit on success", async () => {
		await expect(selectParentStudentAction(fd({ studentId: STUDENT_ID }))).rejects.toThrow(
			/NEXT_REDIRECT:\/parent\/dashboard/,
		);
		expect(cookiesMock.current.set).toHaveBeenCalledTimes(1);
		const setCall = (cookiesMock.current.set as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(setCall?.[0]).toBe("vertex24_parent_active_student");
		expect(setCall?.[1]).toBe(STUDENT_ID);
		const opts = setCall?.[2] as { maxAge?: number; httpOnly?: boolean; sameSite?: string };
		expect(opts.maxAge).toBe(60 * 60 * 24 * 30);
		expect(opts.httpOnly).toBe(true);
		expect(opts.sameSite).toBe("lax");
		expect(auditMock.current).toHaveBeenCalledWith(
			expect.objectContaining({
				action: expect.stringMatching(/^select_student$/i),
				targetId: STUDENT_ID,
			}),
		);
	});
});

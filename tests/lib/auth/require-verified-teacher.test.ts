import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));

describe("getVerifiedTeacherSession", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("returns not_signed_in when there is no authenticated user", async () => {
		getServerUser.mockResolvedValue(null);

		const { getVerifiedTeacherSession } = await import("@/lib/auth/require-verified-teacher");
		const result = await getVerifiedTeacherSession();

		expect(result).toEqual({
			ok: false,
			code: "not_signed_in",
			message: "Not signed in.",
			status: 401,
			userId: undefined,
		});
		expect(getCachedAppProfileRow).not.toHaveBeenCalled();
	});

	it("rejects authenticated users without a teacher profile", async () => {
		getServerUser.mockResolvedValue({ id: "student-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "student-1",
			role: "student",
			is_verified: true,
			is_suspended: false,
		});

		const { getVerifiedTeacherSession } = await import("@/lib/auth/require-verified-teacher");
		const result = await getVerifiedTeacherSession();

		expect(result).toMatchObject({
			ok: false,
			code: "not_teacher",
			message: "Sign in as a teacher to continue.",
			status: 403,
			userId: "student-1",
		});
	});

	it("rejects unverified teacher profiles", async () => {
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: false,
			is_suspended: false,
		});

		const { getVerifiedTeacherSession } = await import("@/lib/auth/require-verified-teacher");
		const result = await getVerifiedTeacherSession();

		expect(result).toMatchObject({
			ok: false,
			code: "not_verified",
			message: "Your teacher account must be verified before using this feature.",
			status: 403,
			userId: "teacher-1",
		});
	});

	it("rejects suspended teacher profiles", async () => {
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: true,
		});

		const { getVerifiedTeacherSession } = await import("@/lib/auth/require-verified-teacher");
		const result = await getVerifiedTeacherSession();

		expect(result).toMatchObject({
			ok: false,
			code: "suspended",
			message: "This teacher account is suspended.",
			status: 403,
			userId: "teacher-1",
		});
	});

	it("returns the user and profile for verified teachers", async () => {
		const user = { id: "teacher-1", email: "teacher@example.com" };
		const profile = {
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: false,
		};
		getServerUser.mockResolvedValue(user);
		getCachedAppProfileRow.mockResolvedValue(profile);

		const { getVerifiedTeacherSession } = await import("@/lib/auth/require-verified-teacher");
		const result = await getVerifiedTeacherSession();

		expect(result).toEqual({ ok: true, user, profile });
	});
});


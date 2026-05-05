/**
 * Server-action tests for `app/student/settings/actions.ts`.
 *
 * Covers `updateStudentProfile` and `updateStudentSchoolPlacement`.
 * The Supabase-Auth password flow is client-driven and tested separately
 * (see PasswordChangeForm component test in Phase 2.2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../../factories/supabase";

const { mockSupabase, mockUser, isOwnAvatarMock, revalidatePathMock } = vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
	mockUser: { current: null as null | { id: string; email?: string } },
	isOwnAvatarMock: { current: vi.fn((url: string, _userId: string) => url.includes("/avatars/own/")) },
	revalidatePathMock: { current: vi.fn(() => undefined) },
}));

vi.mock("@/lib/auth/get-server-user", () => ({
	getServerUser: async () => mockUser.current,
}));
vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/supabase/avatar-storage-url", () => ({
	isOwnSupabaseAvatarUrl: (url: string, userId: string) => isOwnAvatarMock.current(url, userId),
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: () => undefined,
	logServerError: () => undefined,
	isPostgresUndefinedColumnError: () => false,
}));
vi.mock("next/cache", () => ({
	revalidatePath: (...args: unknown[]) =>
		(revalidatePathMock.current as (...a: unknown[]) => unknown)(...args),
}));

import {
	updateStudentProfile,
	updateStudentSchoolPlacement,
} from "@/app/student/settings/actions";

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const ELECTIVE_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
	mockUser.current = { id: STUDENT_ID };
	mockSupabase.current = makeMockSupabase({
		user: { id: STUDENT_ID },
		tables: {
			profiles: {
				data: {
					id: STUDENT_ID,
					role: "student",
					avatar_url: null,
					grade: 10,
					stream: null,
					elective_subject_id: null,
				},
			},
		},
	});
	isOwnAvatarMock.current = vi.fn((url: string) => url.includes("/avatars/own/"));
	revalidatePathMock.current = vi.fn(() => undefined);
});

afterEach(() => {
	vi.clearAllMocks();
});

function fd(entries: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.append(k, v);
	return f;
}

/* -------------------------------------------------------------------------- */
/*                            updateStudentProfile                             */
/* -------------------------------------------------------------------------- */

describe("updateStudentProfile", () => {
	it("returns the first field error when validation fails", async () => {
		const out = await updateStudentProfile(undefined, fd({ fullName: "", avatarUrl: "", phone: "" }));
		expect(out.error).toBeTruthy();
	});

	it("rejects an unauthenticated caller", async () => {
		mockUser.current = null;
		const out = await updateStudentProfile(
			undefined,
			fd({ fullName: "Ada", avatarUrl: "", phone: "" }),
		);
		expect(out).toEqual({ error: "Not signed in." });
	});

	it("rejects when the profile is missing or non-student", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: { profiles: { data: { id: STUDENT_ID, role: "parent", avatar_url: null } } },
		});
		const out = await updateStudentProfile(
			undefined,
			fd({ fullName: "Ada", avatarUrl: "", phone: "" }),
		);
		expect(out).toEqual({ error: "Profile not found." });
	});

	it("rejects an avatar URL that is neither legacy-unchanged nor own-storage", async () => {
		isOwnAvatarMock.current = vi.fn(() => false);
		const out = await updateStudentProfile(
			undefined,
			fd({ fullName: "Ada", avatarUrl: "https://evil.example.com/img.png", phone: "" }),
		);
		expect(out.error).toMatch(/profile photo/i);
	});

	it("returns success on the happy path and revalidates the student layout", async () => {
		isOwnAvatarMock.current = vi.fn(() => true);
		const out = await updateStudentProfile(
			undefined,
			fd({
				fullName: "Ada Lovelace",
				avatarUrl: "https://supabase.test/storage/avatars/own/me.png",
				phone: "+1 555 0100",
			}),
		);
		expect(out).toEqual({ success: true });
		expect(revalidatePathMock.current).toHaveBeenCalledWith("/student", "layout");
	});
});

/* -------------------------------------------------------------------------- */
/*                       updateStudentSchoolPlacement                          */
/* -------------------------------------------------------------------------- */

describe("updateStudentSchoolPlacement", () => {
	it("returns a validation error for an invalid grade", async () => {
		const out = await updateStudentSchoolPlacement({ grade: 99, section: "A", stream: null });
		expect(out.error).toBeTruthy();
	});

	it("requires authentication", async () => {
		mockUser.current = null;
		const out = await updateStudentSchoolPlacement({
			grade: 10,
			section: "A",
			stream: null,
			schoolName: null,
		});
		expect(out).toEqual({ error: "Not signed in." });
	});

	it("rejects when the profile is missing or non-student", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: { profiles: { data: { id: STUDENT_ID, role: "parent" } } },
		});
		const out = await updateStudentSchoolPlacement({
			grade: 10,
			section: "A",
			stream: null,
			schoolName: null,
		});
		expect(out).toEqual({ error: "Profile not found." });
	});

	it("rejects an elective that is not active / wrong grade", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: {
					data: { id: STUDENT_ID, role: "student", grade: 10, stream: null, elective_subject_id: null },
				},
				subjects: {
					data: {
						id: ELECTIVE_ID,
						is_elective: false,
						grade: 11,
						stream: null,
						is_active: true,
					},
				},
			},
		});
		const out = await updateStudentSchoolPlacement({
			grade: 11,
			section: "A",
			stream: "science",
			electiveSubjectId: ELECTIVE_ID,
			schoolName: null,
		});
		expect(out.error).toMatch(/elective/i);
	});

	it("rejects an elective whose stream conflicts with the chosen stream", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: {
					data: { id: STUDENT_ID, role: "student", grade: 10, stream: null, elective_subject_id: null },
				},
				subjects: {
					data: {
						id: ELECTIVE_ID,
						is_elective: true,
						grade: 11,
						stream: "commerce",
						is_active: true,
					},
				},
			},
		});
		const out = await updateStudentSchoolPlacement({
			grade: 11,
			section: "A",
			stream: "science",
			electiveSubjectId: ELECTIVE_ID,
			schoolName: null,
		});
		expect(out.error).toMatch(/stream/i);
	});

	it("returns success when nothing curriculum-relevant changed (no RPC call)", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: {
					data: {
						id: STUDENT_ID,
						role: "student",
						grade: 10,
						stream: null,
						elective_subject_id: null,
					},
				},
			},
			rpcs: {
				sync_student_performance_tracker: { error: { message: "should not be called" } },
			},
		});
		const out = await updateStudentSchoolPlacement({
			grade: 10,
			section: "B",
			stream: null,
			schoolName: "  Acme High  ",
		});
		expect(out).toEqual({ success: true });
		expect(revalidatePathMock.current).toHaveBeenCalledWith("/student", "layout");
	});

	it("returns success and runs sync_student_performance_tracker when curriculum changes", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: {
					data: {
						id: STUDENT_ID,
						role: "student",
						grade: 10,
						stream: null,
						elective_subject_id: null,
					},
				},
			},
			rpcs: {
				sync_student_performance_tracker: { data: null, error: null },
			},
		});
		const out = await updateStudentSchoolPlacement({
			grade: 11,
			section: "A",
			stream: "science",
			schoolName: null,
		});
		expect(out).toEqual({ success: true });
	});

	it("returns a friendly error when the curriculum sync RPC fails", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			tables: {
				profiles: {
					data: {
						id: STUDENT_ID,
						role: "student",
						grade: 10,
						stream: null,
						elective_subject_id: null,
					},
				},
			},
			rpcs: {
				sync_student_performance_tracker: { error: { message: "boom" } },
			},
		});
		const out = await updateStudentSchoolPlacement({
			grade: 11,
			section: "A",
			stream: "science",
			schoolName: null,
		});
		expect(out.error).toMatch(/curriculum/i);
	});
});

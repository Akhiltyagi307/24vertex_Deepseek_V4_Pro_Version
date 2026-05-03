import { describe, expect, it, vi } from "vitest";

import { EDUAI_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { consumePendingRegistration } from "@/lib/auth/pending-registration";
import { getProfile } from "@/lib/auth/routing";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/routing", () => ({
	getProfile: vi.fn(async () => null),
}));

describe("consumePendingRegistration", () => {
	it("returns unsupported-teacher status for legacy teacher pending metadata", async () => {
		const supabase = {
			auth: {
				getUser: vi.fn(async () => ({
					data: {
						user: {
							email: "teacher@example.com",
							user_metadata: {
								[EDUAI_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
									version: 1,
									role: "teacher",
									payload: {
										email: "teacher@example.com",
									},
								}),
							},
						},
					},
					error: null,
				})),
			},
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("failed_unsupported_teacher_signup");
	});

	it("links parent when profile already exists (pending metadata, link-only retry)", async () => {
		vi.mocked(getProfile).mockResolvedValueOnce({
			id: "parent-uid",
			role: "parent",
			is_verified: true,
			is_suspended: false,
		});
		const rpc = vi.fn(async (name: string, _args: { p_student_ref: string }) => {
			if (name === "link_parent_to_student") {
				return { error: null };
			}
			return { error: new Error("unexpected rpc") };
		});
		const supabase = {
			auth: {
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "parent-auth-id",
							email: "parent@example.com",
							user_metadata: {
								[EDUAI_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
									version: 1,
									role: "parent",
									payload: {
										email: "parent@example.com",
										fullName: "Pat Parent",
										studentLinkCode: "AB1234",
									},
								}),
							},
						},
					},
					error: null,
				})),
			},
			rpc: rpc,
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("completed_profile");
		expect(rpc).toHaveBeenCalledWith("link_parent_to_student", { p_student_ref: "AB1234" });
		expect(rpc).not.toHaveBeenCalledWith("register_parent", expect.anything());
	});

	it("runs link after register_parent returns profile already exists", async () => {
		vi.mocked(getProfile).mockResolvedValueOnce(null);
		const rpc = vi.fn(async (name: string, args: { p_full_name?: string; p_student_ref?: string }) => {
			if (name === "register_parent") {
				return { error: { message: "Profile already exists" } };
			}
			if (name === "link_parent_to_student") {
				expect(args.p_student_ref).toBe("XY9999");
				return { error: null };
			}
			return { error: new Error("unexpected") };
		});
		const supabase = {
			auth: {
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "p2-auth-id",
							email: "p2@example.com",
							user_metadata: {
								[EDUAI_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
									version: 1,
									role: "parent",
									payload: {
										email: "p2@example.com",
										fullName: "P Two",
										studentLinkCode: "XY9999",
									},
								}),
							},
						},
					},
					error: null,
				})),
			},
			rpc,
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("completed_profile");
		expect(rpc).toHaveBeenCalledWith("register_parent", { p_full_name: "P Two" });
		expect(rpc).toHaveBeenCalledWith("link_parent_to_student", { p_student_ref: "XY9999" });
	});

	it("returns parent_portal_link_unknown when link fails after register_parent but parent row exists", async () => {
		vi.mocked(getProfile).mockResolvedValueOnce(null);
		const maybeSingle = vi.fn(async () => ({ data: { role: "parent" }, error: null }));
		const supabase = {
			auth: {
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "orphan-parent",
							email: "orph@example.com",
							user_metadata: {
								[EDUAI_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
									version: 1,
									role: "parent",
									payload: {
										email: "orph@example.com",
										fullName: "Orph",
										studentLinkCode: "ZZ0001",
									},
								}),
							},
						},
					},
					error: null,
				})),
			},
			rpc: vi.fn(async (name: string) => {
				if (name === "register_parent") {
					return { error: null };
				}
				if (name === "link_parent_to_student") {
					return { error: { message: "Internal error (masked)", details: "xyz", hint: null } };
				}
				return { error: new Error("unexpected") };
			}),
			from: vi.fn(() => ({
				select: vi.fn(() => ({
					eq: vi.fn(() => ({ maybeSingle })),
				})),
			})),
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("parent_portal_link_unknown");
		expect(maybeSingle).toHaveBeenCalled();
	});
});

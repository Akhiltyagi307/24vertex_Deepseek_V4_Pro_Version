import { describe, expect, it, vi } from "vitest";

import { VERTEX24_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { consumePendingRegistration } from "@/lib/auth/pending-registration";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/notifications/account-security", () => ({
	notifyParentLinkedToStudent: vi.fn(async () => {}),
	notifyParentChildLinkConfirmed: vi.fn(async () => {}),
}));

vi.mock("@/lib/email/teacher-pending-approval-email", () => ({
	sendTeacherPendingApprovalEmail: vi.fn(async () => ({ ok: true })),
}));

/** `consumePendingRegistration` calls `auth.getSession` after `getUser`. */
function getSessionNever() {
	return vi.fn(async () => ({ data: { session: null }, error: null }));
}

function mockProfilesStudentByLinkChain(studentId: string) {
	const chain: {
		select: ReturnType<typeof vi.fn>;
		eq: ReturnType<typeof vi.fn>;
		maybeSingle: ReturnType<typeof vi.fn>;
	} = {
		select: vi.fn(),
		eq: vi.fn(),
		maybeSingle: vi.fn(async () => ({ data: { id: studentId, role: "student" }, error: null })),
	};
	chain.select.mockReturnValue(chain);
	chain.eq.mockReturnValue(chain);
	return {
		from: vi.fn(() => chain),
		chain,
	};
}

/** `fetchProfileForSessionUser`: `.select("id, role").eq("id").maybeSingle()` */
function profilesSignupLookup(row: { id: string; role: string } | null) {
	const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
	const from = vi.fn((table: string) => {
		expect(table).toBe("profiles");
		return {
			select: vi.fn(() => ({
				eq: vi.fn(() => ({ maybeSingle })),
			})),
		};
	});
	return { from };
}

/** First `.from("profiles")` is signup lookup; subsequent calls reuse student link chain. */
function composeProfilesFromSignupThenStudentChain(
	firstRow: { id: string; role: string } | null,
	studentChain: ReturnType<typeof mockProfilesStudentByLinkChain>["chain"],
) {
	let firstProfilesFrom = true;
	return vi.fn((table: string) => {
		expect(table).toBe("profiles");
		if (firstProfilesFrom) {
			firstProfilesFrom = false;
			const maybeSingle = vi.fn(async () => ({ data: firstRow, error: null }));
			return {
				select: vi.fn(() => ({
					eq: vi.fn(() => ({ maybeSingle })),
				})),
			};
		}
		return studentChain;
	});
}

describe("consumePendingRegistration", () => {
	it("completes teacher registration from valid pending metadata (email-verification path)", async () => {
		const rpc = vi.fn(async (name: string) => {
			if (name === "register_teacher") {
				return { error: null };
			}
			return { error: new Error("unexpected rpc") };
		});
		const supabase = {
			auth: {
				getSession: getSessionNever(),
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "teacher-uid",
							email: "teacher@example.com",
							user_metadata: {
								[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
									version: 1,
									role: "teacher",
									payload: {
										email: "teacher@example.com",
										fullName: "Tina Teacher",
										phone: "+919876543210",
										schoolName: "Delhi Public School",
									},
								}),
							},
						},
					},
					error: null,
				})),
			},
			rpc,
			...profilesSignupLookup(null),
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("completed_profile");
		expect(rpc).toHaveBeenCalledWith("register_teacher", {
			p_full_name: "Tina Teacher",
			p_school_name: "Delhi Public School",
			p_phone: "+919876543210",
		});
	});

	it("uses session handshake to restore email/metadata when getUser omits them (PKCE timing)", async () => {
		const rpc = vi.fn(async (name: string) => {
			if (name === "register_teacher") return { error: null };
			return { error: new Error("unexpected") };
		});
		const handshakeMeta = JSON.stringify({
			version: 1,
			role: "teacher",
			payload: {
				email: "teacher@example.com",
				fullName: "Tina Teacher",
				phone: "+919876543210",
				schoolName: null,
			},
		});
		const handshakeUser = {
			id: "teacher-uid",
			email: "teacher@example.com",
			user_metadata: {
				[VERTEX24_PENDING_REGISTRATION_META_KEY]: handshakeMeta,
			},
		};
		const supabase = {
			auth: {
				getSession: getSessionNever(),
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "teacher-uid",
							email: "",
							user_metadata: {},
						},
					},
					error: null,
				})),
			},
			rpc,
			...profilesSignupLookup(null),
		};

		const result = await consumePendingRegistration(supabase as never, {
			sessionUserHandshake: handshakeUser as never,
		});

		expect(result).toBe("completed_profile");
		expect(rpc).toHaveBeenCalledWith("register_teacher", {
			p_full_name: "Tina Teacher",
			p_school_name: null,
			p_phone: "+919876543210",
		});
	});

	it("restores teacher pending metadata via getSession when getUser lacks email/metadata", async () => {
		const rpc = vi.fn(async (name: string) => {
			if (name === "register_teacher") return { error: null };
			return { error: new Error("unexpected") };
		});
		const sessionUserFull = {
			id: "teacher-uid",
			email: "teacher@example.com",
			user_metadata: {
				[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
					version: 1,
					role: "teacher",
					payload: {
						email: "teacher@example.com",
						fullName: "Tina Teacher",
						phone: "+919876543210",
						schoolName: null,
					},
				}),
			},
		};
		const supabase = {
			auth: {
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "teacher-uid",
							email: "",
							user_metadata: {},
						},
					},
					error: null,
				})),
				getSession: vi.fn(async () => ({
					data: { session: { user: sessionUserFull } },
					error: null,
				})),
			},
			rpc,
			...profilesSignupLookup(null),
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("completed_profile");
		expect(rpc).toHaveBeenCalledWith("register_teacher", {
			p_full_name: "Tina Teacher",
			p_school_name: null,
			p_phone: "+919876543210",
		});
	});

	it("completes teacher registration when email is only on identities (PKCE user shape)", async () => {
		const rpc = vi.fn(async (name: string) => {
			if (name === "register_teacher") return { error: null };
			return { error: new Error("unexpected rpc") };
		});
		const supabase = {
			auth: {
				getSession: getSessionNever(),
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "teacher-uid",
							email: "",
							identities: [
								{
									identity_id: "id1",
									id: "teacher-uid",
									user_id: "teacher-uid",
									identity_data: { email: "teacher@example.com" },
								},
							],
							user_metadata: {
								[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
									version: 1,
									role: "teacher",
									payload: {
										email: "teacher@example.com",
										fullName: "Tina Teacher",
										phone: "+919876543210",
										schoolName: null,
									},
								}),
							},
						},
					},
					error: null,
				})),
			},
			rpc,
			...profilesSignupLookup(null),
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("completed_profile");
		expect(rpc).toHaveBeenCalledWith("register_teacher", {
			p_full_name: "Tina Teacher",
			p_school_name: null,
			p_phone: "+919876543210",
		});
	});

	it("returns no_pending when teacher profile already exists (callback retry after auto-confirm)", async () => {
		const supabase = {
			auth: {
				getSession: getSessionNever(),
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "teacher-uid",
							email: "teacher@example.com",
							user_metadata: {
								[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
									version: 1,
									role: "teacher",
									payload: {
										email: "teacher@example.com",
										fullName: "Tina Teacher",
										phone: "+919876543210",
										schoolName: null,
									},
								}),
							},
						},
					},
					error: null,
				})),
			},
			rpc: vi.fn(),
			...profilesSignupLookup({ id: "teacher-uid", role: "teacher" }),
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("no_pending");
		expect(supabase.rpc).not.toHaveBeenCalled();
	});

	it("returns failed_unsupported_teacher_signup for old-format teacher metadata (no phone field)", async () => {
		const supabase = {
			auth: {
				getSession: getSessionNever(),
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "teacher-legacy",
							email: "teacher@example.com",
							user_metadata: {
								[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
									version: 1,
									role: "teacher",
									payload: {
										// Old format: missing phone, has assignments instead
										email: "teacher@example.com",
										fullName: "Old Teacher",
										schoolName: "Some School",
										assignments: [{ grade: 9, section: "A", subjectId: "uuid" }],
									},
								}),
							},
						},
					},
					error: null,
				})),
			},
			...profilesSignupLookup(null),
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("failed_unsupported_teacher_signup");
	});

	it("links parent when profile already exists (pending metadata, link-only retry)", async () => {
		const rpc = vi.fn(async (name: string, _args: { p_student_ref: string }) => {
			if (name === "link_parent_to_student") {
				return { error: null };
			}
			return { error: new Error("unexpected rpc") };
		});
		const { chain } = mockProfilesStudentByLinkChain("11111111-1111-1111-1111-111111111111");
		const supabase = {
			auth: {
				getSession: getSessionNever(),
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "parent-auth-id",
							email: "parent@example.com",
							user_metadata: {
								[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
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
			rpc,
			from: composeProfilesFromSignupThenStudentChain(
				{ id: "parent-auth-id", role: "parent" },
				chain,
			),
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("completed_profile");
		expect(rpc).toHaveBeenCalledWith("link_parent_to_student", { p_student_ref: "AB1234" });
		expect(rpc).not.toHaveBeenCalledWith("register_parent", expect.anything());
	});

	it("runs link after register_parent returns profile already exists", async () => {
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
				getSession: getSessionNever(),
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "p2-auth-id",
							email: "p2@example.com",
							user_metadata: {
								[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
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
			from: composeProfilesFromSignupThenStudentChain(
				null,
				mockProfilesStudentByLinkChain("22222222-2222-2222-2222-222222222222").chain,
			),
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("completed_profile");
		expect(rpc).toHaveBeenCalledWith("register_parent", { p_full_name: "P Two" });
		expect(rpc).toHaveBeenCalledWith("link_parent_to_student", { p_student_ref: "XY9999" });
	});

	it("returns parent_portal_link_unknown when link fails after register_parent but parent row exists", async () => {
		const signupMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
		const classifyMaybeSingle = vi.fn(async () => ({ data: { role: "parent" }, error: null }));
		let fromCallIdx = 0;
		const from = vi.fn(() => {
			fromCallIdx += 1;
			if (fromCallIdx === 1) {
				return {
					select: vi.fn(() => ({
						eq: vi.fn(() => ({ maybeSingle: signupMaybeSingle })),
					})),
				};
			}
			return {
				select: vi.fn(() => ({
					eq: vi.fn(() => ({ maybeSingle: classifyMaybeSingle })),
				})),
			};
		});
		const supabase = {
			auth: {
				getSession: getSessionNever(),
				getUser: vi.fn(async () => ({
					data: {
						user: {
							id: "orphan-parent",
							email: "orph@example.com",
							user_metadata: {
								[VERTEX24_PENDING_REGISTRATION_META_KEY]: JSON.stringify({
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
			from,
		};

		const result = await consumePendingRegistration(supabase as never);

		expect(result).toBe("parent_portal_link_unknown");
		expect(signupMaybeSingle).toHaveBeenCalled();
		expect(classifyMaybeSingle).toHaveBeenCalled();
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockSupabase } from "../../../factories/supabase";

const LINK_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const PARENT_ID = "22222222-2222-2222-2222-222222222222";

const { mockSupabase, mockUser, revalidatePathMock, logSupabaseErrorMock } = vi.hoisted(() => ({
	mockSupabase: { current: null as unknown },
	mockUser: { current: null as null | { id: string } },
	revalidatePathMock: { current: vi.fn(() => undefined) },
	logSupabaseErrorMock: {
		current: vi.fn<(context: string, error: unknown, metadata?: unknown) => void>(),
	},
}));

vi.mock("@/lib/auth/get-server-user", () => ({
	getServerUser: async () => mockUser.current,
}));
vi.mock("@/lib/supabase/server", () => ({
	createClient: async () => mockSupabase.current,
}));
vi.mock("@/lib/server/log-supabase-error", () => ({
	logSupabaseError: (context: string, error: unknown, metadata?: unknown) =>
		logSupabaseErrorMock.current(context, error, metadata),
}));
vi.mock("@/lib/notifications/account-security", () => ({
	notifyParentLinkedToStudent: vi.fn(async () => undefined),
	notifyParentChildLinkConfirmed: vi.fn(async () => undefined),
}));
vi.mock("next/cache", () => ({
	revalidatePath: (...args: unknown[]) =>
		(revalidatePathMock.current as (...a: unknown[]) => unknown)(...args),
}));

import {
	confirmParentLinkAction,
	rejectParentLinkAction,
} from "@/app/student/settings/parent-link-actions";

function fd(linkId: string): FormData {
	const f = new FormData();
	f.append("linkId", linkId);
	return f;
}

beforeEach(() => {
	mockUser.current = { id: STUDENT_ID };
	mockSupabase.current = makeMockSupabase({
		user: { id: STUDENT_ID },
		rpcs: {
			confirm_parent_link: { data: null, error: null },
			reject_parent_link: { data: null, error: null },
		},
		tables: {
			parent_student_links: { data: { parent_id: PARENT_ID } },
		},
	});
	revalidatePathMock.current = vi.fn(() => undefined);
	logSupabaseErrorMock.current = vi.fn(() => undefined);
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("confirmParentLinkAction", () => {
	it("returns an error for an invalid linkId", async () => {
		const out = await confirmParentLinkAction({}, fd("not-a-uuid"));
		expect(out).toEqual({ error: "Invalid link request." });
	});

	it("requires authentication", async () => {
		mockUser.current = null;
		const out = await confirmParentLinkAction({}, fd(LINK_ID));
		expect(out).toEqual({ error: "Sign in again to continue." });
	});

	it("logs and returns a friendly error when the RPC fails", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			rpcs: { confirm_parent_link: { error: { message: "boom" } } },
		});
		const out = await confirmParentLinkAction({}, fd(LINK_ID));
		expect(out.error).toMatch(/could not approve/i);
		expect(logSupabaseErrorMock.current).toHaveBeenCalled();
	});

	it("revalidates settings on success", async () => {
		const out = await confirmParentLinkAction({}, fd(LINK_ID));
		expect(out).toEqual({ success: true });
		expect(revalidatePathMock.current).toHaveBeenCalledWith("/student/settings");
	});
});

describe("rejectParentLinkAction", () => {
	it("returns an error for an invalid linkId", async () => {
		const out = await rejectParentLinkAction({}, fd("bad"));
		expect(out).toEqual({ error: "Invalid link request." });
	});

	it("requires authentication", async () => {
		mockUser.current = null;
		const out = await rejectParentLinkAction({}, fd(LINK_ID));
		expect(out).toEqual({ error: "Sign in again to continue." });
	});

	it("logs and returns a friendly error when the RPC fails", async () => {
		mockSupabase.current = makeMockSupabase({
			user: { id: STUDENT_ID },
			rpcs: { reject_parent_link: { error: { message: "nope" } } },
		});
		const out = await rejectParentLinkAction({}, fd(LINK_ID));
		expect(out.error).toMatch(/could not decline/i);
		expect(logSupabaseErrorMock.current).toHaveBeenCalled();
	});

	it("revalidates settings on success", async () => {
		const out = await rejectParentLinkAction({}, fd(LINK_ID));
		expect(out).toEqual({ success: true });
		expect(revalidatePathMock.current).toHaveBeenCalledWith("/student/settings");
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getServerUser = vi.fn();
const getCachedAppProfileRow = vi.fn();
const revalidatePath = vi.fn();
const isOwnSupabaseAvatarUrl = vi.fn();

type ChainBuilder = ReturnType<typeof buildSupabaseChain>;

function buildSupabaseChain() {
	const profilesUpdate = vi.fn();

	const fromMap: Record<string, () => unknown> = {
		profiles: () => ({
			update: (...args: unknown[]) => {
				const eqUserId = vi.fn().mockReturnValue({
					eq: (..._eqArgs: unknown[]) => profilesUpdate(...args),
				});
				return { eq: eqUserId };
			},
		}),
	};

	const supabase = {
		from: (table: string) => fromMap[table]?.() ?? {},
	};

	return { supabase, profilesUpdate };
}

let chain: ChainBuilder;

vi.mock("@/lib/auth/get-server-user", () => ({ getServerUser }));
vi.mock("@/lib/auth/cached-profile", () => ({ getCachedAppProfileRow }));
vi.mock("@/lib/supabase/server", () => ({
	createClient: () => Promise.resolve(chain.supabase),
}));
vi.mock("@/lib/supabase/avatar-storage-url", () => ({ isOwnSupabaseAvatarUrl }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/server/log-supabase-error", () => ({ logSupabaseError: vi.fn() }));

describe("teacher account/settings actions", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		chain = buildSupabaseChain();
		isOwnSupabaseAvatarUrl.mockReturnValue(true);
	});

	function arrangeTeacher(overrides: Partial<{ phone: string | null; avatar_url: string | null }> = {}) {
		getServerUser.mockResolvedValue({ id: "teacher-1" });
		getCachedAppProfileRow.mockResolvedValue({
			id: "teacher-1",
			role: "teacher",
			is_verified: true,
			is_suspended: false,
			full_name: "Jane",
			avatar_url: overrides.avatar_url ?? null,
			phone: overrides.phone ?? null,
			subjects_taught: null,
		});
	}

	it("updateTeacherProfile rejects an unknown avatar URL", async () => {
		arrangeTeacher();
		isOwnSupabaseAvatarUrl.mockReturnValue(false);
		const fd = new FormData();
		fd.set("fullName", "Jane Doe");
		fd.set("avatarUrl", "https://random.example.com/x.png");
		fd.set("phone", "9999999999");
		const { updateTeacherProfile } = await import(
			"@/app/teacher/(protected)/settings/account-actions"
		);
		const result = await updateTeacherProfile(undefined, fd);
		expect(result.error).toMatch(/profile photo/i);
		expect(chain.profilesUpdate).not.toHaveBeenCalled();
	});

	it("updateTeacherProfile saves trimmed fields when avatar is valid", async () => {
		arrangeTeacher();
		chain.profilesUpdate.mockResolvedValue({ error: null });
		const fd = new FormData();
		fd.set("fullName", "Jane Doe");
		fd.set("avatarUrl", "");
		fd.set("phone", "9999999999");
		const { updateTeacherProfile } = await import(
			"@/app/teacher/(protected)/settings/account-actions"
		);
		const result = await updateTeacherProfile(undefined, fd);
		expect(result).toEqual({ success: true });
		expect(chain.profilesUpdate).toHaveBeenCalledTimes(1);
	});
});

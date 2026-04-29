import { describe, expect, it, vi } from "vitest";

import { EDUAI_PENDING_REGISTRATION_META_KEY } from "@/lib/auth/pending-registration-meta";
import { consumePendingRegistration } from "@/lib/auth/pending-registration";

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
});

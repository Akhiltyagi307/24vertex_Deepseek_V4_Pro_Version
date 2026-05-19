/**
 * Tenant boundary regression test (D8).
 *
 * Every student-settings server action must scope writes to the authenticated
 * student's profile. The schemas in `@/lib/validations/auth` and the schema
 * in `@/lib/notifications/preferences-schema` both use `.strict()` so that
 * adding an `id` / `userId` / `profileId` field to the request payload is
 * silently rejected — `getServerUser().id` is the only acceptable source.
 *
 * These tests fail loudly if anyone later relaxes `.strict()` or adds a
 * payload field whose name suggests a profile id. They are NOT meant to
 * re-cover happy-path behavior (see settings-actions.test.ts) — they are a
 * fence around the invariant.
 */
import { describe, expect, it } from "vitest";

import { notificationPreferencesPayloadSchema } from "@/lib/notifications/preferences-schema";
import {
	studentProfileUpdateSchema,
	studentSchoolPlacementSchema,
} from "@/lib/validations/auth";

const FORGED_FIELDS = [
	"userId",
	"user_id",
	"profileId",
	"profile_id",
	"id",
	"targetUserId",
	"actorId",
] as const;

describe("student settings schemas reject forged profile-id fields", () => {
	it("studentProfileUpdateSchema rejects any payload-supplied profile id", () => {
		const base = {
			fullName: "Ada Lovelace",
			avatarUrl: "",
			phone: "",
		} as const;
		for (const key of FORGED_FIELDS) {
			const parsed = studentProfileUpdateSchema.safeParse({
				...base,
				[key]: "11111111-1111-1111-1111-111111111111",
			});
			expect(parsed.success, `forged ${key} should be rejected`).toBe(false);
		}
	});

	it("studentSchoolPlacementSchema rejects any payload-supplied profile id", () => {
		const base = {
			grade: 10,
			section: "A",
			stream: null,
			schoolName: null,
		} as const;
		for (const key of FORGED_FIELDS) {
			const parsed = studentSchoolPlacementSchema.safeParse({
				...base,
				[key]: "11111111-1111-1111-1111-111111111111",
			});
			expect(parsed.success, `forged ${key} should be rejected`).toBe(false);
		}
	});

	it("notificationPreferencesPayloadSchema rejects any payload-supplied profile id", () => {
		const base = {
			enableInApp: true,
			enableEmail: false,
			types: {
				test_result: true,
				usage_alert: true,
				announcement: true,
				reminder: true,
			},
		} as const;
		for (const key of FORGED_FIELDS) {
			const parsed = notificationPreferencesPayloadSchema.safeParse({
				...base,
				[key]: "11111111-1111-1111-1111-111111111111",
			});
			expect(parsed.success, `forged ${key} should be rejected`).toBe(false);
		}
	});
});

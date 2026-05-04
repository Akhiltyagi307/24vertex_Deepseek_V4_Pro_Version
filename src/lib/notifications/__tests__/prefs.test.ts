import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` factories are hoisted above module-level `const`s, so the mock
// fn has to be created via `vi.hoisted` to be visible inside the factory.
const { dbRowsMock } = vi.hoisted(() => ({ dbRowsMock: vi.fn() }));
vi.mock("@/db", () => {
	const chain: {
		select: ReturnType<typeof vi.fn>;
		from: ReturnType<typeof vi.fn>;
		where: ReturnType<typeof vi.fn>;
	} = {
		select: vi.fn(() => chain),
		from: vi.fn(() => chain),
		where: vi.fn(() => dbRowsMock()),
	};
	return { db: chain };
});

import {
	getNotificationPrefsForUsers,
	isEmailAllowed,
	isInAppAllowed,
	prefsFromUserPreferenceRow,
	type NotificationPrefs,
} from "@/lib/notifications/prefs";

describe("prefs gating", () => {
	const base: NotificationPrefs = {
		enableInApp: true,
		enableEmail: true,
		types: {
			test_result: true,
			usage_alert: true,
			announcement: true,
			reminder: true,
		},
	};

	it("blocks everything when the master in-app switch is off", () => {
		const off: NotificationPrefs = { ...base, enableInApp: false };
		expect(isInAppAllowed(off, "test_result")).toBe(false);
		expect(isInAppAllowed(off, "usage_alert")).toBe(false);
	});

	it("blocks per-type when the map sets false", () => {
		const p: NotificationPrefs = {
			...base,
			types: { ...base.types, usage_alert: false },
		};
		expect(isInAppAllowed(p, "test_result")).toBe(true);
		expect(isInAppAllowed(p, "usage_alert")).toBe(false);
	});

	it("treats missing map entries as allowed (default-open)", () => {
		const p: NotificationPrefs = {
			...base,
			types: { test_result: true },
		};
		expect(isInAppAllowed(p, "announcement")).toBe(true);
	});

	it("email helper mirrors the email master switch and per-type map", () => {
		expect(isEmailAllowed(base, "test_result")).toBe(true);
		expect(
			isEmailAllowed({ ...base, enableEmail: false }, "test_result"),
		).toBe(false);
		expect(
			isEmailAllowed(
				{ ...base, types: { ...base.types, test_result: false } },
				"test_result",
			),
		).toBe(false);
	});
});

describe("prefsFromUserPreferenceRow", () => {
	it("treats null master flags as enabled", () => {
		const p = prefsFromUserPreferenceRow({
			enableInapp: null,
			enableEmail: null,
			types: null,
		});
		expect(p.enableInApp).toBe(true);
		expect(p.enableEmail).toBe(true);
		expect(isEmailAllowed(p, "announcement")).toBe(true);
	});

	it("honours explicit false for master email (e.g. one-click unsubscribe)", () => {
		const p = prefsFromUserPreferenceRow({
			enableInapp: true,
			enableEmail: false,
			types: {},
		});
		expect(isEmailAllowed(p, "announcement")).toBe(false);
	});

	it("honours announcement false for broadcast-style gating", () => {
		const p = prefsFromUserPreferenceRow({
			enableInapp: true,
			enableEmail: true,
			types: { announcement: false },
		});
		expect(isEmailAllowed(p, "announcement")).toBe(false);
		expect(isInAppAllowed(p, "announcement")).toBe(false);
	});

	it("ignores non-boolean JSON values for known keys", () => {
		const p = prefsFromUserPreferenceRow({
			enableInapp: true,
			enableEmail: true,
			types: { announcement: "no" as unknown as boolean },
		});
		expect(isEmailAllowed(p, "announcement")).toBe(true);
	});
});

describe("getNotificationPrefsForUsers", () => {
	beforeEach(() => {
		dbRowsMock.mockReset();
	});

	it("returns defaults for users with no row", async () => {
		dbRowsMock.mockResolvedValueOnce([]);
		const map = await getNotificationPrefsForUsers(["u1", "u2"]);
		expect(map.get("u1")).toEqual({
			enableInApp: true,
			enableEmail: true,
			types: {
				test_result: true,
				announcement: true,
				reminder: true,
				usage_alert: true,
				system: true,
				encouragement: true,
			},
		});
		expect(map.get("u2")).toEqual(map.get("u1"));
	});

	it("honors strict booleans in notification_types and falls through for non-booleans", async () => {
		dbRowsMock.mockResolvedValueOnce([
			{
				userId: "u1",
				enableInapp: true,
				enableEmail: false,
				types: { announcement: false, reminder: "yes", new_key: 1 },
			},
		]);
		const map = await getNotificationPrefsForUsers(["u1"]);
		const p = map.get("u1")!;
		expect(p.enableInApp).toBe(true);
		expect(p.enableEmail).toBe(false);
		// strict boolean wins
		expect(p.types.announcement).toBe(false);
		// non-boolean on a known key → keep code default (true)
		expect(p.types.reminder).toBe(true);
		// non-boolean on an unknown key → default to true
		expect(p.types.new_key).toBe(true);
	});

	it("returns an empty map when given no ids and does not query", async () => {
		const map = await getNotificationPrefsForUsers([]);
		expect(map.size).toBe(0);
		expect(dbRowsMock).not.toHaveBeenCalled();
	});

	it("treats null masters as on (matches single-user loader)", async () => {
		dbRowsMock.mockResolvedValueOnce([
			{ userId: "u1", enableInapp: null, enableEmail: null, types: null },
		]);
		const p = (await getNotificationPrefsForUsers(["u1"])).get("u1")!;
		expect(p.enableInApp).toBe(true);
		expect(p.enableEmail).toBe(true);
	});
});

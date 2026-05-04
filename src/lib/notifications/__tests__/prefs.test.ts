import { describe, expect, it } from "vitest";

import { isEmailAllowed, isInAppAllowed, type NotificationPrefs } from "@/lib/notifications/prefs";

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

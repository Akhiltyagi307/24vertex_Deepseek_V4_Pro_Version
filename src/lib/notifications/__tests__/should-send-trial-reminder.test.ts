import { describe, expect, it } from "vitest";

import { shouldSendTrialReminder } from "@/lib/notifications/should-send-trial-reminder";
import type { NotificationPrefs } from "@/lib/notifications/prefs";

const DEFAULT: NotificationPrefs = {
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
};

describe("shouldSendTrialReminder", () => {
	it("returns true with default prefs", () => {
		expect(shouldSendTrialReminder(DEFAULT)).toBe(true);
	});

	it("returns false when master email is off", () => {
		expect(shouldSendTrialReminder({ ...DEFAULT, enableEmail: false })).toBe(false);
	});

	it("returns false when reminder is explicitly off", () => {
		expect(
			shouldSendTrialReminder({
				...DEFAULT,
				types: { ...DEFAULT.types, reminder: false },
			}),
		).toBe(false);
	});

	it("returns true when reminder is missing from the map (default-open)", () => {
		const sparse: NotificationPrefs = {
			...DEFAULT,
			types: { announcement: true },
		};
		expect(shouldSendTrialReminder(sparse)).toBe(true);
	});
});

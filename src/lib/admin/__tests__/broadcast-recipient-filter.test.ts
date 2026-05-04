import { describe, expect, it } from "vitest";

import { filterAllowedBroadcastRecipients } from "@/lib/admin/broadcast-recipient-filter";
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

const recipients = [
	{ id: "u1", email: "u1@example.com", role: "student" },
	{ id: "u2", email: "u2@example.com", role: "student" },
	{ id: "u3", email: null, role: "student" },
];

describe("filterAllowedBroadcastRecipients", () => {
	it("includes everyone when no one has opted out (channels: in-app + email)", () => {
		const prefs = new Map([
			["u1", DEFAULT],
			["u2", DEFAULT],
			["u3", DEFAULT],
		]);
		const out = filterAllowedBroadcastRecipients(recipients, prefs, {
			inApp: true,
			email: true,
		});
		expect(out.inAppAllowed.map((r) => r.id)).toEqual(["u1", "u2", "u3"]);
		expect(out.emailAllowed.map((r) => r.id)).toEqual(["u1", "u2"]); // u3 has no email
	});

	it("excludes users with master in-app off from in-app, but they may still get email", () => {
		const prefs = new Map([
			["u1", { ...DEFAULT, enableInApp: false }],
			["u2", DEFAULT],
			["u3", DEFAULT],
		]);
		const out = filterAllowedBroadcastRecipients(recipients, prefs, {
			inApp: true,
			email: true,
		});
		expect(out.inAppAllowed.map((r) => r.id)).toEqual(["u2", "u3"]);
		expect(out.emailAllowed.map((r) => r.id)).toEqual(["u1", "u2"]);
	});

	it("excludes users with announcement: false from both channels", () => {
		const prefs = new Map([
			["u1", { ...DEFAULT, types: { ...DEFAULT.types, announcement: false } }],
			["u2", DEFAULT],
			["u3", DEFAULT],
		]);
		const out = filterAllowedBroadcastRecipients(recipients, prefs, {
			inApp: true,
			email: true,
		});
		expect(out.inAppAllowed.map((r) => r.id)).toEqual(["u2", "u3"]);
		expect(out.emailAllowed.map((r) => r.id)).toEqual(["u2"]);
	});

	it("returns empty arrays when channels are off", () => {
		const prefs = new Map([
			["u1", DEFAULT],
			["u2", DEFAULT],
			["u3", DEFAULT],
		]);
		const out = filterAllowedBroadcastRecipients(recipients, prefs, {
			inApp: false,
			email: false,
		});
		expect(out.inAppAllowed).toEqual([]);
		expect(out.emailAllowed).toEqual([]);
	});

	it("falls open (defaults) for an id missing from the prefs map", () => {
		const prefs = new Map([["u1", DEFAULT]]);
		const out = filterAllowedBroadcastRecipients(recipients, prefs, {
			inApp: true,
			email: true,
		});
		// Missing prefs → treat as default (allowed)
		expect(out.inAppAllowed.map((r) => r.id)).toEqual(["u1", "u2", "u3"]);
		expect(out.emailAllowed.map((r) => r.id)).toEqual(["u1", "u2"]);
	});
});

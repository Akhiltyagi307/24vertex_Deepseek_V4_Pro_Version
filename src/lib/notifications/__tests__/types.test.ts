import { describe, expect, it } from "vitest";

import { deriveCta, preferenceKeyForRow } from "@/lib/notifications/types";

describe("deriveCta", () => {
	it("returns a View report CTA for test_result rows that carry a test reference", () => {
		const cta = deriveCta({
			type: "test_result",
			category: "test_report_ready",
			referenceType: "test",
			referenceId: "11111111-1111-1111-1111-111111111111",
			contextStudentId: null,
		});
		expect(cta).toEqual({
			label: "View report",
			href: "/student/reports?test=11111111-1111-1111-1111-111111111111",
			variant: "primary",
		});
	});

	it("returns a View plan CTA for usage_ alerts", () => {
		const cta = deriveCta({
			type: "alert",
			category: "usage_tests_80",
			referenceType: "usage_period",
			referenceId: "22222222-2222-2222-2222-222222222222",
			contextStudentId: null,
		});
		expect(cta).toEqual({
			label: "View plan",
			href: "/student/subscription",
			variant: "secondary",
		});
	});

	it("returns null when there is no matching CTA rule", () => {
		expect(
			deriveCta({
				type: "announcement",
				category: "broadcast",
				referenceType: "broadcast",
				referenceId: null,
				contextStudentId: null,
			}),
		).toBeNull();
	});

	it("returns null for test_result rows missing a reference id", () => {
		expect(
			deriveCta({
				type: "test_result",
				category: "test_report_ready",
				referenceType: "test",
				referenceId: null,
				contextStudentId: null,
			}),
		).toBeNull();
	});

	it("returns Account settings CTA for account security system rows", () => {
		expect(
			deriveCta({
				type: "system",
				category: "account_password_changed",
				referenceType: null,
				referenceId: null,
				contextStudentId: null,
			}),
		).toEqual({
			label: "Account settings",
			href: "/student/settings",
			variant: "secondary",
		});
	});

	it("parent portal: report CTA uses open-report with student + test", () => {
		const cta = deriveCta(
			{
				type: "test_result",
				category: "test_report_ready",
				referenceType: "test",
				referenceId: "11111111-1111-1111-1111-111111111111",
				contextStudentId: "22222222-2222-2222-2222-222222222222",
			},
			{ portal: "parent" },
		);
		expect(cta).toEqual({
			label: "View report",
			href: "/parent/open-report?student=22222222-2222-2222-2222-222222222222&test=11111111-1111-1111-1111-111111111111",
			variant: "primary",
		});
	});

	it("parent portal: usage alerts link to parent subscription", () => {
		const cta = deriveCta(
			{
				type: "alert",
				category: "usage_tests_80",
				referenceType: "usage_period",
				referenceId: null,
				contextStudentId: null,
			},
			{ portal: "parent" },
		);
		expect(cta?.href).toBe("/parent/subscription");
	});
});

describe("preferenceKeyForRow", () => {
	it("maps usage_* alerts to the single usage_alert bucket", () => {
		expect(
			preferenceKeyForRow({ type: "alert", category: "usage_tests_80" }),
		).toBe("usage_alert");
		expect(
			preferenceKeyForRow({ type: "alert", category: "usage_tokens_100" }),
		).toBe("usage_alert");
	});

	it("falls back to the raw type key for other rows", () => {
		expect(preferenceKeyForRow({ type: "test_result", category: null })).toBe(
			"test_result",
		);
		expect(preferenceKeyForRow({ type: "announcement", category: "broadcast" })).toBe(
			"announcement",
		);
	});
});

import { describe, expect, it } from "vitest";

import { isValidIndianPhone, parseIndianPhone } from "@/lib/marketing/contact/phone";

describe("parseIndianPhone", () => {
	it("accepts a bare 10-digit mobile", () => {
		expect(parseIndianPhone("9876543210")).toEqual({
			canonical: "+919876543210",
			pretty: "+91 98765 43210",
		});
	});

	it("accepts the +91 country code", () => {
		expect(parseIndianPhone("+919876543210")?.canonical).toBe("+919876543210");
	});

	it("accepts +91 with spaces and hyphens", () => {
		expect(parseIndianPhone("+91 98765 43210")?.canonical).toBe("+919876543210");
		expect(parseIndianPhone("+91-98765-43210")?.canonical).toBe("+919876543210");
		expect(parseIndianPhone("+91 (98765) 43210")?.canonical).toBe("+919876543210");
	});

	it("accepts the leading-0 national format", () => {
		expect(parseIndianPhone("09876543210")?.canonical).toBe("+919876543210");
	});

	it("accepts 91 without a leading +", () => {
		expect(parseIndianPhone("919876543210")?.canonical).toBe("+919876543210");
	});

	it("accepts 0091 international prefix", () => {
		expect(parseIndianPhone("00919876543210")?.canonical).toBe("+919876543210");
		expect(parseIndianPhone("0091 98765 43210")?.canonical).toBe("+919876543210");
	});

	it.each(["6876543210", "7876543210", "8876543210", "9876543210"])(
		"accepts mobile prefix %s",
		(n) => {
			expect(parseIndianPhone(n)?.canonical).toBe(`+91${n}`);
		},
	);

	it.each([
		["", "empty string"],
		["   ", "whitespace only"],
		["abc", "non-numeric"],
		["1234567890", "starts with 1"],
		["5876543210", "starts with 5 (not a mobile prefix)"],
		["+15551234567", "non-Indian country code"],
		["+91", "country code with no number"],
		["+9198765", "too short"],
		["98765432100", "too long (11 digits)"],
		["98765 4321", "too short with spaces"],
		["+91 98765 4321", "9-digit subscriber"],
		["+91 abcd efghij", "letters inside"],
	])("rejects %s (%s)", (input) => {
		expect(parseIndianPhone(input)).toBeNull();
	});

	it("pretty-formats with the standard 5-5 grouping", () => {
		expect(parseIndianPhone("9876543210")?.pretty).toBe("+91 98765 43210");
	});
});

describe("isValidIndianPhone", () => {
	it("returns true for valid", () => {
		expect(isValidIndianPhone("9876543210")).toBe(true);
		expect(isValidIndianPhone("+91 98765 43210")).toBe(true);
	});

	it("returns false for invalid", () => {
		expect(isValidIndianPhone("")).toBe(false);
		expect(isValidIndianPhone("5876543210")).toBe(false);
		expect(isValidIndianPhone("+15551234567")).toBe(false);
	});
});

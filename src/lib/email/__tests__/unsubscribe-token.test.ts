import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { signUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("unsubscribe-token", () => {
	let originalSecret: string | undefined;

	beforeEach(() => {
		originalSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
		process.env.EMAIL_UNSUBSCRIBE_SECRET = TEST_SECRET;
	});

	afterEach(() => {
		if (originalSecret == null) delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
		else process.env.EMAIL_UNSUBSCRIBE_SECRET = originalSecret;
	});

	it("round-trips a valid token", () => {
		const token = signUnsubscribeToken("user-1");
		expect(token).toBeTruthy();
		const decoded = verifyUnsubscribeToken(token!);
		expect(decoded?.userId).toBe("user-1");
		expect(decoded?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
	});

	it("rejects a token signed with a different secret", () => {
		const token = signUnsubscribeToken("user-2");
		expect(token).toBeTruthy();

		// Different secret shouldn't validate.
		process.env.EMAIL_UNSUBSCRIBE_SECRET =
			"deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
		expect(verifyUnsubscribeToken(token!)).toBeNull();
	});

	it("rejects malformed tokens", () => {
		expect(verifyUnsubscribeToken("")).toBeNull();
		expect(verifyUnsubscribeToken("nope")).toBeNull();
		expect(verifyUnsubscribeToken("a.b.c")).toBeNull();
	});

	it("rejects expired tokens", () => {
		const token = signUnsubscribeToken("user-3", -10);
		expect(token).toBeTruthy();
		expect(verifyUnsubscribeToken(token!)).toBeNull();
	});

	it("returns null when no secret is configured", () => {
		delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
		expect(signUnsubscribeToken("user-4")).toBeNull();
	});

	it("rejects tokens with a tampered signature byte", () => {
		const token = signUnsubscribeToken("user-5");
		expect(token).toBeTruthy();
		const [payload, sig] = token!.split(".");
		const flippedFirstSigChar = sig[0] === "A" ? "B" : "A";
		const tampered = `${payload}.${flippedFirstSigChar}${sig.slice(1)}`;
		expect(verifyUnsubscribeToken(tampered)).toBeNull();
	});
});

import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "../razorpay";

function signHex(secret: string, body: string): string {
	return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function signBase64(secret: string, body: string): string {
	return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

describe("verifyWebhookSignature", () => {
	const ORIG_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
	const ORIG_EXTRA = process.env.RAZORPAY_WEBHOOK_SECRET_EXTRA;

	beforeEach(() => {
		process.env.RAZORPAY_WEBHOOK_SECRET = "primary_test_secret";
		delete process.env.RAZORPAY_WEBHOOK_SECRET_EXTRA;
	});

	afterEach(() => {
		if (ORIG_SECRET === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
		else process.env.RAZORPAY_WEBHOOK_SECRET = ORIG_SECRET;
		if (ORIG_EXTRA === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET_EXTRA;
		else process.env.RAZORPAY_WEBHOOK_SECRET_EXTRA = ORIG_EXTRA;
	});

	const SAMPLE_BODY = '{"event":"subscription.charged","payload":{}}';

	it("accepts a valid hex signature", () => {
		const sig = signHex("primary_test_secret", SAMPLE_BODY);
		expect(verifyWebhookSignature(SAMPLE_BODY, sig)).toBe(true);
	});

	it("accepts a valid base64 signature", () => {
		const sig = signBase64("primary_test_secret", SAMPLE_BODY);
		expect(verifyWebhookSignature(SAMPLE_BODY, sig)).toBe(true);
	});

	it("rejects a missing signature header", () => {
		expect(verifyWebhookSignature(SAMPLE_BODY, null)).toBe(false);
		expect(verifyWebhookSignature(SAMPLE_BODY, "")).toBe(false);
		expect(verifyWebhookSignature(SAMPLE_BODY, "   ")).toBe(false);
	});

	it("rejects a signature computed with the wrong secret", () => {
		const sig = signHex("definitely_not_the_real_secret", SAMPLE_BODY);
		expect(verifyWebhookSignature(SAMPLE_BODY, sig)).toBe(false);
	});

	it("rejects a signature of incorrect length", () => {
		expect(verifyWebhookSignature(SAMPLE_BODY, "abc")).toBe(false);
	});

	it("rejects a tampered body (same secret but body changed)", () => {
		const sig = signHex("primary_test_secret", SAMPLE_BODY);
		const tampered = SAMPLE_BODY.replace("charged", "cancelled");
		expect(verifyWebhookSignature(tampered, sig)).toBe(false);
	});

	it("trims whitespace around the signature header", () => {
		const sig = signHex("primary_test_secret", SAMPLE_BODY);
		expect(verifyWebhookSignature(SAMPLE_BODY, `   ${sig}   `)).toBe(true);
	});

	it("accepts a signature from RAZORPAY_WEBHOOK_SECRET_EXTRA during rotation", () => {
		process.env.RAZORPAY_WEBHOOK_SECRET_EXTRA = "rotation_test_secret";
		const sig = signHex("rotation_test_secret", SAMPLE_BODY);
		expect(verifyWebhookSignature(SAMPLE_BODY, sig)).toBe(true);
	});

	it("accepts both primary and rotated secrets during a rotation window", () => {
		process.env.RAZORPAY_WEBHOOK_SECRET_EXTRA = "old_secret_rotating_out";
		expect(verifyWebhookSignature(SAMPLE_BODY, signHex("primary_test_secret", SAMPLE_BODY))).toBe(true);
		expect(verifyWebhookSignature(SAMPLE_BODY, signHex("old_secret_rotating_out", SAMPLE_BODY))).toBe(true);
	});

	it("supports a comma-separated list of extra secrets", () => {
		process.env.RAZORPAY_WEBHOOK_SECRET_EXTRA = "secret_a, secret_b, secret_c";
		expect(verifyWebhookSignature(SAMPLE_BODY, signHex("secret_b", SAMPLE_BODY))).toBe(true);
		expect(verifyWebhookSignature(SAMPLE_BODY, signHex("secret_c", SAMPLE_BODY))).toBe(true);
		expect(verifyWebhookSignature(SAMPLE_BODY, signHex("never_added", SAMPLE_BODY))).toBe(false);
	});
});

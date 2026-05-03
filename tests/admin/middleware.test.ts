import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { adminProxyGate } from "@/lib/admin/proxy-guard";

describe("admin proxy gate", () => {
	it("allows public admin login path without cookie", async () => {
		const req = new NextRequest(new URL("http://localhost:3001/admin/login"));
		const res = await adminProxyGate(req);
		expect(res).toBeNull();
	});

	it("allows public admin auth login API", async () => {
		const req = new NextRequest(new URL("http://localhost:3001/api/admin/auth/login"));
		const res = await adminProxyGate(req);
		expect(res).toBeNull();
	});

	it("redirects protected admin page without cookie", async () => {
		const req = new NextRequest(new URL("http://localhost:3001/admin/dashboard"));
		const res = await adminProxyGate(req);
		expect(res?.status).toBe(307);
		expect(res?.headers.get("location")).toContain("/admin/login");
	});

	it("returns 401 for protected admin API without cookie", async () => {
		const req = new NextRequest(new URL("http://localhost:3001/api/admin/audit"));
		const res = await adminProxyGate(req);
		expect(res?.status).toBe(401);
	});
});

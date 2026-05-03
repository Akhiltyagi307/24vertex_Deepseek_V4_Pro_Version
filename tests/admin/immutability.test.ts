import { describe, expect, it } from "vitest";

const enabled = Boolean(
	process.env.ADMIN_INTEGRATION_TESTS === "true" &&
		process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
		process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
);

describe.skipIf(!enabled)("admin_action_log immutability (integration)", () => {
	it("rejects UPDATE and DELETE (append-only)", async () => {
		const { createServiceRoleClient } = await import("@/lib/supabase/admin");
		const admin = createServiceRoleClient();

		const { data: row, error: insertErr } = await admin
			.from("admin_action_log")
			.insert({ action: "test_immutability" })
			.select("id")
			.single();

		expect(insertErr).toBeNull();
		expect(row?.id).toBeDefined();

		const { error: updateErr } = await admin.from("admin_action_log").update({ action: "tampered" }).eq("id", row!.id);

		expect(updateErr).toBeTruthy();
		const msg = `${updateErr?.message ?? ""} ${(updateErr as { details?: string })?.details ?? ""}`;
		expect(msg.toLowerCase()).toMatch(/append-only|check_violation/);

		const { error: deleteErr } = await admin.from("admin_action_log").delete().eq("id", row!.id);

		expect(deleteErr).toBeTruthy();
	});
});

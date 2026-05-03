import { assertCronRequestAuthorized } from "@/lib/internal/cron-auth";
import { writeAdminAction } from "@/lib/admin/audit";
import { runAllEnabledRetentionPolicies } from "@/lib/compliance/retention-purge";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
	const auth = assertCronRequestAuthorized(request);
	if (auth) return auth;

	const results = await runAllEnabledRetentionPolicies(false);

	await writeAdminAction({
		action: "compliance_retention_cron",
		targetType: "retention",
		targetId: "cron",
		payload: { results },
	});

	return Response.json({ ok: true, results });
}

import { desc } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";

import { AdminServerRowsToolbar } from "@/components/admin/admin-server-rows-toolbar";
import { AdminAiEvalRunButton } from "@/components/admin/ai/admin-ai-eval-run-button";
import { db } from "@/db";
import { evalRuns } from "@/db/schema/eval-runs";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import { FIXTURES_BY_SUBJECT } from "@/lib/practice/__fixtures__/index";

export const metadata = {
	title: "AI eval runs · Admin",
	robots: { index: false, follow: false },
};

function fmtDuration(ms: number | null | undefined): string {
	if (ms == null) return "—";
	if (ms < 1000) return `${ms}ms`;
	const sec = Math.round(ms / 100) / 10;
	return `${sec}s`;
}

function fmtPassRate(passed: number | null, total: number | null): string {
	if (passed == null || total == null || total === 0) return "—";
	const pct = ((passed / total) * 100).toFixed(0);
	return `${passed}/${total} (${pct}%)`;
}

function statusPill(
	status: string,
	passed: number | null,
	failed: number | null,
): { label: string; cls: string } {
	if (status === "running") {
		return { label: "running", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" };
	}
	if (status === "failed") {
		return { label: "failed", cls: "bg-red-500/15 text-red-700 dark:text-red-400" };
	}
	if (status === "complete") {
		if ((failed ?? 0) > 0) {
			return { label: `${failed} regressed`, cls: "bg-red-500/15 text-red-700 dark:text-red-400" };
		}
		return { label: "all pass", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" };
	}
	return { label: status, cls: "bg-muted text-muted-foreground" };
}

export default async function AdminAiEvalsPage() {
	const rows = await db
		.select()
		.from(evalRuns)
		.orderBy(desc(evalRuns.triggeredAt))
		.limit(200);

	const subjectKeys = Object.keys(FIXTURES_BY_SUBJECT).sort();

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">AI eval runs</h1>
					<p className="text-sm text-muted-foreground">
						Tier 2 LLM evals — exercises the practice prompt fixtures against the live
						model and reports per-fixture pass/fail. Runs cost ~$0.06 each. Tier 1 (free,
						structural) runs in CI on every PR.
					</p>
				</div>
				<AdminAiEvalRunButton subjectKeys={subjectKeys} />
			</div>

			<Suspense fallback={null}>
				<AdminServerRowsToolbar
					listId={ADMIN_LIST_ID.aiEvals}
					filenameBase="ai-evals"
					headers={[
						"id",
						"triggered_at",
						"status",
						"filter",
						"model",
						"passed",
						"failed",
						"schema_invalid",
						"total_input_tokens",
						"total_output_tokens",
						"total_latency_ms",
					]}
					rows={rows.map((r) => ({
						id: r.id,
						triggered_at: r.triggeredAt.toISOString(),
						status: r.status,
						filter: r.filter,
						model: r.model,
						passed: r.passed ?? "",
						failed: r.failed ?? "",
						schema_invalid: r.schemaInvalid ?? "",
						total_input_tokens: r.totalInputTokens ?? "",
						total_output_tokens: r.totalOutputTokens ?? "",
						total_latency_ms: r.totalLatencyMs ?? "",
					}))}
				/>
			</Suspense>

			<div className="overflow-x-auto rounded-md border border-border">
				<table className="w-full min-w-[960px] text-sm">
					<thead className="border-b border-border bg-muted/40 text-left">
						<tr>
							<th className="px-3 py-2 font-medium">Triggered</th>
							<th className="px-3 py-2 font-medium">Status</th>
							<th className="px-3 py-2 font-medium">Filter</th>
							<th className="px-3 py-2 font-medium">Model</th>
							<th className="px-3 py-2 font-medium">Fixtures</th>
							<th className="px-3 py-2 font-medium">Assertions</th>
							<th className="px-3 py-2 font-medium">Tokens (in / out)</th>
							<th className="px-3 py-2 font-medium">Duration</th>
							<th className="px-3 py-2 font-medium" />
						</tr>
					</thead>
					<tbody>
						{rows.map((r) => {
							const pill = statusPill(r.status, r.passed, r.failed);
							return (
								<tr key={r.id} className="border-b border-border/80">
									<td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
										{r.triggeredAt.toISOString().replace("T", " ").slice(0, 19)}
									</td>
									<td className="px-3 py-2">
										<span
											className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.cls}`}
										>
											{pill.label}
										</span>
									</td>
									<td className="px-3 py-2 font-mono text-xs">{r.filter}</td>
									<td className="px-3 py-2 text-xs">{r.model}</td>
									<td className="px-3 py-2 text-xs">
										{fmtPassRate(r.passed, r.totalFixtures)}
									</td>
									<td className="px-3 py-2 text-xs">
										{fmtPassRate(r.passedAssertions, r.totalAssertions)}
									</td>
									<td className="px-3 py-2 text-xs text-muted-foreground">
										{(r.totalInputTokens ?? 0).toLocaleString()} /{" "}
										{(r.totalOutputTokens ?? 0).toLocaleString()}
									</td>
									<td className="px-3 py-2 text-xs">
										{fmtDuration(r.totalLatencyMs)}
									</td>
									<td className="px-3 py-2">
										<Link
											className="text-primary underline"
											href={`/admin/ai/evals/${r.id}`}
										>
											Open
										</Link>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
				{rows.length === 0 ? (
					<p className="px-3 py-6 text-sm text-muted-foreground">
						No eval runs yet. Click <strong>Run evals</strong> to trigger one (~$0.06,
						~30s), or run <code className="font-mono text-xs">pnpm run evals:practice</code>{" "}
						from the CLI.
					</p>
				) : null}
			</div>
		</div>
	);
}

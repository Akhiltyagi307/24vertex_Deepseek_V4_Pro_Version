import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAiPromptActions } from "@/components/admin/ai/admin-ai-prompt-actions";
import { db } from "@/db";
import { aiPrompts } from "@/db/schema/ai-prompts";
import { evalRuns } from "@/db/schema/eval-runs";

export const metadata = {
	title: "AI prompt · Admin",
	robots: { index: false, follow: false },
};

export default async function AdminAiPromptDetailPage(props: { params: Promise<{ id: string }> }) {
	const { id } = await props.params;
	const [row] = await db.select().from(aiPrompts).where(eq(aiPrompts.id, id)).limit(1);
	if (!row) notFound();

	// Most recent eval run (any prompt) — useful as a quality signal next to
	// the activate button. When prompt-version-aware eval routing lands, this
	// can scope to runs against this specific prompt id.
	const [latestEvalRun] = await db
		.select({
			id: evalRuns.id,
			triggeredAt: evalRuns.triggeredAt,
			status: evalRuns.status,
			passed: evalRuns.passed,
			totalFixtures: evalRuns.totalFixtures,
			failed: evalRuns.failed,
			totalAssertions: evalRuns.totalAssertions,
			passedAssertions: evalRuns.passedAssertions,
		})
		.from(evalRuns)
		.where(eq(evalRuns.status, "complete"))
		.orderBy(desc(evalRuns.triggeredAt))
		.limit(1);

	return (
		<div className="space-y-4">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">{row.name}</h1>
				<p className="font-mono text-xs text-muted-foreground">
					{row.feature} · v{row.version} · {row.model}
				</p>
			</div>
			<AdminAiPromptActions id={row.id} />

			{/* Tier 1 + Tier 2 quality readout */}
			<section className="grid gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm sm:grid-cols-2">
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Tier 1 (structural, CI)
					</p>
					<p className="mt-1">
						<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
							runs in PR CI
						</span>
						<span className="ml-2 text-xs text-muted-foreground">
							see the latest commit&apos;s checks for pass/fail
						</span>
					</p>
				</div>
				<div>
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Tier 2 (LLM eval)
					</p>
					{latestEvalRun ? (
						<p className="mt-1">
							<span
								className={`rounded-full px-2 py-0.5 text-xs font-medium ${
									(latestEvalRun.failed ?? 0) > 0
										? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
										: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
								}`}
							>
								{latestEvalRun.passed ?? 0}/{latestEvalRun.totalFixtures ?? 0} fixtures
								pass
							</span>
							<span className="ml-2 text-xs text-muted-foreground">
								last run{" "}
								{latestEvalRun.triggeredAt.toISOString().replace("T", " ").slice(0, 16)}
							</span>{" "}
							·{" "}
							<Link
								href={`/admin/ai/evals/${latestEvalRun.id}`}
								className="text-primary underline"
							>
								details
							</Link>{" "}
							·{" "}
							<Link href="/admin/ai/evals" className="text-primary underline">
								all runs
							</Link>
						</p>
					) : (
						<p className="mt-1 text-xs text-muted-foreground">
							No completed eval runs yet.{" "}
							<Link href="/admin/ai/evals" className="text-primary underline">
								Run evals
							</Link>{" "}
							before activating prompt changes.
						</p>
					)}
				</div>
			</section>

			<pre className="max-h-[480px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{row.template}</pre>
		</div>
	);
}

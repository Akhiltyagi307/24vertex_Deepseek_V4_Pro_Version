import { desc, eq, lt } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAiEvalDiffPanel } from "@/components/admin/ai/admin-ai-eval-diff-panel";
import { db } from "@/db";
import { evalRunResults, evalRuns } from "@/db/schema/eval-runs";

export const metadata = {
	title: "Eval run · Admin",
	robots: { index: false, follow: false },
};

type AssertionResult = {
	pass: boolean;
	assertion: { type: string; [k: string]: unknown };
	reason?: string;
};

function fmtPct(passed: number | null, total: number | null) {
	if (passed == null || total == null || total === 0) return "—";
	return `${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`;
}

function fmtDuration(ms: number | null | undefined): string {
	if (ms == null) return "—";
	if (ms < 1000) return `${ms}ms`;
	const sec = Math.round(ms / 100) / 10;
	return `${sec}s`;
}

export default async function AdminAiEvalRunDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const [run] = await db.select().from(evalRuns).where(eq(evalRuns.id, id)).limit(1);
	if (!run) notFound();

	const results = await db
		.select()
		.from(evalRunResults)
		.where(eq(evalRunResults.evalRunId, id));
	results.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));

	// Find the previous completed run for the diff panel
	const [prevRun] = await db
		.select()
		.from(evalRuns)
		.where(lt(evalRuns.triggeredAt, run.triggeredAt))
		.orderBy(desc(evalRuns.triggeredAt))
		.limit(1);
	const prevResults = prevRun
		? await db
				.select()
				.from(evalRunResults)
				.where(eq(evalRunResults.evalRunId, prevRun.id))
		: [];

	return (
		<div className="space-y-6">
			<div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Link href="/admin/ai/evals" className="hover:underline">
						← All eval runs
					</Link>
				</div>
				<h1 className="mt-1 text-2xl font-semibold tracking-tight">
					Eval run · {run.triggeredAt.toISOString().replace("T", " ").slice(0, 19)}
				</h1>
				<p className="text-sm text-muted-foreground">
					Filter <code className="font-mono">{run.filter}</code> · Model{" "}
					<code className="font-mono">{run.model}</code>
					{run.notes ? (
						<>
							{" · "}
							<span className="italic">&ldquo;{run.notes}&rdquo;</span>
						</>
					) : null}
				</p>
			</div>

			{/* Summary */}
			<section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<SummaryCard label="Status" value={run.status} />
				<SummaryCard
					label="Fixtures"
					value={fmtPct(run.passed, run.totalFixtures)}
					tone={run.failed && run.failed > 0 ? "warn" : run.totalFixtures ? "good" : "neutral"}
				/>
				<SummaryCard
					label="Assertions"
					value={fmtPct(run.passedAssertions, run.totalAssertions)}
				/>
				<SummaryCard label="Duration" value={fmtDuration(run.totalLatencyMs)} />
				<SummaryCard
					label="Tokens (in)"
					value={(run.totalInputTokens ?? 0).toLocaleString()}
				/>
				<SummaryCard
					label="Tokens (out)"
					value={(run.totalOutputTokens ?? 0).toLocaleString()}
				/>
				<SummaryCard
					label="Schema invalid"
					value={String(run.schemaInvalid ?? 0)}
					tone={(run.schemaInvalid ?? 0) > 0 ? "warn" : "neutral"}
				/>
				<SummaryCard label="Triggered by" value={run.triggeredBy ?? "—"} />
			</section>

			{run.error ? (
				<section className="rounded-md border border-red-500/30 bg-red-500/10 p-3">
					<p className="text-sm font-semibold text-red-800 dark:text-red-300">
						Run-level error
					</p>
					<pre className="mt-2 whitespace-pre-wrap text-xs text-red-800 dark:text-red-300">
						{run.error}
					</pre>
				</section>
			) : null}

			{/* Diff vs previous run */}
			<AdminAiEvalDiffPanel
				currentRunId={run.id}
				prevRun={
					prevRun
						? {
								id: prevRun.id,
								triggeredAt: prevRun.triggeredAt.toISOString(),
								filter: prevRun.filter,
							}
						: null
				}
				currentResults={results.map((r) => ({
					fixtureId: r.fixtureId,
					subject: r.subject,
					pass: r.pass,
				}))}
				prevResults={prevResults.map((r) => ({
					fixtureId: r.fixtureId,
					subject: r.subject,
					pass: r.pass,
				}))}
			/>

			{/* Per-fixture results */}
			<section className="space-y-3">
				<h2 className="text-lg font-semibold">Per-fixture results</h2>
				{results.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No fixture results recorded for this run.
					</p>
				) : (
					<div className="space-y-3">
						{results.map((r) => (
							<FixtureResultCard
								key={r.id}
								fixtureId={r.fixtureId}
								subject={r.subject}
								pass={r.pass}
								schemaValid={r.schemaValid}
								latencyMs={r.latencyMs}
								inputTokens={r.inputTokens}
								outputTokens={r.outputTokens}
								outputResults={r.outputResults as AssertionResult[]}
								error={r.error}
							/>
						))}
					</div>
				)}
			</section>
		</div>
	);
}

function SummaryCard({
	label,
	value,
	tone = "neutral",
}: {
	label: string;
	value: string;
	tone?: "good" | "warn" | "neutral";
}) {
	const toneCls =
		tone === "good"
			? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
			: tone === "warn"
				? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
				: "bg-muted text-foreground";
	return (
		<div className={`rounded-md border border-border p-3 ${toneCls}`}>
			<p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
			<p className="mt-1 break-words text-base font-medium">{value}</p>
		</div>
	);
}

function FixtureResultCard({
	fixtureId,
	subject,
	pass,
	schemaValid,
	latencyMs,
	inputTokens,
	outputTokens,
	outputResults,
	error,
}: {
	fixtureId: string;
	subject: string;
	pass: boolean;
	schemaValid: boolean;
	latencyMs: number | null;
	inputTokens: number | null;
	outputTokens: number | null;
	outputResults: AssertionResult[];
	error: string | null;
}) {
	const failed = outputResults.filter((a) => !a.pass);
	return (
		<div className="rounded-md border border-border">
			<div
				className={`flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 text-sm ${
					pass
						? "bg-emerald-500/5"
						: schemaValid
							? "bg-red-500/5"
							: "bg-amber-500/5"
				}`}
			>
				<span
					className={`rounded-full px-2 py-0.5 text-xs font-medium ${
						pass
							? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
							: schemaValid
								? "bg-red-500/20 text-red-800 dark:text-red-300"
								: "bg-amber-500/20 text-amber-800 dark:text-amber-300"
					}`}
				>
					{pass ? "PASS" : schemaValid ? "FAIL" : "INVALID"}
				</span>
				<code className="font-mono text-sm">{fixtureId}</code>
				<span className="text-xs text-muted-foreground">{subject}</span>
				<span className="ml-auto text-xs text-muted-foreground">
					{fmtDuration(latencyMs)} · in {(inputTokens ?? 0).toLocaleString()} / out{" "}
					{(outputTokens ?? 0).toLocaleString()}
				</span>
			</div>
			{error ? (
				<div className="border-b border-border bg-red-500/5 px-3 py-2 text-xs text-red-800 dark:text-red-300">
					<strong>Error:</strong> {error}
				</div>
			) : null}
			<ul className="divide-y divide-border text-sm">
				{outputResults.map((a, idx) => (
					<li key={idx} className="flex items-start gap-2 px-3 py-1.5">
						<span
							className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
								a.pass
									? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
									: "bg-red-500/20 text-red-800 dark:text-red-300"
							}`}
						>
							{a.pass ? "✓" : "✗"}
						</span>
						<div className="flex-1">
							<code className="font-mono text-xs">{a.assertion?.type ?? "(unknown)"}</code>
							{a.reason ? (
								<p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
							) : null}
						</div>
					</li>
				))}
				{outputResults.length === 0 && !error ? (
					<li className="px-3 py-2 text-xs text-muted-foreground">No assertions ran.</li>
				) : null}
				{failed.length === 0 && outputResults.length > 0 ? null : null}
			</ul>
		</div>
	);
}

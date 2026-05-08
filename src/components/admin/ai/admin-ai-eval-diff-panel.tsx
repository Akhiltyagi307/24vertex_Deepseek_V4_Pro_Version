/**
 * Diff panel — shows fixtures that changed pass/fail state between this run
 * and the previous one. Server-rendered (no client interactivity needed).
 *
 * Renders nothing if there's no previous run to compare against.
 */
type FixtureSummary = { fixtureId: string; subject: string; pass: boolean };

export function AdminAiEvalDiffPanel({
	currentRunId: _currentRunId,
	prevRun,
	currentResults,
	prevResults,
}: {
	currentRunId: string;
	prevRun: { id: string; triggeredAt: string; filter: string } | null;
	currentResults: FixtureSummary[];
	prevResults: FixtureSummary[];
}) {
	if (!prevRun || prevResults.length === 0) {
		return (
			<section className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
				No previous eval run found — diff view will appear after at least two runs are
				recorded.
			</section>
		);
	}

	const prevByFixture = new Map(prevResults.map((r) => [r.fixtureId, r]));
	const currByFixture = new Map(currentResults.map((r) => [r.fixtureId, r]));

	const regressed: FixtureSummary[] = [];
	const improved: FixtureSummary[] = [];
	const newOnly: FixtureSummary[] = [];
	const removed: FixtureSummary[] = [];

	for (const [id, curr] of currByFixture) {
		const prev = prevByFixture.get(id);
		if (!prev) {
			newOnly.push(curr);
			continue;
		}
		if (prev.pass && !curr.pass) regressed.push(curr);
		else if (!prev.pass && curr.pass) improved.push(curr);
	}
	for (const [id, prev] of prevByFixture) {
		if (!currByFixture.has(id)) removed.push(prev);
	}

	const noChanges =
		regressed.length === 0 &&
		improved.length === 0 &&
		newOnly.length === 0 &&
		removed.length === 0;

	return (
		<section className="rounded-md border border-border">
			<div className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium">
				Diff vs. previous run ({prevRun.triggeredAt.replace("T", " ").slice(0, 19)},
				filter <code className="font-mono">{prevRun.filter}</code>)
			</div>
			<div className="px-3 py-3 text-sm">
				{noChanges ? (
					<p className="text-muted-foreground">
						No fixture-level pass/fail changes between runs.
					</p>
				) : (
					<div className="space-y-3">
						{regressed.length > 0 ? (
							<DiffGroup
								label="Regressions"
								tone="bad"
								items={regressed.map((r) => ({
									id: r.fixtureId,
									subject: r.subject,
									note: "passed previously, fails now",
								}))}
							/>
						) : null}
						{improved.length > 0 ? (
							<DiffGroup
								label="Improvements"
								tone="good"
								items={improved.map((r) => ({
									id: r.fixtureId,
									subject: r.subject,
									note: "failed previously, passes now",
								}))}
							/>
						) : null}
						{newOnly.length > 0 ? (
							<DiffGroup
								label={`New fixtures (${newOnly.length})`}
								tone="info"
								items={newOnly.map((r) => ({
									id: r.fixtureId,
									subject: r.subject,
									note: r.pass ? "PASS" : "FAIL",
								}))}
							/>
						) : null}
						{removed.length > 0 ? (
							<DiffGroup
								label={`Removed fixtures (${removed.length})`}
								tone="muted"
								items={removed.map((r) => ({
									id: r.fixtureId,
									subject: r.subject,
									note: "no longer in fixture set",
								}))}
							/>
						) : null}
					</div>
				)}
			</div>
		</section>
	);
}

function DiffGroup({
	label,
	tone,
	items,
}: {
	label: string;
	tone: "good" | "bad" | "info" | "muted";
	items: Array<{ id: string; subject: string; note: string }>;
}) {
	const headCls =
		tone === "bad"
			? "text-red-700 dark:text-red-400"
			: tone === "good"
				? "text-emerald-700 dark:text-emerald-400"
				: tone === "info"
					? "text-amber-700 dark:text-amber-400"
					: "text-muted-foreground";
	return (
		<div>
			<p className={`text-sm font-semibold ${headCls}`}>{label}</p>
			<ul className="mt-1 space-y-1 pl-2">
				{items.map((it) => (
					<li key={it.id} className="text-xs">
						<code className="font-mono text-xs">{it.id}</code>{" "}
						<span className="text-muted-foreground">[{it.subject}]</span>{" "}
						<span className="text-muted-foreground">— {it.note}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

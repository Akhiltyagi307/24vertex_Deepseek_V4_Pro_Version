"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * "Run evals" button for the eval-runs dashboard list page.
 *
 * - Shows a confirmation modal with cost estimate before triggering.
 * - Lets the operator pick a fixture filter (subject key) or run all.
 * - Disables itself + shows progress while the run is in flight.
 * - Redirects to /admin/ai/evals/<id> on completion.
 *
 * Cost: full run (12 fixtures) ≈ $0.06 with gpt-4o-mini; subject-only runs
 * are 1/12th of that. Rate-limited server-side to 4 manual runs / hour.
 */
export function AdminAiEvalRunButton({ subjectKeys }: { subjectKeys: string[] }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [filter, setFilter] = useState<string>("all");
	const [notes, setNotes] = useState<string>("");
	const [error, setError] = useState<string | null>(null);

	async function trigger() {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch("/api/admin/ai/evals/run", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					filter: filter === "all" ? undefined : filter,
					notes: notes.trim() ? notes.trim() : undefined,
				}),
			});
			const j = await res.json();
			if (!res.ok) {
				throw new Error(j.error ?? `HTTP ${res.status}`);
			}
			const id = j?.data?.id;
			setOpen(false);
			setNotes("");
			if (id) {
				router.push(`/admin/ai/evals/${id}`);
				router.refresh();
			} else {
				router.refresh();
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<Button type="button" onClick={() => setOpen(true)}>
				Run evals
			</Button>
			{open ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl">
						<h2 className="text-lg font-semibold">Run practice prompt evals</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							This sends real LLM calls. A full run (~12 fixtures) costs ≈ $0.06 with{" "}
							<code className="font-mono">gpt-4o-mini</code> and takes ~30 seconds.
							Rate-limited to 4 manual runs/hour project-wide.
						</p>
						<div className="mt-4 space-y-3">
							<label className="block text-sm">
								<span className="text-muted-foreground">Filter</span>
								<select
									value={filter}
									onChange={(e) => setFilter(e.target.value)}
									className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
									disabled={busy}
								>
									<option value="all">all subjects (12 fixtures, ~$0.06)</option>
									{subjectKeys.map((s) => (
										<option key={s} value={s}>
											{s} (1 fixture, ~$0.005)
										</option>
									))}
								</select>
							</label>
							<label className="block text-sm">
								<span className="text-muted-foreground">Notes (optional)</span>
								<input
									type="text"
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="e.g. before activating prompt v7"
									className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
									maxLength={500}
									disabled={busy}
								/>
							</label>
						</div>
						{error ? (
							<p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
								{error}
							</p>
						) : null}
						<div className="mt-5 flex justify-end gap-2">
							<Button
								type="button"
								variant="secondary"
								onClick={() => setOpen(false)}
								disabled={busy}
							>
								Cancel
							</Button>
							<Button type="button" onClick={() => void trigger()} disabled={busy}>
								{busy ? "Running…" : "Run"}
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}

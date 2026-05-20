"use client";

import dynamic from "next/dynamic";
import { useCallback, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), { ssr: false });

const DEFAULT_SQL = "SELECT 1 AS ok;";

export function AdminSqlConsoleClient({ writeEnabled }: { writeEnabled: boolean }) {
	const idWritable = useId();
	const idTotp = useId();
	const [sql, setSql] = useState(DEFAULT_SQL);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<unknown>(null);
	const [writableRun, setWritableRun] = useState(false);
	const [totp, setTotp] = useState("");

	const run = useCallback(async () => {
		setBusy(true);
		setError(null);
		setResult(null);
		const useWrite = writeEnabled && writableRun;
		try {
			const res = await fetch("/api/admin/system/sql/run", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sql,
					writable: useWrite,
					...(useWrite && totp.trim() ? { totp: totp.trim() } : {}),
				}),
			});
			const j = (await res.json()) as { data?: unknown; error?: string };
			if (!res.ok) {
				setError(typeof j.error === "string" ? j.error : res.statusText);
				return;
			}
			setResult(j.data ?? j);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}, [sql, totp, writableRun, writeEnabled]);

	return (
		<div className="space-y-4">
			<div className="overflow-hidden rounded-lg border border-border">
				<div className="h-[280px]">
					<MonacoEditor
						height="100%"
						defaultLanguage="sql"
						theme="vs"
						value={sql}
						onChange={(v) => setSql(v ?? "")}
						options={{
							minimap: { enabled: false },
							fontSize: 13,
							wordWrap: "on",
							scrollBeyondLastLine: false,
						}}
					/>
				</div>
			</div>
			{writeEnabled ?
				<div className="flex flex-col gap-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
					<div className="flex items-center gap-2">
						<input
							id={idWritable}
							type="checkbox"
							className="size-4 accent-destructive"
							checked={writableRun}
							onChange={(e) => setWritableRun(e.target.checked)}
						/>
						<Label htmlFor={idWritable} className="font-medium text-amber-950 dark:text-amber-100">
							Run as writable (INSERT/UPDATE/DELETE on allowlisted tables only)
						</Label>
					</div>
					{writableRun ?
						<div className="space-y-1">
							<Label htmlFor={idTotp}>Authenticator code</Label>
							<Input
								id={idTotp}
								value={totp}
								onChange={(e) => setTotp(e.target.value)}
								autoComplete="one-time-code"
								inputMode="numeric"
								placeholder="6-digit TOTP"
								className="max-w-xs font-mono"
							/>
						</div>
					:	null}
				</div>
			:	null}
			<div className="flex flex-wrap gap-2">
				<Button type="button" onClick={() => void run()} disabled={busy}>
					{busy ? "Running…" : writableRun && writeEnabled ? "Run (writable)" : "Run (read-only)"}
				</Button>
				<p className="text-xs text-muted-foreground">
					Read path: SELECT / WITH / EXPLAIN, max {1000} rows, plan cost gate (
					<code>ADMIN_SQL_MAX_PLAN_COST</code>). Writable path requires{" "}
					<code className="text-foreground">ADMIN_SQL_WRITE_ENABLED</code>,{" "}
					<code className="text-foreground">ADMIN_SQL_WRITE_ALLOWLIST_TABLES</code>, and TOTP when{" "}
					<code className="text-foreground">ADMIN_TOTP_SECRET</code> is set.
				</p>
			</div>
			{error ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
			{result ? (
				// D25: keep the result region keyboard-focusable so screen readers
				// can land on it (Pre with tabindex=0 becomes a focusable scroll
				// region). The aria-label lets AT announce what the pre contains
				// without forcing the user to read every JSON line.
				<pre
					tabIndex={0}
					role="region"
					aria-label="SQL query result"
					className="max-h-[360px] overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs focus-visible:outline-2 focus-visible:outline-ring"
				>
					{JSON.stringify(result, null, 2)}
				</pre>
			) : null}
		</div>
	);
}

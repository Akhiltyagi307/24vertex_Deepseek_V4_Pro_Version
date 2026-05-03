"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function createLoginAbort(timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
	if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
		return { signal: AbortSignal.timeout(timeoutMs), dispose: () => {} };
	}
	const ctrl = new AbortController();
	const id = setTimeout(() => {
		ctrl.abort(new DOMException("The operation was aborted.", "TimeoutError"));
	}, timeoutMs);
	return {
		signal: ctrl.signal,
		dispose: () => clearTimeout(id),
	};
}

function isTimeoutError(err: unknown): boolean {
	return (
		(err instanceof DOMException && err.name === "TimeoutError") ||
		(err instanceof Error && err.name === "TimeoutError")
	);
}

function isLikelyNetworkFailure(err: unknown): boolean {
	if (!(err instanceof TypeError)) return false;
	const m = err.message;
	return m === "Failed to fetch" || m === "Load failed" || m.toLowerCase().includes("network");
}

export function AdminLoginForm() {
	const searchParams = useSearchParams();
	const nextPath = searchParams.get("next") ?? "/admin/dashboard";
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [totp, setTotp] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setPending(true);
		const { signal, dispose } = createLoginAbort(30_000);
		try {
			const res = await fetch("/api/admin/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: email.trim(),
					password,
					totp: totp.trim() || undefined,
				}),
				credentials: "same-origin",
				signal,
			});
			if (!res.ok) {
				const text = await res.text();
				let msg: string | undefined;
				try {
					const j = JSON.parse(text) as { error?: string; message?: string; code?: string };
					msg = typeof j.error === "string" ? j.error : typeof j.message === "string" ? j.message : undefined;
					if (!msg && typeof j.code === "string") {
						msg = `Sign-in rejected (${j.code}).`;
					}
				} catch {
					const snippet = text.replace(/\s+/g, " ").trim().slice(0, 200);
					msg =
						snippet && !snippet.startsWith("<") ?
							snippet
						:	`Server returned HTTP ${res.status} (non-JSON). Open DevTools → Network → the login request and inspect the response.`;
				}
				setError(msg ?? `Sign-in failed (HTTP ${res.status}).`);
				return;
			}
			const dest = nextPath.startsWith("/admin") ? nextPath : "/admin/dashboard";
			// Full navigation so `Set-Cookie` is applied before the next request (avoids soft-nav / RSC edge cases).
			window.location.assign(dest);
		} catch (err) {
			if (process.env.NODE_ENV === "development") {
				console.error("[admin login]", err);
			}
			if (isTimeoutError(err)) {
				setError(
					"Sign-in timed out. Check your network and database (Supabase pooler URL), then try again.",
				);
			} else if (isLikelyNetworkFailure(err)) {
				setError(
					"Could not reach the server. Confirm this site’s URL matches where the app is deployed, the dev server is running, and nothing (VPN, firewall, ad blocker) is blocking the request.",
				);
			} else if (process.env.NODE_ENV === "development" && err instanceof Error) {
				setError(`Sign-in failed: ${err.message}`);
			} else {
				setError("Sign-in failed unexpectedly. Please try again.");
			}
		} finally {
			dispose();
			setPending(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="mx-auto w-full max-w-sm space-y-4">
			<div className="space-y-2">
				<Label htmlFor="admin-email">Email</Label>
				<Input
					id="admin-email"
					name="email"
					type="email"
					autoComplete="username"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="admin-password">Password</Label>
				<Input
					id="admin-password"
					name="password"
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="admin-totp">Authenticator code (if enabled)</Label>
				<Input
					id="admin-totp"
					name="totp"
					inputMode="numeric"
					autoComplete="one-time-code"
					value={totp}
					onChange={(e) => setTotp(e.target.value)}
					placeholder="Optional"
				/>
			</div>
			{error ? <p className="text-sm text-destructive">{error}</p> : null}
			<Button type="submit" className="w-full" disabled={pending}>
				{pending ? "Signing in…" : "Sign in"}
			</Button>
		</form>
	);
}

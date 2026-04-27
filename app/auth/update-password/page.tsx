"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const duration = reduceMotion ? 0 : 0.24;
	const y = reduceMotion ? 0 : 8;

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		const supabase = createClient();
		const { error: updateError } = await supabase.auth.updateUser({ password });
		if (updateError) {
			setError(updateError.message);
			return;
		}
		setDone(true);
		router.push("/login");
		router.refresh();
	}

	return (
		<div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
			<motion.div
				className="space-y-6"
				initial={reduceMotion ? false : { opacity: 0, y }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration, ease: [0.25, 0.1, 0.25, 1] }}
			>
				<div>
					<h1 className="text-xl font-semibold">Set a new password</h1>
					<p className="mt-1 text-sm text-zinc-600">Use the link from your email to reach this page.</p>
				</div>
				{done ? (
					<p className="text-sm text-green-800">Password updated. Redirecting to log in…</p>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label htmlFor="password" className="block text-sm font-medium">
								New password
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
								className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
							/>
						</div>
						<div>
							<label htmlFor="confirm" className="block text-sm font-medium">
								Confirm password
							</label>
							<input
								id="confirm"
								type="password"
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
								required
								minLength={8}
								autoComplete="new-password"
								className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
							/>
						</div>
						{error ? <p className="text-sm text-red-600">{error}</p> : null}
						<button
							type="submit"
							className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800"
						>
							Update password
						</button>
					</form>
				)}
				<p className="text-center text-sm">
					<Link href="/login" className="underline">
						Back to log in
					</Link>
				</p>
			</motion.div>
		</div>
	);
}

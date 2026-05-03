"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** Smoke-test Supabase Realtime on `public.tests` (Phase 3 live sessions precursor). */
export function AdminRealtimeSmoke() {
	const [status, setStatus] = useState<string>("idle");

	useEffect(() => {
		const supabase = createClient();
		const channel = supabase
			.channel("admin-smoke-tests")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "tests" },
				() => {
					/* no-op: presence of handler validates wiring */
				},
			)
			.subscribe((s) => setStatus(s));
		return () => {
			void supabase.removeChannel(channel);
		};
	}, []);

	return (
		<p className="text-xs text-muted-foreground">
			Realtime (tests): <span className="font-mono">{status}</span>
		</p>
	);
}

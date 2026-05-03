"use client";

import * as React from "react";

import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

export type TestRowRealtimeFields = {
	timeLimitSeconds: number;
	isPaused: boolean;
	accumulatedPauseSeconds: number;
	startedAtIso: string | null;
	updatedAtIso?: string | null;
};

const defaultFields: TestRowRealtimeFields = {
	timeLimitSeconds: 3600,
	isPaused: false,
	accumulatedPauseSeconds: 0,
	startedAtIso: null,
};

/**
 * Hybrid Realtime + polling for a single `tests` row (same pattern as grading progress).
 * Keeps student timer aligned with admin extend/pause/resume.
 */
export function useTestRowRealtimePoll(testId: string | undefined, initialTimeLimitSeconds: number) {
	const [fields, setFields] = React.useState<TestRowRealtimeFields>({
		...defaultFields,
		timeLimitSeconds: initialTimeLimitSeconds,
	});
	const lastRealtimeAtRef = React.useRef(0);

	React.useEffect(() => {
		if (!testId) return;
		setFields((f) => ({ ...f, timeLimitSeconds: initialTimeLimitSeconds }));
	}, [testId, initialTimeLimitSeconds]);

	React.useEffect(() => {
		if (!testId) return;
		const supabase = createBrowserSupabase();
		let cancelled = false;

		const applyRow = (row: Record<string, unknown> | null | undefined) => {
			if (!row || cancelled) return;
			const tls = row.time_limit_seconds;
			const lim = typeof tls === "number" ? tls : Number(tls ?? 0) || initialTimeLimitSeconds;
			const paused = Boolean(row.is_paused);
			const acc = row.accumulated_pause_seconds;
			const accNum = typeof acc === "number" ? acc : Number(acc ?? 0) || 0;
			const started = (row.started_at as string | null | undefined) ?? null;
			const updatedAt = (row.updated_at as string | null | undefined) ?? null;
			setFields({
				timeLimitSeconds: lim,
				isPaused: paused,
				accumulatedPauseSeconds: accNum,
				startedAtIso: started,
				updatedAtIso: updatedAt,
			});
		};

		const pollOnce = async (opts?: { skipIfRecentRealtime?: boolean }) => {
			if (cancelled) return;
			if (opts?.skipIfRecentRealtime) {
				const sinceRt = Date.now() - lastRealtimeAtRef.current;
				if (sinceRt < 3000 && lastRealtimeAtRef.current > 0) return;
			}
			const { data } = await supabase
				.from("tests")
				.select("time_limit_seconds, is_paused, accumulated_pause_seconds, started_at, updated_at")
				.eq("id", testId)
				.maybeSingle();
			applyRow(data as Record<string, unknown> | null);
		};

		const channel = supabase
			.channel(`practice-test-row-${testId}`)
			.on(
				"postgres_changes",
				{ event: "UPDATE", schema: "public", table: "tests", filter: `id=eq.${testId}` },
				(payload) => {
					if (cancelled) return;
					lastRealtimeAtRef.current = Date.now();
					applyRow(payload.new as Record<string, unknown>);
				},
			)
			.subscribe();

		void pollOnce();
		const pollId = window.setInterval(() => void pollOnce({ skipIfRecentRealtime: true }), 4000);

		return () => {
			cancelled = true;
			window.clearInterval(pollId);
			void supabase.removeChannel(channel);
		};
	}, [testId, initialTimeLimitSeconds]);

	return fields;
}

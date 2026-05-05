"use client";

import { useEffect } from "react";

import { createClient as createBrowserSupabase } from "@/lib/supabase/client";

type Options = {
	testId: string;
	/** Called with each new message body inserted by an admin. */
	onMessage: (body: string) => void;
};

/**
 * Subscribes to `public.admin_test_messages` inserts for the given test and
 * delivers the row body to `onMessage`. The channel is torn down on unmount
 * or when `testId` changes; a `cancelled` flag guards against late callbacks
 * after unmount. Messages without a string body are ignored.
 */
export function useAdminTestMessageChannel({ testId, onMessage }: Options): void {
	useEffect(() => {
		const supabase = createBrowserSupabase();
		let cancelled = false;
		const channel = supabase
			.channel(`admin-test-messages-${testId}`)
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "admin_test_messages", filter: `test_id=eq.${testId}` },
				(payload) => {
					if (cancelled) return;
					const body = (payload.new as { body?: string } | null)?.body;
					if (typeof body === "string") onMessage(body);
				},
			)
			.subscribe();
		return () => {
			cancelled = true;
			void supabase.removeChannel(channel);
		};
	}, [testId, onMessage]);
}

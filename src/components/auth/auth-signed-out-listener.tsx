"use client";

import { useEffect } from "react";

import { AUTH_CHANNEL, AUTH_SIGNED_OUT_MESSAGE } from "@/lib/auth/sign-out";
import { createClient } from "@/lib/supabase/client";

/**
 * Listens for cross-tab sign-out events and redirects to `/login`. Mounted
 * once per authenticated portal layout so a logout in any tab kicks every
 * other tab off too. Two channels for resilience:
 *
 *   1. `supabase.auth.onAuthStateChange("SIGNED_OUT")` — Supabase fires this
 *      via its shared localStorage backing store, so even tabs that never
 *      received the BroadcastChannel message still react.
 *   2. `BroadcastChannel("eduai-auth")` — explicit message from the active
 *      tab's `signOutEverywhere()` covers browsers where storage events get
 *      throttled (e.g. Safari background tabs).
 */
export function AuthSignedOutListener() {
	useEffect(() => {
		const supabase = createClient();
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event) => {
			if (event === "SIGNED_OUT") {
				window.location.href = "/login";
			}
		});

		let bc: BroadcastChannel | null = null;
		if (typeof BroadcastChannel !== "undefined") {
			try {
				bc = new BroadcastChannel(AUTH_CHANNEL);
				bc.onmessage = (ev) => {
					if (ev.data === AUTH_SIGNED_OUT_MESSAGE) {
						window.location.href = "/login";
					}
				};
			} catch {
				// ignore — fallback to onAuthStateChange path
			}
		}

		return () => {
			subscription.unsubscribe();
			bc?.close();
		};
	}, []);

	return null;
}

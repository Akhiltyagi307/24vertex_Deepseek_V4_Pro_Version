"use client";

import { createClient } from "@/lib/supabase/client";

const CHANNEL = "eduai-auth";
const SIGNED_OUT_MESSAGE = "signed-out";

export const AUTH_CHANNEL = CHANNEL;
export const AUTH_SIGNED_OUT_MESSAGE = SIGNED_OUT_MESSAGE;

/**
 * Signs the user out everywhere (Supabase global revoke), notifies other
 * same-origin tabs via BroadcastChannel, and navigates to `/login`. Use this
 * helper from every sign-out button so the contract is consistent across the
 * student, parent, teacher, and auth-flow surfaces.
 */
export async function signOutEverywhere(): Promise<void> {
	const supabase = createClient();
	try {
		await supabase.auth.signOut({ scope: "global" });
	} catch {
		// Supabase has already cleared local storage by this point even if the
		// network call to revoke the refresh token failed. Continue with the
		// local cleanup and redirect so the user always reaches a logged-out UI.
	}
	if (typeof BroadcastChannel !== "undefined") {
		try {
			const ch = new BroadcastChannel(CHANNEL);
			ch.postMessage(SIGNED_OUT_MESSAGE);
			ch.close();
		} catch {
			// Older browsers / restricted contexts (private mode) may throw; the
			// AuthSignedOutListener's onAuthStateChange path still covers most
			// same-browser tabs via Supabase's storage broadcast.
		}
	}
	window.location.href = "/login";
}

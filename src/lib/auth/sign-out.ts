"use client";

import { createClient } from "@/lib/supabase/client";
import { LEGACY_PRODUCT_SLUG, PRODUCT_SLUG } from "@/lib/brand/constants";

const CHANNEL = `${PRODUCT_SLUG}-auth`;
const LEGACY_CHANNEL = `${LEGACY_PRODUCT_SLUG}-auth`;
const SIGNED_OUT_MESSAGE = "signed-out";

export const AUTH_CHANNEL = CHANNEL;
export const AUTH_SIGNED_OUT_MESSAGE = SIGNED_OUT_MESSAGE;

function postSignedOutBroadcast(): void {
	if (typeof BroadcastChannel === "undefined") return;
	for (const name of [CHANNEL, LEGACY_CHANNEL]) {
		try {
			const ch = new BroadcastChannel(name);
			ch.postMessage(SIGNED_OUT_MESSAGE);
			ch.close();
		} catch {
			/* Older browsers / restricted contexts */
		}
	}
}

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
	postSignedOutBroadcast();
	window.location.href = "/login";
}

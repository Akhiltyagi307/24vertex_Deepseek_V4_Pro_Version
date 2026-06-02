import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabasePublishableKey, getSupabaseUrl, isProductionDeployment } from "@/lib/env";

type RequestAuthContext = {
	supabase: SupabaseClient;
	user: User;
};

function decodeBasicAuth(header: string): { email: string; password: string } | null {
	const [scheme, encoded] = header.split(" ");
	if (scheme?.toLowerCase() !== "basic" || !encoded) return null;
	try {
		const decoded = Buffer.from(encoded, "base64").toString("utf8");
		const idx = decoded.indexOf(":");
		if (idx <= 0) return null;
		const email = decoded.slice(0, idx).trim();
		const password = decoded.slice(idx + 1);
		if (!email || !password) return null;
		return { email, password };
	} catch {
		return null;
	}
}

function createBearerClient(accessToken: string): SupabaseClient {
	return createSupabaseClient(getSupabaseUrl(), getSupabasePublishableKey(), {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
		global: {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		},
	});
}

async function tryAuthorizationHeaderAuth(request: Request): Promise<RequestAuthContext | null> {
	const authHeader = request.headers.get("authorization")?.trim();
	if (!authHeader) return null;

	const lower = authHeader.toLowerCase();
	if (lower.startsWith("bearer ")) {
		const token = authHeader.slice("bearer ".length).trim();
		if (!token || token === "<token>") return null;
		const client = createBearerClient(token);
		const {
			data: { user },
		} = await client.auth.getUser();
		return user ? { supabase: client, user } : null;
	}

	if (lower.startsWith("basic ")) {
		const creds = decodeBasicAuth(authHeader);
		if (!creds) return null;
		const signInClient = createSupabaseClient(getSupabaseUrl(), getSupabasePublishableKey(), {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
			},
		});
		const { data, error } = await signInClient.auth.signInWithPassword({
			email: creds.email,
			password: creds.password,
		});
		if (error || !data.session?.access_token) return null;
		const client = createBearerClient(data.session.access_token);
		const {
			data: { user },
		} = await client.auth.getUser();
		return user ? { supabase: client, user } : null;
	}

	return null;
}

/**
 * Resolves the authenticated API user from the cookie session first, then from
 * an `Authorization` (Bearer / Basic) header — but the header path is for local
 * + CI test tooling ONLY (see the guards below).
 *
 * IMPORTANT: this returns IDENTITY ONLY — it performs NO role/authorization
 * check. "Got a user" does not mean "allowed to do this." Callers MUST apply the
 * appropriate role guard (requireVerifiedStudent / requireParent / requireAdminApi
 * / ownership check) before acting. (Review findings M11 + H5.)
 */
export async function getApiRequestUser(request: Request): Promise<RequestAuthContext | null> {
	const cookieClient = await createServerSupabaseClient();
	const {
		data: { user },
	} = await cookieClient.auth.getUser();
	if (user) return { supabase: cookieClient, user };

	if (isProductionDeployment()) return null;
	// Defense-in-depth (M11): isProductionDeployment() is FALSE on Vercel preview
	// deployments (VERCEL_ENV='preview'), which can be publicly reachable — so a
	// preview with ALLOW_API_HEADER_AUTH set would expose a password-grant
	// endpoint. Refuse header auth on ANY Vercel deployment; it then works only
	// off Vercel (local/CI), independent of how ALLOW_API_HEADER_AUTH is set.
	if (process.env.VERCEL === "1") return null;
	if (process.env.ALLOW_API_HEADER_AUTH?.trim().toLowerCase() !== "true") return null;
	return tryAuthorizationHeaderAuth(request);
}

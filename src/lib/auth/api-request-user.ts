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
 * Resolves authenticated API user from cookie session first, then from
 * `Authorization` (Bearer / Basic) only when `ALLOW_API_HEADER_AUTH=true` and
 * not a production deployment — for automated tests and local tooling only.
 */
export async function getApiRequestUser(request: Request): Promise<RequestAuthContext | null> {
	const cookieClient = await createServerSupabaseClient();
	const {
		data: { user },
	} = await cookieClient.auth.getUser();
	if (user) return { supabase: cookieClient, user };

	if (isProductionDeployment()) return null;
	if (process.env.ALLOW_API_HEADER_AUTH?.trim().toLowerCase() !== "true") return null;
	return tryAuthorizationHeaderAuth(request);
}

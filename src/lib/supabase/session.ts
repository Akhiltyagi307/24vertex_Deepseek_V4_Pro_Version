import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";

function buildDownstreamHeaders(
	request: NextRequest,
	extra: Record<string, string>,
): Headers {
	const h = new Headers(request.headers);
	for (const [k, v] of Object.entries(extra)) {
		h.set(k, v);
	}
	return h;
}

export async function updateSession(
	request: NextRequest,
	options?: { extraRequestHeaders?: Record<string, string> },
) {
	const extra = options?.extraRequestHeaders ?? {};
	let supabaseResponse = NextResponse.next({
		request: { headers: buildDownstreamHeaders(request, extra) },
	});

	const supabase = createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet, headers) {
				for (const { name, value } of cookiesToSet) {
					request.cookies.set(name, value);
				}
				supabaseResponse = NextResponse.next({
					request: { headers: buildDownstreamHeaders(request, extra) },
				});
				for (const { name, value, options } of cookiesToSet) {
					supabaseResponse.cookies.set(name, value, options);
				}
				if (headers) {
					for (const [key, value] of Object.entries(headers)) {
						supabaseResponse.headers.set(key, value);
					}
				}
			},
		},
	});

	await supabase.auth.getUser();

	return supabaseResponse;
}

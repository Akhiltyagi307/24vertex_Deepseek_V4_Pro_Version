import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
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
					request,
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

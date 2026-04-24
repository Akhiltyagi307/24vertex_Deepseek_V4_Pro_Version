import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * One `getUser()` per RSC request. In the App Router, a route layout and its page
 * can render in parallel; two concurrent `supabase.auth.getUser()` calls can race
 * Supabase’s single-use refresh flow and one may observe no user, which (with our
 * guards) incorrectly sends people to /login. React `cache` dedupes the call.
 */
export const getServerUser = cache(async (): Promise<User | null> => {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user ?? null;
});

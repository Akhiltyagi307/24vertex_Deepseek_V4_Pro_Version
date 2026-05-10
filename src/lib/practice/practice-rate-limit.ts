import { formatTimeShortInAppTimeZone } from "@/lib/datetime/app-timezone";
import { createClient } from "@/lib/supabase/server";
import { rlConsume } from "@/lib/ratelimit";

export const PRACTICE_GENERATE_RATE_LIMIT_N = 10;
export const PRACTICE_GENERATE_RATE_LIMIT_WINDOW_SECONDS = 3600;

export const STUDY_TIPS_RATE_LIMIT_N = 20;
export const STUDY_TIPS_RATE_LIMIT_WINDOW_SECONDS = 3600;

/** Adaptive follow-up LLM calls (per student, rolling window). */
export const ADAPTIVE_FOLLOWUPS_RATE_LIMIT_N = 20;
export const ADAPTIVE_FOLLOWUPS_RATE_LIMIT_WINDOW_SECONDS = 3600;

export const DOUBT_CHAT_RATE_LIMIT_N = 40;
export const DOUBT_CHAT_RATE_LIMIT_WINDOW_SECONDS = 3600;

/**
 * Read-side bucket for cheap doubt-chat queries (entitlement summary, usage
 * summary). Separate from the write bucket so a per-turn refresh doesn't eat
 * the user's chat-send budget. Generous because these calls are bounded by
 * the UI's natural cadence (one tick per `useChat` onFinish).
 */
export const DOUBT_CHAT_READ_RATE_LIMIT_N = 240;
export const DOUBT_CHAT_READ_RATE_LIMIT_WINDOW_SECONDS = 3600;

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

function rateLimitFailClosed(): boolean {
	return (
		process.env.VERCEL_ENV === "preview" ||
		process.env.VERCEL_ENV === "production" ||
		process.env.NODE_ENV === "production"
	);
}

const RPC_ERROR_USER_MESSAGE = "Could not verify limits. Try again shortly.";

/**
 * Shared rate-limit wrapper. Calls the auth-agnostic public.rl_consume() via
 * the dedicated rate-limit DB pool, using the authenticated student's ID as
 * part of the bucket key. The route handler is expected to have already
 * verified auth (typically via supabase.auth.getUser()) before reaching here.
 *
 * Fail-policy: when the rate-limit DB has been failing recently the consumer's
 * circuit breaker trips open and returns `degraded: "circuit_open"`. For these
 * cost-sensitive paths (AI generations, doubt chat) we fail closed in prod so
 * limits cannot be bypassed during infra issues; in dev we fail open so local
 * work is unaffected. This preserves the policy of the previous RPC wrapper.
 */
export async function consumePracticeRateLimit(
	supabase: ServerSupabase,
	params: {
		bucket: string;
		limitN: number;
		windowSeconds: number;
		limitExceededMessage: (resetAt: string | null) => string;
	},
): Promise<{ ok: true } | { ok: false; message: string; resetAt: string | null }> {
	const { data: sessionData } = await supabase.auth.getSession();
	const userId = sessionData?.session?.user?.id;
	if (!userId) {
		return { ok: false, message: "Not authenticated.", resetAt: null };
	}

	const result = await rlConsume({
		key: `practice:${params.bucket}:user:${userId}`,
		limit: params.limitN,
		windowSec: params.windowSeconds,
	});

	if (result.degraded === "circuit_open" && rateLimitFailClosed()) {
		return { ok: false, message: RPC_ERROR_USER_MESSAGE, resetAt: null };
	}

	if (result.allowed) {
		return { ok: true };
	}

	const resetIso = result.resetAt.toISOString();
	return {
		ok: false,
		message: params.limitExceededMessage(resetIso),
		resetAt: resetIso,
	};
}

export async function consumeGenerationRateLimit(
	supabase: ServerSupabase,
): Promise<{ ok: true } | { ok: false; message: string; resetAt: string | null }> {
	return consumePracticeRateLimit(supabase, {
		bucket: "generate",
		limitN: PRACTICE_GENERATE_RATE_LIMIT_N,
		windowSeconds: PRACTICE_GENERATE_RATE_LIMIT_WINDOW_SECONDS,
		limitExceededMessage: (reset) => {
			const resetHint = reset ? ` Try again after ${formatTimeShortInAppTimeZone(reset)}.` : "";
			return `You have generated too many practice tests in the last hour.${resetHint}`;
		},
	});
}

export async function consumeStudyTipsRateLimit(
	supabase: ServerSupabase,
): Promise<{ ok: true } | { ok: false; message: string; resetAt: string | null }> {
	return consumePracticeRateLimit(supabase, {
		bucket: "study_tips",
		limitN: STUDY_TIPS_RATE_LIMIT_N,
		windowSeconds: STUDY_TIPS_RATE_LIMIT_WINDOW_SECONDS,
		limitExceededMessage: (reset) => {
			const resetHint = reset ? ` Try again after ${formatTimeShortInAppTimeZone(reset)}.` : "";
			return `You have requested too many study tips recently.${resetHint}`;
		},
	});
}

export async function consumeAdaptiveFollowupsRateLimit(
	supabase: ServerSupabase,
): Promise<{ ok: true } | { ok: false; message: string; resetAt: string | null }> {
	return consumePracticeRateLimit(supabase, {
		bucket: "adaptive_followups",
		limitN: ADAPTIVE_FOLLOWUPS_RATE_LIMIT_N,
		windowSeconds: ADAPTIVE_FOLLOWUPS_RATE_LIMIT_WINDOW_SECONDS,
		limitExceededMessage: (reset) => {
			const resetHint = reset ? ` Try again after ${formatTimeShortInAppTimeZone(reset)}.` : "";
			return `You have requested too many follow-up questions recently.${resetHint}`;
		},
	});
}

export async function consumeDoubtChatRateLimit(
	supabase: ServerSupabase,
): Promise<{ ok: true } | { ok: false; message: string; resetAt: string | null }> {
	return consumePracticeRateLimit(supabase, {
		bucket: "doubt_chat",
		limitN: DOUBT_CHAT_RATE_LIMIT_N,
		windowSeconds: DOUBT_CHAT_RATE_LIMIT_WINDOW_SECONDS,
		limitExceededMessage: (reset) => {
			const resetHint = reset ? ` Try again after ${formatTimeShortInAppTimeZone(reset)}.` : "";
			return `You have used the doubt chat assistant too many times in the last hour.${resetHint}`;
		},
	});
}

export async function consumeDoubtChatReadRateLimit(
	supabase: ServerSupabase,
): Promise<{ ok: true } | { ok: false; message: string; resetAt: string | null }> {
	return consumePracticeRateLimit(supabase, {
		bucket: "doubt_chat_reads",
		limitN: DOUBT_CHAT_READ_RATE_LIMIT_N,
		windowSeconds: DOUBT_CHAT_READ_RATE_LIMIT_WINDOW_SECONDS,
		limitExceededMessage: (reset) => {
			const resetHint = reset ? ` Try again after ${formatTimeShortInAppTimeZone(reset)}.` : "";
			return `Too many doubt chat status refreshes recently.${resetHint}`;
		},
	});
}

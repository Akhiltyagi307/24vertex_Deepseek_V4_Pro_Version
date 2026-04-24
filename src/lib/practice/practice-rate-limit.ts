import { createClient } from "@/lib/supabase/server";
import { logSupabaseError } from "@/lib/server/log-supabase-error";

export const PRACTICE_GENERATE_RATE_LIMIT_N = 10;
export const PRACTICE_GENERATE_RATE_LIMIT_WINDOW_SECONDS = 3600;

export const STUDY_TIPS_RATE_LIMIT_N = 20;
export const STUDY_TIPS_RATE_LIMIT_WINDOW_SECONDS = 3600;

/** Adaptive follow-up LLM calls (per student, rolling window). */
export const ADAPTIVE_FOLLOWUPS_RATE_LIMIT_N = 20;
export const ADAPTIVE_FOLLOWUPS_RATE_LIMIT_WINDOW_SECONDS = 3600;

export const DOUBT_CHAT_RATE_LIMIT_N = 40;
export const DOUBT_CHAT_RATE_LIMIT_WINDOW_SECONDS = 3600;

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

type RateLimitRow = {
	allowed: boolean;
	remaining: number;
	reset_at: string | null;
};

function rateLimitRpcFailClosed(): boolean {
	return (
		process.env.VERCEL_ENV === "production" ||
		process.env.NODE_ENV === "production"
	);
}

const RPC_ERROR_USER_MESSAGE = "Could not verify limits. Try again shortly.";

/**
 * Shared `practice_rate_limit_consume` wrapper. In production, RPC errors fail closed
 * so limits cannot be bypassed when the database is misbehaving.
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
	const { data, error } = await supabase.rpc("practice_rate_limit_consume", {
		p_bucket: params.bucket,
		p_limit_n: params.limitN,
		p_window_seconds: params.windowSeconds,
	});

	if (error) {
		logSupabaseError("consumePracticeRateLimit.practice_rate_limit_consume", error, {
			bucket: params.bucket,
		});
		if (rateLimitRpcFailClosed()) {
			return { ok: false, message: RPC_ERROR_USER_MESSAGE, resetAt: null };
		}
		return { ok: true };
	}

	const rows = (data ?? []) as RateLimitRow[];
	const row = rows[0];
	if (!row || row.allowed) {
		return { ok: true };
	}
	const reset = row.reset_at;
	return {
		ok: false,
		message: params.limitExceededMessage(reset),
		resetAt: reset,
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
			const resetHint = reset ? ` Try again after ${new Date(reset).toLocaleTimeString()}.` : "";
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
			const resetHint = reset ? ` Try again after ${new Date(reset).toLocaleTimeString()}.` : "";
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
			const resetHint = reset ? ` Try again after ${new Date(reset).toLocaleTimeString()}.` : "";
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
			const resetHint = reset ? ` Try again after ${new Date(reset).toLocaleTimeString()}.` : "";
			return `You have used the doubt chat assistant too many times in the last hour.${resetHint}`;
		},
	});
}

import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contentBlacklist } from "@/db/schema/content-blacklist";
import { insertHeuristicModerationFlag } from "@/lib/ai/moderation";
import {
	getDoubtImageReviewSampleRate,
	isDoubtPiiRedactionEnabled,
	isDoubtSafetyModerationEnabled,
} from "@/lib/env";
import {
	highestSeverity,
	screenInput,
	screenOutput,
	type CompiledBlacklistRule,
	type InputScreenResult,
	type OutputScreenResult,
	type SafetyCategory,
} from "@/lib/doubt/safety-detectors";

/**
 * Server-only orchestration for the deterministic doubt-chat safety screen.
 *
 * This is the I/O layer around the pure detectors in `safety-detectors.ts`:
 * it loads the admin-managed content blacklist, reads the feature flags, runs
 * the pure screens, and writes moderation flags for human review. No LLM is
 * involved at any point — these are heuristic backstops that run alongside the
 * model, never a second judge model.
 *
 * Reliability stance: the screen FAILS OPEN. A bug or a transient DB error must
 * never block a student mid-lesson, so every entry point swallows errors and
 * returns the permissive default. The model's own system-prompt safety rules
 * remain the primary live control; this layer adds deterministic catch + audit.
 */

const DOUBT_BLACKLIST_SCOPE = "doubt_chat";

/** Entity types used on `moderation_flags` rows so the admin queue can filter. */
const ENTITY_CONVERSATION = "doubt_conversation";
const ENTITY_ATTACHMENT = "doubt_attachment";

/**
 * Short in-process cache for the compiled blacklist. The input + output screens
 * each need the rules once per turn (two reads), and the common case is zero
 * configured rows — so a 30s TTL keeps this off the per-turn DB path while still
 * letting an admin's new rule propagate within half a minute. Cleared per
 * process instance only; that's fine for a non-time-critical moderation list.
 */
let blacklistCache: { exp: number; rules: CompiledBlacklistRule[] } | null = null;
const BLACKLIST_TTL_MS = 30_000;

/** Test-only: drop the in-process blacklist cache. */
export function __resetDoubtBlacklistCacheForTests(): void {
	blacklistCache = null;
}

/**
 * Load and compile the admin regex blacklist scoped to doubt chat. Mirrors the
 * generation-side loader but reads the `doubt_chat` scope so doubt rules and
 * question-generator rules stay independent. Returns [] on any error (fail-open)
 * or when no rules are configured (the common case). Cached for {@link BLACKLIST_TTL_MS}.
 */
export async function loadDoubtContentBlacklist(): Promise<CompiledBlacklistRule[]> {
	const now = Date.now();
	if (blacklistCache && blacklistCache.exp > now) {
		return blacklistCache.rules;
	}
	try {
		const rows = await db
			.select()
			.from(contentBlacklist)
			.where(eq(contentBlacklist.appliesTo, DOUBT_BLACKLIST_SCOPE));
		const compiled: CompiledBlacklistRule[] = [];
		for (const row of rows) {
			if (row.patternType !== "regex") continue;
			try {
				compiled.push({ id: row.id, re: new RegExp(row.pattern, "i") });
			} catch {
				/* invalid regex stored — skip it rather than crash the screen */
			}
		}
		blacklistCache = { exp: now + BLACKLIST_TTL_MS, rules: compiled };
		return compiled;
	} catch {
		return [];
	}
}

/**
 * Screen a student's turn. Loads the blacklist + reads the redaction flag, then
 * runs the pure {@link screenInput}. Fail-open: on any error returns a clean,
 * non-blocking verdict so the turn proceeds.
 */
export async function screenDoubtInput(text: string): Promise<InputScreenResult> {
	if (!isDoubtSafetyModerationEnabled()) {
		return {
			block: false,
			blockMessage: null,
			redactedText: text,
			categories: [],
			distress: false,
			pii: false,
		};
	}
	try {
		const blacklist = await loadDoubtContentBlacklist();
		return screenInput(text, {
			blacklist,
			redactPiiAtRest: isDoubtPiiRedactionEnabled(),
		});
	} catch {
		return {
			block: false,
			blockMessage: null,
			redactedText: text,
			categories: [],
			distress: false,
			pii: false,
		};
	}
}

/**
 * Screen the tutor's own output. Fail-open: on error returns `{ safe: true }`
 * so a screening fault never swallows a legitimate answer.
 */
export async function screenDoubtOutput(text: string): Promise<OutputScreenResult> {
	if (!isDoubtSafetyModerationEnabled()) {
		return { safe: true, categories: [] };
	}
	try {
		const blacklist = await loadDoubtContentBlacklist();
		return screenOutput(text, blacklist);
	} catch {
		return { safe: true, categories: [] };
	}
}

/**
 * Raise a moderation flag against a doubt conversation for human review.
 * Fail-silent (never throws into the request path). When multiple categories
 * are present the row carries the highest severity and a joined source list so
 * one row summarises the turn.
 */
export async function flagDoubtSafety(input: {
	conversationId: string;
	categories: SafetyCategory[];
}): Promise<void> {
	const { conversationId, categories } = input;
	if (categories.length === 0) return;
	try {
		await insertHeuristicModerationFlag({
			entityType: ENTITY_CONVERSATION,
			entityId: conversationId,
			source: categories.map((c) => c.source).join(","),
			reason: categories.map((c) => c.reason).join("; "),
			severity: highestSeverity(categories),
		});
	} catch {
		/* fail-silent — flagging must never break the chat */
	}
}

/** Flag an attachment whose extracted text contained a prompt-injection attempt. */
export async function flagDoubtAttachmentInjection(input: {
	attachmentId: string;
}): Promise<void> {
	try {
		await insertHeuristicModerationFlag({
			entityType: ENTITY_ATTACHMENT,
			entityId: input.attachmentId,
			source: "heuristic_injection",
			reason: "attachment text contained a prompt-injection pattern",
			severity: "medium",
		});
	} catch {
		/* fail-silent */
	}
}

/**
 * Decide whether this image turn should be sampled into the review queue.
 * Deterministic per-call coin flip at the configured rate; 0 (default) disables
 * sampling entirely.
 */
export function shouldSampleImageForReview(): boolean {
	const rate = getDoubtImageReviewSampleRate();
	if (rate <= 0) return false;
	if (rate >= 1) return true;
	return Math.random() < rate;
}

/** Flag a sampled image turn for human spot-review. Fail-silent. */
export async function flagDoubtImageForReview(input: {
	conversationId: string;
}): Promise<void> {
	try {
		await insertHeuristicModerationFlag({
			entityType: ENTITY_CONVERSATION,
			entityId: input.conversationId,
			source: "image_sample_review",
			reason: "sampled image-attachment turn for spot review",
			severity: "low",
		});
	} catch {
		/* fail-silent */
	}
}

export { ensureDoubtSafetyFloor } from "@/lib/doubt/safety-detectors";

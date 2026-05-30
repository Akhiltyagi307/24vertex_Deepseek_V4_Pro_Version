/**
 * Doubt-chat turn guardrails — cheap pre-LLM checks (behind `DOUBT_SCOPE_PRECHECK`).
 *
 * Order of evaluation:
 *   1. Meta tutor guidance (how to use modes, ask better questions) → always allow
 *   2. Low-value chatter (jokes, roleplay, unrelated socialising) → block when confident
 *   3. Off-topic vocabulary overlap (see `scope-precheck.ts`) → block when confident
 *
 * Short turns and attachment turns are handled by the route (attachments skip
 * the whole block; scope-precheck skips short turns).
 */

import {
	buildScopeVocab,
	OFF_TOPIC_USER_MESSAGE,
	userTurnLikelyOutOfScope,
	type ScopePrecheckVerdict,
} from "@/lib/doubt/scope-precheck";

export { buildScopeVocab, OFF_TOPIC_USER_MESSAGE };

/** Student-facing copy when we block obvious non-learning chatter. */
export const LOW_VALUE_CHATTER_USER_MESSAGE =
	"This doubt chat is for learning the topic you opened — not general chatting. " +
	"If you want tips on how to use the tutor better (modes, attachments, how to ask), just ask that directly. " +
	"Otherwise, ask something about this chapter and I'll help.";

const MIN_CHARS_FOR_CHATTER_BLOCK = 28;

/**
 * Questions about how to use 24Vertex doubt chat effectively. These may have
 * zero overlap with NCERT vocabulary but must never be blocked.
 */
const META_TUTOR_GUIDANCE_RE = [
	/\bhow (do|should|can) i (use|ask|phrase|get)\b/i,
	/\bhow (does|do) (this|the) (doubt )?(chat|tutor)\b/i,
	/\b(which|what) mode\b/i,
	/\b(explain mode|solve[- ]with[- ]me|quiz me)\b/i,
	/\b(tips?|advice) (for|on) (asking|using|getting)\b/i,
	/\b(get|give) (me )?better answers\b/i,
	/\bhow (to|can i) (attach|upload|send) (a |my )?(photo|image|picture|pdf|screenshot)\b/i,
	/\bwhat (should|can) i (ask|type|write)\b/i,
	/\buse (you|ai|this) (better|effectively|properly)\b/i,
	/\b24vertex\b/i,
];

/** High-confidence patterns for turns that waste quota without learning intent. */
const LOW_VALUE_CHATTER_RE = [
	/\b(tell me|say|share)( a)? (funny )?joke\b/i,
	/\b(let'?s|want to) (just )?(chat|talk)( about)? (random|anything|whatever)\b/i,
	/\b(play|playing) (a )?(game|trivia|would you rather)\b/i,
	/\b(date me|marry me|love you|be my (boy|girl)friend)\b/i,
	/\b(pretend|act) (you are|you're|to be) (my |a )?(friend|boyfriend|girlfriend|crush)\b/i,
	/\bignore (your|the) (instructions|rules|system prompt)\b/i,
	/\b(roleplay|rp) as\b/i,
	/\b(do|write|complete) (my|the) (whole |entire )?(homework|assignment|project)( for me| instead)?\b/i,
	/\bjust (give|tell) me the answer\b/i,
	/\bnothing to do with (stud(y|ies)|school|this topic|the lesson)\b/i,
];

export type DoubtTurnGuardrailVerdict =
	| { ok: true }
	| ({ ok: false } & (
			| { code: "off_topic_no_vocab_overlap"; userTokens: number; vocabSize: number }
			| { code: "low_value_chatter" }
	  ));

export function isMetaTutorGuidanceTurn(userText: string): boolean {
	const t = userText.trim();
	if (t.length < 12) return false;
	return META_TUTOR_GUIDANCE_RE.some((re) => re.test(t));
}

export function isLowValueChatterTurn(userText: string): boolean {
	const t = userText.trim();
	if (t.length < MIN_CHARS_FOR_CHATTER_BLOCK) return false;
	return LOW_VALUE_CHATTER_RE.some((re) => re.test(t));
}

/**
 * Classify the latest user turn before calling the LLM. Errs on allowing
 * ambiguous turns through — the system prompt handles soft redirects.
 */
export function classifyDoubtUserTurn(
	userText: string,
	vocab: Set<string>,
): DoubtTurnGuardrailVerdict {
	if (isMetaTutorGuidanceTurn(userText)) return { ok: true };
	if (isLowValueChatterTurn(userText)) return { ok: false, code: "low_value_chatter" };
	const scopeVerdict: ScopePrecheckVerdict = userTurnLikelyOutOfScope(userText, vocab);
	if (!scopeVerdict.ok) return scopeVerdict;
	return { ok: true };
}

export function userMessageForGuardrailBlock(
	code: "off_topic_no_vocab_overlap" | "low_value_chatter",
): string {
	return code === "low_value_chatter" ? LOW_VALUE_CHATTER_USER_MESSAGE : OFF_TOPIC_USER_MESSAGE;
}

export function apiCodeForGuardrailBlock(
	code: "off_topic_no_vocab_overlap" | "low_value_chatter",
): "off_topic" | "low_value_chatter" {
	return code === "low_value_chatter" ? "low_value_chatter" : "off_topic";
}

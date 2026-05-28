/**
 * Cheap vocabulary-overlap pre-check for doubt-chat off-topic detection.
 *
 * Premise: a topic-scoped chat carries `topic_context_chunks` content — a
 * compact summary of the NCERT material for this topic. A genuinely on-topic
 * question will share at least one content word with that vocabulary. A
 * question about an unrelated subject (e.g. asking about quadratic equations
 * inside a Photosynthesis chat) typically won't.
 *
 * This is intentionally low-resolution: false positives (real on-topic
 * questions with no vocab overlap, e.g. one-liner clarifications like "what
 * does that mean") are avoided by skipping the check for very short turns.
 * False negatives (off-topic questions that happen to share a stopword-like
 * word with scope vocabulary) are acceptable — we still hand them to the LLM,
 * which is instructed to redirect off-topic queries.
 *
 * The check is wrapped behind a feature flag (`DOUBT_SCOPE_PRECHECK`) so we
 * can A/B the false-positive rate before turning it on broadly.
 */

const STOPWORDS = new Set<string>([
	// articles / pronouns / prepositions / common helpers — generic, not subject-specific.
	"a", "an", "the", "and", "or", "but", "if", "then", "so", "to", "of", "in",
	"on", "at", "by", "for", "with", "from", "as", "is", "was", "be", "are",
	"were", "been", "being", "am", "do", "does", "did", "have", "has", "had",
	"i", "me", "my", "you", "your", "we", "us", "he", "she", "it", "they", "them",
	"this", "that", "these", "those", "what", "which", "who", "whom", "whose",
	"when", "where", "why", "how", "can", "could", "should", "would", "shall",
	"will", "may", "might", "must", "not", "no", "yes", "please", "thanks",
	"thank", "hi", "hello", "hey", "ok", "okay", "sure", "right", "wrong",
	"some", "any", "all", "each", "every", "few", "many", "most", "more", "less",
	"about", "also", "just", "very", "much", "such", "too", "than", "into",
	"like", "want", "need", "know", "tell", "show", "give", "make", "made",
	"get", "got", "go", "going", "explain", "help", "solve", "answer",
	// numbers + filler — keep these out so "answer 5 questions" doesn't false-match on "5".
	"one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
]);

const TOKEN_RE = /[a-z][a-z0-9]+/g;

/**
 * Tokenize a string into lowercase content words >= 4 chars, minus stopwords.
 * Deliberately conservative: we want signal-bearing words (subject vocabulary)
 * not chat noise.
 */
function tokenize(text: string): string[] {
	const out: string[] = [];
	const lowered = text.toLowerCase();
	const matches = lowered.matchAll(TOKEN_RE);
	for (const m of matches) {
		const t = m[0];
		if (t.length < 4) continue;
		if (STOPWORDS.has(t)) continue;
		out.push(t);
	}
	return out;
}

/**
 * Build a vocabulary set from the topic context chunk block. We don't trim by
 * frequency — chunk text is already a curated summary (~70KB cap), so taking
 * everything keeps the set under a few thousand terms.
 */
export function buildScopeVocab(chunkBlock: string): Set<string> {
	const vocab = new Set<string>();
	for (const t of tokenize(chunkBlock)) vocab.add(t);
	return vocab;
}

export type ScopePrecheckVerdict =
	| { ok: true }
	| { ok: false; code: "off_topic_no_vocab_overlap"; userTokens: number; vocabSize: number };

const MIN_TURN_CHARS_FOR_CHECK = 40;
const MIN_USER_TOKENS_FOR_CHECK = 4;

/**
 * Decide whether the user's turn is confidently off-topic. Returns `ok: true`
 * unless ALL of the following hold:
 *   - the turn is at least MIN_TURN_CHARS_FOR_CHECK characters
 *   - it yields at least MIN_USER_TOKENS_FOR_CHECK content tokens after stopword filtering
 *   - none of those tokens appear in the scope vocabulary
 *
 * Designed to err on the side of letting questions through. Short or
 * conversational turns (e.g. "what does that mean?") are exempt because the
 * model has full prior context and we should not block follow-ups.
 */
export function userTurnLikelyOutOfScope(
	userText: string,
	vocab: Set<string>,
): ScopePrecheckVerdict {
	if (userText.length < MIN_TURN_CHARS_FOR_CHECK) return { ok: true };
	const userTokens = tokenize(userText);
	if (userTokens.length < MIN_USER_TOKENS_FOR_CHECK) return { ok: true };
	if (vocab.size === 0) return { ok: true };
	for (const t of userTokens) {
		if (vocab.has(t)) return { ok: true };
	}
	return {
		ok: false,
		code: "off_topic_no_vocab_overlap",
		userTokens: userTokens.length,
		vocabSize: vocab.size,
	};
}

/**
 * Suggested user-facing message when the pre-check blocks a turn. Keep it
 * gentle — false positives will happen and we want the student to feel the
 * tool is being helpful, not gatekeeping.
 */
export const OFF_TOPIC_USER_MESSAGE =
	"That looks like it might be a different topic than this chat is scoped to. " +
	"For best answers, start a new doubt chat on that topic. " +
	"If you meant to ask about this chapter, try phrasing it with terms from the lesson.";

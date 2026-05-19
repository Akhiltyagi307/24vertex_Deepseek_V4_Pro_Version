/**
 * The `VisualExemplar` row type shared by every shard file under `./exemplars/`.
 * Extracted from `exemplars.ts` during the per-subject shard split so each
 * shard can be authored in isolation without circular imports.
 */

import type { QuestionVisualEnvelope } from "./schemas";

export type VisualExemplar = {
	stem: string;
	visual: QuestionVisualEnvelope | null;
	/**
	 * Optional lowercase phrases matched as substrings against server-built topic/chapter hint text
	 * to prioritize this exemplar when it aligns with selected practice topics (see `pickExemplarsForSubject`).
	 */
	topicKeywords?: ReadonlyArray<string>;
	subjects: ReadonlyArray<
		| "mathematics"
		| "physics"
		| "chemistry"
		| "biology"
		| "accountancy"
		| "economics_statistics"
		| "business_studies"
		| "geography"
		| "social_science"
		| "science"
		| "english"
	>;
};

/**
 * Stem heuristics shared by practice quality gates and `pnpm eval:visuals`.
 * Criterion alignment: stem implies an attached stimulus ⇔ non-null `visual`
 * (eval criteria 1 & 4).
 *
 * Design: avoid bare `\bbelow\b` / `\babove\b` — they match harmless MCQ boilerplate
 * (“options below”, “questions given below”) and caused false `stem_references_missing_visual`
 * failures across subjects. Prefer phrases that tie deixis to a stimulus noun or to
 * “shown/given … below” blocks.
 */

/** Nouns that normally correspond to `visual.spec` families when preceded by the/in/from/etc. */
const STIMULUS_NOUN =
	"figure|diagram|graphs?|charts?|tables?|circuits?|structures?|images?|drawings?|sketches?|plots?|maps?|histograms?|ogives?|polygons?|curves?|axes|timelines?|flowcharts?|flow\\s+charts?|source\\s+extracts?|extracts?|field\\s+lines?|wave\\s+diagrams?";

/**
 * Stems matching should carry a non-null `visual`, or be rewritten to remove dangling references.
 */
export const STEM_NEEDS_VISUAL_HINT = new RegExp(
	[
		`\\b(?:`,
		// Article / determiner + stimulus (“the graph shows…”, “the tables compare…”)
		`the\\s+(?:${STIMULUS_NOUN})`,
		// Standard deictic blocks
		`|shown\\s+(?:below|above|here)`,
		`|(?:printed|displayed|presented)\\s+(?:below|above)`,
		// “Below is a figure …” (requires explicit stimulus noun)
		`|(?:below|above)\\s+is\\s+(?:a|an|the)\\s+(?:${STIMULUS_NOUN})`,
		`|(?:below|above)\\s+are\\s+(?:the|two|three|four|five|several)\\s+(?:${STIMULUS_NOUN})`,
		// Preposition + stimulus
		`|in\\s+the\\s+(?:${STIMULUS_NOUN})`,
		`|from\\s+the\\s+(?:${STIMULUS_NOUN})`,
		`|on\\s+the\\s+(?:${STIMULUS_NOUN}|number\\s*[-]?\\s*line)`,
		`|refer(?:ring)?\\s+to\\s+the\\s+(?:${STIMULUS_NOUN})`,
		`|with\\s+reference\\s+to\\s+the\\s+(?:${STIMULUS_NOUN})`,
		`|(?:observe|study|examine|see|using)\\s+the\\s+(?:${STIMULUS_NOUN})`,
		`|(?:look|looking)\\s+at\\s+the\\s+(?:${STIMULUS_NOUN})`,
		`|based\\s+on\\s+the\\s+(?:${STIMULUS_NOUN})`,
		`|according\\s+to\\s+the\\s+(?:${STIMULUS_NOUN})`,
		// “following …” blocks (table/graph/passage)
		`|(?:in|from)\\s+the\\s+following\\s+(?:${STIMULUS_NOUN})`,
		`|the\\s+following\\s+(?:${STIMULUS_NOUN})`,
		// As-clauses
		`|as\\s+(?:shown|illustrated|depicted)\\s+(?:in\\s+the\\s+(?:${STIMULUS_NOUN})|below|above)`,
		// English / comprehension stems (structured passage envelope)
		`|the\\s+following\\s+passage`,
		`|read\\s+the\\s+source\\s+extract`,
		`|source\\s+extract\\s+(?:given\\s+)?(?:below|above)`,
		`|read\\s+the\\s+passage\\s+(?:given\\s+)?(?:below|above)`,
		`|passage\\s+(?:given\\s+)?(?:below|above)`,
		// Chemistry / numeric stems (“shown in the equation below”) — “shown” and “below” are not adjacent
		`|shown\\s+in\\s+the\\s+equation\\s+(?:below|above)`,
		`|the\\s+equation\\s+(?:below|above)`,
		`|the\\s+(?:balanced\\s+)?(?:chemical\\s+)?equation\\s+(?:below|above)`,
		`)`,
	].join(""),
	"i",
);

export function stemNeedsVisualHint(stem: string): boolean {
	return STEM_NEEDS_VISUAL_HINT.test(stem);
}

/**
 * Stem heuristics shared by practice quality gates and `pnpm eval:visuals`.
 * Criterion alignment: "stem implies a figure" ⇔ non-null visual (eval criteria 1 & 4).
 */

/**
 * Stems matching this pattern should carry a non-null `visual`, or the stem
 * should be rewritten to remove dangling references.
 *
 * Covers explicit referents ("the figure"), deictics ("shown below"), and
 * common layout phrases — same rule as `scripts/eval-visuals.ts` historically used.
 */
export const STEM_NEEDS_VISUAL_HINT =
	/\b(the\s+(figure|diagram|graph|table|circuit|structure|image|drawing)|shown\s+(below|above|here)|in\s+the\s+(figure|diagram|graph|table)|on\s+the\s+(right|left)\b|above|below)\b/i;

export function stemNeedsVisualHint(stem: string): boolean {
	return STEM_NEEDS_VISUAL_HINT.test(stem);
}

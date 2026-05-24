/**
 * Chapter mastery colors for marketing preview mocks (radar, practice, assignments).
 * Values mirror product radar semantics; use CSS variables from `globals.css` so
 * dark mode stays aligned with `--destructive` and brand green tokens.
 */

export type LandingMasteryPreviewState = "green" | "amber" | "red";

export const landingMasteryPreviewDotClassNames: Record<LandingMasteryPreviewState, string> = {
	green: "bg-[var(--mastery-strong)] ring-[var(--mastery-strong)]/30",
	amber: "bg-[var(--mastery-attention)] ring-[var(--mastery-attention)]/30",
	red: "bg-[var(--mastery-critical)] ring-[var(--mastery-critical)]/30",
};

export const landingMasteryPreviewTextClassNames: Record<LandingMasteryPreviewState, string> = {
	green: "text-[var(--mastery-strong)]",
	amber: "text-[var(--mastery-attention-foreground)]",
	red: "text-[var(--mastery-critical)]",
};

export const landingMasteryPreviewChipClassNames: Record<LandingMasteryPreviewState, string> = {
	green: "border-[var(--mastery-strong)]/40 bg-[var(--mastery-strong)]/10 text-[var(--mastery-strong)]",
	amber:
		"border-[var(--mastery-attention)]/40 bg-[var(--mastery-attention)]/10 text-[var(--mastery-attention-foreground)]",
	red: "border-[var(--mastery-critical)]/40 bg-[var(--mastery-critical)]/10 text-[var(--mastery-critical)]",
};

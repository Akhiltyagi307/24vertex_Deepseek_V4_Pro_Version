/**
 * Compact token-count formatter shared across billing surfaces (sidebar plan
 * card, doubt-chat composer, paywall dialog). Renders as 1.2M / 123k / 999.
 */
export function formatTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
	if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
	return n.toLocaleString("en-IN");
}

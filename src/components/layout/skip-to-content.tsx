/**
 * Skip-to-content anchor. Hidden until focused via Tab so keyboard users can
 * jump past the sidebar/nav in role shells. The target `<main id="main-content">`
 * is rendered by `DashboardShell` (student/parent) and `AdminShellClient` (admin),
 * and by the marketing landing page directly.
 *
 * Class shape mirrors the marketing landing's existing pattern (app/page.tsx)
 * so the focus chrome looks consistent across surfaces.
 */
export function SkipToContent({
	href = "#main-content",
	label = "Skip to main content",
}: { href?: string; label?: string } = {}) {
	return (
		<a
			href={href}
			className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
		>
			{label}
		</a>
	);
}

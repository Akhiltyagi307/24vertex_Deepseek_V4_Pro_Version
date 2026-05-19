/**
 * Centered main column for student hub routes (profile/settings, practice, subscription).
 * ~80% of the sidebar inset on medium+; full width on small screens.
 */
export const studentHubPageShellClassName = "mx-auto w-full min-w-0 medium:max-w-[80%]";

/**
 * Full-width main column aligned with the student dashboard (assignments, performance).
 * Horizontal padding comes from `DashboardShell` inset (`px-4 medium:px-6 xl:px-8`).
 */
export const studentMainPageShellClassName =
	"mx-0 flex w-full min-w-0 max-w-none flex-col gap-8 py-6 medium:py-8";

import { cn } from "@/lib/utils";

/** Shared form className tokens for the student settings shell. Lives at the route level so
 *  the main form, the placement dialog, and the password-change form all stay in lockstep. */

export const tabAccentClass =
	"bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90";

const comfortableInputClass =
	"h-10 medium:h-10 medium:text-base px-3 py-2 file:text-sm [&::file-selector-button]:text-sm";

/** Solid light fill on grey/muted panels (Input defaults to transparent). */
export const panelRaisedInputClass = cn(
	comfortableInputClass,
	"border-border/90 bg-background shadow-sm dark:border-input dark:bg-input/35",
);

export const accountReadonlyInputClass = panelRaisedInputClass;

/** Native `<select>` on raised panels; pair with `NativeSelect` for a chevron (no OS arrow under `appearance-none`). */
export const placementSelectClass = cn(
	panelRaisedInputClass,
	"w-full cursor-pointer appearance-none pr-10",
);

/** Primary & outline CTAs on Profile settings — shared tap target + type scale. */
export const settingsCtaButtonClass = "h-11 min-h-11 px-6 text-base font-medium";

/** Full-width on narrow layouts; auto width from `medium` up. */
export const settingsCtaButtonWidthClass = "w-full medium:w-auto";

/** Bottom-right row for card save/update actions. */
export const settingsCardCtaRowClass =
	"mt-6 flex w-full flex-col items-end gap-3 medium:flex-row medium:flex-wrap medium:justify-end";

/** Card footer CTA — compact width at all breakpoints. */
export const settingsCardCtaButtonClass = cn(settingsCtaButtonClass, "w-auto shrink-0");

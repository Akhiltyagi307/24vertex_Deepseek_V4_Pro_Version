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

export const placementSelectClass = cn(
	panelRaisedInputClass,
	"w-full cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10",
);

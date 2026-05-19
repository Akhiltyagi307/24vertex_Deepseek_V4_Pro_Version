import {
	settingsCtaButtonClass,
	settingsCtaButtonWidthClass,
} from "@/app/student/settings/_settings-form-styles";
import { cn } from "@/lib/utils";

export const settingsPrimarySubmitClass = cn(
	settingsCtaButtonClass,
	settingsCtaButtonWidthClass,
	"shrink-0",
);

export const tabPanelClassName =
	"min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm medium:px-8 medium:py-8 dark:border-border dark:bg-muted/20";

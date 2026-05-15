"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { placementSelectClass } from "@/app/student/settings/_settings-form-styles";
import { cn } from "@/lib/utils";

/** Styled `<select>` with a visible chevron on the right (native controls hide the arrow when using `appearance-none`). */
export const NativeSelect = React.forwardRef<
	HTMLSelectElement,
	React.ComponentPropsWithoutRef<"select">
>(function NativeSelect({ className, ...props }, ref) {
	return (
		<div className="relative w-full">
			<select ref={ref} className={cn(placementSelectClass, className)} {...props} />
			<ChevronDownIcon
				className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
				strokeWidth={2}
				aria-hidden
			/>
		</div>
	);
});

NativeSelect.displayName = "NativeSelect";

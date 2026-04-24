"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
	return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

type PopoverContentProps = React.ComponentProps<typeof PopoverPrimitive.Popup> &
	Pick<
		React.ComponentProps<typeof PopoverPrimitive.Positioner>,
		"align" | "alignOffset" | "side" | "sideOffset"
	>;

function PopoverContent({
	className,
	align = "start",
	alignOffset = 0,
	side = "bottom",
	sideOffset = 8,
	...props
}: PopoverContentProps) {
	return (
		<PopoverPrimitive.Portal>
			<PopoverPrimitive.Positioner
				className="isolate z-[100] outline-none"
				align={align}
				alignOffset={alignOffset}
				side={side}
				sideOffset={sideOffset}
			>
				<PopoverPrimitive.Popup
					data-slot="popover-content"
					className={cn(
						"z-[100] max-h-[min(85vh,var(--available-height))] w-[min(100vw-2rem,24rem)] origin-(--transform-origin) overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none",
						"data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}
				/>
			</PopoverPrimitive.Positioner>
		</PopoverPrimitive.Portal>
	);
}

export { Popover, PopoverTrigger, PopoverContent };

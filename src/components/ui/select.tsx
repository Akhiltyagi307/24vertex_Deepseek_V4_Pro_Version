"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Select(props: SelectPrimitive.Root.Props<string>): React.JSX.Element;
function Select<Value>(
	props: SelectPrimitive.Root.Props<Value>,
): React.JSX.Element;
function Select<Value>(props: SelectPrimitive.Root.Props<Value>) {
	return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup(props: SelectPrimitive.Group.Props) {
	return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectGroupLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
	return (
		<SelectPrimitive.GroupLabel
			data-slot="select-group-label"
			className={cn(
				"text-muted-foreground px-1.5 py-1 text-[11px] font-medium tracking-wider uppercase",
				className,
			)}
			{...props}
		/>
	);
}

function SelectValue(props: SelectPrimitive.Value.Props) {
	return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
	className,
	children,
	size = "default",
	...props
}: SelectPrimitive.Trigger.Props & {
	size?: "default" | "sm";
}) {
	return (
		<SelectPrimitive.Trigger
			data-slot="select-trigger"
			data-size={size}
			className={cn(
				// Layout
				"group/select-trigger inline-flex w-full min-w-0 items-center justify-between gap-2",
				"rounded-lg border border-input bg-background px-3 py-2 text-left text-sm",
				"data-[size=sm]:h-8 data-[size=sm]:py-1.5 data-[size=sm]:text-[13px]",
				"data-[size=default]:h-10 data-[size=default]:py-2",
				// Text / placeholder
				"text-foreground [&_[data-slot=select-value][data-placeholder]]:text-muted-foreground/75",
				// Focus / invalid
				"outline-none transition-[border-color,box-shadow,background-color] duration-150",
				"focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
				"aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
				"dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
				// Open state
				"data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/40",
				// Disabled
				"disabled:cursor-not-allowed disabled:opacity-60",
				"data-disabled:cursor-not-allowed data-disabled:opacity-60",
				// Dark
				"dark:bg-input/30",
				className,
			)}
			{...props}
		>
			<span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
			<SelectPrimitive.Icon
				className="text-muted-foreground shrink-0 transition-transform duration-150 group-data-[popup-open]/select-trigger:rotate-180"
				data-slot="select-icon"
			>
				<ChevronDownIcon className="size-4" strokeWidth={2} aria-hidden />
			</SelectPrimitive.Icon>
		</SelectPrimitive.Trigger>
	);
}

function SelectContent({
	className,
	children,
	align = "start",
	sideOffset = 6,
	alignItemWithTrigger = false,
	...props
}: SelectPrimitive.Popup.Props &
	Pick<
		SelectPrimitive.Positioner.Props,
		"align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
	>) {
	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				className="isolate z-[200] outline-none"
				align={align}
				sideOffset={sideOffset}
				alignItemWithTrigger={alignItemWithTrigger}
			>
				<SelectPrimitive.Popup
					data-slot="select-content"
					className={cn(
						// Box
						"max-h-(--available-height) w-(--anchor-width) min-w-32 overflow-y-auto overflow-x-hidden",
						"bg-popover text-popover-foreground rounded-lg p-1 shadow-md ring-1 ring-foreground/10",
						"origin-(--transform-origin)",
						// Motion
						"duration-100 outline-none",
						"data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
						"data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
						"data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}
				>
					<SelectScrollUpArrow />
					{children}
					<SelectScrollDownArrow />
				</SelectPrimitive.Popup>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	);
}

function SelectItem({
	className,
	children,
	...props
}: SelectPrimitive.Item.Props) {
	return (
		<SelectPrimitive.Item
			data-slot="select-item"
			className={cn(
				"group/select-item relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-7 pl-2 text-[13.5px] outline-none",
				"text-foreground",
				"data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
				"data-[selected]:font-medium",
				"data-disabled:pointer-events-none data-disabled:opacity-50",
				"[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			<SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">
				{children}
			</SelectPrimitive.ItemText>
			<span
				aria-hidden
				className="pointer-events-none absolute right-1.5 flex items-center justify-center"
			>
				<SelectPrimitive.ItemIndicator>
					<CheckIcon className="text-foreground/85 size-3.5" strokeWidth={2.25} />
				</SelectPrimitive.ItemIndicator>
			</span>
		</SelectPrimitive.Item>
	);
}

function SelectSeparator({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			role="separator"
			data-slot="select-separator"
			className={cn("bg-border -mx-1 my-1 h-px", className)}
			{...props}
		/>
	);
}

function SelectScrollUpArrow() {
	return (
		<SelectPrimitive.ScrollUpArrow
			data-slot="select-scroll-up-arrow"
			className="bg-popover text-muted-foreground sticky top-0 z-10 flex h-5 cursor-default items-center justify-center rounded-t-md data-[direction=down]:hidden"
		>
			<ChevronUpIcon className="size-3.5" strokeWidth={2} aria-hidden />
		</SelectPrimitive.ScrollUpArrow>
	);
}

function SelectScrollDownArrow() {
	return (
		<SelectPrimitive.ScrollDownArrow
			data-slot="select-scroll-down-arrow"
			className="bg-popover text-muted-foreground sticky bottom-0 z-10 flex h-5 cursor-default items-center justify-center rounded-b-md data-[direction=up]:hidden"
		>
			<ChevronDownIcon className="size-3.5" strokeWidth={2} aria-hidden />
		</SelectPrimitive.ScrollDownArrow>
	);
}

export {
	Select,
	SelectGroup,
	SelectGroupLabel,
	SelectValue,
	SelectTrigger,
	SelectContent,
	SelectItem,
	SelectSeparator,
};

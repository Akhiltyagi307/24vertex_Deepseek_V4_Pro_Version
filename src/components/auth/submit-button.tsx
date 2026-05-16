"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Button>, "type" | "children"> & {
	label: string;
	pendingLabel?: string;
	/** When set, overrides `useFormStatus` (needed for async `onSubmit` handlers). */
	busy?: boolean;
};

export function SubmitButton({
	label,
	pendingLabel,
	busy,
	disabled,
	className,
	...rest
}: Props) {
	const { pending } = useFormStatus();
	const isPending = busy !== undefined ? busy : pending;
	return (
		<Button
			{...rest}
			type="submit"
			disabled={disabled || isPending}
			className={cn("w-full", className)}
		>
			{isPending ? (pendingLabel ?? "Please wait…") : label}
		</Button>
	);
}

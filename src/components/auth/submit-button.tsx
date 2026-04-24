"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	label: string;
	pendingLabel?: string;
	/** When set, overrides `useFormStatus` (needed for async `onSubmit` handlers). */
	busy?: boolean;
};

export function SubmitButton({ label, pendingLabel, busy, disabled, className, ...rest }: Props) {
	const { pending } = useFormStatus();
	const isPending = busy !== undefined ? busy : pending;
	return (
		<button
			type="submit"
			disabled={disabled || isPending}
			className={cn(
				"inline-flex h-8 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent bg-emerald-600 px-2.5 text-sm font-medium text-white transition-all outline-none select-none hover:bg-emerald-600/90 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 dark:bg-emerald-500 dark:hover:bg-emerald-500/90",
				className,
			)}
			{...rest}
		>
			{isPending ? (pendingLabel ?? "Please wait…") : label}
		</button>
	);
}

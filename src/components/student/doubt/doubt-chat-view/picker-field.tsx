import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

import type { IconComponent } from "./types";

export function PickerField({
	icon: Icon,
	label,
	htmlFor,
	locked = false,
	children,
}: {
	icon: IconComponent;
	label: string;
	htmlFor: string;
	locked?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<label
				htmlFor={htmlFor}
				className={cn(
					"text-foreground/90 flex items-center gap-2 text-[12.5px] font-medium",
					locked && "text-muted-foreground/80",
				)}
			>
				<Icon
					className={cn(
						"text-muted-foreground size-3.5",
						!locked && "text-foreground/80",
					)}
					strokeWidth={1.75}
					aria-hidden
				/>
				<span>{label}</span>
				{locked ? (
					<Lock
						className="text-muted-foreground/60 ml-auto size-3"
						strokeWidth={2}
						aria-hidden
					/>
				) : null}
			</label>
			{children}
		</div>
	);
}

export function ScopeSteps({
	done,
}: {
	done: { subject: boolean; chapter: boolean; topic: boolean };
}) {
	const items: { key: keyof typeof done; label: string }[] = [
		{ key: "subject", label: "Subject" },
		{ key: "chapter", label: "Chapter" },
		{ key: "topic", label: "Topic" },
	];
	return (
		<div className="flex items-center gap-1.5 text-[11px]" aria-label="Scope progress">
			{items.map((item, i) => {
				const isDone = done[item.key];
				const isCurrent = !isDone && items.slice(0, i).every((prev) => done[prev.key]);
				return (
					<div key={item.key} className="flex items-center gap-1.5">
						<span
							className={cn(
								"inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] font-medium tabular-nums transition-colors",
								isDone && "text-emerald-700 dark:text-emerald-300",
								!isDone && isCurrent && "text-foreground",
								!isDone && !isCurrent && "text-muted-foreground/60",
							)}
						>
							<span
								aria-hidden
								className={cn(
									"inline-block size-1.5 rounded-full",
									isDone && "bg-emerald-500",
									!isDone && isCurrent && "bg-foreground/60",
									!isDone && !isCurrent && "bg-muted-foreground/40",
								)}
							/>
							{item.label}
						</span>
						{i < items.length - 1 ? (
							<span aria-hidden className="text-muted-foreground/40">
								/
							</span>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

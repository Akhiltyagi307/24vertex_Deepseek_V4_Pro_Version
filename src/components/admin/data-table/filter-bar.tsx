"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type FilterBarProps = {
	/** URL query key for free-text search (default `q`). */
	searchParamKey?: string;
	className?: string;
	/** Optional extra filters rendered in desktop bar and mobile sheet. */
	children?: React.ReactNode;
	debounceMs?: number;
};

export function AdminFilterBar({ searchParamKey = "q", className, children, debounceMs = 350 }: FilterBarProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const initial = searchParams.get(searchParamKey) ?? "";
	const [value, setValue] = useState(initial);

	useEffect(() => {
		const next = searchParams.get(searchParamKey) ?? "";
		const id = requestAnimationFrame(() => setValue(next));
		return () => cancelAnimationFrame(id);
	}, [searchParamKey, searchParams]);

	const pushQuery = useCallback(
		(next: string) => {
			const p = new URLSearchParams(searchParams.toString());
			const t = next.trim();
			if (t) p.set(searchParamKey, t);
			else p.delete(searchParamKey);
			p.delete("cursor");
			p.set("page", "1");
			router.push(`${pathname}?${p.toString()}`);
		},
		[pathname, router, searchParamKey, searchParams],
	);

	useEffect(() => {
		if (value === (searchParams.get(searchParamKey) ?? "")) return;
		const id = window.setTimeout(() => pushQuery(value), debounceMs);
		return () => window.clearTimeout(id);
	}, [value, debounceMs, pushQuery, searchParamKey, searchParams]);

	const filterBody = <div className="flex flex-col gap-3">{children}</div>;

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			<div className="relative min-w-[200px] max-w-md flex-1">
				<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					className="pl-8"
					placeholder="Search…"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					aria-label="Search"
				/>
			</div>
			{children ?
				<>
					<div className="hidden flex-wrap items-center gap-2 medium:flex">{children}</div>
					<Sheet>
						<SheetTrigger
							render={<Button type="button" variant="outline" size="sm" className="medium:hidden" />}
						>
							<SlidersHorizontal className="mr-1 size-4" />
							Filters
						</SheetTrigger>
						<SheetContent side="bottom" className="h-[70vh]">
							<SheetHeader>
								<SheetTitle>Filters</SheetTitle>
							</SheetHeader>
							<div className="mt-4">{filterBody}</div>
						</SheetContent>
					</Sheet>
				</>
			:	null}
		</div>
	);
}

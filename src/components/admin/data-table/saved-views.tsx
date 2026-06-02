"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookmarkPlus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";

import { fetchJson, isAbortError } from "@/lib/http/fetch-json";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

export type SavedViewRow = { id: string; name: string; state: Record<string, unknown> };

const savedViewsResponseSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			state: z.record(z.string(), z.unknown()),
		}),
	),
});

type SavedViewsProps = {
	listId: string;
};

export function AdminSavedViews({ listId }: SavedViewsProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [views, setViews] = useState<SavedViewRow[]>([]);
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [loading, setLoading] = useState(false);

	const reqIdRef = useRef(0);
	const acRef = useRef<AbortController | null>(null);

	const load = useCallback(async () => {
		const reqId = ++reqIdRef.current;
		acRef.current?.abort();
		const ac = new AbortController();
		acRef.current = ac;
		try {
			const j = await fetchJson(`/api/admin/saved-views?list_id=${encodeURIComponent(listId)}`, {
				schema: savedViewsResponseSchema,
				signal: ac.signal,
				init: { credentials: "include" },
			});
			if (reqId !== reqIdRef.current) return;
			setViews(j.data ?? []);
		} catch (err) {
			if (isAbortError(err)) return;
			// Match the previous behaviour: a failed load silently leaves the list as-is.
		}
	}, [listId]);

	useEffect(() => {
		void load();
		return () => {
			acRef.current?.abort();
		};
	}, [load]);

	const applyState = (state: Record<string, unknown>) => {
		const p = new URLSearchParams();
		const q = typeof state.q === "string" ? state.q : "";
		if (q) p.set("q", q);
		const page = typeof state.page === "string" ? state.page : "1";
		p.set("page", page);
		const pageSize = typeof state.page_size === "string" ? state.page_size : "";
		if (pageSize) p.set("page_size", pageSize);
		else p.delete("page_size");
		const sort = typeof state.sort === "string" ? state.sort : "";
		if (sort) p.set("sort", sort);
		const filters = state.filters;
		if (filters && typeof filters === "object" && filters !== null) {
			for (const [k, v] of Object.entries(filters as Record<string, string>)) {
				if (v) p.set(k, v);
			}
		}
		router.push(`${pathname}?${p.toString()}`);
	};

	const captureState = (): Record<string, unknown> => {
		const filters: Record<string, string> = {};
		for (const [k, v] of searchParams.entries()) {
			if (["q", "page", "page_size", "sort", "cursor"].includes(k)) continue;
			filters[k] = v;
		}
		return {
			q: searchParams.get("q") ?? "",
			page: searchParams.get("page") ?? "1",
			page_size: searchParams.get("page_size") ?? "",
			sort: searchParams.get("sort") ?? "",
			filters,
		};
	};

	const save = async () => {
		const n = name.trim();
		if (!n) return;
		setLoading(true);
		try {
			const res = await fetch("/api/admin/saved-views", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ list_id: listId, name: n, state: captureState() }),
			});
			if (res.ok) {
				setName("");
				setOpen(false);
				await load();
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex items-center gap-1">
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
					Saved views
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel>Apply</DropdownMenuLabel>
					{views.length === 0 ?
						<DropdownMenuItem disabled>No saved views</DropdownMenuItem>
					:	views.map((v) => (
							<DropdownMenuItem key={v.id} onSelect={() => applyState(v.state)}>
								{v.name}
							</DropdownMenuItem>
						))}
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger
					render={
						<Button type="button" variant="secondary" size="sm" />
					}
				>
					<BookmarkPlus className="mr-1 size-4" />
					New view
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save current filters</DialogTitle>
					</DialogHeader>
					<Input placeholder="View name" value={name} onChange={(e) => setName(e.target.value)} />
					<DialogFooter>
						<Button type="button" onClick={() => void save()} disabled={loading || !name.trim()}>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

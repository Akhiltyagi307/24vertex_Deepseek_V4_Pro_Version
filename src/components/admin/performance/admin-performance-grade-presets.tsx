"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookmarkPlus } from "lucide-react";
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
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";

type SavedViewRow = { id: string; name: string; state: Record<string, unknown> };

const savedViewsResponseSchema = z.object({
	data: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			state: z.record(z.string(), z.unknown()),
		}),
	),
});

export function AdminPerformanceGradePresets({
	grade,
	onApplyGrade,
}: {
	grade: string;
	onApplyGrade: (g: string) => void;
}) {
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
			const j = await fetchJson(
				`/api/admin/saved-views?list_id=${encodeURIComponent(ADMIN_LIST_ID.performanceTools)}`,
				{ schema: savedViewsResponseSchema, signal: ac.signal, init: { credentials: "include" } },
			);
			if (reqId !== reqIdRef.current) return;
			setViews(j.data ?? []);
		} catch (err) {
			if (isAbortError(err)) return;
			// Match the previous behaviour: a failed load silently leaves the list as-is.
		}
	}, []);

	useEffect(() => {
		void load();
		return () => {
			acRef.current?.abort();
		};
	}, [load]);

	const save = async () => {
		const n = name.trim();
		if (!n) return;
		setLoading(true);
		try {
			const res = await fetch("/api/admin/saved-views", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					list_id: ADMIN_LIST_ID.performanceTools,
					name: n,
					state: { grade },
				}),
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
					Grade presets
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-48">
					<DropdownMenuLabel>Apply grade</DropdownMenuLabel>
					{views.length === 0 ?
						<DropdownMenuItem disabled>No saved presets</DropdownMenuItem>
					:	views.map((v) => {
							const g = typeof v.state.grade === "string" ? v.state.grade : "";
							return (
								<DropdownMenuItem key={v.id} onSelect={() => g && onApplyGrade(g)}>
									{v.name} ({g || "?"})
								</DropdownMenuItem>
							);
						})}
				</DropdownMenuContent>
			</DropdownMenu>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogTrigger render={<Button type="button" variant="secondary" size="sm" />}>
					<BookmarkPlus className="mr-1 size-4" />
					Save grade preset
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save grade {grade}</DialogTitle>
					</DialogHeader>
					<Input placeholder="Preset name" value={name} onChange={(e) => setName(e.target.value)} />
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

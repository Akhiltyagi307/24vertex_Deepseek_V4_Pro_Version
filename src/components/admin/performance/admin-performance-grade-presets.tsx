"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkPlus } from "lucide-react";

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

	const load = useCallback(async () => {
		const res = await fetch(
			`/api/admin/saved-views?list_id=${encodeURIComponent(ADMIN_LIST_ID.performanceTools)}`,
			{ credentials: "include" },
		);
		if (!res.ok) return;
		const j = (await res.json()) as { data: SavedViewRow[] };
		setViews(j.data ?? []);
	}, []);

	useEffect(() => {
		void load();
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

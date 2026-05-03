"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export type AdminSubjectReorderRow = {
	id: string;
	name: string;
	stream: string | null;
	isElective: boolean;
	isActive: boolean;
};

type Props = {
	grade: number;
	initialSubjects: AdminSubjectReorderRow[];
};

export function AdminSubjectsReorderTable({ grade, initialSubjects }: Props) {
	const router = useRouter();
	const [subjects, setSubjects] = useState(initialSubjects);
	const [pending, setPending] = useState(false);

	useEffect(() => {
		setSubjects(initialSubjects);
	}, [initialSubjects]);

	const persistOrder = async (next: AdminSubjectReorderRow[]) => {
		setPending(true);
		setSubjects(next);
		try {
			const res = await fetch("/api/admin/subjects/reorder", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ids: next.map((s) => s.id) }),
			});
			if (!res.ok) {
				setSubjects(initialSubjects);
				return;
			}
			router.refresh();
		} finally {
			setPending(false);
		}
	};

	const move = (index: number, delta: -1 | 1) => {
		const j = index + delta;
		if (j < 0 || j >= subjects.length) return;
		const next = [...subjects];
		[next[index], next[j]] = [next[j]!, next[index]!];
		void persistOrder(next);
	};

	return (
		<div className="overflow-hidden rounded-lg border border-border">
			<p className="border-b border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
				Grade {grade}: use arrows to change display order (sort_order).
			</p>
			<table className="w-full text-sm">
				<thead className="bg-muted/40">
					<tr>
						<th className="px-3 py-2 text-left">Name</th>
						<th className="px-3 py-2 text-left">Stream</th>
						<th className="px-3 py-2 text-left">Elective</th>
						<th className="px-3 py-2 text-left">Active</th>
						<th className="px-3 py-2 text-right">Order</th>
						<th className="px-3 py-2 text-right"> </th>
					</tr>
				</thead>
				<tbody>
					{subjects.map((s, i) => (
						<tr key={s.id} className="border-t border-border">
							<td className="px-3 py-2">{s.name}</td>
							<td className="px-3 py-2 text-muted-foreground">{s.stream ?? "—"}</td>
							<td className="px-3 py-2">{s.isElective ? "Yes" : "No"}</td>
							<td className="px-3 py-2">{s.isActive === false ? "No" : "Yes"}</td>
							<td className="px-3 py-2 text-right">
								<div className="inline-flex items-center gap-0.5">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="size-8"
										disabled={pending || i === 0}
										onClick={() => move(i, -1)}
										aria-label="Move up"
									>
										<ChevronUp className="size-4" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="size-8"
										disabled={pending || i === subjects.length - 1}
										onClick={() => move(i, 1)}
										aria-label="Move down"
									>
										<ChevronDown className="size-4" />
									</Button>
								</div>
							</td>
							<td className="px-3 py-2 text-right">
								<Link className="text-primary text-xs font-medium hover:underline" href={`/admin/curriculum/subjects/${s.id}`}>
									Edit
								</Link>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

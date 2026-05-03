"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { subjects } from "@/db/schema/academic";

type SubjectRow = typeof subjects.$inferSelect;

export function AdminSubjectForm({ subject }: { subject: SubjectRow }) {
	const router = useRouter();
	const [name, setName] = useState(subject.name);
	const [grade, setGrade] = useState(String(subject.grade));
	const [stream, setStream] = useState(subject.stream ?? "");
	const [subjectGroup, setSubjectGroup] = useState(subject.subjectGroup ?? "");
	const [isElective, setIsElective] = useState(Boolean(subject.isElective));
	const [sortOrder, setSortOrder] = useState(String(subject.sortOrder ?? 0));
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const senior = Number(grade) === 11 || Number(grade) === 12;

	const save = async () => {
		setBusy(true);
		setErr(null);
		try {
			const body: Record<string, unknown> = {
				name: name.trim(),
				grade: Number(grade),
				subject_group: subjectGroup.trim() || null,
				sort_order: Number(sortOrder) || 0,
				is_elective: senior ? isElective : false,
				stream: senior ? (stream.trim() || null) : null,
			};
			const res = await fetch(`/api/admin/subjects/${subject.id}`, {
				method: "PATCH",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const j = (await res.json().catch(() => ({}))) as { error?: unknown };
			if (!res.ok) {
				setErr(typeof j.error === "string" ? j.error : JSON.stringify(j.error ?? res.statusText));
				return;
			}
			router.refresh();
		} finally {
			setBusy(false);
		}
	};

	const softDelete = async () => {
		if (!confirm("Deactivate this subject?")) return;
		setBusy(true);
		try {
			await fetch(`/api/admin/subjects/${subject.id}`, { method: "DELETE", credentials: "include" });
			router.push("/admin/curriculum/subjects");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="space-y-4 rounded-lg border border-border p-4">
			<div>
				<Label htmlFor="sn">Name</Label>
				<Input id="sn" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
			</div>
			<div>
				<Label htmlFor="sg">Grade</Label>
				<Input id="sg" type="number" min={1} max={12} value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1" />
			</div>
			<div>
				<Label htmlFor="sgrp">Subject group</Label>
				<Input id="sgrp" value={subjectGroup} onChange={(e) => setSubjectGroup(e.target.value)} className="mt-1" />
			</div>
			<div>
				<Label htmlFor="sso">Sort order</Label>
				<Input id="sso" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mt-1" />
			</div>
			{senior ?
				<>
					<div>
						<Label htmlFor="sst">Stream (11–12 only)</Label>
						<Input id="sst" value={stream} onChange={(e) => setStream(e.target.value)} className="mt-1" />
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" checked={isElective} onChange={(e) => setIsElective(e.target.checked)} />
						Elective (11–12 only)
					</label>
				</>
			:	<p className="text-xs text-muted-foreground">Stream and elective are only editable for grades 11–12.</p>}
			{err ?
				<p className="text-sm text-destructive">{err}</p>
			:	null}
			<div className="flex flex-wrap gap-2">
				<Button type="button" onClick={() => void save()} disabled={busy}>
					Save
				</Button>
				<Button type="button" variant="destructive" onClick={() => void softDelete()} disabled={busy}>
					Deactivate
				</Button>
			</div>
		</div>
	);
}

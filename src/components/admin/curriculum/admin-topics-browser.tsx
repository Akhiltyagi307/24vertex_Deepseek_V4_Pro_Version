"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdminExportButton } from "@/components/admin/data-table/export-button";
import { AdminSavedViews } from "@/components/admin/data-table/saved-views";
import { Button } from "@/components/ui/button";
import { ADMIN_LIST_ID } from "@/lib/admin/list-ids";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AdminTopicSubjectChip = { id: string; name: string };

type TopicRow = {
	id: string;
	unitName: string;
	chapterName: string;
	topicName: string;
	grade: number;
	isActive: boolean | null;
};

type Props = {
	subjects: AdminTopicSubjectChip[];
};

export function AdminTopicsBrowser({ subjects }: Props) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const subjectIdFromUrl = searchParams.get("subject_id");

	const [subjectId, setSubjectId] = useState<string | null>(
		subjectIdFromUrl && /^[0-9a-f-]{36}$/i.test(subjectIdFromUrl) ? subjectIdFromUrl : null,
	);
	const [topics, setTopics] = useState<TopicRow[]>([]);
	const [nextAfter, setNextAfter] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [clonePick, setClonePick] = useState<Record<string, boolean>>({});
	const [cloneOpen, setCloneOpen] = useState(false);
	const [targetGrade, setTargetGrade] = useState("10");
	const [cloneBusy, setCloneBusy] = useState(false);
	const [cloneMsg, setCloneMsg] = useState<string | null>(null);

	const parentRef = useRef<HTMLDivElement>(null);

	const setSubjectInUrl = useCallback(
		(id: string | null) => {
			const p = new URLSearchParams(searchParams.toString());
			if (id) p.set("subject_id", id);
			else p.delete("subject_id");
			router.replace(`/admin/curriculum/topics?${p.toString()}`);
		},
		[router, searchParams],
	);

	useEffect(() => {
		const fromUrl = searchParams.get("subject_id");
		if (fromUrl && /^[0-9a-f-]{36}$/i.test(fromUrl)) {
			setSubjectId(fromUrl);
		}
	}, [searchParams]);

	const fetchTopics = useCallback(async (opts: { reset: boolean; after: string | null; sid: string }) => {
		setLoading(true);
		setError(null);
		try {
			const u = new URLSearchParams();
			u.set("subject_id", opts.sid);
			u.set("limit", "100");
			if (opts.after) u.set("after", opts.after);
			const res = await fetch(`/api/admin/topics?${u.toString()}`, { credentials: "include" });
			if (!res.ok) {
				setError("Failed to load topics");
				if (opts.reset) setTopics([]);
				setNextAfter(null);
				return;
			}
			const j = (await res.json()) as { data: TopicRow[]; next_after: string | null };
			const chunk = j.data ?? [];
			setTopics((prev) => (opts.reset ? chunk : [...prev, ...chunk]));
			setNextAfter(j.next_after ?? null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		setClonePick({});
	}, [subjectId]);

	useEffect(() => {
		if (!subjectId) {
			setTopics([]);
			setNextAfter(null);
			return;
		}
		let cancelled = false;
		void (async () => {
			setLoading(true);
			setError(null);
			try {
				const u = new URLSearchParams();
				u.set("subject_id", subjectId);
				u.set("limit", "100");
				const res = await fetch(`/api/admin/topics?${u.toString()}`, { credentials: "include" });
				if (cancelled) return;
				if (!res.ok) {
					setError("Failed to load topics");
					setTopics([]);
					setNextAfter(null);
					return;
				}
				const j = (await res.json()) as { data: TopicRow[]; next_after: string | null };
				setTopics(j.data ?? []);
				setNextAfter(j.next_after ?? null);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [subjectId]);

	const loadMore = () => {
		if (!nextAfter || loading || !subjectId) return;
		void fetchTopics({ reset: false, after: nextAfter, sid: subjectId });
	};

	const rowVirtualizer = useVirtualizer({
		count: topics.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 72,
		overscan: 12,
	});

	const virtualItems = rowVirtualizer.getVirtualItems();

	const pickSubject = (id: string) => {
		setSubjectId(id);
		setSubjectInUrl(id);
	};

	const subjectName = useMemo(() => subjects.find((s) => s.id === subjectId)?.name, [subjects, subjectId]);

	const selectedCloneIds = useMemo(() => Object.entries(clonePick).filter(([, v]) => v).map(([id]) => id), [clonePick]);

	const toggleClone = (id: string) => {
		setClonePick((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const runClone = async () => {
		const g = Number.parseInt(targetGrade, 10);
		if (!Number.isFinite(g) || g < 1 || g > 12) {
			setCloneMsg("Grade must be 1–12");
			return;
		}
		if (selectedCloneIds.length === 0) return;
		setCloneBusy(true);
		setCloneMsg(null);
		try {
			const res = await fetch("/api/admin/topics/clone-to-grade", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ source_topic_ids: selectedCloneIds, target_grade: g }),
			});
			const j = (await res.json().catch(() => ({}))) as { ok?: boolean; inserted?: number; error?: string };
			if (!res.ok) {
				setCloneMsg(j.error ?? "Clone failed");
				return;
			}
			setCloneMsg(`Inserted ${j.inserted ?? 0} topic(s).`);
			setClonePick({});
			setCloneOpen(false);
			router.refresh();
		} finally {
			setCloneBusy(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2 text-sm">
				{subjects.map((s) => (
					<button
						key={s.id}
						type="button"
						onClick={() => pickSubject(s.id)}
						className={cn(
							"rounded-md border px-3 py-1",
							subjectId === s.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
						)}
					>
						{s.name}
					</button>
				))}
			</div>

			{!subjectId ?
				<p className="text-sm text-muted-foreground">Select a subject above.</p>
			:	<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-end gap-2">
						<AdminSavedViews listId={ADMIN_LIST_ID.curriculumTopics} />
						<AdminExportButton
							filenameBase="curriculum-topics"
							headers={["topic_id", "unit", "chapter", "topic", "grade", "is_active"]}
							rows={topics.map((t) => ({
								topic_id: t.id,
								unit: t.unitName,
								chapter: t.chapterName,
								topic: t.topicName,
								grade: t.grade,
								is_active: t.isActive ?? "",
							}))}
							disabled={loading || topics.length === 0}
						/>
					</div>
					{selectedCloneIds.length > 0 ?
						<div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
							<span>
								<span className="font-medium">{selectedCloneIds.length}</span> topic
								{selectedCloneIds.length === 1 ? "" : "s"} selected
							</span>
							<Button type="button" size="sm" variant="secondary" onClick={() => setCloneOpen(true)}>
								Clone to grade…
							</Button>
							<Button type="button" size="sm" variant="ghost" onClick={() => setClonePick({})}>
								Clear
							</Button>
						</div>
					:	null}
					<Dialog
						open={cloneOpen}
						onOpenChange={(open) => {
							setCloneOpen(open);
							if (open) setCloneMsg(null);
						}}
					>
						<DialogContent className="medium:max-w-md">
							<DialogHeader>
								<DialogTitle>Clone topics to another grade</DialogTitle>
								<DialogDescription>
									Creates duplicate rows for the selected topics at the target grade (same subject and hierarchy).
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-2">
								<Label htmlFor="target_grade">Target grade (1–12)</Label>
								<Input
									id="target_grade"
									type="number"
									min={1}
									max={12}
									value={targetGrade}
									onChange={(e) => setTargetGrade(e.target.value)}
								/>
								{cloneMsg ?
									<p className="text-sm text-muted-foreground">{cloneMsg}</p>
								:	null}
							</div>
							<DialogFooter>
								<Button type="button" variant="outline" onClick={() => setCloneOpen(false)} disabled={cloneBusy}>
									Cancel
								</Button>
								<Button type="button" onClick={() => void runClone()} disabled={cloneBusy}>
									{cloneBusy ? "Cloning…" : "Clone"}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
					<p className="text-sm text-muted-foreground">
						{subjectName}: {topics.length} topic{topics.length === 1 ? "" : "s"} loaded
						{nextAfter ? " (more available)" : ""}.
					</p>
					{error ?
						<p className="text-sm text-destructive">{error}</p>
					:	null}
					<div
						ref={parentRef}
						className="max-h-[min(70vh,520px)] overflow-auto rounded-lg border border-border bg-background"
						style={{ contain: "strict" }}
					>
						<div
							style={{
								height: `${rowVirtualizer.getTotalSize()}px`,
								width: "100%",
								position: "relative",
							}}
						>
							{virtualItems.map((vi) => {
								const t = topics[vi.index];
								if (!t) return null;
								return (
									<div
										key={t.id}
										className="absolute left-0 top-0 flex w-full items-start gap-2 border-b border-border px-3 py-2 text-sm"
										style={{ transform: `translateY(${vi.start}px)` }}
									>
										<input
											type="checkbox"
											className="mt-1 size-4 shrink-0 rounded border border-input"
											checked={!!clonePick[t.id]}
											onChange={() => toggleClone(t.id)}
											aria-label={`Select ${t.topicName}`}
										/>
										<div className="min-w-0 flex-1">
											<Link className="font-medium text-primary hover:underline" href={`/admin/curriculum/topics/${t.id}`}>
												{t.topicName}
											</Link>
											<span className="block truncate text-xs text-muted-foreground">
												{t.unitName} · {t.chapterName} · Grade {t.grade} · {t.isActive === false ? "Inactive" : "Active"}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					</div>
					{nextAfter ?
						<Button type="button" variant="outline" size="sm" disabled={loading} onClick={loadMore}>
							{loading ? "Loading…" : "Load more"}
						</Button>
					:	null}
				</div>
			}
		</div>
	);
}

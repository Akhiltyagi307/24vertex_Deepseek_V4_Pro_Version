"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AdminTopicEditModel = {
	id: string;
	topicName: string;
	unitName: string;
	chapterName: string;
	description: string | null;
	isActive: boolean | null;
};

type Props = {
	topic: AdminTopicEditModel;
};

export function AdminTopicEditForm({ topic }: Props) {
	const router = useRouter();
	const [topicName, setTopicName] = useState(topic.topicName);
	const [unitName, setUnitName] = useState(topic.unitName);
	const [chapterName, setChapterName] = useState(topic.chapterName);
	const [description, setDescription] = useState(topic.description ?? "");
	const [isActive, setIsActive] = useState(topic.isActive !== false);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		setMessage(null);
		try {
			const res = await fetch(`/api/admin/topics/${topic.id}`, {
				method: "PATCH",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					topic_name: topicName,
					unit_name: unitName,
					chapter_name: chapterName,
					description: description.trim() === "" ? null : description,
					is_active: isActive,
				}),
			});
			if (!res.ok) {
				const j = (await res.json().catch(() => ({}))) as { error?: string };
				setMessage(j.error ?? "Save failed");
				return;
			}
			setMessage("Saved.");
			router.refresh();
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border p-4">
			<div className="grid gap-4 medium:grid-cols-2">
				<div className="space-y-2 medium:col-span-2">
					<Label htmlFor="topic_name">Topic name</Label>
					<Input id="topic_name" value={topicName} onChange={(e) => setTopicName(e.target.value)} required maxLength={250} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="unit_name">Unit name</Label>
					<Input id="unit_name" value={unitName} onChange={(e) => setUnitName(e.target.value)} required maxLength={250} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="chapter_name">Chapter name</Label>
					<Input id="chapter_name" value={chapterName} onChange={(e) => setChapterName(e.target.value)} required maxLength={250} />
				</div>
				<div className="space-y-2 medium:col-span-2">
					<Label htmlFor="description">Description</Label>
					<textarea
						id="description"
						className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</div>
				<label className="flex items-center gap-2 text-sm medium:col-span-2">
					<input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
					Active
				</label>
			</div>
			{message ?
				<p className={`text-sm ${message === "Saved." ? "text-muted-foreground" : "text-destructive"}`}>{message}</p>
			:	null}
			<Button type="submit" disabled={saving}>
				{saving ? "Saving…" : "Save changes"}
			</Button>
		</form>
	);
}

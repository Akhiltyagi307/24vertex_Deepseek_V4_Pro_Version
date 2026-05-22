"use client";

import * as React from "react";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/feedback/types";

export function FeedbackReportRowActions({
	reportId,
	initialStatus,
}: {
	reportId: string;
	initialStatus: string;
}) {
	const [status, setStatus] = React.useState(initialStatus);
	const [saving, setSaving] = React.useState(false);
	const [message, setMessage] = React.useState<string | null>(null);

	const save = async (next: FeedbackStatus) => {
		setSaving(true);
		setMessage(null);
		try {
			const res = await fetch(`/api/admin/feedback/${reportId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: next }),
			});
			if (!res.ok) {
				setMessage("Update failed");
				setStatus(initialStatus);
				return;
			}
			setStatus(next);
			setMessage("Saved");
		} catch {
			setMessage("Update failed");
			setStatus(initialStatus);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex flex-col items-end gap-1">
			<Select
				value={status}
				onValueChange={(v) => void save(v as FeedbackStatus)}
				disabled={saving}
			>
				<SelectTrigger
					aria-label="Report status"
					className="h-8 min-w-[7.5rem] text-xs"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{FEEDBACK_STATUSES.map((s) => (
						<SelectItem key={s} value={s}>
							{s}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{message ?
				<span className="text-muted-foreground text-[10px]">{message}</span>
			:	null}
		</div>
	);
}

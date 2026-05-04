"use client";

import * as React from "react";
import { BellIcon, CheckIcon } from "lucide-react";

import {
	NOTIFICATION_PREFERENCE_KEYS,
	updateNotificationPreferences,
	type NotificationPreferencesState,
} from "./notification-preferences-actions";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PrefKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

const PREF_LABELS: Record<PrefKey, { title: string; description: string }> = {
	test_result: {
		title: "Report ready",
		description: "When a practice test has been graded and your report is available.",
	},
	usage_alert: {
		title: "Plan usage alerts",
		description: "When you've used 80% or 100% of your tests or doubt-chat tokens this period.",
	},
	announcement: {
		title: "Announcements",
		description: "Product updates and important EduAI news.",
	},
	reminder: {
		title: "Reminders",
		description: "Nudges for uncompleted practice or upcoming sessions.",
	},
};

export type NotificationPreferencesFormProps = {
	initial: {
		enableInApp: boolean;
		enableEmail: boolean;
		types: Record<PrefKey, boolean>;
	};
};

export function NotificationPreferencesForm({ initial }: NotificationPreferencesFormProps) {
	const [enableInApp, setEnableInApp] = React.useState(initial.enableInApp);
	const [enableEmail, setEnableEmail] = React.useState(initial.enableEmail);
	const [types, setTypes] = React.useState(initial.types);
	const [pending, startTransition] = React.useTransition();
	const [state, setState] = React.useState<NotificationPreferencesState | null>(null);

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setState(null);
		startTransition(async () => {
			const res = await updateNotificationPreferences({
				enableInApp,
				enableEmail,
				types,
			});
			setState(res);
		});
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center gap-2">
					<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<BellIcon className="size-4" />
					</div>
					<div>
						<CardTitle>Notification preferences</CardTitle>
						<CardDescription>
							Choose where you want to be notified and which types you care about.
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit} className="flex flex-col gap-5">
					<div className="flex flex-col gap-3">
						<ToggleRow
							id="enable-in-app"
							label="In-app notifications"
							description="Shown in the bell and on the Notifications page."
							checked={enableInApp}
							onChange={setEnableInApp}
						/>
						<ToggleRow
							id="enable-email"
							label="Email notifications"
							description="We'll also email you for critical events when enabled."
							checked={enableEmail}
							onChange={setEnableEmail}
						/>
					</div>

					<div className="rounded-lg border border-border bg-muted/30 p-4">
						<p className="text-sm font-medium text-foreground">Notify me about</p>
						<p className="text-xs text-muted-foreground">
							Applies to both in-app and email channels.
						</p>
						<div className="mt-3 flex flex-col gap-3">
							{NOTIFICATION_PREFERENCE_KEYS.map((key) => (
								<ToggleRow
									key={key}
									id={`type-${key}`}
									label={PREF_LABELS[key].title}
									description={PREF_LABELS[key].description}
									checked={Boolean(types[key])}
									onChange={(v) =>
										setTypes((prev) => ({ ...prev, [key]: v }))
									}
									disabled={!enableInApp && !enableEmail}
								/>
							))}
						</div>
					</div>

					<div className="flex items-center justify-between">
						<p className="text-xs text-muted-foreground" aria-live="polite">
							{state?.ok ? (
								<span className="inline-flex items-center gap-1 text-primary">
									<CheckIcon className="size-3.5" /> Saved
								</span>
							) : state?.error ? (
								<span className="text-destructive">{state.error}</span>
							) : null}
						</p>
						<Button type="submit" disabled={pending}>
							{pending ? "Saving" : "Save preferences"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function ToggleRow({
	id,
	label,
	description,
	checked,
	onChange,
	disabled,
}: {
	id: string;
	label: string;
	description: string;
	checked: boolean;
	onChange: (v: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<label
			htmlFor={id}
			className={cn(
				"flex items-start justify-between gap-4 rounded-md border border-transparent px-2 py-1.5 transition-colors",
				disabled ? "opacity-60" : "hover:bg-muted/60",
			)}
		>
			<span className="flex flex-col">
				<span className="text-sm font-medium text-foreground">{label}</span>
				<span className="text-xs text-muted-foreground">{description}</span>
			</span>
			<input
				id={id}
				type="checkbox"
				role="switch"
				className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
				checked={checked}
				disabled={disabled}
				onChange={(e) => onChange(e.target.checked)}
			/>
		</label>
	);
}

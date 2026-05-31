"use client";

import * as React from "react";
import { BellIcon, CheckIcon } from "lucide-react";

import { NOTIFICATION_PREFERENCE_KEYS } from "@/lib/notifications/types";
import type {
	NotificationPreferencesInitial,
	NotificationPreferencesInput,
	NotificationPreferencesState,
} from "./notification-preferences-types";
import { settingsCardCtaButtonClass, settingsCardCtaRowClass } from "./_settings-form-styles";
import AnimatedToggle from "@/components/smoothui/animated-toggle";
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
		description: "Product updates and important 24Vertex news.",
	},
	reminder: {
		title: "Reminders",
		description: "Trial-ending emails and other practice nudges.",
	},
};

export type { NotificationPreferencesInitial };

export type NotificationPreferencesFormProps = {
	initial: NotificationPreferencesInitial;
	saveNotificationPreferences: (
		input: NotificationPreferencesInput,
	) => Promise<NotificationPreferencesState>;
	/**
	 * `settingsTab`: transparent card like other Profile settings tabs; no outer `<form>`
	 * (parent page already wraps tabs in a form for profile fields).
	 */
	variant?: "standalone" | "settingsTab";
};

const settingsTabNestedWellClass =
	"rounded-xl border border-border/80 bg-sidebar-accent p-4 shadow-sm dark:border-border dark:bg-foreground/10 medium:p-5";

export function NotificationPreferencesForm({
	initial,
	saveNotificationPreferences,
	variant = "standalone",
}: NotificationPreferencesFormProps) {
	const [enableInApp, setEnableInApp] = React.useState(initial.enableInApp);
	const [enableEmail, setEnableEmail] = React.useState(initial.enableEmail);
	const [types, setTypes] = React.useState(initial.types);
	const [pending, startTransition] = React.useTransition();
	const [state, setState] = React.useState<NotificationPreferencesState | null>(null);

	const isSettingsTab = variant === "settingsTab";

	function save() {
		setState(null);
		startTransition(async () => {
			const res = await saveNotificationPreferences({
				enableInApp,
				enableEmail,
				types,
			});
			setState(res);
		});
	}

	function onFormSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		save();
	}

	const typeSectionShell = isSettingsTab ? settingsTabNestedWellClass : "rounded-lg border border-border bg-muted/30 p-4";

	const fields = (
		<>
			<div className="flex flex-col gap-3">
				<ToggleRow
					id="enable-in-app"
					label="In-app notifications"
					description="Shown in the bell and on the Notifications page."
					checked={enableInApp}
					onChange={setEnableInApp}
					comfortable={isSettingsTab}
				/>
				<ToggleRow
					id="enable-email"
					label="Email notifications"
					description="We'll also email you for critical events when enabled."
					checked={enableEmail}
					onChange={setEnableEmail}
					comfortable={isSettingsTab}
				/>
			</div>

			<div className={typeSectionShell}>
				<p
					className={cn(
						"font-medium text-foreground",
						isSettingsTab ? "text-base" : "text-sm",
					)}
				>
					Notify me about
				</p>
				<p
					className={cn(
						"text-muted-foreground",
						isSettingsTab ? "mt-1 text-sm leading-relaxed" : "text-xs",
					)}
				>
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
							onChange={(v) => setTypes((prev) => ({ ...prev, [key]: v }))}
							disabled={!enableInApp && !enableEmail}
							comfortable={isSettingsTab}
						/>
					))}
				</div>
			</div>

			<div className={isSettingsTab ? settingsCardCtaRowClass : "flex items-center justify-between gap-4"}>
				<p
					className={cn(
						"text-muted-foreground",
						isSettingsTab ?
							"min-h-[1.25rem] w-full self-start text-sm leading-relaxed medium:mr-auto medium:w-auto"
						:	"text-xs",
					)}
					aria-live="polite"
				>
					{state?.ok ? (
						<span className="inline-flex items-center gap-1 text-primary">
							<CheckIcon className="size-3.5" /> Saved
						</span>
					) : state?.error ? (
						<span className="text-destructive">{state.error}</span>
					) : null}
				</p>
				<Button
					type={isSettingsTab ? "button" : "submit"}
					className={isSettingsTab ? settingsCardCtaButtonClass : undefined}
					disabled={pending}
					onClick={isSettingsTab ? () => save() : undefined}
				>
					{pending ? "Saving…" : "Save preferences"}
				</Button>
			</div>
		</>
	);

	if (isSettingsTab) {
		return (
			<div>
				<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
					<CardHeader className="px-0 pt-0">
						<CardTitle className="text-lg">Notification preferences</CardTitle>
						<CardDescription className="text-base leading-relaxed">
							Choose where you want to be notified and which types you care about.
						</CardDescription>
					</CardHeader>
					<CardContent className="px-0">
						<div className="flex flex-col gap-5">{fields}</div>
					</CardContent>
				</Card>
			</div>
		);
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
				<form onSubmit={onFormSubmit} className="flex flex-col gap-5">
					{fields}
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
	comfortable = false,
}: {
	id: string;
	label: string;
	description: string;
	checked: boolean;
	onChange: (v: boolean) => void;
	disabled?: boolean;
	comfortable?: boolean;
}) {
	const switchLabel = `${label}, ${checked ? "on" : "off"}`;
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-4 rounded-md border border-transparent px-2 py-1.5 transition-colors",
				disabled ? "opacity-60" : "hover:bg-muted/60",
			)}
		>
			<div className="min-w-0 flex flex-1 flex-col pr-2">
				<span
					id={`${id}-label`}
					className={cn(
						"font-medium text-foreground",
						comfortable ? "text-base" : "text-sm",
					)}
				>
					{label}
				</span>
				<span
					id={`${id}-description`}
					className={cn("text-muted-foreground", comfortable ? "text-sm leading-relaxed" : "text-xs")}
				>
					{description}
				</span>
			</div>
			<AnimatedToggle
				variant="plain"
				size="sm"
				checked={checked}
				onChange={onChange}
				disabled={disabled}
				label={switchLabel}
				aria-labelledby={`${id}-label`}
				aria-describedby={`${id}-description`}
			/>
		</div>
	);
}

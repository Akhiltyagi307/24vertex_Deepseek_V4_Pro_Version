"use client";

import { Bell, CheckIcon, KeyRound, User, UserPlus, Users } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { NotificationPreferencesForm } from "@/app/student/settings/notification-preferences-form";
import type {
	NotificationPreferencesInitial,
	NotificationPreferencesInput,
	NotificationPreferencesState,
} from "@/app/student/settings/notification-preferences-types";
import { PasswordChangeForm } from "@/app/student/settings/password-change-form";
import { tabAccentClass } from "@/app/student/settings/_settings-form-styles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";

import { updateParentProfile, type UpdateParentProfileState } from "./actions";
import { LinkStudentSection } from "./sections/link-student-section";
import { ParentProfileEditorPanel } from "./sections/parent-profile-editor-panel";
import { SwitchStudentSection, type LinkedStudent } from "./sections/switch-student-section";

export type ParentProfileSettingsRow = {
	id: string;
	full_name: string;
	avatar_url: string | null;
	phone: string | null;
};

export function ParentAccountSettingsForm({
	userId,
	loginEmail,
	profile,
	initialNotificationPrefs,
	saveNotificationPreferences,
	linkedStudents,
}: {
	userId: string;
	loginEmail: string;
	profile: ParentProfileSettingsRow;
	initialNotificationPrefs: NotificationPreferencesInitial;
	saveNotificationPreferences: (
		input: NotificationPreferencesInput,
	) => Promise<NotificationPreferencesState>;
	linkedStudents: LinkedStudent[];
}) {
	const [state, formAction] = useActionState<UpdateParentProfileState | undefined, FormData>(
		updateParentProfile,
		undefined,
	);
	const feedbackRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (state?.error || state?.success) {
			feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, [state?.error, state?.success]);

	return (
		<div className="flex w-full min-w-0 flex-col gap-8">
			<div className="flex shrink-0 flex-col gap-1.5">
				<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">Account</h1>
				<PageHeaderSubtext variant="wrap">
					Update your name, photo, and phone on the Profile tab. Password and notification tabs have their
					own save buttons. Use{" "}
					<span className="text-foreground/90">Switch student account</span> or{" "}
					<span className="text-foreground/90">Link a student</span> to manage linked children.
				</PageHeaderSubtext>
			</div>

			<div ref={feedbackRef}>
				{state?.error ? (
					<Alert variant="destructive" role="alert">
						<AlertTitle>Something went wrong</AlertTitle>
						<AlertDescription>{state.error}</AlertDescription>
					</Alert>
				) : null}

				{state?.success ? (
					<Alert role="status">
						<CheckIcon />
						<AlertTitle>Saved</AlertTitle>
						<AlertDescription>Your profile was updated.</AlertDescription>
					</Alert>
				) : null}
			</div>

			<form action={formAction} className="flex flex-col gap-6">
				<SmoothTab
					defaultTabId="profile"
					panelClassName="min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm medium:px-8 medium:py-8 dark:border-border dark:bg-muted/20"
					persistContentPanels
					tabListPosition="top"
					items={[
						{
							id: "profile",
							title: "Profile",
							icon: User,
							color: tabAccentClass,
							content: <ParentProfileEditorPanel userId={userId} profile={profile} />,
						},
						{
							id: "password",
							title: "Password",
							icon: KeyRound,
							color: tabAccentClass,
							content: <PasswordChangeForm loginEmail={loginEmail} fieldIdPrefix="parent" />,
						},
						{
							id: "notifications",
							title: "Notifications",
							icon: Bell,
							color: tabAccentClass,
							content: (
								<NotificationPreferencesForm
									initial={initialNotificationPrefs}
									saveNotificationPreferences={saveNotificationPreferences}
									variant="settingsTab"
								/>
							),
						},
						{
							id: "switch",
							title: "Switch student",
							icon: Users,
							color: tabAccentClass,
							content: (
								<SwitchStudentSection
									linkedStudents={linkedStudents}
									onSwitchHref="/parent/select-student"
								/>
							),
						},
						{
							id: "link",
							title: "Link a student",
							icon: UserPlus,
							color: tabAccentClass,
							content: <LinkStudentSection />,
						},
					]}
				/>
			</form>
		</div>
	);
}

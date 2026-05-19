"use client";

import {
	Bell,
	CheckIcon,
	CopyIcon,
	GraduationCap,
	KeyRound,
	User,
	Users,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
	updateStudentOrganization,
	updateStudentProfile,
	type UpdateStudentOrganizationState,
	type UpdateStudentProfileState,
} from "./actions";
import { NotificationPreferencesForm } from "./notification-preferences-form";
import type {
	NotificationPreferencesInitial,
	NotificationPreferencesInput,
	NotificationPreferencesState,
} from "./notification-preferences-types";
import { PasswordChangeForm } from "./password-change-form";
import { PlacementFieldDialog, type PlacementField } from "./placement-field-dialog";
import { AccountDetailsPanel } from "./sections/account-details-panel";
import { settingsNestedWellClass } from "./sections/_account-fields";
import { OrganizationPanel } from "./sections/organization-panel";
import { ParentPanel } from "./sections/parent-panel";
import { ProfileEditorPanel } from "./sections/profile-editor-panel";
import { SubjectsPanel } from "./sections/subjects-panel";
import {
	settingsCtaButtonClass,
	settingsCtaButtonWidthClass,
	tabAccentClass,
} from "./_settings-form-styles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { cn } from "@/lib/utils";
import { formatDateLongStyleInAppTimeZone } from "@/lib/datetime/app-timezone";
import type { SerializedOrganization } from "@/lib/organizations/schemas";

export type ResolvedSubjectForSettings = {
	id: string;
	name: string;
};

export type StudentProfileSettingsRow = {
	id: string;
	student_link_code: string | null;
	full_name: string;
	grade: number | null;
	section: string | null;
	stream: string | null;
	elective_subject_id: string | null;
	school_name: string | null;
	parent_name: string | null;
	parent_email: string | null;
	avatar_url: string | null;
	phone: string | null;
	organization_id: string | null;
	is_verified: boolean | null;
	created_at: string;
};

export function StudentProfileSettingsForm({
	userId,
	loginEmail,
	profile,
	electiveSubjectName,
	resolvedSubjects = [],
	subjectsLoadError = null,
	organizations = [],
	initialNotificationPrefs,
	saveNotificationPreferences,
}: {
	userId: string;
	loginEmail: string;
	profile: StudentProfileSettingsRow;
	electiveSubjectName: string | null;
	resolvedSubjects?: ResolvedSubjectForSettings[];
	subjectsLoadError?: string | null;
	organizations?: SerializedOrganization[];
	initialNotificationPrefs: NotificationPreferencesInitial;
	saveNotificationPreferences: (
		input: NotificationPreferencesInput,
	) => Promise<NotificationPreferencesState>;
}) {
	const [state, formAction] = useActionState<UpdateStudentProfileState | undefined, FormData>(
		updateStudentProfile,
		undefined,
	);
	const [organizationState, organizationFormAction] = useActionState<
		UpdateStudentOrganizationState | undefined,
		FormData
	>(updateStudentOrganization, undefined);
	const [copied, setCopied] = useState(false);
	const [placementField, setPlacementField] = useState<PlacementField | null>(null);
	const feedbackRef = useRef<HTMLDivElement | null>(null);

	const shareText = profile.student_link_code ?? profile.id;
	const currentOrganization = organizations.find((org) => org.id === profile.organization_id) ?? null;

	useEffect(() => {
		if (state?.error || state?.success) {
			feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, [state?.error, state?.success]);

	async function copyShareCode() {
		try {
			await navigator.clipboard.writeText(shareText);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	const enrolled = formatDateLongStyleInAppTimeZone(profile.created_at);

	const linkCodePanel = (
		<div className={settingsNestedWellClass}>
			<p className="text-foreground text-sm font-semibold">Link code</p>
			<div className="mt-2 flex flex-wrap items-center gap-3">
				<div
					className={cn(
						"rounded-lg border border-border/80 bg-muted/30 px-3 py-2 font-mono text-base text-foreground shadow-none dark:border-border dark:bg-muted/25",
						profile.student_link_code ? "tracking-wide" : "break-all text-sm",
					)}
					aria-readonly
				>
					{shareText}
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={copyShareCode}
					className={cn(settingsCtaButtonClass, "shrink-0 gap-2")}
				>
					{copied ? <CheckIcon /> : <CopyIcon />}
					{copied ? "Copied" : "Copy"}
				</Button>
			</div>
			<p className="mt-3 text-foreground/80 text-sm leading-relaxed dark:text-muted-foreground">
				Give this code to a parent—they’ll use it in their app to connect to your account.
			</p>
		</div>
	);

	return (
		<div className="flex w-full min-w-0 flex-col gap-8">
			<PlacementFieldDialog
				key={[
					placementField ?? "closed",
					profile.grade ?? "",
					profile.section ?? "",
					profile.stream ?? "",
					profile.elective_subject_id ?? "",
					profile.school_name ?? "",
				].join(":")}
				field={placementField}
				onClose={() => setPlacementField(null)}
				profile={profile}
			/>
			<div className="flex shrink-0 flex-col gap-1.5">
				<h1 className="font-semibold text-3xl tracking-tight text-balance text-foreground">Profile</h1>
				<PageHeaderSubtext variant="wrap">
					Update your name, photo, and appearance here. Tap{" "}
					<span className="text-foreground/90">Save changes</span> when you&apos;re done.
					<br />
					<span className="text-foreground/90">Password</span>,{" "}
					<span className="text-foreground/90">School &amp; account</span>,{" "}
					<span className="text-foreground/90">Guardian</span>, and{" "}
					<span className="text-foreground/90">Notifications</span> cover sign-in, grade, parent info, and
					alerts.
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
					defaultTabId="school"
					panelClassName="min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm medium:px-8 medium:py-8 dark:border-border dark:bg-muted/20"
					persistContentPanels
					tabListPosition="top"
					items={[
						{
							id: "school",
							title: "School & account",
							icon: GraduationCap,
							color: tabAccentClass,
							content: (
								<div className="space-y-8">
									<div>
										<h2 className="font-semibold text-lg tracking-tight text-foreground">
											School & account
										</h2>
										<p className="mt-1 text-foreground/75 text-sm leading-relaxed dark:text-muted-foreground">
											How you sign in, when you joined, and your class setup. Tap the pencil to edit
											school-managed fields. Login email and enrollment date are fixed (they come from
											your account and signup).
										</p>
									</div>
									<AccountDetailsPanel
										loginEmail={loginEmail}
										profile={profile}
										enrolled={enrolled}
										electiveSubjectName={electiveSubjectName}
										onPlacementFieldEdit={setPlacementField}
									/>
									<OrganizationPanel
										profile={profile}
										organizations={organizations}
										currentOrganization={currentOrganization}
										organizationState={organizationState}
										organizationFormAction={organizationFormAction}
									/>
									<SubjectsPanel
										profile={profile}
										resolvedSubjects={resolvedSubjects}
										subjectsLoadError={subjectsLoadError}
									/>
									{linkCodePanel}
								</div>
							),
						},
						{
							id: "profile",
							title: "Profile",
							icon: User,
							color: tabAccentClass,
							content: <ProfileEditorPanel userId={userId} profile={profile} />,
						},
						{
							id: "password",
							title: "Password",
							icon: KeyRound,
							color: tabAccentClass,
							content: <PasswordChangeForm loginEmail={loginEmail} />,
						},
						{
							id: "guardian",
							title: "Guardian",
							icon: Users,
							color: tabAccentClass,
							content: <ParentPanel profile={profile} />,
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
					]}
				/>

				<div
					className={cn(
						"sticky bottom-0 z-10 -mx-1 mt-2 flex flex-col gap-3 border-t border-border bg-background/95 px-1 py-4 backdrop-blur-md",
						"supports-[backdrop-filter]:bg-background/80 medium:flex-row medium:items-center medium:justify-between",
					)}
				>
					<p className="text-muted-foreground text-sm leading-relaxed">
						<strong className="font-medium text-foreground">Save changes</strong> only saves the Profile tab
						(name, photo, phone). On School &amp; account, each field saves in its own pop-up. Use{" "}
						<strong className="font-medium text-foreground">Update password</strong> on the Password tab and{" "}
						<strong className="font-medium text-foreground">Save preferences</strong> on the Notifications
						tab.
					</p>
					<Button
						type="submit"
						className={cn(settingsCtaButtonClass, settingsCtaButtonWidthClass, "shrink-0")}
					>
						Save changes
					</Button>
				</div>
			</form>
		</div>
	);
}

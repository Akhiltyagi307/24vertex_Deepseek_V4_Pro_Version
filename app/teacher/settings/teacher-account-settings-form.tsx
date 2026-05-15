"use client";

import { BookMarked, Building2, KeyRound, Link2, Mail, User, Users } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
	updateTeacherProfile,
	updateTeacherTeachingFocus,
	type UpdateTeacherProfileState,
	type UpdateTeacherTeachingFocusState,
} from "./account-actions";
import {
	joinTeacherOrganization,
	leaveTeacherOrganization,
	type TeacherOrganizationState,
} from "./actions";
import { TeacherOrgStudentsTab } from "./teacher-org-students-tab";
import { TeacherIndependentStudentsPanel } from "../students/independent-students-panel";
import { panelRaisedInputClass, tabAccentClass } from "@/app/student/settings/_settings-form-styles";
import { PasswordChangeForm } from "@/app/student/settings/password-change-form";
import { SubmitButton } from "@/components/auth/submit-button";
import { LoginEmailChangeForm } from "@/components/auth/login-email-change-form";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { StudentAvatarUpload } from "@/components/student/student-avatar-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldContent,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { SerializedOrganization } from "@/lib/organizations/schemas";
import type { OrganizationRosterStudentRow } from "@/lib/teachers/roster-queries";
import type { SubjectCatalogRow } from "@/lib/teachers/subjects-catalog";
import { cn } from "@/lib/utils";

const tabPanelClassName =
	"min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm medium:px-8 medium:py-8 dark:border-border dark:bg-muted/20";

export type TeacherAccountProfile = {
	full_name: string;
	avatar_url: string | null;
	phone: string | null;
	teacher_roster_grade: number | null;
	teacher_roster_subject_id: string | null;
};

export function TeacherAccountSettingsForm({
	userId,
	loginEmail,
	profile,
	organizations,
	activeOrganization,
	subjectsCatalog,
	orgStudentRoster,
	independentLinkedStudents,
}: {
	userId: string;
	loginEmail: string;
	profile: TeacherAccountProfile;
	organizations: SerializedOrganization[];
	activeOrganization: SerializedOrganization | null;
	subjectsCatalog: SubjectCatalogRow[];
	/** Present when the teacher belongs to an organization — roster tab + filter metadata. */
	orgStudentRoster: {
		initialRows: OrganizationRosterStudentRow[];
		filterOptions: { grades: number[]; sections: string[] };
	} | null;
	/** Present for independent teachers — link-code connections (same data as Link Student). */
	independentLinkedStudents: { id: string; fullName: string; studentLinkCode: string | null }[] | null;
}) {
	const [profileState, profileAction] = useActionState<
		UpdateTeacherProfileState | undefined,
		FormData
	>(updateTeacherProfile, undefined);
	const [focusState, focusAction] = useActionState<
		UpdateTeacherTeachingFocusState | undefined,
		FormData
	>(updateTeacherTeachingFocus, undefined);
	const [joinState, joinAction] = useActionState<TeacherOrganizationState | undefined, FormData>(
		joinTeacherOrganization,
		undefined,
	);
	const [leaveState, leaveAction] = useActionState<TeacherOrganizationState | undefined, FormData>(
		leaveTeacherOrganization,
		undefined,
	);

	const feedbackRef = useRef<HTMLDivElement | null>(null);
	const joinJumpHandledRef = useRef(false);
	const [activateTabRequest, setActivateTabRequest] = useState<{ token: number; tabId: string } | null>(null);
	const [gradePick, setGradePick] = useState<number>(() => profile.teacher_roster_grade ?? 9);

	useEffect(() => {
		if (!activeOrganization) {
			joinJumpHandledRef.current = false;
		}
	}, [activeOrganization]);

	useEffect(() => {
		if (!activeOrganization || !joinState?.success || joinJumpHandledRef.current) return;
		joinJumpHandledRef.current = true;
		setActivateTabRequest({ token: Date.now(), tabId: "teaching-filters" });
	}, [activeOrganization, joinState?.success]);

	useEffect(() => {
		if (
			profileState?.error ||
			profileState?.success ||
			focusState?.error ||
			focusState?.success ||
			joinState?.error ||
			joinState?.success ||
			leaveState?.error ||
			leaveState?.success
		) {
			feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, [
		profileState?.error,
		profileState?.success,
		focusState?.error,
		focusState?.success,
		joinState?.error,
		joinState?.success,
		leaveState?.error,
		leaveState?.success,
	]);

	const subjectsForGrade = subjectsCatalog.filter((s) => s.grade === gradePick);

	const organizationContent = (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-lg tracking-tight text-foreground">School or tuition center</h2>
				<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
					Pick your institution and enter the <span className="font-medium text-foreground">linking code</span> your
					administrator shares from the admin panel. Joining revokes link-code access to independently linked students.
				</p>
			</div>
			<div className="space-y-4">
				{joinState?.error ? <p className="text-sm text-destructive">{joinState.error}</p> : null}
				{joinState?.success ? (
					<p className="text-sm text-muted-foreground">
						Organization connected. Use the <span className="font-medium text-foreground">Teaching filters</span> tab (opened
						for you) to choose grade and subject for roster data.
					</p>
				) : null}
				{leaveState?.error ? <p className="text-sm text-destructive">{leaveState.error}</p> : null}
				{leaveState?.success ? (
					<p className="text-sm text-muted-foreground">Organization disconnected.</p>
				) : null}

				{activeOrganization ? (
					<form action={leaveAction} className="space-y-4">
						<div className="rounded-lg border border-border/80 bg-muted/30 p-4">
							<p className="text-sm text-muted-foreground">Connected to</p>
							<p className="mt-1 font-medium">{activeOrganization.name}</p>
							<p className="text-sm text-muted-foreground">{activeOrganization.type_label}</p>
						</div>
						<Button type="submit" variant="outline">
							Leave organization
						</Button>
					</form>
				) : (
					<form action={joinAction} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="teacherOrganizationId">Choose organization</Label>
							<NativeSelect id="teacherOrganizationId" name="organizationId" required>
								<option value="">Select a school or tuition center</option>
								{organizations.map((org) => (
									<option key={org.id} value={org.id}>
										{org.name} ({org.type_label})
									</option>
								))}
							</NativeSelect>
						</div>
						<div className="space-y-2">
							<Label htmlFor="teacherOrganizationLinkingCode">Organization linking code</Label>
							<Input
								id="teacherOrganizationLinkingCode"
								name="organizationLinkingCode"
								required
								autoComplete="off"
								spellCheck={false}
								maxLength={16}
								className={panelRaisedInputClass}
								placeholder="8 characters from your administrator"
							/>
							<p className="text-muted-foreground text-xs leading-relaxed">
								This code is unique to your school or tuition center. Paste or type it exactly as shared — letters are not
								case-sensitive.
							</p>
						</div>
						<SubmitButton label="Join organization" pendingLabel="Joining..." />
					</form>
				)}
			</div>
		</div>
	);

	const teachingFiltersForm =
		activeOrganization == null ? null : (
			<form action={focusAction} className="space-y-6">
				<div>
					<h2 className="font-semibold text-lg tracking-tight text-foreground">Teaching filters</h2>
					<p className="mt-1 text-muted-foreground text-sm leading-relaxed">
						Choose the grade and subject for your organization roster on the Link Student page. Only students in your
						school who belong to that grade and take that subject appear.
					</p>
				</div>
				<div className="grid gap-4 medium:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="teacherRosterGrade">Grade</Label>
						<NativeSelect
							id="teacherRosterGrade"
							name="grade"
							required
							value={gradePick}
							onChange={(e) => setGradePick(Number(e.target.value))}
						>
							{Array.from({ length: 7 }, (_, i) => i + 6).map((g) => (
								<option key={g} value={g}>
									Grade {g}
								</option>
							))}
						</NativeSelect>
					</div>
					<div className="space-y-2">
						<Label htmlFor="teacherRosterSubject">Subject</Label>
						<NativeSelect
							key={gradePick}
							id="teacherRosterSubject"
							name="subjectId"
							required
							defaultValue={
								subjectsForGrade.some((s) => s.id === profile.teacher_roster_subject_id)
									? (profile.teacher_roster_subject_id ?? "")
									: subjectsForGrade[0]?.id ?? ""
							}
						>
							{subjectsForGrade.length === 0 ? (
								<option value="">No subjects configured for this grade</option>
							) : (
								subjectsForGrade.map((s) => (
									<option key={s.id} value={s.id}>
										{s.name}
									</option>
								))
							)}
						</NativeSelect>
					</div>
				</div>
				<p className="text-xs text-muted-foreground">
					Roster resolution follows each student&apos;s stream and elective for grades 11–12.
				</p>
				<SubmitButton
					label="Save teaching filters"
					pendingLabel="Saving…"
					disabled={subjectsForGrade.length === 0}
				/>
			</form>
		);

	const tabItems = [
		{
			id: "profile",
			title: "Profile",
			icon: User,
			color: tabAccentClass,
			content: (
				<form action={profileAction} className="space-y-6">
					<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
						<CardHeader className="px-0 pt-0">
							<CardTitle className="text-lg">Profile</CardTitle>
							<CardDescription className="text-base">
								Name, photo, and phone shown where your educator account appears.
							</CardDescription>
						</CardHeader>
						<CardContent className="px-0">
							<FieldSet className="gap-6 border-0 p-0">
								<FieldLegend className="sr-only">Editable profile</FieldLegend>
								<FieldGroup className="gap-6">
									<Field>
										<FieldLabel className="text-base" htmlFor="teacherFullName">
											Display name
										</FieldLabel>
										<FieldContent>
											<Input
												id="teacherFullName"
												name="fullName"
												required
												className={panelRaisedInputClass}
												defaultValue={profile.full_name}
												autoComplete="name"
											/>
										</FieldContent>
									</Field>
									<StudentAvatarUpload
										userId={userId}
										displayName={profile.full_name}
										initialAvatarUrl={profile.avatar_url}
									/>
									<Field>
										<FieldLabel className="text-base" htmlFor="teacherPhone">
											Phone
										</FieldLabel>
										<FieldContent>
											<Input
												id="teacherPhone"
												name="phone"
												type="tel"
												className={panelRaisedInputClass}
												autoComplete="tel"
												defaultValue={profile.phone ?? ""}
											/>
										</FieldContent>
									</Field>
								</FieldGroup>
							</FieldSet>
						</CardContent>
					</Card>
					<SubmitButton label="Save profile" pendingLabel="Saving…" />
				</form>
			),
		},
		{
			id: "login-email",
			title: "Login email",
			icon: Mail,
			color: tabAccentClass,
			content: <LoginEmailChangeForm currentEmail={loginEmail} inputIdPrefix="teacherLoginEmail" variant="embedded" />,
		},
		{
			id: "password",
			title: "Password",
			icon: KeyRound,
			color: tabAccentClass,
			content: <PasswordChangeForm loginEmail={loginEmail} fieldIdPrefix="teacher" />,
		},
		{
			id: "organization",
			title: "Organization",
			icon: Building2,
			color: tabAccentClass,
			content: organizationContent,
		},
		...(independentLinkedStudents != null
			? [
					{
						id: "linked-students",
						title: "Linked students",
						icon: Link2,
						color: tabAccentClass,
						content: (
							<div className="flex flex-col gap-6">
								<div className="space-y-1">
									<h2 className="font-semibold text-lg tracking-tight text-foreground">Students via link code</h2>
									<p className="text-muted-foreground text-sm leading-relaxed">
										Everyone listed here connected using the six-character code from their Profile. You can also open{" "}
										<span className="text-foreground">Link Student</span> in the sidebar for the same link and remove
										controls.
									</p>
								</div>
								<TeacherIndependentStudentsPanel linkedStudents={independentLinkedStudents} />
							</div>
						),
					},
				]
			: []),
		...(orgStudentRoster && activeOrganization
			? [
					{
						id: "organization-students",
						title: "Students",
						icon: Users,
						color: tabAccentClass,
						content: (
							<TeacherOrgStudentsTab
								organizationName={activeOrganization.name}
								subjectsCatalog={subjectsCatalog}
								initialRows={orgStudentRoster.initialRows}
								filterOptions={orgStudentRoster.filterOptions}
							/>
						),
					},
				]
			: []),
		...(teachingFiltersForm
			? [
					{
						id: "teaching-filters",
						title: "Teaching filters",
						icon: BookMarked,
						color: tabAccentClass,
						content: teachingFiltersForm,
					},
				]
			: []),
	];

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-6">
			<div className="shrink-0 space-y-1">
				<h1 className="text-2xl font-semibold tracking-tight">Account settings</h1>
				<p className="text-sm text-muted-foreground">
					Switch tabs for profile, sign-in, your institution, students linked by code when you&apos;re independent, or your
					organization roster and teaching filters when you belong to a school.{" "}
					<span className="text-foreground">Save profile</span> only updates the Profile tab. Login email and password use
					their own buttons; organization and teaching filters save per section.
				</p>
			</div>

			<div ref={feedbackRef}>
				{profileState?.error ? (
					<Alert variant="destructive" className="mb-2">
						<AlertTitle>Profile</AlertTitle>
						<AlertDescription>{profileState.error}</AlertDescription>
					</Alert>
				) : null}
				{profileState?.success ? (
					<Alert className="mb-2">
						<AlertTitle>Profile saved</AlertTitle>
						<AlertDescription>Your details were updated.</AlertDescription>
					</Alert>
				) : null}
				{focusState?.error ? (
					<Alert variant="destructive" className="mb-2">
						<AlertTitle>Teaching filters</AlertTitle>
						<AlertDescription>{focusState.error}</AlertDescription>
					</Alert>
				) : null}
				{focusState?.success ? (
					<Alert className="mb-2">
						<AlertTitle>Teaching filters saved</AlertTitle>
						<AlertDescription>Your Link Student page will use this grade and subject.</AlertDescription>
					</Alert>
				) : null}
			</div>

			<SmoothTab
				defaultTabId="profile"
				panelClassName={tabPanelClassName}
				persistContentPanels
				tabListPosition="top"
				items={tabItems}
				activateTabRequest={activateTabRequest}
			/>

			<div
				className={cn(
					"-mx-1 flex flex-col gap-3 border-t border-border px-1 pt-4 text-muted-foreground text-sm leading-relaxed",
					"medium:flex-row medium:items-start medium:justify-between",
				)}
			>
				<p>
					<strong className="font-medium text-foreground">Save profile</strong> applies name, photo, and phone.{" "}
					<strong className="font-medium text-foreground">Update login email</strong> and{" "}
					<strong className="font-medium text-foreground">Update password</strong> live on their tabs. Joining or leaving
					an organization submits immediately; browse organization students on the Students tab, or link-code students on
					Linked students while independent; teaching filters use{" "}
					<strong className="font-medium text-foreground">Save teaching filters</strong>.
				</p>
			</div>
		</div>
	);
}

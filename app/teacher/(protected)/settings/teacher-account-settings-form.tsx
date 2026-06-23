"use client";

import { Building2, KeyRound, Link2, Mail, User, Users } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
	updateTeacherProfile,
	type UpdateTeacherProfileState,
} from "./account-actions";
import {
	joinTeacherOrganization,
	leaveTeacherOrganization,
	type TeacherOrganizationState,
} from "./actions";
import { tabPanelClassName } from "./sections/_shared";
import { TeacherLinkedStudentsSection } from "./sections/linked-students-section";
import { TeacherLoginEmailSection } from "./sections/login-email-section";
import { TeacherOrganizationSection } from "./sections/organization-section";
import { TeacherOrgStudentsDeferredTab } from "./sections/org-students-section";
import { TeacherPasswordSection } from "./sections/password-section";
import { TeacherProfileSection } from "./sections/profile-section";
import type { TeacherAccountProfile } from "./teacher-account-settings-form-types";
import { tabAccentClass } from "@/app/student/settings/_settings-form-styles";
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { SerializedOrganization } from "@/lib/organizations/schemas";
import type { OrganizationRosterStudentRow } from "@/lib/teachers/roster-types";
import type { SubjectCatalogRow } from "@/lib/teachers/subject-catalog-label";
import { cn } from "@/lib/utils";

export type { TeacherAccountProfile } from "./teacher-account-settings-form-types";

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

	useEffect(() => {
		if (!activeOrganization) {
			joinJumpHandledRef.current = false;
		}
	}, [activeOrganization]);

	useEffect(() => {
		if (!activeOrganization || !joinState?.success || joinJumpHandledRef.current) return;
		joinJumpHandledRef.current = true;
		let cancelled = false;
		queueMicrotask(() => {
			if (!cancelled) {
				setActivateTabRequest({ token: Date.now(), tabId: "organization-students" });
			}
		});
		return () => {
			cancelled = true;
		};
	}, [activeOrganization, joinState?.success]);

	useEffect(() => {
		if (
			profileState?.error ||
			profileState?.success ||
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
		joinState?.error,
		joinState?.success,
		leaveState?.error,
		leaveState?.success,
	]);

	const tabItems = [
		{
			id: "profile",
			title: "Profile",
			icon: User,
			color: tabAccentClass,
			content: <TeacherProfileSection userId={userId} profile={profile} formAction={profileAction} />,
		},
		{
			id: "login-email",
			title: "Login email",
			icon: Mail,
			color: tabAccentClass,
			content: <TeacherLoginEmailSection loginEmail={loginEmail} />,
		},
		{
			id: "password",
			title: "Password",
			icon: KeyRound,
			color: tabAccentClass,
			content: <TeacherPasswordSection loginEmail={loginEmail} />,
		},
		{
			id: "organization",
			title: "Organization",
			icon: Building2,
			color: tabAccentClass,
			content: (
				<TeacherOrganizationSection
					organizations={organizations}
					activeOrganization={activeOrganization}
					joinState={joinState}
					leaveState={leaveState}
					joinAction={joinAction}
					leaveAction={leaveAction}
				/>
			),
		},
		...(independentLinkedStudents != null
			? [
					{
						id: "linked-students",
						title: "Linked students",
						icon: Link2,
						color: tabAccentClass,
						content: <TeacherLinkedStudentsSection independentLinkedStudents={independentLinkedStudents} />,
					},
				]
			: []),
		...(activeOrganization
			? [
					{
						id: "organization-students",
						title: "Students",
						icon: Users,
						color: tabAccentClass,
						content: (
							<TeacherOrgStudentsDeferredTab
								organizationName={activeOrganization.name}
								subjectsCatalog={subjectsCatalog}
								initialData={orgStudentRoster}
							/>
						),
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
					organization roster when you belong to a school.{" "}
					<span className="text-foreground">Save profile</span> only updates the Profile tab. Login email and password use
					their own buttons; organization changes save per section.
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
			</div>

			<SmoothTab
				defaultTabId="profile"
				panelClassName={tabPanelClassName}
				persistContentPanels
				deferUntilActivatedTabIds={activeOrganization ? ["organization-students"] : []}
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
					Linked students while independent.
				</p>
			</div>
		</div>
	);
}

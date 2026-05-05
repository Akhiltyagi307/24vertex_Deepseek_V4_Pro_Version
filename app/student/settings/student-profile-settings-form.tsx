"use client";

import {
	Bell,
	CheckIcon,
	CopyIcon,
	GraduationCap,
	KeyRound,
	Pencil,
	ShieldAlert,
	ShieldCheck,
	User,
	Users,
} from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";

import {
	updateStudentProfile,
	type UpdateStudentProfileState,
} from "./actions";
import { NotificationPreferencesForm } from "./notification-preferences-form";
import type {
	NotificationPreferencesInitial,
	NotificationPreferencesInput,
	NotificationPreferencesState,
} from "./notification-preferences-types";
import { PasswordChangeForm } from "./password-change-form";
import {
	formatPlacementStream,
	PlacementFieldDialog,
	type PlacementField,
} from "./placement-field-dialog";
import {
	accountReadonlyInputClass,
	panelRaisedInputClass,
	tabAccentClass,
} from "./_settings-form-styles";
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
import SmoothTab from "@/components/kokonutui/smooth-tab";
import { PageHeaderSubtext } from "@/components/student/page-header-subtext";
import { StudentAvatarUpload } from "@/components/student/student-avatar-upload";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
	is_verified: boolean | null;
	created_at: string;
};

const settingsNestedWellClass =
	"rounded-xl border border-border/80 bg-sidebar-accent p-4 shadow-sm dark:border-border dark:bg-foreground/10 medium:p-5";

function AccountFieldEditButton({
	tooltipContent,
	ariaLabel,
	onClick,
}: {
	tooltipContent: string;
	ariaLabel: string;
	onClick?: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						onClick={onClick}
						className={cn(
							"rounded-md p-1.5",
							"text-muted-foreground transition-colors",
							"hover:bg-muted/80 hover:text-foreground",
							"focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
						)}
						aria-label={ariaLabel}
					>
						<Pencil className="size-4" />
					</button>
				}
			/>
			<TooltipContent side="top" className="max-w-[240px] text-center text-xs">
				{tooltipContent}
			</TooltipContent>
		</Tooltip>
	);
}

function AccountReadonlyField({
	label,
	value,
	schoolManaged,
	onSchoolPlacementEdit,
	placementEditTooltip,
	placementEditAriaLabel,
	lockedFieldHint,
	description,
	className,
}: {
	label: string;
	value: string;
	schoolManaged?: boolean;
	/** Opens the school placement editor for this row. */
	onSchoolPlacementEdit?: () => void;
	placementEditTooltip?: string;
	placementEditAriaLabel?: string;
	/** Shows the same pencil affordance with this message (non–school-managed fields). */
	lockedFieldHint?: string;
	/** Muted helper below the field (no edit affordance). */
	description?: string;
	className?: string;
}) {
	const id = useId();
	const showSchoolEdit = Boolean(schoolManaged);
	const showLockedEdit = Boolean(lockedFieldHint) && !schoolManaged;
	const trailing = showSchoolEdit ? (
		<div className="absolute top-1/2 right-1.5 z-10 -translate-y-1/2">
			<AccountFieldEditButton
				tooltipContent={
					onSchoolPlacementEdit
						? (placementEditTooltip ?? "Edit this field.")
						: "Set by your school. It cannot be edited here."
				}
				ariaLabel={
					onSchoolPlacementEdit
						? (placementEditAriaLabel ?? "Edit placement")
						: "School-managed field. Cannot be changed in EduAI."
				}
				onClick={onSchoolPlacementEdit}
			/>
		</div>
	) : showLockedEdit ? (
		<div className="absolute top-1/2 right-1.5 z-10 -translate-y-1/2">
			<AccountFieldEditButton
				tooltipContent={lockedFieldHint!}
				ariaLabel="This field cannot be edited in EduAI."
			/>
		</div>
	) : null;

	return (
		<div className={cn("flex flex-col gap-2", className)}>
			<label htmlFor={id} className="text-foreground/70 text-sm font-medium leading-snug">
				{label}
			</label>
			<div className="relative">
				<Input
					id={id}
					readOnly
					value={value}
					className={cn(
						accountReadonlyInputClass,
						"font-medium text-foreground",
						trailing ? "pr-11" : "pr-3",
						description && !trailing && "cursor-default",
					)}
				/>
				{trailing}
			</div>
			{description ? (
				<p className="mt-1.5 text-muted-foreground text-xs leading-relaxed">{description}</p>
			) : null}
		</div>
	);
}

// PlacementFieldDialog and related helpers were extracted to ./placement-field-dialog.tsx (Phase 1.4).


function LoginEmailField({
	email,
	isVerified,
}: {
	email: string;
	isVerified: boolean | null;
}) {
	const id = useId();
	const verificationAffordance =
		isVerified === true ? (
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							className={cn(
								"rounded-md p-1.5",
								"text-emerald-600 transition-colors dark:text-emerald-400",
								"hover:bg-muted/80",
								"focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
							)}
							aria-label="Verified account"
						>
							<ShieldCheck className="size-4" aria-hidden />
						</button>
					}
				/>
				<TooltipContent side="top" className="max-w-[240px] text-center text-xs">
					Verified account
				</TooltipContent>
			</Tooltip>
		) : isVerified === false ? (
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							className={cn(
								"rounded-md p-1.5",
								"text-amber-600 transition-colors dark:text-amber-500",
								"hover:bg-muted/80",
								"focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
							)}
							aria-label="Verification pending"
						>
							<ShieldAlert className="size-4" aria-hidden />
						</button>
					}
				/>
				<TooltipContent side="top" className="max-w-[240px] text-center text-xs">
					Verification pending
				</TooltipContent>
			</Tooltip>
		) : null;

	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={id} className="text-foreground/70 text-sm font-medium leading-snug">
				Login email
			</label>
			<div className="relative">
				<Input
					id={id}
					readOnly
					value={email || "—"}
					className={cn(
						accountReadonlyInputClass,
						"font-medium text-foreground",
						verificationAffordance ? "pr-[5.25rem]" : "pr-11",
					)}
				/>
				<div className="absolute top-1/2 right-1.5 z-10 flex -translate-y-1/2 items-center gap-0.5">
					{verificationAffordance}
					<AccountFieldEditButton
						tooltipContent="Your login email is tied to your sign-in and cannot be changed here."
						ariaLabel="Login email cannot be edited in EduAI."
					/>
				</div>
			</div>
		</div>
	);
}

export function StudentProfileSettingsForm({
	userId,
	loginEmail,
	profile,
	electiveSubjectName,
	resolvedSubjects = [],
	subjectsLoadError = null,
	initialNotificationPrefs,
	saveNotificationPreferences,
}: {
	userId: string;
	loginEmail: string;
	profile: StudentProfileSettingsRow;
	electiveSubjectName: string | null;
	resolvedSubjects?: ResolvedSubjectForSettings[];
	subjectsLoadError?: string | null;
	initialNotificationPrefs: NotificationPreferencesInitial;
	saveNotificationPreferences: (
		input: NotificationPreferencesInput,
	) => Promise<NotificationPreferencesState>;
}) {
	const [state, formAction] = useActionState<UpdateStudentProfileState | undefined, FormData>(
		updateStudentProfile,
		undefined,
	);
	const [copied, setCopied] = useState(false);
	const [placementField, setPlacementField] = useState<PlacementField | null>(null);
	const feedbackRef = useRef<HTMLDivElement | null>(null);

	const shareText = profile.student_link_code ?? profile.id;

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

	const enrolled = new Date(profile.created_at).toLocaleDateString("en-US", {
		dateStyle: "long",
	});
	const accountDetails = (
		<div className={cn(settingsNestedWellClass, "text-base")}>
			<div className="grid grid-cols-1 gap-4 medium:grid-cols-2">
				<div className="min-w-0 medium:col-span-2">
					<LoginEmailField email={loginEmail} isVerified={profile.is_verified} />
				</div>
				<AccountReadonlyField
					className="min-w-0 medium:col-span-2"
					label="Enrollment date"
					value={enrolled}
					description="Set when your account was created. This cannot be changed."
				/>
				<AccountReadonlyField
					className="min-w-0"
					label="Grade"
					schoolManaged
					value={profile.grade != null ? String(profile.grade) : "—"}
					onSchoolPlacementEdit={() => setPlacementField("grade")}
					placementEditTooltip="Edit grade"
					placementEditAriaLabel="Edit grade"
				/>
				<AccountReadonlyField
					className="min-w-0"
					label="Section"
					schoolManaged
					value={profile.section?.trim() || "—"}
					onSchoolPlacementEdit={() => setPlacementField("section")}
					placementEditTooltip="Edit section"
					placementEditAriaLabel="Edit section"
				/>
				<AccountReadonlyField
					className="min-w-0"
					label="Stream"
					schoolManaged
					value={formatPlacementStream(profile.stream)}
					onSchoolPlacementEdit={() => setPlacementField("stream")}
					placementEditTooltip="Edit stream"
					placementEditAriaLabel="Edit stream"
				/>
				<AccountReadonlyField
					className="min-w-0"
					label="Elective"
					schoolManaged
					value={electiveSubjectName ?? "—"}
					onSchoolPlacementEdit={() => setPlacementField("elective")}
					placementEditTooltip="Edit elective"
					placementEditAriaLabel="Edit elective"
				/>
				<AccountReadonlyField
					className="min-w-0 medium:col-span-2"
					label="School"
					schoolManaged
					value={profile.school_name?.trim() || "—"}
					onSchoolPlacementEdit={() => setPlacementField("school")}
					placementEditTooltip="Edit school name"
					placementEditAriaLabel="Edit school"
				/>
			</div>
		</div>
	);

	const subjectsPanel = (
		<div className={settingsNestedWellClass}>
			<p className="text-foreground text-sm font-semibold">Subjects</p>
			{subjectsLoadError ? (
				<Alert variant="destructive" className="mt-3">
					<AlertTitle>Could not refresh subjects</AlertTitle>
					<AlertDescription>{subjectsLoadError}</AlertDescription>
				</Alert>
			) : null}
			<div className="mt-2 flex flex-wrap gap-2">
				{resolvedSubjects.length > 0 ? (
					resolvedSubjects.map((s) => (
						<span
							key={s.id}
							className="inline-flex items-center gap-2 rounded-lg border border-border/90 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm dark:border-border dark:bg-muted/50"
						>
							<span
								className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-500"
								aria-hidden
							>
								<CheckIcon className="size-3 text-white" strokeWidth={2.75} />
							</span>
							{s.name}
						</span>
					))
				) : (
					<span className="rounded-lg border border-border/90 bg-background px-3 py-2 text-foreground/70 text-sm shadow-sm dark:border-border dark:bg-muted/50">
						—
					</span>
				)}
			</div>
			<p className="mt-3 text-foreground/80 text-sm leading-relaxed dark:text-muted-foreground">
				{profile.grade == null
					? "Set your grade (and stream or elective for 11–12) so we can list the subjects you should see."
					: profile.grade >= 11
						? "We pick these from your grade, stream, and elective. If something’s missing, fix the fields above or ask your school."
						: "We pick these from your grade. If the list looks wrong, double-check the fields above with your school."}
			</p>
		</div>
	);

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
				<Button type="button" variant="outline" size="default" onClick={copyShareCode} className="shrink-0">
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
									{accountDetails}
									{subjectsPanel}
									{linkCodePanel}
								</div>
							),
						},
						{
							id: "profile",
							title: "Profile",
							icon: User,
							color: tabAccentClass,
							content: (
								<div>
									<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
										<CardHeader className="px-0 pt-0">
											<CardTitle className="text-lg">Profile</CardTitle>
											<CardDescription className="text-base">
												Name, photo, and phone—what classmates and reports see as you.
											</CardDescription>
										</CardHeader>
										<CardContent className="px-0">
											<FieldSet className="gap-6 border-0 p-0">
												<FieldLegend className="sr-only">Editable profile</FieldLegend>
												<FieldGroup className="gap-6">
													<Field>
														<FieldLabel className="text-base" htmlFor="fullName">
															Display name
														</FieldLabel>
														<FieldContent>
															<Input
																id="fullName"
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
														<FieldLabel className="text-base" htmlFor="phone">
															Phone
														</FieldLabel>
														<FieldContent>
															<Input
																id="phone"
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
								</div>
							),
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
							content: (
								<div>
									<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
										<CardHeader className="px-0 pt-0">
											<CardTitle className="text-lg">Guardian &amp; parent connection</CardTitle>
											<CardDescription className="text-base leading-relaxed">
												After a parent connects using your link code, we show their contact here.
												You cannot change these fields.
											</CardDescription>
										</CardHeader>
										<CardContent className="px-0">
											<div className="flex flex-col gap-4">
												<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed">
													<span className="text-muted-foreground font-medium">Guardian name</span>
													<span className="text-muted-foreground"> - </span>
													<span className="min-w-0 text-foreground">
														{profile.parent_name?.trim() || "—"}
													</span>
												</p>
												<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed">
													<span className="text-muted-foreground font-medium">Guardian email</span>
													<span className="text-muted-foreground"> - </span>
													<span className="min-w-0 break-all text-foreground">
														{profile.parent_email?.trim() || "—"}
													</span>
												</p>
											</div>
											<p className="mt-6 text-muted-foreground text-sm leading-relaxed">
												These values are set when your parent links their account with your link
												code.
											</p>
										</CardContent>
									</Card>
								</div>
							),
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
						size="lg"
						className="h-11 w-full shrink-0 px-6 text-base medium:w-auto"
					>
						Save changes
					</Button>
				</div>
			</form>
		</div>
	);
}

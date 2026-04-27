"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
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
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";

import {
	updateStudentProfile,
	updateStudentSchoolPlacement,
	type UpdateStudentProfileState,
} from "./actions";
import { createClient } from "@/lib/supabase/client";
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
	FieldDescription,
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
import { studentChangePasswordSchema } from "@/lib/validations/auth";
import { cn } from "@/lib/utils";

const PLACEMENT_STREAM_OPTIONS: { value: string; label: string }[] = [
	{ value: "science", label: "Science" },
	{ value: "science_pcmb", label: "Science (PCMB)" },
	{ value: "science_pcm", label: "Science (PCM)" },
	{ value: "science_pcb", label: "Science (PCB)" },
	{ value: "commerce", label: "Commerce" },
	{ value: "commerce_with_maths", label: "Commerce with Mathematics" },
	{ value: "arts", label: "Arts" },
];

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

function formatStream(stream: string | null): string {
	if (!stream) return "—";
	const label = PLACEMENT_STREAM_OPTIONS.find((o) => o.value === stream)?.label;
	return label ?? stream.charAt(0).toUpperCase() + stream.slice(1);
}

const tabAccentClass =
	"bg-emerald-600 hover:bg-emerald-600/90 dark:bg-emerald-500 dark:hover:bg-emerald-500/90";

const comfortableInputClass =
	"h-10 md:h-10 md:text-base px-3 py-2 file:text-sm [&::file-selector-button]:text-sm";

/** Solid light fill on grey/muted panels (Input defaults to transparent). */
const panelRaisedInputClass = cn(
	comfortableInputClass,
	"border-border/90 bg-background shadow-sm dark:border-input dark:bg-input/35",
);

const accountReadonlyInputClass = panelRaisedInputClass;

const settingsNestedWellClass =
	"rounded-xl border border-border/80 bg-sidebar-accent p-4 shadow-sm dark:border-border dark:bg-foreground/10 md:p-5";

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

const placementSelectClass = cn(
	panelRaisedInputClass,
	"w-full cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-10",
);

const GRADE_OPTIONS = [6, 7, 8, 9, 10, 11, 12] as const;

type PlacementField = "grade" | "section" | "stream" | "elective" | "school";

type PlacementPayload = {
	grade: number;
	section: string;
	stream: string | null;
	electiveSubjectId: string | null;
	schoolName: string | null;
};

/** Merge current profile with a single edited field for `updateStudentSchoolPlacement`. */
function buildPlacementPayload(
	profile: StudentProfileSettingsRow,
	patch: Partial<{
		grade: number;
		section: string;
		stream: string | null;
		electiveSubjectId: string | null;
		schoolName: string | null;
	}>,
): { ok: true; payload: PlacementPayload } | { ok: false; error: string } {
	const grade = patch.grade !== undefined ? patch.grade : profile.grade;
	if (grade == null || Number.isNaN(grade)) {
		return { ok: false, error: "Set your grade first." };
	}

	const section =
		patch.section !== undefined ? patch.section : (profile.section?.trim() ?? "");
	let stream = patch.stream !== undefined ? patch.stream : profile.stream;
	let electiveId =
		patch.electiveSubjectId !== undefined
			? patch.electiveSubjectId
			: profile.elective_subject_id;
	let schoolName =
		patch.schoolName !== undefined
			? patch.schoolName
			: (profile.school_name?.trim() || null);

	if (grade < 11) {
		stream = null;
		electiveId = null;
	}

	const streamPayload = grade >= 11 ? (stream && stream !== "" ? stream : null) : null;
	const electivePayload = grade >= 11 && electiveId ? electiveId : null;
	if (typeof schoolName === "string" && schoolName.trim() === "") {
		schoolName = null;
	}

	return {
		ok: true,
		payload: {
			grade,
			section: section.trim(),
			stream: streamPayload,
			electiveSubjectId: electivePayload,
			schoolName,
		},
	};
}

const PLACEMENT_FIELD_COPY: Record<
	PlacementField,
	{ title: string; description: string }
> = {
	grade: {
		title: "Edit grade",
		description: "Your grade drives which subjects apply. If you move to grade 11 or 12, set your stream next.",
	},
	section: {
		title: "Edit section",
		description: "Your class section (for example A or B).",
	},
	stream: {
		title: "Edit stream",
		description: "Stream applies to grades 11–12 and affects which electives you can choose.",
	},
	elective: {
		title: "Edit elective",
		description: "Choose an elective that matches your grade and stream.",
	},
	school: {
		title: "Edit school",
		description: "The school name shown on your profile.",
	},
};

function PlacementFieldDialog({
	field,
	onClose,
	profile,
}: {
	field: PlacementField | null;
	onClose: () => void;
	profile: StudentProfileSettingsRow;
}) {
	const router = useRouter();
	const open = field !== null;
	const titleId = useId();
	const descId = useId();

	const [gradeDraft, setGradeDraft] = useState(() => profile.grade ?? 9);
	const [sectionDraft, setSectionDraft] = useState(() => profile.section?.trim() ?? "");
	const [streamDraft, setStreamDraft] = useState(() => profile.stream ?? "");
	const [electiveDraft, setElectiveDraft] = useState(() => profile.elective_subject_id ?? "");
	const [schoolDraft, setSchoolDraft] = useState(() => profile.school_name?.trim() ?? "");
	const [electives, setElectives] = useState<{ id: string; name: string }[]>([]);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const seniorEligible =
		profile.grade != null && profile.grade >= 11 && profile.grade <= 12;
	const streamElectiveBlocked = profile.grade == null || profile.grade < 11;
	const electiveNeedsStream = seniorEligible && !profile.stream;

	useEffect(() => {
		if (!open || field !== "elective") return;
		if (!seniorEligible || electiveNeedsStream) return;
		const g = profile.grade!;
		const st = profile.stream!;
		let cancelled = false;
		(async () => {
			const supabase = createClient();
			const { data, error: qErr } = await supabase
				.from("subjects")
				.select("id, name, stream")
				.eq("grade", g)
				.eq("is_elective", true)
				.eq("is_active", true)
				.order("name");
			if (cancelled || qErr) return;
			const rows = (data ?? []).filter((s) => {
				const rowStream = s.stream as string | null;
				return !rowStream || rowStream === st;
			});
			setElectives(rows.map((s) => ({ id: s.id as string, name: s.name as string })));
		})().catch(() => {
			if (!cancelled) setElectives([]);
		});
		return () => {
			cancelled = true;
		};
	}, [open, field, profile.grade, profile.stream, seniorEligible, electiveNeedsStream]);

	function handleOpenChange(next: boolean) {
		if (!next) onClose();
	}

	async function saveWithPatch(
		patch: Partial<{
			grade: number;
			section: string;
			stream: string | null;
			electiveSubjectId: string | null;
			schoolName: string | null;
		}>,
	) {
		setError(null);
		const built = buildPlacementPayload(profile, patch);
		if (!built.ok) {
			setError(built.error);
			return;
		}
		setPending(true);
		const result = await updateStudentSchoolPlacement({
			grade: built.payload.grade,
			section: built.payload.section,
			stream: built.payload.stream,
			electiveSubjectId: built.payload.electiveSubjectId,
			schoolName: built.payload.schoolName,
		});
		setPending(false);
		if (result?.error) {
			setError(result.error);
			return;
		}
		onClose();
		router.refresh();
	}

	async function handleSaveField() {
		if (!field) return;
		switch (field) {
			case "grade":
				return saveWithPatch({ grade: gradeDraft });
			case "section":
				return saveWithPatch({ section: sectionDraft });
			case "stream": {
				if (streamElectiveBlocked) return;
				const s = streamDraft.trim();
				if (!s) {
					setError("Select a stream for grades 11–12.");
					return;
				}
				return saveWithPatch({ stream: s });
			}
			case "elective": {
				if (streamElectiveBlocked || electiveNeedsStream) return;
				return saveWithPatch({
					electiveSubjectId: effectiveElectiveDraft ? effectiveElectiveDraft : null,
				});
			}
			case "school":
				return saveWithPatch({ schoolName: schoolDraft.trim() || null });
			default:
				return;
		}
	}

	const copy = field ? PLACEMENT_FIELD_COPY[field] : null;
	const showSave =
		field != null &&
		(field === "grade" ||
			field === "section" ||
			field === "school" ||
			(field === "stream" && !streamElectiveBlocked) ||
			(field === "elective" && !streamElectiveBlocked && !electiveNeedsStream));

	const gatedStreamElective =
		field === "stream" || field === "elective"
			? streamElectiveBlocked
				? "Stream and elective apply to grades 11–12. Update your grade first, then set stream and elective."
				: field === "elective" && electiveNeedsStream
					? "Choose your stream before selecting an elective."
					: null
			: null;
	const effectiveElectiveDraft =
		electiveDraft && electives.some((elective) => elective.id === electiveDraft) ?
			electiveDraft
		:	"";

	return (
		<Dialog.Root open={open} onOpenChange={(o) => handleOpenChange(o)}>
			<Dialog.Portal>
				<Dialog.Backdrop
					className={cn(
						"fixed inset-0 z-50 bg-black/60 transition-opacity duration-150",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				/>
				<Dialog.Popup
					className={cn(
						"fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,720px)] w-[min(calc(100vw-2rem),440px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg",
						"data-ending-style:opacity-0 data-starting-style:opacity-0",
					)}
				>
					{copy ? (
						<>
							<Dialog.Title id={titleId} className="font-semibold text-base tracking-tight">
								{copy.title}
							</Dialog.Title>
							<Dialog.Description
								id={descId}
								className="text-muted-foreground text-sm leading-relaxed"
							>
								{copy.description}
							</Dialog.Description>
						</>
					) : null}

					{gatedStreamElective ? (
						<p className="text-foreground/90 text-sm leading-relaxed">{gatedStreamElective}</p>
					) : null}

					{field === "grade" ? (
						<div className="flex flex-col gap-2">
							<label htmlFor={`${titleId}-grade`} className="text-foreground/70 text-sm font-medium">
								Grade
							</label>
							<select
								id={`${titleId}-grade`}
								className={placementSelectClass}
								value={gradeDraft}
								onChange={(e) => setGradeDraft(Number(e.target.value))}
							>
								{GRADE_OPTIONS.map((g) => (
									<option key={g} value={g}>
										{g}
									</option>
								))}
							</select>
						</div>
					) : null}

					{field === "section" ? (
						<div className="flex flex-col gap-2">
							<label htmlFor={`${titleId}-section`} className="text-foreground/70 text-sm font-medium">
								Section
							</label>
							<Input
								id={`${titleId}-section`}
								value={sectionDraft}
								onChange={(e) => setSectionDraft(e.target.value)}
								maxLength={5}
								className={panelRaisedInputClass}
								placeholder="e.g. B"
								autoComplete="off"
							/>
						</div>
					) : null}

					{field === "stream" && !streamElectiveBlocked ? (
						<div className="flex flex-col gap-2">
							<label htmlFor={`${titleId}-stream`} className="text-foreground/70 text-sm font-medium">
								Stream
							</label>
							<select
								id={`${titleId}-stream`}
								className={placementSelectClass}
								value={streamDraft}
								onChange={(e) => setStreamDraft(e.target.value)}
							>
								<option value="">Select stream…</option>
								{PLACEMENT_STREAM_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</div>
					) : null}

					{field === "elective" && seniorEligible && !electiveNeedsStream ? (
						<div className="flex flex-col gap-2">
							<label htmlFor={`${titleId}-elective`} className="text-foreground/70 text-sm font-medium">
								Elective
							</label>
							<select
								id={`${titleId}-elective`}
								className={placementSelectClass}
								value={effectiveElectiveDraft}
								onChange={(e) => setElectiveDraft(e.target.value)}
							>
								<option value="">None</option>
								{electives.map((e) => (
									<option key={e.id} value={e.id}>
										{e.name}
									</option>
								))}
							</select>
						</div>
					) : null}

					{field === "school" ? (
						<div className="flex flex-col gap-2">
							<label htmlFor={`${titleId}-school`} className="text-foreground/70 text-sm font-medium">
								School
							</label>
							<Input
								id={`${titleId}-school`}
								value={schoolDraft}
								onChange={(e) => setSchoolDraft(e.target.value)}
								maxLength={300}
								className={panelRaisedInputClass}
								placeholder="School name"
								autoComplete="organization"
							/>
						</div>
					) : null}

					{error ? (
						<p className="text-destructive text-sm" role="alert">
							{error}
						</p>
					) : null}

					<div className="flex justify-end gap-2 border-border border-t pt-2">
						<Button type="button" variant="outline" onClick={onClose} disabled={pending}>
							{showSave ? "Cancel" : "Close"}
						</Button>
						{showSave ? (
							<Button type="button" onClick={() => void handleSaveField()} disabled={pending}>
								{pending ? "Saving…" : "Save"}
							</Button>
						) : null}
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

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
}: {
	userId: string;
	loginEmail: string;
	profile: StudentProfileSettingsRow;
	electiveSubjectName: string | null;
	resolvedSubjects?: ResolvedSubjectForSettings[];
	subjectsLoadError?: string | null;
}) {
	const [state, formAction] = useActionState<UpdateStudentProfileState | undefined, FormData>(
		updateStudentProfile,
		undefined,
	);
	const [copied, setCopied] = useState(false);
	const [pwCurrent, setPwCurrent] = useState("");
	const [pwNew, setPwNew] = useState("");
	const [pwConfirm, setPwConfirm] = useState("");
	const [pwError, setPwError] = useState<string | null>(null);
	const [pwSuccess, setPwSuccess] = useState(false);
	const [pwPending, setPwPending] = useState(false);
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

	async function handleChangePassword() {
		setPwError(null);
		setPwSuccess(false);
		if (!loginEmail.trim()) {
			setPwError("Your account email is missing. Try signing out and back in.");
			return;
		}
		const parsed = studentChangePasswordSchema.safeParse({
			currentPassword: pwCurrent,
			newPassword: pwNew,
			confirmPassword: pwConfirm,
		});
		if (!parsed.success) {
			const first =
				Object.values(parsed.error.flatten().fieldErrors).flat()[0] ??
				parsed.error.issues[0]?.message ??
				"Check your password fields.";
			setPwError(first);
			return;
		}
		setPwPending(true);
		const supabase = createClient();
		const { error: signErr } = await supabase.auth.signInWithPassword({
			email: loginEmail.trim(),
			password: parsed.data.currentPassword,
		});
		if (signErr) {
			setPwPending(false);
			setPwError(
				"That current password is incorrect, or this account may use another sign-in method (for example Google) instead of a password.",
			);
			return;
		}
		const { error: updErr } = await supabase.auth.updateUser({
			password: parsed.data.newPassword,
		});
		setPwPending(false);
		if (updErr) {
			setPwError(updErr.message);
			return;
		}
		setPwSuccess(true);
		setPwCurrent("");
		setPwNew("");
		setPwConfirm("");
	}

	const enrolled = new Date(profile.created_at).toLocaleDateString("en-US", {
		dateStyle: "long",
	});
	const accountDetails = (
		<div className={cn(settingsNestedWellClass, "text-base")}>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="min-w-0 sm:col-span-2">
					<LoginEmailField email={loginEmail} isVerified={profile.is_verified} />
				</div>
				<AccountReadonlyField
					className="min-w-0 sm:col-span-2"
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
					value={formatStream(profile.stream)}
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
					className="min-w-0 sm:col-span-2"
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
						: "We pick these from your grade. If the list looks wrong, double-check the fields above with your class teacher."}
			</p>
		</div>
	);

	const linkCodePanel = (
		<div className={settingsNestedWellClass}>
			<p className="text-foreground text-sm font-semibold">Link code</p>
			<div className="mt-2 flex flex-wrap items-center gap-3">
				<code
					className={cn(
						"rounded-lg border border-border/80 bg-background px-3 py-2 font-mono text-base shadow-sm dark:border-border dark:bg-muted/40",
						profile.student_link_code ? "tracking-wide" : "break-all text-sm",
					)}
				>
					{shareText}
				</code>
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
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
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
				<PageHeaderSubtext>
					Manage your name, photo, and appearance here; use{" "}
					<span className="text-foreground/90">Save changes</span> on this tab, Password for sign-in,{" "}
					<span className="text-foreground/90">School &amp; account</span> for grade and placement, and note
					guardian email is read-only until your school updates it.
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
					className="max-w-none"
					defaultTabId="school"
					panelClassName="min-h-[280px] rounded-xl border border-border/90 bg-muted px-6 py-7 shadow-sm md:px-8 md:py-8 dark:border-border dark:bg-muted/20"
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
							content: (
								<div>
									<Card className="border-0 bg-transparent p-0 shadow-none ring-0">
										<CardHeader className="px-0 pt-0">
											<CardTitle className="text-lg">Change password</CardTitle>
											<CardDescription className="text-base leading-relaxed">
												Update the password for this email login. This uses the button on this tab—not
												“Save changes” at the bottom.
											</CardDescription>
										</CardHeader>
										<CardContent className="px-0">
											{pwError ? (
												<Alert variant="destructive" className="mb-6" role="alert">
													<AlertTitle>Could not update password</AlertTitle>
													<AlertDescription>{pwError}</AlertDescription>
												</Alert>
											) : null}
											{pwSuccess ? (
												<Alert className="mb-6" role="status">
													<CheckIcon />
													<AlertTitle>Password updated</AlertTitle>
													<AlertDescription>Your new password is ready to use.</AlertDescription>
												</Alert>
											) : null}
											<FieldGroup className="gap-6">
												<Field>
													<FieldLabel className="text-base" htmlFor="studentCurrentPassword">
														Current password
													</FieldLabel>
													<FieldContent>
														<Input
															id="studentCurrentPassword"
															type="password"
															className={panelRaisedInputClass}
															autoComplete="current-password"
															value={pwCurrent}
															onChange={(e) => setPwCurrent(e.target.value)}
														/>
													</FieldContent>
												</Field>
												<Field>
													<FieldLabel className="text-base" htmlFor="studentNewPassword">
														New password
													</FieldLabel>
													<FieldContent>
														<Input
															id="studentNewPassword"
															type="password"
															className={panelRaisedInputClass}
															autoComplete="new-password"
															value={pwNew}
															onChange={(e) => setPwNew(e.target.value)}
														/>
														<FieldDescription className="text-sm">
															At least 8 characters, same as when you signed up.
														</FieldDescription>
													</FieldContent>
												</Field>
												<Field>
													<FieldLabel className="text-base" htmlFor="studentConfirmPassword">
														Confirm password
													</FieldLabel>
													<FieldContent>
														<Input
															id="studentConfirmPassword"
															type="password"
															className={panelRaisedInputClass}
															autoComplete="new-password"
															value={pwConfirm}
															onChange={(e) => setPwConfirm(e.target.value)}
														/>
													</FieldContent>
												</Field>
											</FieldGroup>
											<Button
												type="button"
												className="mt-6 h-11 w-full text-base sm:w-auto"
												size="lg"
												disabled={pwPending}
												onClick={() => void handleChangePassword()}
											>
												{pwPending ? "Updating…" : "Update password"}
											</Button>
										</CardContent>
									</Card>
								</div>
							),
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
											<CardTitle className="text-lg">Guardian contact</CardTitle>
											<CardDescription className="text-base leading-relaxed">
												We show what your school has on file for a parent or guardian. You can’t edit it
												here.
											</CardDescription>
										</CardHeader>
										<CardContent className="px-0">
											<div className="flex flex-col gap-4">
												<AccountReadonlyField
													label="Guardian name"
													value={profile.parent_name?.trim() || "—"}
													lockedFieldHint="Guardian details are on file from your school and cannot be edited here."
												/>
												<AccountReadonlyField
													label="Guardian email"
													value={profile.parent_email?.trim() || "—"}
													lockedFieldHint="Guardian details are on file from your school and cannot be edited here."
												/>
											</div>
											<p className="mt-4 text-muted-foreground text-sm leading-relaxed">
												If a name or email is outdated, your school has to change it in their records.
											</p>
										</CardContent>
									</Card>
								</div>
							),
						},
					]}
				/>

				<div
					className={cn(
						"sticky bottom-0 z-10 -mx-1 mt-2 flex flex-col gap-3 border-t border-border bg-background/95 px-1 py-4 backdrop-blur-md",
						"supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between",
					)}
				>
					<p className="text-muted-foreground text-sm leading-relaxed sm:max-w-md">
						<strong className="font-medium text-foreground">Save changes</strong> only saves the Profile tab
						(name, photo, phone). On School &amp; account, each field saves in its own pop-up. Use{" "}
						<strong className="font-medium text-foreground">Update password</strong> on the Password tab.
					</p>
					<Button
						type="submit"
						size="lg"
						className="h-11 w-full shrink-0 px-6 text-base sm:w-auto"
					>
						Save changes
					</Button>
				</div>
			</form>
		</div>
	);
}

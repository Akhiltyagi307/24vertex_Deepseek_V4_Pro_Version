"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { updateStudentSchoolPlacement } from "./actions";
import { panelRaisedInputClass } from "./_settings-form-styles";
import type { StudentProfileSettingsRow } from "./student-profile-settings-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export const PLACEMENT_STREAM_OPTIONS: { value: string; label: string }[] = [
	{ value: "science", label: "Science" },
	{ value: "science_pcmb", label: "Science (PCMB)" },
	{ value: "science_pcm", label: "Science (PCM)" },
	{ value: "science_pcb", label: "Science (PCB)" },
	{ value: "commerce", label: "Commerce" },
	{ value: "commerce_with_maths", label: "Commerce with Mathematics" },
	{ value: "arts", label: "Arts" },
];

export function formatPlacementStream(stream: string | null): string {
	if (!stream) return "—";
	const label = PLACEMENT_STREAM_OPTIONS.find((o) => o.value === stream)?.label;
	return label ?? stream.charAt(0).toUpperCase() + stream.slice(1);
}

const GRADE_OPTIONS = [6, 7, 8, 9, 10, 11, 12] as const;

export type PlacementField = "grade" | "section" | "stream" | "elective" | "school";

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
		description:
			"Your grade drives which subjects apply. For grades 11–12, choose your stream and elective below before saving.",
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

export function PlacementFieldDialog({
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
	const gradeDialogSenior = field === "grade" && gradeDraft >= 11 && gradeDraft <= 12;

	useEffect(() => {
		if (!open) return;

		let grade: number;
		let stream: string;
		if (field === "elective") {
			if (!seniorEligible || electiveNeedsStream) return;
			grade = profile.grade!;
			stream = profile.stream!;
		} else if (gradeDialogSenior) {
			const st = streamDraft.trim();
			if (!st) return;
			grade = gradeDraft;
			stream = st;
		} else {
			return;
		}

		let cancelled = false;
		(async () => {
			const supabase = createClient();
			const { data, error: qErr } = await supabase
				.from("subjects")
				.select("id, name, stream")
				.eq("grade", grade)
				.eq("is_elective", true)
				.eq("is_active", true)
				.order("name");
			if (cancelled || qErr) return;
			const rows = (data ?? []).filter((s) => {
				const rowStream = s.stream as string | null;
				return !rowStream || rowStream === stream;
			});
			setElectives(rows.map((s) => ({ id: s.id as string, name: s.name as string })));
		})().catch(() => {
			if (!cancelled) setElectives([]);
		});
		return () => {
			cancelled = true;
		};
	}, [
		open,
		field,
		gradeDraft,
		streamDraft,
		profile.grade,
		profile.stream,
		seniorEligible,
		electiveNeedsStream,
		gradeDialogSenior,
	]);

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

	const effectiveElectiveDraft =
		electiveDraft && electives.some((elective) => elective.id === electiveDraft) ?
			electiveDraft
		:	"";
	const gradeDialogElectiveValue = gradeDialogSenior ? effectiveElectiveDraft : "";

	async function handleSaveField() {
		if (!field) return;
		switch (field) {
			case "grade": {
				if (gradeDraft >= 11 && gradeDraft <= 12) {
					const s = streamDraft.trim();
					if (!s) {
						setError("Select your stream for grades 11–12.");
						return;
					}
					const electiveOk =
						electiveDraft && electives.some((e) => e.id === electiveDraft) ?
							electiveDraft
						:	null;
					return saveWithPatch({
						grade: gradeDraft,
						stream: s,
						electiveSubjectId: electiveOk,
					});
				}
				return saveWithPatch({ grade: gradeDraft });
			}
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
						<div className="flex flex-col gap-4">
							<div className="flex flex-col gap-2">
								<label htmlFor={`${titleId}-grade`} className="text-foreground/70 text-sm font-medium">
									Grade
								</label>
								<NativeSelect
									id={`${titleId}-grade`}
									value={gradeDraft}
									onChange={(e) => {
										const n = Number(e.target.value);
										const prev = gradeDraft;
										setGradeDraft(n);
										if (n < 11) {
											setStreamDraft("");
											setElectiveDraft("");
											setElectives([]);
										} else if (prev < 11 && n >= 11) {
											setStreamDraft("");
											setElectiveDraft("");
											setElectives([]);
										} else if (n >= 11 && prev >= 11 && n !== prev) {
											setElectiveDraft("");
										}
									}}
								>
									{GRADE_OPTIONS.map((g) => (
										<option key={g} value={g}>
											{g}
										</option>
									))}
								</NativeSelect>
							</div>
							{gradeDialogSenior ? (
								<>
									<div className="flex flex-col gap-2">
										<label
											htmlFor={`${titleId}-grade-stream`}
											className="text-foreground/70 text-sm font-medium"
										>
											Stream
										</label>
										<NativeSelect
											id={`${titleId}-grade-stream`}
											value={streamDraft}
											onChange={(e) => {
												const v = e.target.value;
												setStreamDraft(v);
												setElectiveDraft("");
												if (!v.trim()) setElectives([]);
											}}
										>
											<option value="">Select stream…</option>
											{PLACEMENT_STREAM_OPTIONS.map((o) => (
												<option key={o.value} value={o.value}>
													{o.label}
												</option>
											))}
										</NativeSelect>
									</div>
									<div className="flex flex-col gap-2">
										<label
											htmlFor={`${titleId}-grade-elective`}
											className="text-foreground/70 text-sm font-medium"
										>
											Elective (optional)
										</label>
										<NativeSelect
											id={`${titleId}-grade-elective`}
											value={gradeDialogElectiveValue}
											onChange={(e) => setElectiveDraft(e.target.value)}
											disabled={!streamDraft.trim()}
										>
											<option value="">None</option>
											{electives.map((el) => (
												<option key={el.id} value={el.id}>
													{el.name}
												</option>
											))}
										</NativeSelect>
										{!streamDraft.trim() ? (
											<p className="text-muted-foreground text-xs leading-relaxed">
												Choose a stream first to see electives for this grade.
											</p>
										) : null}
									</div>
								</>
							) : null}
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
							<NativeSelect
								id={`${titleId}-stream`}
								value={streamDraft}
								onChange={(e) => setStreamDraft(e.target.value)}
							>
								<option value="">Select stream…</option>
								{PLACEMENT_STREAM_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</NativeSelect>
						</div>
					) : null}

					{field === "elective" && seniorEligible && !electiveNeedsStream ? (
						<div className="flex flex-col gap-2">
							<label htmlFor={`${titleId}-elective`} className="text-foreground/70 text-sm font-medium">
								Elective
							</label>
							<NativeSelect
								id={`${titleId}-elective`}
								value={effectiveElectiveDraft}
								onChange={(e) => setElectiveDraft(e.target.value)}
							>
								<option value="">None</option>
								{electives.map((e) => (
									<option key={e.id} value={e.id}>
										{e.name}
									</option>
								))}
							</NativeSelect>
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

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";

import { selectParentStudentAction } from "../../../select-student/actions";
import { unlinkParentFromStudent, type UnlinkChildState } from "../unlink-actions";
import {
	settingsCardCtaButtonClass,
	settingsCardCtaRowClass,
} from "@/app/student/settings/_settings-form-styles";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const settingsNestedWellClass =
	"rounded-xl border border-border/80 bg-sidebar-accent p-4 shadow-sm dark:border-border dark:bg-foreground/10 medium:p-5";

const studentSelectButtonClass = cn(
	"flex-1 rounded-lg border border-border/90 bg-background px-4 py-3 text-left text-sm font-medium text-foreground shadow-sm transition-colors",
	"hover:bg-muted/50 dark:border-border dark:bg-muted/50 dark:hover:bg-muted/70",
);

export type LinkedStudent = { id: string; displayName: string };

function UnlinkButton({ student }: { student: LinkedStudent }) {
	// Controlled dialog only — we don't use AlertDialogTrigger because it
	// requires Radix asChild composition with Base-UI's Button primitive,
	// which is unproven elsewhere in the codebase. A plain Button that flips
	// `open` is simpler and unambiguous.
	const [open, setOpen] = useState(false);
	const [state, formAction, pending] = useActionState<UnlinkChildState, FormData>(
		unlinkParentFromStudent,
		{},
	);

	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				className="text-muted-foreground hover:text-destructive"
				aria-label={`Unlink ${student.displayName}`}
				onClick={() => setOpen(true)}
			>
				Unlink
			</Button>
			<AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unlink {student.displayName}?</AlertDialogTitle>
						<AlertDialogDescription>
							You&apos;ll lose access to {student.displayName}&apos;s overview, reports, and
							notifications. You can re-link any time using their link code from their 24Vertex
							profile.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{state.error ? (
						<p className="text-sm text-destructive" role="alert">
							{state.error}
						</p>
					) : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
						<form action={formAction}>
							<input type="hidden" name="studentId" value={student.id} />
							<Button type="submit" variant="destructive" disabled={pending}>
								{pending ? "Unlinking…" : "Unlink"}
							</Button>
						</form>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

export function SwitchStudentSection({
	linkedStudents,
	onSwitchHref,
}: {
	linkedStudents: LinkedStudent[];
	onSwitchHref: string;
}) {
	return (
		<div className="space-y-8">
			<div>
				<h2 className="font-semibold text-lg tracking-tight text-foreground">Switch student</h2>
				<p className="mt-1 text-foreground/75 text-sm leading-relaxed dark:text-muted-foreground">
					View overview, progress, and test reports for another student linked to your account.
					Select a name below, or open the full student picker.
				</p>
			</div>
			<div className={settingsNestedWellClass}>
				<p className="text-foreground text-sm font-semibold">Linked students</p>
				{linkedStudents.length > 0 ? (
					<ul className="mt-3 flex flex-col gap-2">
						{linkedStudents.map((c) => (
							<li key={c.id} className="flex items-center gap-2">
								<form action={selectParentStudentAction} className="flex-1">
									<input type="hidden" name="studentId" value={c.id} />
									<button type="submit" className={studentSelectButtonClass}>
										{c.displayName}
									</button>
								</form>
								<UnlinkButton student={c} />
							</li>
						))}
					</ul>
				) : (
					<p className="mt-3 text-muted-foreground text-sm">No linked students yet.</p>
				)}
			</div>
			<div className={settingsCardCtaRowClass}>
				<Button
					variant="outline"
					className={settingsCardCtaButtonClass}
					render={<Link href={onSwitchHref} />}
				>
					<Users data-icon="inline-start" />
					Open student picker
				</Button>
			</div>
		</div>
	);
}

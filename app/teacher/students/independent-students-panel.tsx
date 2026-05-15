"use client";

import { useActionState } from "react";
import { LinkIcon, UsersIcon } from "lucide-react";

import {
	linkTeacherToStudent,
	unlinkTeacherFromStudent,
	type TeacherLinkStudentState,
} from "../settings/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type TeacherLinkedStudentRow = {
	id: string;
	fullName: string;
	studentLinkCode: string | null;
};

export function TeacherIndependentStudentsPanel({ linkedStudents }: { linkedStudents: TeacherLinkedStudentRow[] }) {
	const [linkState, linkAction] = useActionState<TeacherLinkStudentState | undefined, FormData>(
		linkTeacherToStudent,
		undefined,
	);
	const [unlinkState, unlinkAction] = useActionState<TeacherLinkStudentState | undefined, FormData>(
		unlinkTeacherFromStudent,
		undefined,
	);

	return (
		<div className="space-y-6">
			<Card className="border-border/80 shadow-sm">
				<CardHeader className="space-y-1">
					<CardTitle className="flex items-center gap-2 text-lg">
						<LinkIcon className="size-4 text-muted-foreground" aria-hidden />
						Link a student
					</CardTitle>
					<CardDescription>
						Ask the student to open Profile and share their six-character link code (two letters + four numbers).
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form action={linkAction} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="teacherStudentLinkRef">Student link code</Label>
							<Input
								id="teacherStudentLinkRef"
								name="studentId"
								required
								autoComplete="off"
								autoCapitalize="characters"
								spellCheck={false}
								placeholder="e.g. AB1234"
								className="font-mono"
							/>
						</div>
						{linkState?.error ? <p className="text-sm text-destructive">{linkState.error}</p> : null}
						{linkState?.success ? <p className="text-sm text-muted-foreground">Student linked.</p> : null}
						<SubmitButton label="Link student" pendingLabel="Linking…" />
					</form>
				</CardContent>
			</Card>

			<Card className="border-border/80 shadow-sm">
				<CardHeader className="space-y-1">
					<CardTitle className="flex items-center gap-2 text-lg">
						<UsersIcon className="size-4 text-muted-foreground" aria-hidden />
						Linked students
					</CardTitle>
					<CardDescription>Remove access anytime; the student keeps their own account.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{unlinkState?.error ? <p className="text-sm text-destructive">{unlinkState.error}</p> : null}
					{unlinkState?.success ? <p className="text-sm text-muted-foreground">Link removed.</p> : null}

					{linkedStudents.length === 0 ? (
						<p className="text-sm text-muted-foreground">No linked students yet.</p>
					) : (
						<ul className="divide-y divide-border rounded-lg border border-border/80">
							{linkedStudents.map((student) => (
								<li key={student.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
									<div className="min-w-0">
										<p className="font-medium">{student.fullName}</p>
										<p className="text-muted-foreground font-mono text-xs tabular-nums">
											{student.studentLinkCode ?? "—"}
										</p>
									</div>
									<form action={unlinkAction}>
										<input type="hidden" name="studentId" value={student.id} />
										<Button type="submit" size="sm" variant="outline">
											Remove
										</Button>
									</form>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

"use client";

import { TeacherIndependentStudentsPanel } from "../../students/independent-students-panel";

export function TeacherLinkedStudentsSection({
	independentLinkedStudents,
}: {
	independentLinkedStudents: { id: string; fullName: string; studentLinkCode: string | null }[];
}) {
	return (
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
	);
}

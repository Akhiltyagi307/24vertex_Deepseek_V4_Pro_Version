import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
	TeacherManualAssignmentBuilder,
	type ManualBuilderEditTarget,
} from "@/components/teacher/manual/teacher-manual-assignment-builder";
import { handleVerifiedTeacherSessionFailure } from "@/lib/auth/handle-verified-teacher-session-failure";
import { getVerifiedTeacherSession } from "@/lib/auth/require-verified-teacher";
import { storedQuestionToDraft } from "@/lib/assignments/manual-helpers";
import { getManualAssignmentForEdit } from "@/lib/assignments/manual-queries";
import { listTeacherAssignableStudents, listTeacherAssignmentSubjectCatalog } from "@/lib/assignments/queries";
import { listActiveSubjectsCatalog } from "@/lib/teachers/subjects-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Edit assignment",
	robots: { index: false, follow: false },
};

export default async function EditManualAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const session = await getVerifiedTeacherSession();
	if (!session.ok) {
		handleVerifiedTeacherSessionFailure(session);
	}
	const { user } = session;

	const loaded = await getManualAssignmentForEdit(user.id, id);
	if (!loaded) {
		notFound();
	}

	const [subjectsCatalogRaw, topicsCatalog, students] = await Promise.all([
		listActiveSubjectsCatalog(),
		listTeacherAssignmentSubjectCatalog(user.id),
		listTeacherAssignableStudents(user.id),
	]);
	const visibleSubjectIds = new Set(topicsCatalog.map((topic) => topic.subjectId));
	const subjectsCatalog = subjectsCatalogRaw.filter((subject) => visibleSubjectIds.has(subject.id));

	const editTarget: ManualBuilderEditTarget = {
		assignmentId: loaded.assignmentId,
		status: loaded.status === "published" ? "published" : "draft",
		title: loaded.title,
		instructions: loaded.instructions,
		subjectId: loaded.subjectId,
		timeLimitSeconds: loaded.timeLimitSeconds,
		difficulty: loaded.difficulty === "easy" || loaded.difficulty === "hard" ? loaded.difficulty : "medium",
		dueAt: loaded.dueAt,
		drafts: loaded.questions.map((q, index) => storedQuestionToDraft(q, `q-${index}`)),
	};

	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-6 medium:px-0">
			<h1 className="mb-4 font-semibold text-foreground text-xl tracking-tight">
				{editTarget.status === "published" ? "Edit assignment" : "Continue draft"}
			</h1>
			<TeacherManualAssignmentBuilder
				subjectsCatalog={subjectsCatalog}
				topicsCatalog={topicsCatalog}
				students={students}
				editTarget={editTarget}
			/>
		</div>
	);
}

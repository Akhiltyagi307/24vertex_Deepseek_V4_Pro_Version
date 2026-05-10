import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminQuestionVisualTile } from "@/components/admin/visuals/admin-question-visual-tile";
import { requireAdmin } from "@/lib/admin/guards";
import { adminListRecentQuestionsWithVisuals } from "@/lib/admin/visuals-gallery";
import { parseStoredQuestionVisualFromMetadata } from "@/lib/practice/visuals/parse-stored";

export const metadata = {
	title: "Question visuals · EduAI",
	robots: { index: false, follow: false },
};

export default async function AdminQuestionVisualsPage() {
	await requireAdmin();
	const rows = await adminListRecentQuestionsWithVisuals(48);

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Curriculum", href: "/admin/curriculum/subjects" },
					{ label: "Question visuals" },
				]}
				title="Question visuals"
				description="Read-only gallery of recent questions with non-null metadata.visual for rollout spot-checks."
			/>
			{rows.length === 0 ?
				<p className="text-muted-foreground text-sm">No questions with stored visuals yet.</p>
			:	<ul className="grid gap-6 lg:grid-cols-2">
					{rows.map((row) => {
						const parsed = parseStoredQuestionVisualFromMetadata(row.metadata);
						return (
							<li key={row.id}>
								<AdminQuestionVisualTile
									questionId={row.id}
									testId={row.testId}
									questionNumber={row.questionNumber}
									subjectName={row.subjectName}
									questionTextPreview={row.questionTextPreview}
									visual={parsed.ok ? parsed.envelope : null}
									parseError={parsed.ok ? null : parsed.reason}
								/>
							</li>
						);
					})}
				</ul>
			}
		</div>
	);
}

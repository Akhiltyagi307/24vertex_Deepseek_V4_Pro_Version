import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/shell/admin-page-header";
import { AdminTestDetailActions } from "@/components/admin/assessments/admin-test-detail-actions";
import { requireAdmin } from "@/lib/admin/guards";
import { adminGetTestBundle } from "@/lib/admin/tests-admin";

export const metadata = {
	title: "Admin test detail · EduAI",
	robots: { index: false, follow: false },
};

export default async function AdminTestDetailPage({ params }: { params: Promise<{ id: string }> }) {
	await requireAdmin();
	const { id } = await params;
	const bundle = await adminGetTestBundle(id);
	if (!bundle) notFound();

	const { test, questions, answers, question_anomalies, report } = bundle;

	return (
		<div className="space-y-6">
			<AdminPageHeader
				items={[
					{ label: "Admin", href: "/admin/dashboard" },
					{ label: "Tests", href: "/admin/assessments/tests" },
					{ label: "Detail" },
				]}
				title="Test detail"
				description={`Test ${id} · student ${test.student_id as string}`}
			/>

			<AdminTestDetailActions testId={id} />

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">Overview</h2>
				<pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">{JSON.stringify(test, null, 2)}</pre>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">Questions and answers</h2>
				<p className="text-xs text-muted-foreground">{questions.length} questions · {answers.length} answers</p>
				{question_anomalies.length > 0 ?
					<div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
						Question anomalies: {question_anomalies.map((a) => `${a.questionId}: ${a.flags.join(",")}`).join(" · ")}
					</div>
				:	null}
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full min-w-[640px] text-left text-sm">
						<thead className="border-b border-border bg-muted/40">
							<tr>
								<th className="px-2 py-1.5">#</th>
								<th className="px-2 py-1.5">Question</th>
								<th className="px-2 py-1.5">Answer</th>
							</tr>
						</thead>
						<tbody>
							{questions.map((q: { id: string; question_number: number; question_text: string }) => (
								<tr key={q.id} className="border-b border-border/70">
									<td className="px-2 py-1.5 font-mono text-xs">{q.question_number}</td>
									<td className="px-2 py-1.5 align-top">{q.question_text}</td>
									<td className="px-2 py-1.5 align-top font-mono text-xs">
										{JSON.stringify(answers.find((a: { question_id: string }) => a.question_id === q.id)?.student_answer ?? null)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			<section className="space-y-2">
				<h2 className="text-lg font-semibold">Report</h2>
				{report ?
					<pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
						{JSON.stringify(report.summaryReport ?? report, null, 2)}
					</pre>
				:	<p className="text-sm text-muted-foreground">No report row.</p>}
			</section>

			<p className="text-sm">
				<Link href="/admin/assessments/tests" className="text-primary underline-offset-4 hover:underline">
					← Back to tests
				</Link>
			</p>
		</div>
	);
}

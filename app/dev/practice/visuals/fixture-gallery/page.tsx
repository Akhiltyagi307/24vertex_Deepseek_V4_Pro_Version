import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { notFound } from "next/navigation";

import { QuestionVisual } from "@/components/student/practice/visuals/question-visual";
import { questionVisualEnvelopeSchema } from "@/lib/practice/visuals/schemas";
import type { QuestionVisualEnvelope } from "@/lib/practice/visuals/types";

/**
 * Dev-only fixture preview gallery.
 *
 * Renders every eval fixture under `tests/eval-visuals/fixtures/<subject>/`
 * using the real `<QuestionVisual>` dispatcher so the spec / renderer pairing
 * can be eyeballed before any generation runs. Gated to non-production.
 */

export const metadata = {
	title: "Practice visual fixture preview (dev only) · 24Vertex",
};

type FixtureRecord = {
	subject: string;
	fileName: string;
	questionText: string;
	correctAnswer: string | null;
	envelope: QuestionVisualEnvelope;
	isGrade9: boolean;
	isGrade10: boolean;
	parseError: string | null;
};

const FIXTURES_DIR = path.resolve(process.cwd(), "tests", "eval-visuals", "fixtures");

function loadFixtures(): FixtureRecord[] {
	const out: FixtureRecord[] = [];
	let subjects: string[] = [];
	try {
		subjects = readdirSync(FIXTURES_DIR).filter((name) =>
			statSync(path.join(FIXTURES_DIR, name)).isDirectory(),
		);
	} catch {
		return out;
	}
	for (const subject of subjects.sort()) {
		const subjectDir = path.join(FIXTURES_DIR, subject);
		let files: string[] = [];
		try {
			files = readdirSync(subjectDir).filter((f) => f.endsWith(".json"));
		} catch {
			continue;
		}
		for (const fileName of files.sort()) {
			const filePath = path.join(subjectDir, fileName);
			try {
				const raw = JSON.parse(readFileSync(filePath, "utf8")) as {
					question_text?: unknown;
					answer_key?: { correct_answer?: unknown } | null;
					visual?: unknown;
				};
				if (raw.visual == null) continue;
				const parsed = questionVisualEnvelopeSchema.safeParse(raw.visual);
				out.push({
					subject,
					fileName,
					questionText: typeof raw.question_text === "string" ? raw.question_text : "",
					correctAnswer:
						raw.answer_key && typeof raw.answer_key.correct_answer === "string" ?
							raw.answer_key.correct_answer
						:	null,
					envelope: parsed.success ? parsed.data : (raw.visual as QuestionVisualEnvelope),
					isGrade9: /(^|[-_])9([-_]|$)/.test(fileName.replace(/\.json$/, "")) || fileName.endsWith("_grade_9.json"),
					isGrade10: fileName.endsWith("_grade_10.json") || /-10-/.test(fileName),
					parseError: parsed.success ? null : parsed.error.message,
				});
			} catch {
				// Skip unparseable fixtures silently — eval:visuals will flag them.
			}
		}
	}
	return out;
}

export default function FixtureGalleryPage(): React.ReactElement {
	if (process.env.NODE_ENV === "production") {
		notFound();
	}

	const fixtures = loadFixtures();
	const bySubject = fixtures.reduce<Record<string, FixtureRecord[]>>((acc, f) => {
		(acc[f.subject] ??= []).push(f);
		return acc;
	}, {});
	const grade9Count = fixtures.filter((f) => f.isGrade9).length;
	const grade10Count = fixtures.filter((f) => f.isGrade10).length;

	return (
		<main className="mx-auto max-w-5xl px-6 py-10">
			<header className="mb-8">
				<p className="text-xs uppercase tracking-wider text-muted-foreground">Dev only</p>
				<h1 className="mt-1 text-3xl font-semibold tracking-tight">
					Visual fixture preview
				</h1>
				<p className="mt-3 max-w-2xl text-sm text-muted-foreground">
					Renders every eval fixture under{" "}
					<code>tests/eval-visuals/fixtures/&lt;subject&gt;/</code> through the real{" "}
					<code>&lt;QuestionVisual&gt;</code> dispatcher. Use this to eyeball spec /
					renderer pairings before flipping{" "}
					<code>PRACTICE_VISUAL_TEMPLATE_ENGINE</code> on.
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Fixtures loaded: <strong>{fixtures.length}</strong>, of which{" "}
					<strong>{grade9Count}</strong> are Grade 9 and{" "}
					<strong>{grade10Count}</strong> are Grade 10.
				</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Metadata view:{" "}
					<a className="underline" href="/dev/practice/visuals/template-gallery">
						/dev/practice/visuals/template-gallery
					</a>
				</p>
			</header>

			<div className="flex flex-col gap-12">
				{Object.entries(bySubject).map(([subject, group]) => (
					<section
						key={subject}
						className="rounded-lg border border-border bg-card p-6"
					>
						<header className="mb-4 flex flex-wrap items-baseline gap-3 border-b border-border pb-4">
							<h2 className="text-xl font-semibold tracking-tight">{subject}</h2>
							<span className="text-xs text-muted-foreground">
								{group.length} {group.length === 1 ? "fixture" : "fixtures"}
							</span>
						</header>
						<ul className="flex flex-col gap-6">
							{group.map((f) => (
								<li
									key={`${f.subject}/${f.fileName}`}
									data-fixture-key={`${f.subject}/${f.fileName}`}
									data-visual-kind={f.envelope.spec.kind}
									className="rounded-md border border-border/50 p-4"
								>
									<div className="mb-2 flex flex-wrap items-baseline gap-3">
										<code className="text-xs text-muted-foreground">
											{f.subject}/{f.fileName}
										</code>
										{f.isGrade9 && (
											<span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
												new · Grade 9
											</span>
										)}
										{f.isGrade10 && (
											<span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
												new · Grade 10
											</span>
										)}
										<span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
											{f.envelope.spec.kind}
										</span>
										{f.correctAnswer && (
											<span className="ml-auto inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
												answer · {f.correctAnswer}
											</span>
										)}
									</div>
									{f.questionText && (
										<p className="mb-2 text-sm">{f.questionText}</p>
									)}
									{f.parseError && (
										<details className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
											<summary className="cursor-pointer">
												Strict schema mismatch (renderer still attempts)
											</summary>
											<pre className="mt-2 whitespace-pre-wrap break-words text-[10px] leading-tight">
												{f.parseError}
											</pre>
										</details>
									)}
									<QuestionVisual visual={f.envelope} />
								</li>
							))}
						</ul>
					</section>
				))}
			</div>

			{fixtures.length === 0 && (
				<p className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
					No fixtures found. Drop fixture JSONs under
					<code> tests/eval-visuals/fixtures/&lt;subject&gt;/</code> and reload.
				</p>
			)}
		</main>
	);
}

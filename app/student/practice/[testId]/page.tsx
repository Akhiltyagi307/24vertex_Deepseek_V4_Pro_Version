import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import {
	PracticeTestSession,
	type PracticeSessionQuestion,
	type SessionStudentAnswer,
} from "@/components/student/practice/practice-test-session";
import { getServerUser } from "@/lib/auth/get-server-user";
import { clientIpFromHeaders } from "@/lib/http/client-ip";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ testId: string }> };

function parseSessionAnswer(raw: unknown): SessionStudentAnswer | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	if (o.kind === "mcq" && typeof o.value === "string") {
		return { kind: "mcq", value: o.value };
	}
	if (o.kind === "text" && typeof o.value === "string") {
		return { kind: "text", value: o.value };
	}
	if (o.kind === "numerical" && typeof o.value === "string") {
		return { kind: "numerical", value: o.value };
	}
	return null;
}

function topicsFieldsFromRow(topics: unknown): { topic_name: string; chapter_name: string | null } {
	if (!topics) return { topic_name: "Topic", chapter_name: null };
	if (Array.isArray(topics)) {
		const first = topics[0] as { topic_name?: string; chapter_name?: string | null } | undefined;
		const tn = first?.topic_name?.trim() ? String(first.topic_name) : "";
		const ch = first?.chapter_name?.trim() ? String(first.chapter_name) : null;
		return { topic_name: tn || "Topic", chapter_name: ch };
	}
	const o = topics as { topic_name?: string; chapter_name?: string | null };
	const tn = o.topic_name?.trim() ? String(o.topic_name) : "";
	const ch = o.chapter_name?.trim() ? String(o.chapter_name) : null;
	return { topic_name: tn || "Topic", chapter_name: ch };
}

export default async function PracticeSessionPage({ params }: PageProps) {
	const { testId } = await params;
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const supabase = await createClient();

	const { data: test, error: tErr } = await supabase
		.from("tests")
		.select("id, student_id, subject_id, status, time_limit_seconds, started_at, last_ip")
		.eq("id", testId)
		.maybeSingle();

	if (tErr || !test) {
		notFound();
	}
	if (test.student_id !== user.id) {
		notFound();
	}

	const st = test.status;
	if (st === "grading" || st === "grading_failed") {
		redirect(`/student/practice/${testId}/grading`);
	}
	if (st === "graded") {
		redirect(
			`/student/reports?subject=${encodeURIComponent(test.subject_id as string)}&test=${encodeURIComponent(testId)}`,
		);
	}
	if (st !== "in_progress") {
		redirect(`/student/reports?subject=${encodeURIComponent(test.subject_id as string)}`);
	}

	// Stamp `started_at` the first time the student opens the session page.
	// Used by `practice_start_grading` to clamp client-reported elapsed time.
	const hdrs = await headers();
	const clientIp = clientIpFromHeaders(hdrs);
	if (!test.started_at) {
		const patch: Record<string, string> = { started_at: new Date().toISOString() };
		if (clientIp) patch.last_ip = clientIp;
		await supabase
			.from("tests")
			.update(patch)
			.eq("id", testId)
			.eq("student_id", user.id)
			.is("started_at", null);
	} else if (!test.last_ip && clientIp) {
		await supabase
			.from("tests")
			.update({ last_ip: clientIp, updated_at: new Date().toISOString() })
			.eq("id", testId)
			.eq("student_id", user.id)
			.is("last_ip", null);
	}

	const { data: sub } = await supabase
		.from("subjects")
		.select("name")
		.eq("id", test.subject_id as string)
		.maybeSingle();

	const subjectName = sub?.name?.trim() ? String(sub.name) : "Subject";

	const { data: qRows, error: qErr } = await supabase
		.from("questions")
		.select(
			"id, question_number, question_text, question_type, difficulty_level, options, topic_id, topics(topic_name, chapter_name)",
		)
		.eq("test_id", testId)
		.order("question_number", { ascending: true });

	if (qErr || !qRows?.length) {
		notFound();
	}

	const { data: aRows } = await supabase
		.from("student_answers")
		.select("question_id, student_answer, flagged_for_review")
		.eq("test_id", testId);

	const questions: PracticeSessionQuestion[] = qRows.map((r) => {
		const tf = topicsFieldsFromRow(r.topics);
		return {
			id: r.id as string,
			question_number: r.question_number as number,
			question_text: r.question_text as string,
			question_type: r.question_type as PracticeSessionQuestion["question_type"],
			difficulty_level: (r.difficulty_level as string | null) ?? null,
			options: (r.options as Record<string, string> | null) ?? null,
			topic_id: r.topic_id as string,
			topic_name: tf.topic_name,
			chapter_name: tf.chapter_name,
		};
	});

	const initialAnswers = questions.map((q) => {
		const row = (aRows ?? []).find((a) => a.question_id === q.id);
		return {
			questionId: q.id,
			studentAnswer: row?.student_answer ? parseSessionAnswer(row.student_answer) : null,
			flaggedForReview: Boolean(row?.flagged_for_review),
		};
	});

	const timeLimit =
		typeof test.time_limit_seconds === "number" && test.time_limit_seconds > 0 ?
			test.time_limit_seconds
		:	3600;

	// Phase 1 stamped this on first load; prefer the DB value over whatever the
	// client might have cached.
	const { data: stampedRow } = await supabase
		.from("tests")
		.select("started_at")
		.eq("id", testId)
		.maybeSingle();
	const rawStartedAt = (stampedRow?.started_at as string | null | undefined) ?? null;
	const hasTimezoneSuffix =
		typeof rawStartedAt === "string" && /(?:Z|[+-]\d{2}:?\d{2})$/i.test(rawStartedAt);
	const serverStartedAtIso = rawStartedAt ? (hasTimezoneSuffix ? rawStartedAt : `${rawStartedAt}Z`) : null;

	return (
		<div className="flex min-h-[calc(100dvh-8rem)] flex-col">
			<PracticeTestSession
				testId={testId}
				subjectName={subjectName}
				timeLimitSeconds={timeLimit}
				questions={questions}
				initialAnswers={initialAnswers}
				serverStartedAtIso={serverStartedAtIso}
			/>
		</div>
	);
}

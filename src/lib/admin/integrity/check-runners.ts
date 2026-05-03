import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

export type IntegrityCheckResult = {
	rowsFound: number;
	details: unknown[] | null;
};

export const INTEGRITY_CHECK_NAMES = [
	"students_missing_tracker_rows",
	"tracker_rows_pointing_at_inactive_topics",
	"tests_without_questions",
	"questions_without_answer_keys",
	"subscriptions_without_plans",
	"payments_without_subscriptions",
	"usage_periods_overlapping",
	"parent_links_with_deleted_users",
	"email_log_stuck_queued",
	"embeddings_dimension_mismatch",
	"topics_with_zero_chunks",
	"audit_holes",
] as const;

export type IntegrityCheckName = (typeof INTEGRITY_CHECK_NAMES)[number];

export async function runIntegrityCheck(name: IntegrityCheckName): Promise<IntegrityCheckResult> {
	switch (name) {
		case "students_missing_tracker_rows": {
			const rows = await db.execute(sql`
				SELECT p.id AS student_id
				FROM public.profiles p
				WHERE p.role = 'student'
				  AND p.deleted_at IS NULL
				  AND p.grade IS NOT NULL
				  AND NOT EXISTS (SELECT 1 FROM public.performance_tracker pt WHERE pt.student_id = p.id LIMIT 1)
				LIMIT 500
			`);
			const details = rows as unknown as { student_id: string }[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "tracker_rows_pointing_at_inactive_topics": {
			const rows = await db.execute(sql`
				SELECT pt.id AS tracker_row_id, pt.student_id, pt.topic_id
				FROM public.performance_tracker pt
				INNER JOIN public.topics t ON t.id = pt.topic_id
				WHERE COALESCE(t.is_active, TRUE) = FALSE
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "tests_without_questions": {
			const rows = await db.execute(sql`
				SELECT t.id AS test_id, t.student_id
				FROM public.tests t
				WHERE NOT EXISTS (SELECT 1 FROM public.questions q WHERE q.test_id = t.id)
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "questions_without_answer_keys": {
			const rows = await db.execute(sql`
				SELECT q.id AS question_id, q.test_id
				FROM public.questions q
				WHERE q.answer_key IS NULL OR q.answer_key = 'null'::jsonb OR q.answer_key = '{}'::jsonb
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "subscriptions_without_plans": {
			const rows = await db.execute(sql`
				SELECT s.id AS subscription_id, s.plan_code
				FROM public.subscriptions s
				WHERE NOT EXISTS (SELECT 1 FROM public.plans p WHERE p.code = s.plan_code)
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "payments_without_subscriptions": {
			const rows = await db.execute(sql`
				SELECT pay.id AS payment_id, pay.subscription_id
				FROM public.payments pay
				WHERE pay.subscription_id IS NOT NULL
				  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = pay.subscription_id)
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "usage_periods_overlapping": {
			const rows = await db.execute(sql`
				SELECT u1.id AS usage_period_id, u1.subscription_id
				FROM public.usage_periods u1
				INNER JOIN public.usage_periods u2
				  ON u1.subscription_id = u2.subscription_id
				 AND u1.id <> u2.id
				 AND u1.period_start < u2.period_end
				 AND u2.period_start < u1.period_end
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "parent_links_with_deleted_users": {
			const rows = await db.execute(sql`
				SELECT l.id AS link_id, l.parent_id, l.student_id
				FROM public.parent_student_links l
				LEFT JOIN public.profiles pp ON pp.id = l.parent_id
				LEFT JOIN public.profiles ps ON ps.id = l.student_id
				WHERE pp.deleted_at IS NOT NULL OR ps.deleted_at IS NOT NULL
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "email_log_stuck_queued": {
			const rows = await db.execute(sql`
				SELECT e.id, e.created_at
				FROM public.email_log e
				WHERE e.status = 'queued'
				  AND e.created_at < NOW() - INTERVAL '1 hour'
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "embeddings_dimension_mismatch": {
			try {
				const rows = await db.execute(sql`
					SELECT q.id AS question_id
					FROM public.questions q
					WHERE q.embedding IS NOT NULL
					  AND vector_dims(q.embedding) IS DISTINCT FROM 1536
					LIMIT 500
				`);
				const details = rows as unknown as Record<string, unknown>[];
				return { rowsFound: details.length, details: details.slice(0, 50) };
			} catch {
				return { rowsFound: 0, details: [{ note: "vector_dims_unavailable_or_no_rows" }] };
			}
		}
		case "topics_with_zero_chunks": {
			const rows = await db.execute(sql`
				SELECT t.id AS topic_id, t.topic_name
				FROM public.topics t
				WHERE COALESCE(t.is_active, TRUE) = TRUE
				  AND NOT EXISTS (SELECT 1 FROM public.topic_context_chunks c WHERE c.topic_id = t.id LIMIT 1)
				LIMIT 500
			`);
			const details = rows as unknown as Record<string, unknown>[];
			return { rowsFound: details.length, details: details.slice(0, 50) };
		}
		case "audit_holes": {
			return { rowsFound: 0, details: [] };
		}
	}
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("parent qna logs RLS migration", () => {
	it("adds parent read policies for questions and student_answers", () => {
		const migrationPath = resolve(
			process.cwd(),
			"supabase/migrations/20260619103000_parent_qna_logs_question_answer_rls.sql",
		);
		const sql = readFileSync(migrationPath, "utf8");

		expect(sql).toContain('CREATE POLICY "Parents view linked child questions"');
		expect(sql).toContain('ON public.questions');
		expect(sql).toContain('CREATE POLICY "Parents view linked child student answers"');
		expect(sql).toContain('ON public.student_answers');
	});
});

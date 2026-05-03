import { z } from "zod";

const adminSubjectFieldsSchema = z.object({
	name: z.string().min(1).max(250),
	grade: z.number().int().min(1).max(12),
	subject_group: z.string().max(200).optional().nullable(),
	stream: z.string().max(50).optional().nullable(),
	is_elective: z.boolean().optional(),
	sort_order: z.number().int().optional(),
});

function refineSubjectGradeStreamElective(
	val: { grade: number; stream?: string | null; is_elective?: boolean },
	ctx: z.RefinementCtx,
) {
	const senior = val.grade === 11 || val.grade === 12;
	if (!senior && val.stream) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "stream applies only to grades 11–12",
			path: ["stream"],
		});
	}
	if (!senior && val.is_elective) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "elective applies only to grades 11–12",
			path: ["is_elective"],
		});
	}
}

export const adminSubjectCreateSchema = adminSubjectFieldsSchema.superRefine((val, ctx) => {
	refineSubjectGradeStreamElective(val, ctx);
});

export const adminSubjectPatchSchema = adminSubjectFieldsSchema.partial().superRefine((val, ctx) => {
	if (val.grade === undefined) return;
	refineSubjectGradeStreamElective(
		{ grade: val.grade, stream: val.stream, is_elective: val.is_elective },
		ctx,
	);
});

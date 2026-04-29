import { z } from "zod";

export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

export const forgotPasswordSchema = z.object({
	email: z.string().email(),
});

const streamEnum = z.enum([
	"science",
	"science_pcmb",
	"science_pcm",
	"science_pcb",
	"commerce",
	"commerce_with_maths",
	"arts",
]);

const studentProfileRefine = (data: {
	grade: number;
	stream?:
		| "science"
		| "science_pcmb"
		| "science_pcm"
		| "science_pcb"
		| "commerce"
		| "commerce_with_maths"
		| "arts"
		| null;
	electiveSubjectId?: string | null;
}, ctx: z.RefinementCtx) => {
	if (data.grade >= 11 && data.grade <= 12) {
		if (!data.stream) {
			ctx.addIssue({ code: "custom", message: "Stream is required for grades 11–12", path: ["stream"] });
		}
	} else if (data.stream || data.electiveSubjectId) {
		ctx.addIssue({ code: "custom", message: "Stream/elective only for grades 11–12", path: ["stream"] });
	}
};

const studentProfileShape = z.object({
	email: z.string().email(),
	fullName: z.string().min(1).max(200),
	grade: z.coerce.number().int().min(6).max(12),
	section: z.string().min(1).max(5),
	stream: streamEnum.optional().nullable(),
	electiveSubjectId: z.string().uuid().optional().nullable(),
	/** Set when a parent links via link code, or legacy signup. Omitted or null at new student signup. */
	parentName: z
		.union([z.string(), z.null(), z.undefined()])
		.transform((s) => {
			if (s == null) return null;
			const t = s.trim();
			return t === "" ? null : t;
		})
		.refine((v) => v === null || (v.length >= 1 && v.length <= 200), {
			message: "Parent name must be 200 characters or fewer",
		}),
	parentEmail: z
		.union([z.string(), z.null(), z.undefined()])
		.transform((s) => {
			if (s == null) return null;
			const t = s.trim().toLowerCase();
			return t === "" ? null : t;
		})
		.refine((v) => v === null || z.string().email().safeParse(v).success, {
			message: "Invalid parent email",
		}),
});

/** Student profile fields (no password) — used after email verification via user metadata. */
export const studentProfileBodySchema = studentProfileShape.superRefine(studentProfileRefine);

export const studentSignupSchema = studentProfileShape
	.extend({
		password: z.string().min(8),
	})
	.superRefine(studentProfileRefine);

export const parentProfileBodySchema = z.object({
	email: z.string().email(),
	fullName: z.string().min(1).max(200),
});

/** Parent signup + pending registration: student link code (format XX1234). */
export const parentRegistrationPayloadSchema = parentProfileBodySchema.extend({
	studentLinkCode: z
		.string()
		.trim()
		.regex(/^[A-Za-z]{2}\d{4}$/, { message: "Enter the 6-character link code (e.g. AB1234)." })
		.transform((s) => s.toUpperCase()),
});

export const parentSignupSchema = parentRegistrationPayloadSchema.extend({
	password: z.string().min(8),
});

export const teacherSignupSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	fullName: z.string().min(1).max(200),
	schoolName: z.string().min(1).max(300),
	assignments: z
		.array(
			z.object({
				grade: z.coerce.number().int().min(6).max(12),
				section: z.string().trim().min(1).max(5),
				subjectId: z.string().uuid(),
			}),
		)
		.min(1),
});

const studentLinkCodePattern = /^[A-Za-z]{2}\d{4}$/;

export const linkParentSchema = z.object({
	studentId: z
		.string()
		.trim()
		.min(1)
		.refine(
			(s) => z.string().uuid().safeParse(s).success || studentLinkCodePattern.test(s),
			{ message: "Enter the 6-character link code (e.g. AB1234) or the student UUID." },
		)
		.transform((s) => (studentLinkCodePattern.test(s) ? s.toUpperCase() : s)),
});

function trimToNull(s: unknown): string | null {
	if (s == null || typeof s !== "string") return null;
	const t = s.trim();
	return t === "" ? null : t;
}

/** Grade, section, stream, elective, school — student self-service on settings (server action). */
export const studentSchoolPlacementSchema = z
	.object({
		grade: z.coerce.number().int().min(6).max(12),
		section: z.string().trim().min(1, "Enter your section.").max(5),
		stream: streamEnum.nullable(),
		electiveSubjectId: z.string().uuid().nullable().optional(),
		schoolName: z.string().max(300).optional().transform(trimToNull),
	})
	.superRefine((data, ctx) => {
		const elective = data.electiveSubjectId ?? null;
		studentProfileRefine(
			{ grade: data.grade, stream: data.stream, electiveSubjectId: elective },
			ctx,
		);
	});

/** Student self-service profile fields on /student/settings (server action). */
export const studentProfileUpdateSchema = z
	.object({
		fullName: z.string().min(1).max(200),
		avatarUrl: z.string().max(2000).transform(trimToNull),
		phone: z.string().max(32).transform(trimToNull),
	})
	.superRefine((data, ctx) => {
		if (data.avatarUrl !== null && !z.string().url().safeParse(data.avatarUrl).success) {
			ctx.addIssue({ code: "custom", message: "Invalid avatar URL", path: ["avatarUrl"] });
		}
	});

/** Student change-password flow (client-side with Supabase Auth). */
export const studentChangePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Enter your current password."),
		newPassword: z.string().min(8, "Password must be at least 8 characters."),
		confirmPassword: z.string().min(1, "Confirm your new password."),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match.",
		path: ["confirmPassword"],
	});

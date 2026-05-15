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

/** Indian teacher mobile: exactly 10 digits, normalized to E.164 +91XXXXXXXXXX. */
export function toTeacherIndiaPhoneE164(raw: string): string | null {
	const compact = raw.trim().replace(/\s/g, "");
	if (/^\+91\d{10}$/.test(compact)) return compact;
	let digits = raw.replace(/\D/g, "");
	if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
	if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
	if (/^\d{10}$/.test(digits)) return `+91${digits}`;
	return null;
}

/** Teacher pending registration + signup (class assignments removed; school ID linking is a later phase). */
export const teacherRegistrationPayloadSchema = z.object({
	email: z.string().email(),
	fullName: z.string().min(1).max(200),
	phone: z
		.string()
		.min(1, "Enter your mobile number.")
		.refine((s) => toTeacherIndiaPhoneE164(s) !== null, { message: "Enter exactly 10 digits." })
		.transform((s) => toTeacherIndiaPhoneE164(s)!),
	schoolName: z
		.string()
		.max(300)
		.nullish()
		.transform((s) => {
			if (s == null) return null;
			const t = s.trim();
			return t === "" ? null : t;
		}),
});

export const teacherSignupSchema = teacherRegistrationPayloadSchema.extend({
	password: z.string().min(8),
});

const studentLinkCodePattern = /^[A-Za-z]{2}\d{4}$/;

/** Independent teachers link students via six-character link code only (`link_teacher_to_student`). */
export const linkTeacherStudentSchema = z.object({
	studentId: z
		.string()
		.trim()
		.min(1)
		.refine((s) => studentLinkCodePattern.test(s), {
			message: "Enter the student's six-character link code from Profile (e.g. AB1234).",
		})
		.transform((s) => s.toUpperCase()),
});

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
		/** Client sends explicit `null` when the profile has no school name; plain `.optional()` rejects null. */
		schoolName: z
			.string()
			.max(300)
			.nullable()
			.optional()
			.transform((s) => trimToNull(s)),
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

/** Teacher self-service profile on `/teacher/settings` (matches guarded columns policy). */
export const teacherProfileUpdateSchema = z
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

/** Org teachers choose roster filters on `/teacher/settings`. */
export const teacherTeachingFocusSchema = z.object({
	grade: z.coerce.number().int().min(6).max(12),
	subjectId: z.string().uuid(),
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

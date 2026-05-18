export type EmailPreviewSource = "app" | "supabase" | "admin";

/** Mirrors `OrganizationEmailEvent` in organization-emails.ts (kept here for dev previews). */
export type OrganizationEmailEventPreview =
	| "student_organization_linked"
	| "student_organization_unlinked"
	| "student_organization_deactivated"
	| "teacher_organization_joined"
	| "teacher_organization_left"
	| "teacher_organization_deactivated"
	| "teacher_linked_student"
	| "teacher_student_link_confirmed";

export type EmailPreviewSample = {
	slug: string;
	category: string;
	displayName: string;
	description: string;
	subject: string;
	html: string;
	source: EmailPreviewSource;
};

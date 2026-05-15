import "server-only";

export const ORGANIZATION_ACCESS_ACTIONS = {
	STUDENT_ORGANIZATION_LINK: "student_organization_link",
	STUDENT_ORGANIZATION_UNLINK: "student_organization_unlink",
	TEACHER_ORGANIZATION_JOIN: "teacher_organization_join",
	TEACHER_ORGANIZATION_LEAVE: "teacher_organization_leave",
	TEACHER_STUDENT_LINK_SUCCESS: "teacher_student_link_success",
	TEACHER_STUDENT_LINK_FAILED: "teacher_student_link_failed",
} as const;

export type OrganizationAccessActionName =
	(typeof ORGANIZATION_ACCESS_ACTIONS)[keyof typeof ORGANIZATION_ACCESS_ACTIONS];

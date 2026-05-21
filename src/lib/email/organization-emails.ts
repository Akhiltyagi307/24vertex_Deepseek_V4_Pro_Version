import "server-only";

import { getAppUrl } from "@/lib/env";
import { escapeHtml, renderEmailShell } from "@/lib/email/render-email-shell";
import { sendHtmlEmailLogged } from "@/lib/email/send-html-email";

export type OrganizationEmailEvent =
	| "student_organization_linked"
	| "student_organization_unlinked"
	| "student_organization_deactivated"
	| "teacher_organization_joined"
	| "teacher_organization_left"
	| "teacher_organization_deactivated"
	| "teacher_linked_student"
	| "teacher_student_link_confirmed";

export type OrganizationEventEmailParams = {
	to: string;
	recipientUserId: string;
	displayName?: string | null;
	event: OrganizationEmailEvent;
	organizationName?: string | null;
	teacherName?: string | null;
	studentName?: string | null;
	revokedLinksCount?: number | null;
	dedupKey?: string;
};

function emailCopy(params: OrganizationEventEmailParams): {
	subject: string;
	preheader: string;
	title: string;
	paragraphs: string[];
	ctaHref: string;
	ctaLabel: string;
} {
	const org = params.organizationName ?? "your organization";
	const teacher = params.teacherName ?? "A teacher";
	const student = params.studentName ?? "your student";
	const revoked =
		params.revokedLinksCount && params.revokedLinksCount > 0
			? ` This also revoked ${params.revokedLinksCount} independent student link${params.revokedLinksCount === 1 ? "" : "s"}.`
			: "";

	switch (params.event) {
		case "student_organization_linked":
			return {
				subject: `Connected to ${org} on 24Vertex`,
				preheader: `Your 24Vertex account is now connected to ${org}.`,
				title: "Organization connected",
				paragraphs: [
					`Your student account is now connected to <strong>${escapeHtml(org)}</strong>. Teachers associated with this organization may be able to view the student data 24Vertex makes available to them.`,
					"You can unlink from Account settings anytime.",
				],
				ctaHref: `${getAppUrl()}/student/settings`,
				ctaLabel: "Open account settings",
			};
		case "student_organization_unlinked":
			return {
				subject: `Disconnected from ${org} on 24Vertex`,
				preheader: `Your 24Vertex account is no longer connected to ${org}.`,
				title: "Organization disconnected",
				paragraphs: [
					`Your student account is no longer connected to <strong>${escapeHtml(org)}</strong>. Organization teachers will no longer get roster access through that organization.`,
					"Independent tutor links, if any, are unchanged.",
				],
				ctaHref: `${getAppUrl()}/student/settings`,
				ctaLabel: "Open account settings",
			};
		case "student_organization_deactivated":
			return {
				subject: `${org} was removed from 24Vertex`,
				preheader: `Your account was disconnected from ${org}.`,
				title: "Organization removed",
				paragraphs: [
					`<strong>${escapeHtml(org)}</strong> is no longer active on 24Vertex, so your student account was disconnected from it.`,
					"You can continue using 24Vertex without an organization, or connect to another active school or tuition center from Account settings.",
				],
				ctaHref: `${getAppUrl()}/student/settings`,
				ctaLabel: "Open account settings",
			};
		case "teacher_organization_joined":
			return {
				subject: `Connected to ${org} on 24Vertex`,
				preheader: `Your teacher account is now connected to ${org}.`,
				title: "Organization connected",
				paragraphs: [
					`Your teacher account is now connected to <strong>${escapeHtml(org)}</strong>. You can access students associated with this organization according to 24Vertex's teacher access rules.${revoked}`,
					"Link-code access is disabled while your account is connected to an organization.",
				],
				ctaHref: `${getAppUrl()}/teacher/settings`,
				ctaLabel: "Open teacher settings",
			};
		case "teacher_organization_left":
			return {
				subject: `Disconnected from ${org} on 24Vertex`,
				preheader: `Your teacher account is no longer connected to ${org}.`,
				title: "Organization disconnected",
				paragraphs: [
					`Your teacher account is no longer connected to <strong>${escapeHtml(org)}</strong>.`,
					"You can now link students independently using their 24Vertex link code.",
				],
				ctaHref: `${getAppUrl()}/teacher/settings`,
				ctaLabel: "Open teacher settings",
			};
		case "teacher_organization_deactivated":
			return {
				subject: `${org} was removed from 24Vertex`,
				preheader: `Your teacher account was disconnected from ${org}.`,
				title: "Organization removed",
				paragraphs: [
					`<strong>${escapeHtml(org)}</strong> is no longer active on 24Vertex, so your teacher account was disconnected from it.`,
					"You can continue as an independent teacher or connect to another active organization from Teacher settings.",
				],
				ctaHref: `${getAppUrl()}/teacher/settings`,
				ctaLabel: "Open teacher settings",
			};
		case "teacher_linked_student":
			return {
				subject: `${teacher} linked to your 24Vertex account`,
				preheader: `${teacher} can now access your 24Vertex student data as an independent teacher.`,
				title: "Teacher linked",
				paragraphs: [
					`<strong>${escapeHtml(teacher)}</strong> linked to your 24Vertex student account using your link code.`,
					"If this was not expected, contact your parent, school administrator, or 24Vertex support.",
				],
				ctaHref: `${getAppUrl()}/student/settings`,
				ctaLabel: "Open account settings",
			};
		case "teacher_student_link_confirmed":
			return {
				subject: `Connected to ${student} on 24Vertex`,
				preheader: `You can now access ${student}'s 24Vertex student data as an independent teacher.`,
				title: "Student linked",
				paragraphs: [
					`You are now linked to <strong>${escapeHtml(student)}</strong> as an independent teacher.`,
					"If you later join a school or tuition center on 24Vertex, independent student links will be revoked.",
				],
				ctaHref: `${getAppUrl()}/teacher/settings`,
				ctaLabel: "Open teacher settings",
			};
	}
}

export async function sendOrganizationEventEmail(
	params: OrganizationEventEmailParams,
): Promise<{ error: string | null }> {
	const copy = emailCopy(params);
	const safeName = escapeHtml(params.displayName ?? "there");
	const html = renderEmailShell({
		preheader: copy.preheader,
		greeting: `Hi ${safeName},`,
		title: copy.title,
		paragraphs: copy.paragraphs,
		primaryCta: { label: copy.ctaLabel, href: copy.ctaHref },
	});

	return sendHtmlEmailLogged({
		to: params.to,
		recipientUserId: params.recipientUserId,
		subject: copy.subject,
		html,
		templateSlug: params.event,
		templateVariables: {
			display_name: params.displayName ?? "",
			organization_name: params.organizationName ?? "",
			teacher_name: params.teacherName ?? "",
			student_name: params.studentName ?? "",
			revoked_links_count: String(params.revokedLinksCount ?? 0),
		},
		dedupKey: params.dedupKey,
	});
}

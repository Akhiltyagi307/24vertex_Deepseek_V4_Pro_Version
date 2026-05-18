import "server-only";

import { rlConsume, type RlConsumeResult } from "@/lib/ratelimit/consume";

export const parentLinkAttemptKey = (parentUserId: string): string =>
	`parent-link-attempt:${parentUserId}`;

export const parentLinkStudentKey = (studentRef: string): string =>
	`parent-link-student:${studentRef}`;

export const parentNotifReadKey = (parentUserId: string): string =>
	`parent-notif:${parentUserId}`;

export const PARENT_LINK_PER_PARENT_LIMIT = 10;
export const PARENT_LINK_PER_PARENT_WINDOW_SEC = 60 * 60;

export const PARENT_LINK_PER_STUDENT_LIMIT = 5;
export const PARENT_LINK_PER_STUDENT_WINDOW_SEC = 15 * 60;

export const PARENT_NOTIF_LIMIT_PER_MIN = 60;
export const PARENT_NOTIF_WINDOW_SEC = 60;

export type ParentRateLimitOutcome =
	| { ok: true }
	| { ok: false; result: RlConsumeResult; limit: number };

async function consume(key: string, limit: number, windowSec: number): Promise<ParentRateLimitOutcome> {
	const result = await rlConsume({ key, limit, windowSec });
	return result.allowed ? { ok: true } : { ok: false, result, limit };
}

export function consumeParentNotifRead(parentUserId: string): Promise<ParentRateLimitOutcome> {
	return consume(parentNotifReadKey(parentUserId), PARENT_NOTIF_LIMIT_PER_MIN, PARENT_NOTIF_WINDOW_SEC);
}

export function consumeParentLinkPerParent(parentUserId: string): Promise<ParentRateLimitOutcome> {
	return consume(
		parentLinkAttemptKey(parentUserId),
		PARENT_LINK_PER_PARENT_LIMIT,
		PARENT_LINK_PER_PARENT_WINDOW_SEC,
	);
}

export function consumeParentLinkPerStudent(studentRef: string): Promise<ParentRateLimitOutcome> {
	return consume(
		parentLinkStudentKey(studentRef),
		PARENT_LINK_PER_STUDENT_LIMIT,
		PARENT_LINK_PER_STUDENT_WINDOW_SEC,
	);
}

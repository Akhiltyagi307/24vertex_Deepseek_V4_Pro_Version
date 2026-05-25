"use client";

import * as Sentry from "@sentry/nextjs";

export function captureDoubtChatError(
	phase: string,
	err: unknown,
	tags?: Record<string, string>,
): void {
	Sentry.captureException(err, {
		tags: { feature: "doubt_chat", phase, ...tags },
	});
}

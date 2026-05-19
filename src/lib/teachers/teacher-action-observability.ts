import "server-only";

import * as Sentry from "@sentry/nextjs";

import { classifyTeacherActionError } from "@/lib/teachers/classify-teacher-action-error";

export type TeacherActionBreadcrumb = (
	branch: string,
	data?: Record<string, unknown>,
) => void;

/**
 * Wrap a teacher Server Action / Route Handler in a Sentry scope tagged
 * `feature=teacher` + `action=<name>`. The wrapper:
 *
 *  - emits a `started` breadcrumb,
 *  - exposes a `breadcrumb(branch, data?)` callback for the action to mark
 *    validation / auth / rate-limit / RPC / cache-hit transitions,
 *  - captures any thrown value through `classifyTeacherActionError` so the
 *    Sentry event carries a stable `bucket` tag and a user-friendly message,
 *  - rethrows the original error (the action's own typed `{ error }` return
 *    path is preserved by passing the breadcrumb callback to the inner fn).
 *
 * Centralized PII scrubbing already runs in `src/lib/sentry/before-send.ts`,
 * so action data attached to breadcrumbs is sanitized before transport.
 */
export async function withTeacherActionTelemetry<T>(
	actionName: string,
	fn: (breadcrumb: TeacherActionBreadcrumb) => Promise<T>,
): Promise<T> {
	return await Sentry.withScope(async (scope) => {
		scope.setTag("feature", "teacher");
		scope.setTag("action", actionName);

		const breadcrumb: TeacherActionBreadcrumb = (branch, data) => {
			Sentry.addBreadcrumb({
				category: "teacher.action",
				message: `${actionName}.${branch}`,
				level: "info",
				data,
			});
		};
		breadcrumb("started");

		try {
			const result = await fn(breadcrumb);
			return result;
		} catch (err) {
			const classified = classifyTeacherActionError(err, { action: actionName });
			scope.setTag("bucket", classified.bucket);
			scope.setContext("teacher_action", classified.sentryContext);
			Sentry.captureException(err);
			throw err;
		}
	});
}

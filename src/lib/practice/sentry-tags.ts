/**
 * Lightweight Sentry wrapper for practice operations. Usage:
 *
 *   return withPracticeSpan("generatePracticeTest", { subject_id }, async () => { ... });
 *
 * Gracefully no-ops if Sentry isn't configured.
 */
export async function withPracticeSpan<T>(
	stage: string,
	tags: Record<string, string | number | boolean | null | undefined>,
	fn: () => Promise<T>,
): Promise<T> {
	try {
		const Sentry = await import("@sentry/nextjs");
		return await Sentry.withScope(async (scope) => {
			scope.setTag("practice.stage", stage);
			for (const [k, v] of Object.entries(tags)) {
				if (v == null) continue;
				scope.setTag(`practice.${k}`, String(v));
			}
			try {
				return await fn();
			} catch (e) {
				Sentry.captureException(e);
				throw e;
			}
		});
	} catch {
		return fn();
	}
}

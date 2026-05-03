import "server-only";

/**
 * MJML reads component sources from disk at module init. A static `import "mjml"`
 * runs during Next's build-time route evaluation and can throw EBADF under Turbopack.
 * Load it only when compiling.
 */
export async function compileMjmlToHtml(source: string): Promise<{ html: string; errors: string[] }> {
	const mjml = (await import("mjml")).default;
	const { html, errors } = mjml(source, { validationLevel: "soft" });
	return {
		html,
		errors: errors.map((e) => e.formattedMessage ?? String(e)),
	};
}

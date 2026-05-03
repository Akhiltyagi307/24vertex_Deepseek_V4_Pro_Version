import "server-only";

import mjml from "mjml";

export function compileMjmlToHtml(source: string): { html: string; errors: string[] } {
	const { html, errors } = mjml(source, { validationLevel: "soft" });
	return {
		html,
		errors: errors.map((e) => e.formattedMessage ?? String(e)),
	};
}

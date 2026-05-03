import "server-only";

/** Very small, safe HTML from markdown-like body (paragraphs + line breaks). */
export function broadcastBodyToEmailHtml(bodyMd: string): string {
	const safe = bodyMd
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	return `<div style="font-family:system-ui,sans-serif;line-height:1.55;color:#111;max-width:560px;">${safe
		.split(/\n\n+/)
		.map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`)
		.join("")}</div>`;
}

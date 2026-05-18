import "server-only";

import { getAppUrl } from "@/lib/env";

import {
	escapeHtml,
	renderEmailShell,
	setEmailAppUrlResolver,
	type EmailCallout,
	type EmailCta,
	type EmailShellOptions,
	type EmailStat,
} from "@/lib/email/render-email-shell-core";

setEmailAppUrlResolver(getAppUrl);

export {
	escapeHtml,
	renderEmailShell,
	type EmailCallout,
	type EmailCta,
	type EmailShellOptions,
	type EmailStat,
};

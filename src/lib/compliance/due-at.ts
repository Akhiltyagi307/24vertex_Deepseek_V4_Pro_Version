export type ComplianceLegalBasis = "gdpr" | "coppa" | "ferpa" | "dpdp";

/** Statutory-style response deadline from filing date (PDR §4.23). */
export function complianceDueAtFromLegalBasis(legalBasis: ComplianceLegalBasis, filedAt: Date): Date {
	const d = new Date(filedAt.getTime());
	const days =
		legalBasis === "ferpa" ? 45
		: legalBasis === "coppa" ? 30
		: 30; // gdpr, dpdp
	d.setUTCDate(d.getUTCDate() + days);
	return d;
}

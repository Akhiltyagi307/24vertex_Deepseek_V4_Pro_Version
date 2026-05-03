import { z } from "zod";

export const complianceRequestTypeSchema = z.enum(["access", "erasure", "rectification", "portability"]);
export const complianceLegalBasisSchema = z.enum(["gdpr", "coppa", "ferpa", "dpdp"]);
export const complianceRequesterRelationSchema = z.enum(["self", "parent", "guardian", "authorized_agent"]);
export const complianceStatusSchema = z.enum(["open", "in_progress", "fulfilled", "rejected"]);

export const createComplianceRequestBodySchema = z.object({
	request_type: complianceRequestTypeSchema,
	subject_user_id: z.string().uuid().optional(),
	subject_email: z.string().email().max(320).optional(),
	requester_email: z.string().email().max(320),
	requester_relation: complianceRequesterRelationSchema,
	legal_basis: complianceLegalBasisSchema,
	notes: z.string().max(10000).optional(),
});

export const verifyIdentityBodySchema = z.object({
	evidence_url: z.string().url().max(2000).optional(),
});

export const rejectComplianceRequestBodySchema = z.object({
	reason: z.string().min(1).max(5000),
});

export const eraseBodySchema = z.object({
	dry_run: z.boolean(),
	idempotency_key: z.string().uuid().optional(),
	totp: z.string().optional(),
});

export const patchRetentionBodySchema = z.object({
	ttl_days: z.number().int().min(1).max(36500).optional(),
	enabled: z.boolean().optional(),
});

export const retentionRunNowBodySchema = z.object({
	dry_run: z.boolean().default(true),
	commit: z.boolean().optional(),
	totp: z.string().optional(),
});

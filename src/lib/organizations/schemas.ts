import { z } from "zod";

export const organizationTypeSchema = z.enum(["school", "tuition_center"]);

export type OrganizationType = z.infer<typeof organizationTypeSchema>;

const optionalTextToNull = (max: number) =>
	z
		.string()
		.max(max)
		.nullish()
		.transform((value) => {
			if (value == null) return null;
			const trimmed = value.trim();
			return trimmed === "" ? null : trimmed;
		});

export const adminOrganizationInputSchema = z.object({
	type: organizationTypeSchema,
	name: z.string().trim().min(1, "Enter an organization name.").max(300),
	external_id: optionalTextToNull(100),
	favicon_url: optionalTextToNull(2000).refine(
		(value) => value === null || z.string().url().safeParse(value).success,
		{ message: "Invalid favicon URL." },
	),
	is_active: z.boolean().default(true),
});

export type AdminOrganizationInput = z.infer<typeof adminOrganizationInputSchema>;

export type OrganizationRowLike = {
	id: string;
	type: string;
	name: string;
	externalId: string | null;
	faviconUrl: string | null;
	linkingCode?: string;
	isActive: boolean;
	deletedAt: Date | string | null;
	createdAt: Date | string | null;
	updatedAt: Date | string | null;
};

export type SerializedOrganization = {
	id: string;
	type: OrganizationType;
	type_label: string;
	name: string;
	external_id: string | null;
	favicon_url: string | null;
	is_active: boolean;
	deleted_at: string | null;
	created_at: string | null;
	updated_at: string | null;
};

export type SerializedOrganizationAdmin = SerializedOrganization & {
	linking_code: string;
};

function toIsoString(value: Date | string | null): string | null {
	if (value == null) return null;
	if (value instanceof Date) return value.toISOString();
	return value;
}

export function formatOrganizationTypeLabel(type: OrganizationType): string {
	if (type === "tuition_center") return "Tuition center";
	return "School";
}

export function isCatalogOrganization(row: {
	isActive: boolean | null;
	deletedAt: Date | string | null;
}): boolean {
	return row.isActive === true && row.deletedAt == null;
}

export function serializeOrganization(row: OrganizationRowLike): SerializedOrganization {
	const type = organizationTypeSchema.parse(row.type);
	return {
		id: row.id,
		type,
		type_label: formatOrganizationTypeLabel(type),
		name: row.name,
		external_id: row.externalId,
		favicon_url: row.faviconUrl,
		is_active: row.isActive,
		deleted_at: toIsoString(row.deletedAt),
		created_at: toIsoString(row.createdAt),
		updated_at: toIsoString(row.updatedAt),
	};
}

export function serializeOrganizationAdmin(row: OrganizationRowLike & { linkingCode: string }): SerializedOrganizationAdmin {
	return {
		...serializeOrganization(row),
		linking_code: row.linkingCode,
	};
}

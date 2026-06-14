import { describe, expect, it } from "vitest";

import {
	adminOrganizationInputSchema,
	formatOrganizationTypeLabel,
	isCatalogOrganization,
	serializeOrganization,
	serializeOrganizationAdmin,
} from "@/lib/organizations/schemas";

describe("organization schemas", () => {
	it("normalizes admin organization input", () => {
		const parsed = adminOrganizationInputSchema.parse({
			type: "school",
			name: "  Delhi Public School  ",
			external_id: "  DPS-001  ",
			favicon_url: "",
			is_active: true,
		});

		expect(parsed).toEqual({
			type: "school",
			name: "Delhi Public School",
			external_id: "DPS-001",
			favicon_url: null,
			is_active: true,
		});
	});

	it("rejects unsupported organization types", () => {
		expect(() =>
			adminOrganizationInputSchema.parse({
				type: "coaching",
				name: "Bad Org",
			}),
		).toThrow();
	});

	it("accepts an https favicon URL but rejects other schemes", () => {
		const ok = adminOrganizationInputSchema.parse({
			type: "school",
			name: "Org",
			favicon_url: "https://cdn.example.com/favicon.ico",
		});
		expect(ok.favicon_url).toBe("https://cdn.example.com/favicon.ico");

		for (const bad of ["http://example.com/f.ico", "javascript:alert(1)", "data:image/png;base64,AAAA", "not a url"]) {
			expect(() =>
				adminOrganizationInputSchema.parse({ type: "school", name: "Org", favicon_url: bad }),
			).toThrow();
		}
	});

	it("identifies catalog-visible organizations only", () => {
		expect(isCatalogOrganization({ isActive: true, deletedAt: null })).toBe(true);
		expect(isCatalogOrganization({ isActive: false, deletedAt: null })).toBe(false);
		expect(isCatalogOrganization({ isActive: true, deletedAt: new Date() })).toBe(false);
	});

	it("serializes drizzle organization rows for API responses", () => {
		const row = {
			id: "11111111-1111-1111-1111-111111111111",
			type: "tuition_center",
			name: "Aakash Tuition",
			externalId: null,
			faviconUrl: null,
			isActive: true,
			deletedAt: null,
			createdAt: new Date("2026-05-15T00:00:00.000Z"),
			updatedAt: new Date("2026-05-15T00:01:00.000Z"),
		};

		expect(serializeOrganization(row)).toEqual({
			id: row.id,
			type: "tuition_center",
			type_label: "Tuition center",
			name: "Aakash Tuition",
			external_id: null,
			favicon_url: null,
			is_active: true,
			deleted_at: null,
			created_at: "2026-05-15T00:00:00.000Z",
			updated_at: "2026-05-15T00:01:00.000Z",
		});
	});

	it("extends catalog serialization with linking_code for admin APIs", () => {
		const row = {
			id: "22222222-2222-2222-2222-222222222222",
			type: "school",
			name: "DPS",
			externalId: "DPS-1",
			faviconUrl: null,
			isActive: true,
			deletedAt: null,
			createdAt: new Date("2026-05-15T00:00:00.000Z"),
			updatedAt: new Date("2026-05-15T00:01:00.000Z"),
			linkingCode: "ABCD2345",
		};

		expect(serializeOrganizationAdmin(row)).toEqual({
			...serializeOrganization(row),
			linking_code: "ABCD2345",
		});
	});

	it("formats organization type labels", () => {
		expect(formatOrganizationTypeLabel("school")).toBe("School");
		expect(formatOrganizationTypeLabel("tuition_center")).toBe("Tuition center");
	});
});

import "server-only";

import { unstable_cache } from "next/cache";

import { PLAN_CATALOG, type PlanCode, type PlanCatalogEntry } from "@/lib/billing/plans";

type PlanCatalog = Record<PlanCode, PlanCatalogEntry>;

/**
 * Cached plan catalog for server components. Mirrors `PLAN_CATALOG` in code; use this
 * where cross-request dedupe and a single `unstable_cache` key help (subscription UI, etc.).
 */
export const getCachedPlanCatalog = unstable_cache(
	async (): Promise<PlanCatalog> => ({ ...PLAN_CATALOG }),
	["deterministic-plan-catalog-v2"],
	{ revalidate: 3600, tags: ["plan-catalog"] },
);

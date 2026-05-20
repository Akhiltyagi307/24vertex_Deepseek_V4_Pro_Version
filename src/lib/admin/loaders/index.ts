import "server-only";

import { z } from "zod";

/**
 * D17: shared admin loader helper for paginated lists.
 *
 * Before this module, every admin list page parsed `page`, `page_size`,
 * `q`, etc. from `searchParams` inline, with no shared default cap or
 * type-safe schema. The result was 12+ bespoke variants — easy to drift,
 * hard to audit, and one bug away from an unbounded list size.
 *
 * This module centralises:
 *   - default page (1) and `page_size` (25) with a hard cap (`maxPageSize`,
 *     default 100). A page_size > maxPageSize is clamped, not rejected,
 *     because operator UIs occasionally pass `1000` and a 400 here would
 *     just confuse them.
 *   - typed filter parsing via Zod — callers pass a schema for the
 *     non-pagination params they care about and receive a typed result.
 *   - the standard envelope shape (`{ items, total, page, pageSize }`)
 *     used by `adminListResponse`.
 *
 * Usage:
 *
 *   const ListQuery = z.object({ q: z.string().optional() });
 *   const { page, pageSize, filters } = parseAdminListQuery(searchParams, ListQuery);
 *   …
 *   return adminListResponse({ data: rows, total, page, pageSize });
 */

export interface AdminListPagination {
	page: number;
	pageSize: number;
	offset: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_MAX_PAGE_SIZE = 100;

function clampInt(raw: string | number | null | undefined, fallback: number, min: number, max: number): number {
	if (raw == null) return fallback;
	const n = typeof raw === "number" ? raw : Number(raw);
	if (!Number.isFinite(n)) return fallback;
	const i = Math.floor(n);
	if (i < min) return min;
	if (i > max) return max;
	return i;
}

export function parseAdminListPagination(
	params: URLSearchParams | Record<string, string | string[] | undefined>,
	opts: { defaultPageSize?: number; maxPageSize?: number } = {},
): AdminListPagination {
	const get = (key: string): string | undefined => {
		if (params instanceof URLSearchParams) {
			return params.get(key) ?? undefined;
		}
		const v = params[key];
		if (Array.isArray(v)) return v[0];
		return v ?? undefined;
	};
	const defaultPageSize = opts.defaultPageSize ?? DEFAULT_PAGE_SIZE;
	const maxPageSize = opts.maxPageSize ?? DEFAULT_MAX_PAGE_SIZE;
	const page = clampInt(get("page"), DEFAULT_PAGE, 1, 10_000);
	const pageSize = clampInt(get("page_size"), defaultPageSize, 1, maxPageSize);
	return {
		page,
		pageSize,
		offset: (page - 1) * pageSize,
	};
}

export interface AdminListQuery<T> extends AdminListPagination {
	filters: T;
}

export function parseAdminListQuery<T extends z.ZodTypeAny>(
	params: URLSearchParams | Record<string, string | string[] | undefined>,
	filtersSchema: T,
	opts: { defaultPageSize?: number; maxPageSize?: number } = {},
): AdminListQuery<z.infer<T>> {
	const pagination = parseAdminListPagination(params, opts);

	// Collect non-pagination params for the filters schema.
	const filterParams: Record<string, string | undefined> = {};
	if (params instanceof URLSearchParams) {
		for (const [k, v] of params.entries()) {
			if (k === "page" || k === "page_size") continue;
			filterParams[k] = v;
		}
	} else {
		for (const [k, v] of Object.entries(params)) {
			if (k === "page" || k === "page_size") continue;
			filterParams[k] = Array.isArray(v) ? v[0] : v;
		}
	}

	const parsed = filtersSchema.safeParse(filterParams);
	const filters = parsed.success ? parsed.data : ({} as z.infer<T>);
	return { ...pagination, filters };
}

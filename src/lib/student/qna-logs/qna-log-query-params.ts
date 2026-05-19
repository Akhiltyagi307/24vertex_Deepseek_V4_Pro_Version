import { z } from "zod";

import {
	QNA_LOG_PAGE_SIZES,
	QNA_LOG_PERFORMANCE,
	QNA_LOG_QUESTION_TYPES,
	QNA_LOG_SORT_DIRS,
	QNA_LOG_SORT_KEYS,
	QNA_LOG_SOURCES,
	type QnaLogFilters,
	type QnaLogPageSize,
	type QnaLogSort,
} from "./types";

const pageSizeEnum = z.enum(QNA_LOG_PAGE_SIZES.map(String) as [string, ...string[]]);
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

const qnaLogQuerySchema = z
	.object({
		page: z.string().regex(/^\d+$/).optional(),
		page_size: pageSizeEnum.optional(),
		q: z.string().max(160).optional(),
		subject: z.string().uuid().optional(),
		source: z.enum(QNA_LOG_SOURCES).optional(),
		performance: z.enum(QNA_LOG_PERFORMANCE).optional(),
		type: z.enum(QNA_LOG_QUESTION_TYPES).optional(),
		sort: z.enum(QNA_LOG_SORT_KEYS).optional(),
		dir: z.enum(QNA_LOG_SORT_DIRS).optional(),
		from: z.string().regex(dateKeyPattern).optional(),
		to: z.string().regex(dateKeyPattern).optional(),
		a: z.string().uuid().optional(),
	})
	.strict();

export type ParsedQnaLogQueryParams = {
	page: number;
	pageSize: QnaLogPageSize;
	filters: QnaLogFilters;
	sort: QnaLogSort;
	activeAnswerId: string | null;
};

export type ParsedQnaLogDateRange = {
	startIso: string | null;
	endIso: string | null;
};

export function qnaDateKeyRangeToIso(fromDateKey: string | null, toDateKey: string | null): ParsedQnaLogDateRange {
	const startIso = fromDateKey ? new Date(`${fromDateKey}T00:00:00+05:30`).toISOString() : null;
	const endIso = toDateKey ? new Date(`${toDateKey}T23:59:59.999+05:30`).toISOString() : null;
	return { startIso, endIso };
}

function toObject(searchParams: URLSearchParams): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of searchParams.entries()) out[k] = v;
	return out;
}

export function parseQnaLogQueryParams(
	searchParams: URLSearchParams,
): { ok: true; value: ParsedQnaLogQueryParams } | { ok: false; error: string } {
	const parsed = qnaLogQuerySchema.safeParse(toObject(searchParams));
	if (!parsed.success) {
		return { ok: false, error: "Invalid query parameters." };
	}

	const raw = parsed.data;
	const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
	const pageSize = Number.parseInt(raw.page_size ?? String(QNA_LOG_PAGE_SIZES[0]), 10) as QnaLogPageSize;

	const filters: QnaLogFilters = {
		query: raw.q?.trim() ? raw.q.trim() : null,
		subjectId: raw.subject ?? null,
		source: raw.source ?? null,
		performance: raw.performance ?? null,
		questionType: raw.type ?? null,
		fromDateKey: raw.from ?? null,
		toDateKey: raw.to ?? null,
	};
	if (filters.fromDateKey && filters.toDateKey && filters.fromDateKey > filters.toDateKey) {
		return { ok: false, error: "Invalid date range." };
	}

	const sort: QnaLogSort = {
		key: raw.sort ?? "date",
		dir: raw.dir ?? "desc",
	};

	return {
		ok: true,
		value: {
			page,
			pageSize,
			filters,
			sort,
			activeAnswerId: raw.a ?? null,
		},
	};
}

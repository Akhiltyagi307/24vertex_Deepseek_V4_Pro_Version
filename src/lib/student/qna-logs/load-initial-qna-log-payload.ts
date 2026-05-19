import "server-only";

import { parseQnaLogQueryParams } from "./qna-log-query-params";
import { listQnaLogRows } from "./list-qna-log-rows";
import type { QnaLogListResult } from "./types";
import type { ParsedQnaLogQueryParams } from "./qna-log-query-params";

export type InitialQnaLogPayload = {
	data: QnaLogListResult;
	query: ParsedQnaLogQueryParams;
};

export function searchParamsToQnaLogUrlParams(
	searchParams: Record<string, string | string[] | undefined>,
): URLSearchParams {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(searchParams)) {
		if (typeof value === "string") params.set(key, value);
		else if (Array.isArray(value) && typeof value[0] === "string") params.set(key, value[0]);
	}
	return params;
}

export async function loadInitialQnaLogPayload(
	studentId: string,
	searchParams: URLSearchParams,
): Promise<InitialQnaLogPayload | null> {
	const parsed = parseQnaLogQueryParams(searchParams);
	if (!parsed.ok) return null;

	const data = await listQnaLogRows({
		studentId,
		page: parsed.value.page,
		pageSize: parsed.value.pageSize,
		filters: parsed.value.filters,
		sort: parsed.value.sort,
	});

	return { data, query: parsed.value };
}

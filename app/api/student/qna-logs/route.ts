import { parseQnaLogQueryParams } from "@/lib/student/qna-logs/qna-log-query-params";
import { listQnaLogRows } from "@/lib/student/qna-logs/list-qna-log-rows";
import {
	qnaError,
	qnaJson,
	qnaRateLimitCheck,
	resolveStudentQnaViewer,
} from "@/lib/student/qna-logs/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIST_LIMIT_N = 60;
const LIST_WINDOW_SECONDS = 60;

export async function GET(request: Request) {
	const viewer = await resolveStudentQnaViewer();
	if (!viewer.ok) return viewer.response;

	const parsed = parseQnaLogQueryParams(new URL(request.url).searchParams);
	if (!parsed.ok) return qnaError(400, parsed.error);

	const limited = await qnaRateLimitCheck({
		userId: viewer.userId,
		bucket: "qna-logs-list",
		limitN: LIST_LIMIT_N,
		windowSeconds: LIST_WINDOW_SECONDS,
	});
	if (limited) return limited;

	const data = await listQnaLogRows({
		studentId: viewer.studentId,
		page: parsed.value.page,
		pageSize: parsed.value.pageSize,
		filters: parsed.value.filters,
		sort: parsed.value.sort,
	});

	return qnaJson({
		data,
		query: parsed.value,
	});
}

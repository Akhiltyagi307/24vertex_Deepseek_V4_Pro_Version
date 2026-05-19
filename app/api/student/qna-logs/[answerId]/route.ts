import { z } from "zod";

import { getQnaLogDetail } from "@/lib/student/qna-logs/get-qna-log-detail";
import {
	qnaError,
	qnaJson,
	qnaRateLimitCheck,
	resolveStudentQnaViewer,
} from "@/lib/student/qna-logs/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DETAIL_LIMIT_N = 120;
const DETAIL_WINDOW_SECONDS = 60;

const paramsSchema = z.object({ answerId: z.string().uuid() }).strict();

type RouteContext = { params: Promise<{ answerId: string }> };

export async function GET(_request: Request, context: RouteContext) {
	const rawParams = await context.params;
	const parsedParams = paramsSchema.safeParse(rawParams);
	if (!parsedParams.success) return qnaError(400, "Invalid answer id.");

	const viewer = await resolveStudentQnaViewer();
	if (!viewer.ok) return viewer.response;

	const limited = await qnaRateLimitCheck({
		userId: viewer.userId,
		bucket: "qna-logs-detail",
		limitN: DETAIL_LIMIT_N,
		windowSeconds: DETAIL_WINDOW_SECONDS,
	});
	if (limited) return limited;

	const detail = await getQnaLogDetail({
		studentId: viewer.studentId,
		answerId: parsedParams.data.answerId,
	});
	if (!detail) return qnaError(404, "Question log not found.");

	return qnaJson({ detail });
}

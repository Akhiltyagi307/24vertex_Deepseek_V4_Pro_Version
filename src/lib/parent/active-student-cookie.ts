import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

export const PARENT_ACTIVE_STUDENT_COOKIE = "eduai_parent_active_student";

const uuid = z.string().uuid();

export async function getParentActiveStudentIdFromCookie(): Promise<string | null> {
	const raw = (await cookies()).get(PARENT_ACTIVE_STUDENT_COOKIE)?.value;
	if (!raw) return null;
	return uuid.safeParse(raw).success ? raw : null;
}

import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { LEGACY_PRODUCT_SLUG, PRODUCT_SLUG } from "@/lib/brand/constants";

export const PARENT_ACTIVE_STUDENT_COOKIE = `${PRODUCT_SLUG}_parent_active_student`;

/** @deprecated Read shim only. */
export const LEGACY_PARENT_ACTIVE_STUDENT_COOKIE = `${LEGACY_PRODUCT_SLUG}_parent_active_student`;

const uuid = z.string().uuid();

export async function getParentActiveStudentIdFromCookie(): Promise<string | null> {
	const jar = await cookies();
	const raw =
		jar.get(PARENT_ACTIVE_STUDENT_COOKIE)?.value ??
		jar.get(LEGACY_PARENT_ACTIVE_STUDENT_COOKIE)?.value;
	if (!raw) return null;
	return uuid.safeParse(raw).success ? raw : null;
}

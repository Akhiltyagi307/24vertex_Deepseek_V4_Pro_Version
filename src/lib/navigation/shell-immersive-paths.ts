/** `/student/practice/[testId]` — timed session, not the practice hub. */
export function isStudentPracticeTestSessionPath(pathname: string): boolean {
	const segments = pathname.split("/").filter(Boolean);
	return segments.length === 3 && segments[0] === "student" && segments[1] === "practice";
}

export function isStudentDoubtChatPath(pathname: string): boolean {
	return pathname === "/student/doubt-chat";
}

/** Routes where the main column should stay full-bleed (no shell horizontal padding). */
export function isStudentImmersiveShellPath(pathname: string): boolean {
	return isStudentDoubtChatPath(pathname) || isStudentPracticeTestSessionPath(pathname);
}

export function isParentDoubtChatPath(pathname: string): boolean {
	return pathname === "/parent/doubt-chat";
}

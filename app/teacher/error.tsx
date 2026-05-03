"use client";

import { ErrorScreen } from "@/components/error-screen";

export default function TeacherError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<ErrorScreen
			error={error}
			reset={reset}
			homeHref="/teacher/dashboard"
			homeLabel="Back to dashboard"
			tag="teacher"
		/>
	);
}

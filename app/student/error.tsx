"use client";

import { ErrorScreen } from "@/components/error-screen";

export default function StudentError({
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
			homeHref="/student/dashboard"
			homeLabel="Back to dashboard"
			tag="student"
		/>
	);
}

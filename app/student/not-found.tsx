import type { Metadata } from "next";

import { ErrorScreen } from "@/components/error-screen";

export const metadata: Metadata = {
	title: "Page not found",
	robots: { index: false, follow: false },
};

export default function StudentNotFound() {
	return (
		<ErrorScreen
			title="Page not found"
			description="That page doesn't exist or has moved. Head back to your dashboard to keep going."
			homeHref="/student/dashboard"
			homeLabel="Back to dashboard"
			tag="student-not-found"
		/>
	);
}

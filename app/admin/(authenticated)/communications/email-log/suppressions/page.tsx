import { AdminEmailSuppressionsClient } from "./suppressions-client";

export const metadata = {
	title: "Email suppressions · EduAI Admin",
	robots: { index: false, follow: false },
};

export default function AdminEmailSuppressionsPage() {
	return <AdminEmailSuppressionsClient />;
}

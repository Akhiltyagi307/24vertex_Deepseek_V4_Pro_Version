import { AdminEmailSuppressionsClient } from "./suppressions-client";

export const metadata = {
	title: "Email suppressions · 24Vertex Admin",
	robots: { index: false, follow: false },
};

export default function AdminEmailSuppressionsPage() {
	return <AdminEmailSuppressionsClient />;
}

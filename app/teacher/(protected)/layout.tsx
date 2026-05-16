import { redirect } from "next/navigation";

import { getCachedAppProfileRow } from "@/lib/auth/cached-profile";

export default async function ProtectedTeacherLayout({ children }: { children: React.ReactNode }) {
	const profile = await getCachedAppProfileRow();
	if (!profile || profile.role !== "teacher") {
		redirect("/login");
	}
	if (profile.is_verified !== true) {
		redirect("/teacher/pending");
	}

	return children;
}


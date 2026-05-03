import { redirect } from "next/navigation";

import { AdminImpersonationBanner } from "@/components/admin/impersonation-banner";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/routing";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		redirect("/login");
	}
	const profile = await getProfile();
	if (!profile || profile.role !== "teacher") {
		redirect("/login");
	}
	if (profile.is_suspended) {
		redirect("/login?suspended=1");
	}
	return (
		<div className="min-h-screen p-6">
			<AdminImpersonationBanner />
			{children}
		</div>
	);
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/routing";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		redirect("/login");
	}
	const profile = await getProfile();
	if (!profile || profile.role !== "admin") {
		redirect("/login");
	}
	return <div className="min-h-screen p-6">{children}</div>;
}

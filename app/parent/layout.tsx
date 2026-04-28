import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth/get-server-user";
import { getProfile } from "@/lib/auth/routing";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}
	const profile = await getProfile();
	if (!profile || profile.role !== "parent") {
		redirect("/login");
	}
	return <>{children}</>;
}

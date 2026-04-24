import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth/get-server-user";
import { getProfile, resolvePostAuthPath } from "@/lib/auth/routing";
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerUser();
	if (user) {
		const profile = await getProfile();
		if (profile) {
			redirect(await resolvePostAuthPath());
		}
		redirect("/signup/role-picker");
	}
	return children;
}

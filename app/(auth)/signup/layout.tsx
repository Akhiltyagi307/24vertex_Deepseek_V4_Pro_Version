import { redirect } from "next/navigation";
import { getProfile, resolvePostAuthPath } from "@/lib/auth/routing";
import { getServerUser } from "@/lib/auth/get-server-user";

export default async function SignupLayout({ children }: { children: React.ReactNode }) {
	const user = await getServerUser();
	if (user) {
		const profile = await getProfile();
		if (profile) {
			redirect(await resolvePostAuthPath());
		}
	}
	return children;
}

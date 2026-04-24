import { RolePickerPanel } from "@/components/auth/role-picker-panel";
import { getProfile } from "@/lib/auth/routing";
import { getServerUser } from "@/lib/auth/get-server-user";

export default async function RolePickerPage() {
	const user = await getServerUser();
	const profile = user ? await getProfile() : null;
	const isCompletingProfile = Boolean(user && !profile);

	return <RolePickerPanel isCompletingProfile={isCompletingProfile} />;
}

import type { Metadata } from "next";

import { RolePickerPanel } from "@/components/auth/role-picker-panel";
import { getProfile } from "@/lib/auth/routing";
import { getServerUser } from "@/lib/auth/get-server-user";

export const metadata: Metadata = {
	title: "Choose how to sign up",
	description: "Pick your role to start an EduAI account: student, parent, or teacher.",
};

export default async function RolePickerPage() {
	const user = await getServerUser();
	const profile = user ? await getProfile() : null;
	const isCompletingProfile = Boolean(user && !profile);

	return <RolePickerPanel isCompletingProfile={isCompletingProfile} />;
}

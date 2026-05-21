import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyAdminJwt } from "@/lib/admin/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin/constants";

export const metadata = {
	title: "Admin · 24Vertex Admin",
	robots: { index: false, follow: false },
};


export default async function AdminIndexPage() {
	const jar = await cookies();
	const token = jar.get(ADMIN_SESSION_COOKIE)?.value;
	if (token && (await verifyAdminJwt(token))) {
		redirect("/admin/dashboard");
	}
	redirect("/admin/login");
}

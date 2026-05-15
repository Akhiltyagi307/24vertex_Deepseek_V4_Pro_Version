import { NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth/get-server-user";
import { listCatalogOrganizations } from "@/lib/organizations/queries";

export const runtime = "nodejs";

export async function GET() {
	const user = await getServerUser();
	if (!user) {
		return NextResponse.json({ error: "Not signed in." }, { status: 401 });
	}

	const data = await listCatalogOrganizations();
	return NextResponse.json({ data });
}

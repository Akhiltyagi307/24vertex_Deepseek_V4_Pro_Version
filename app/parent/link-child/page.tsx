import { Suspense } from "react";

import { ParentPortalStandaloneShell } from "@/components/parent/parent-portal-standalone-shell";

import { LinkChildForm } from "./link-child-form";

export default function LinkChildPage() {
	return (
		<ParentPortalStandaloneShell>
			<Suspense fallback={null}>
				<LinkChildForm />
			</Suspense>
		</ParentPortalStandaloneShell>
	);
}

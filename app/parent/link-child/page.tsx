import type { Metadata } from "next";
import { Suspense } from "react";

import { ParentPortalStandaloneShell } from "@/components/parent/parent-portal-standalone-shell";

import { LinkChildForm } from "./link-child-form";

export const metadata: Metadata = {
	title: "Link a child · Parent",
	description: "Connect a student to your parent account using their 24Vertex link code.",
	robots: { index: false, follow: false },
	openGraph: {
		title: "Link your child on 24Vertex",
		description: "Enter the 6- or 8-character link code from the student's 24Vertex profile.",
	},
};

export default function LinkChildPage() {
	return (
		<ParentPortalStandaloneShell>
			<Suspense fallback={null}>
				<LinkChildForm />
			</Suspense>
		</ParentPortalStandaloneShell>
	);
}

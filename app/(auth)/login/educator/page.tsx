import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
	title: "Educator log in",
	description: "Sign in to your 24Vertex teacher workspace.",
};

type Props = {
	searchParams?: Promise<{ error?: string; verified?: string; reset?: string }>;
};

export default async function EducatorLoginPage({ searchParams }: Props) {
	const sp = searchParams ? await searchParams : {};
	return (
		<LoginForm
			callbackError={sp.error}
			emailVerified={sp.verified === "1"}
			passwordReset={sp.reset === "success"}
			variant="educator"
		/>
	);
}

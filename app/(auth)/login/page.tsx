import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
	title: "Log in",
	description: "Sign in to EduAI to continue adaptive practice and view your reports.",
};

type Props = {
	searchParams?: Promise<{ error?: string; verified?: string; reset?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
	const sp = searchParams ? await searchParams : {};
	return (
		<LoginForm
			callbackError={sp.error}
			emailVerified={sp.verified === "1"}
			passwordReset={sp.reset === "success"}
		/>
	);
}

import { LoginForm } from "@/components/login-form";

type Props = {
	searchParams?: Promise<{ error?: string; verified?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
	const sp = searchParams ? await searchParams : {};
	return (
		<LoginForm callbackError={sp.error} emailVerified={sp.verified === "1"} />
	);
}

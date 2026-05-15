"use client";

import { usePathname } from "next/navigation";

import { AuthStudioCard } from "@/components/auth/auth-studio-card";

function audienceFromPath(pathname: string | null): "student" | "educator" {
	if (!pathname) return "student";
	if (pathname.startsWith("/signup/teacher")) return "educator";
	if (pathname.startsWith("/login/educator")) return "educator";
	return "student";
}

/**
 * Picks educator vs student marketing column for `(auth)` / `auth` layouts based on the route.
 */
export function AuthStudioCardGate({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const audience = audienceFromPath(pathname);
	return <AuthStudioCard audience={audience}>{children}</AuthStudioCard>;
}

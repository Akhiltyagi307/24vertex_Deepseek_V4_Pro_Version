import { getPublicSupportEmail } from "@/lib/env";

/**
 * Billing/legal contact guidance. Uses NEXT_PUBLIC_SUPPORT_EMAIL when set.
 */
export function LegalContactBlock() {
	const email = getPublicSupportEmail();

	return (
		<div className="mt-8 rounded-lg border border-border/60 bg-muted/15 p-4 text-sm leading-relaxed text-muted-foreground">
			<p className="font-medium text-foreground">How to reach us</p>
			<p className="mt-2">
				{email ? (
					<>
						For subscription, billing, privacy, or access issues, email{" "}
						<a href={`mailto:${email}`} className="font-medium text-primary underline-offset-4 hover:underline">
							{email}
						</a>
						{". "}
					</>
				) : (
					<>
						For subscription, billing, privacy, or access issues, use the in-app options available while signed in
						(for example Student settings).{" "}
					</>
				)}
				If your account or payment was set up through a school, your school administrator may handle certain requests.
			</p>
		</div>
	);
}

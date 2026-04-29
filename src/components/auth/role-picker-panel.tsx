import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type RolePickerPanelProps = {
	isCompletingProfile: boolean;
};

const itemEnter =
	"motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200 motion-reduce:animate-none";

const linkMotion =
	"inline-flex transition-transform motion-safe:active:scale-[0.98] motion-safe:hover:scale-[1.01] motion-reduce:hover:scale-100 motion-reduce:active:scale-100";

export function RolePickerPanel({ isCompletingProfile }: RolePickerPanelProps) {
	const linkClass = cn(buttonVariants({ variant: "outline" }), "w-full justify-center", linkMotion);

	return (
		<div className="flex flex-col gap-6">
			<FieldGroup>
				<div className="flex flex-col items-center gap-2 text-center">
					<h1 className={cn("text-2xl font-bold tracking-tight", itemEnter)}>
						{isCompletingProfile ? "Complete sign up" : "Sign up"}
					</h1>
					<p
						className={cn(
							"max-w-[44ch] text-balance text-sm leading-relaxed text-muted-foreground",
							itemEnter,
							"motion-safe:delay-75",
						)}
					>
						{isCompletingProfile
							? "You are signed in but still need a profile. Choose how you will use the product."
							: "Choose student or parent to create your account, then sign in whenever you need it."}
					</p>
				</div>
				<div className="flex flex-col gap-3">
					<Link
						href="/signup/student"
						className={cn(linkClass, "min-h-11 py-2.5 text-base font-semibold", itemEnter, "motion-safe:delay-100")}
					>
						Student
					</Link>
					<Link
						href="/signup/parent"
						className={cn(linkClass, "min-h-11 py-2.5 text-base font-semibold", itemEnter, "motion-safe:delay-150")}
					>
						Parent
					</Link>
				</div>
			</FieldGroup>
			{isCompletingProfile ? (
				<div className="flex justify-center">
					<SignOutButton />
				</div>
			) : (
				<FieldDescription className="text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link
						href="/login"
						className="font-medium text-foreground underline underline-offset-4 hover:text-foreground"
					>
						Log in
					</Link>
				</FieldDescription>
			)}
		</div>
	);
}

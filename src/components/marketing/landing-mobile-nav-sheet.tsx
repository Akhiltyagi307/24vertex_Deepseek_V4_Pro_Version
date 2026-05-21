"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";

import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import {
	LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
} from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

const landingMobileNavLinks = [
	{ href: "#features", label: "Features" },
	{ href: "#benefits", label: "Benefits" },
	{ href: "#pricing", label: "Pricing" },
] as const;

const mobileNavLinkClassName =
	"flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[0.9375rem] font-medium text-foreground transition-colors duration-200 ease-out hover:bg-muted/45 active:bg-muted/60";

type LandingMobileNavSheetProps = {
	className?: string;
};

export function LandingMobileNavSheet({ className }: LandingMobileNavSheetProps) {
	return (
		<Sheet>
			<SheetTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						className={cn("xl:hidden", className)}
						aria-label="Open menu"
					/>
				}
			>
				<Menu className="size-[15px]" />
				<span className="sr-only">Open menu</span>
			</SheetTrigger>
			<SheetContent
				side="right"
				className="flex w-[min(100vw,20rem)] flex-col gap-0 border-border/70 bg-background p-0 shadow-2xl medium:w-[22.5rem]"
			>
				<SheetTitle className="sr-only">Site menu</SheetTitle>

				<SheetHeader className="border-border/60 shrink-0 space-y-0 border-b px-5 pb-4 pt-5 pr-14">
					<Link
						href="/#home"
						className="inline-flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground"
					>
						<Image
							src="/brand/logo-icon.png"
							alt="24Vertex logo"
							width={32}
							height={32}
							sizes="32px"
							className="size-8 shrink-0 object-contain"
						/>
						<span>24Vertex</span>
					</Link>
					<p className="text-muted-foreground mt-1 text-sm leading-snug">
						Practice, visibility, and class signals for grades 6 to 12.
					</p>
				</SheetHeader>

				<nav
					aria-label="Mobile"
					className="min-h-0 flex-1 overflow-y-auto px-3 py-5"
				>
					<p className="font-mono text-2xs mb-2 px-3 uppercase tracking-wider text-muted-foreground">
						Explore
					</p>
					<ul className="flex flex-col gap-0.5">
						{landingMobileNavLinks.map((link) => (
							<li key={link.href}>
								<SheetClose
									render={
										<a href={link.href} className={mobileNavLinkClassName} />
									}
								>
									<span>{link.label}</span>
									<ChevronRight
										className="text-muted-foreground size-4 shrink-0 opacity-70"
										aria-hidden
									/>
								</SheetClose>
							</li>
						))}
					</ul>
				</nav>

				<SheetFooter className="border-border/60 shrink-0 gap-3 border-t bg-muted/15 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
					<SheetClose
						render={
							<LandingPrimaryCtaButton
								visual="minimal"
								className="h-11 w-full justify-center rounded-full text-sm font-semibold"
								render={<Link href="/signup/role-picker" />}
							/>
						}
					/>
					<SheetClose
						render={
							<Button
								variant="marketingSecondary"
								className={cn(
									"h-11 w-full justify-center",
									LANDING_MARKETING_SECONDARY_CTA_BUTTON_CLASSNAME,
								)}
								render={<Link href="/login" />}
							>
								Log in
							</Button>
						}
					/>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

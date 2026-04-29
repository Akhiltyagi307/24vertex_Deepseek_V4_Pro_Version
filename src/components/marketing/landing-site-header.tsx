"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { LANDING_ROLE_SIGNUP_PRIMARY_CTA } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
	{ href: "#home", label: "Home" },
	{ href: "#features", label: "Features" },
	{ href: "#benefits", label: "Benefits" },
	{ href: "#how-it-works", label: "How it works" },
	{ href: "#pricing", label: "Pricing" },
	{ href: "#voices", label: "Voices" },
] as const;

function NavAnchor({
	href,
	children,
	className,
	onClick,
}: {
	href: string;
	children: React.ReactNode;
	className?: string;
	onClick?: () => void;
}) {
	return (
		<a
			href={href}
			className={cn(
				"rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
				className,
			)}
			onClick={onClick}
		>
			{children}
		</a>
	);
}

export function LandingSiteHeader() {
	const [sheetOpen, setSheetOpen] = useState(false);
	const closeSheet = () => setSheetOpen(false);

	return (
		<header className="sticky top-0 z-50 border-b border-border bg-background">
			<div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
				<Link
					href="/#home"
					className="inline-flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
					aria-label="EduAI home"
				>
					<span className="relative size-9 shrink-0 sm:size-10">
						<Image src="/brand/logo-icon.png" alt="" fill className="object-contain" priority sizes="40px" />
					</span>
					<span className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
						EduAI
					</span>
				</Link>

				<nav className="hidden items-center gap-5 md:flex md:text-[0.8125rem] lg:gap-6 lg:text-sm" aria-label="Primary">
					{NAV_LINKS.map((item) => (
						<NavAnchor key={item.href} href={item.href}>
							{item.label}
						</NavAnchor>
					))}
				</nav>

				<div className="flex shrink-0 items-center gap-2 sm:gap-3">
					<Button variant="ghost" size="sm" className="hidden sm:inline-flex" render={<Link href="/login" />}>
						Log in
					</Button>
					<Button size="sm" className="hidden sm:inline-flex" render={<Link href="/signup/role-picker" />}>
						{LANDING_ROLE_SIGNUP_PRIMARY_CTA}
					</Button>

					<Button variant="ghost" size="sm" className="sm:hidden" render={<Link href="/login" />}>
						Log in
					</Button>

					<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							className="shrink-0 md:hidden"
							aria-label="Open menu"
							onClick={() => setSheetOpen(true)}
						>
							<MenuIcon />
						</Button>
						<SheetContent side="right" className="flex w-full max-w-sm flex-col gap-0 p-0">
							<SheetHeader className="gap-1 border-b border-border p-4 text-left">
								<SheetTitle>Menu</SheetTitle>
								<SheetDescription>Jump to a section or open your account.</SheetDescription>
							</SheetHeader>
							<nav className="flex flex-col gap-0.5 p-2" aria-label="Mobile primary">
								{NAV_LINKS.map((item) => (
									<Button
										key={item.href}
										variant="ghost"
										className="h-auto w-full justify-start px-3 py-2.5 text-base font-medium"
										nativeButton={false}
										render={<a href={item.href} onClick={closeSheet} />}
									>
										{item.label}
									</Button>
								))}
							</nav>
							<Separator />
							<SheetFooter className="mt-0 flex-col gap-2 border-t border-border bg-muted/30 p-4 sm:flex-col">
								<Button
									variant="outline"
									className="w-full"
									render={<Link href="/login" onClick={closeSheet} />}
								>
									Log in
								</Button>
								<Button className="w-full" render={<Link href="/signup/role-picker" onClick={closeSheet} />}>
									{LANDING_ROLE_SIGNUP_PRIMARY_CTA}
								</Button>
							</SheetFooter>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
}

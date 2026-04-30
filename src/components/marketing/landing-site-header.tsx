"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LandingPrimaryCtaButton } from "@/components/marketing/landing-primary-cta-button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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
					aria-label="24vertex home"
				>
					<img
						src="/brand/logo-icon.png"
						alt="24vertex logo"
						className="size-9 shrink-0 object-contain sm:size-10"
					/>
					<span className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
						24vertex
					</span>
				</Link>

				<nav className="hidden items-center gap-5 md:flex md:text-[0.8125rem] lg:gap-6 lg:text-sm" aria-label="Primary">
					<Link
						href="/#home"
						className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-foreground transition-colors hover:text-foreground/85"
						aria-label="24vertex home from navigation"
					>
						<img src="/brand/logo-icon.png" alt="24vertex logo" className="size-5 shrink-0 object-contain" />
						<span className="hidden lg:inline">24vertex</span>
					</Link>
					{NAV_LINKS.map((item) => (
						<NavAnchor key={item.href} href={item.href}>
							{item.label}
						</NavAnchor>
					))}
				</nav>

				<div className="flex shrink-0 items-center gap-2 sm:gap-3">
					<Button
						variant="ghost"
						size="sm"
						className="hidden h-10 rounded-full px-4 text-sm sm:inline-flex"
						render={<Link href="/login" />}
					>
						Log in
					</Button>
					<LandingPrimaryCtaButton className="hidden sm:inline-flex" render={<Link href="/signup/role-picker" />} />

					<Button
						variant="ghost"
						size="sm"
						className="h-10 rounded-full px-4 text-sm sm:hidden"
						render={<Link href="/login" />}
					>
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
							<SheetHeader className="gap-2 border-b border-border p-4 text-left">
								<div className="mb-1 inline-flex items-center gap-2">
									<img src="/brand/logo-icon.png" alt="24vertex logo" className="size-8 shrink-0 object-contain" />
									<span className="text-sm font-semibold tracking-tight text-foreground">24vertex</span>
								</div>
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
									className="h-10 w-full rounded-full px-4 text-sm"
									render={<Link href="/login" onClick={closeSheet} />}
								>
									Log in
								</Button>
								<LandingPrimaryCtaButton
									className="w-full"
									render={<Link href="/signup/role-picker" onClick={closeSheet} />}
								/>
							</SheetFooter>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
}

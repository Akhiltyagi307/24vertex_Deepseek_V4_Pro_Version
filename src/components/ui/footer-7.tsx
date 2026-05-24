"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

import { MARKETING_FOOTER_SECTIONS } from "@/lib/marketing/marketing-nav";

interface Footer7Props {
	logo?: {
		url: string;
		src: string;
		alt: string;
		title: string;
	};
	sections?: Array<{
		title: string;
		links: Array<{ name: string; href: string }>;
	}>;
	description?: string;
	socialLinks?: Array<{
		icon: React.ReactElement;
		href: string;
		label: string;
	}>;
	copyright?: string;
	legalLinks?: Array<{
		name: string;
		href: string;
	}>;
}

/** Shared sizing class for the brand icons; export so callers passing custom `socialLinks` can match the default visual size. */
export const SOCIAL_ICON_CLASS = "size-5";

export function FacebookIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
			<path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47H15.19c-1.25 0-1.64.78-1.64 1.58v1.88h2.78l-.45 2.9h-2.34v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
		</svg>
	);
}

export function InstagramIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
			<path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38a3.71 3.71 0 0 1-1.38.9c-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.71 3.71 0 0 1-1.38-.9 3.71 3.71 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.85 5.85 0 0 0-2.13 1.38A5.85 5.85 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.79.73 1.46 1.38 2.13.67.65 1.34 1.07 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.85 5.85 0 0 0 2.13-1.38 5.85 5.85 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.85 5.85 0 0 0-1.38-2.13A5.85 5.85 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.4-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z" />
		</svg>
	);
}

export function TwitterIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
			<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
		</svg>
	);
}

export function LinkedinIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
			<path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.78A1.77 1.77 0 0 0 0 1.74v20.52A1.77 1.77 0 0 0 1.78 24h20.44a1.77 1.77 0 0 0 1.78-1.74V1.74A1.77 1.77 0 0 0 22.22 0z" />
		</svg>
	);
}

const defaultSocialLinks: Array<{
	icon: React.ReactElement;
	href: string;
	label: string;
}> = [];

const defaultLegalLinks = [
	{ name: "Terms and Conditions", href: "/legal/terms" },
	{ name: "Privacy Policy", href: "/legal/privacy" },
];

export const Footer7 = ({
	logo = {
		url: "/",
		src: "/brand/logo-icon.avif",
		alt: "24Vertex logo",
		title: "24Vertex",
	},
	sections = [...MARKETING_FOOTER_SECTIONS],
	description = "24Vertex spots learning gaps before report cards do. Adaptive practice, an AI tutor that explains and solves step-by-step, and a parent dashboard built for grades 6–10.",
	socialLinks = defaultSocialLinks,
	copyright = `© ${new Date().getFullYear()} 24Vertex. All rights reserved.`,
	legalLinks = defaultLegalLinks,
}: Footer7Props) => {
	return (
		<section className="w-full py-14 medium:py-16">
			<div className="flex w-full flex-col justify-between gap-10 xl:flex-row xl:items-start xl:gap-12">
				<div className="flex w-full max-w-sm flex-col gap-5">
					<div className="flex items-center gap-2.5">
						<Link href={logo.url}>
							<Image
								src={logo.src}
								alt={logo.alt}
								title={logo.title}
								width={32}
								height={32}
								sizes="32px"
								className="size-8 rounded-md object-cover"
							/>
						</Link>
						<h2 className="text-xl font-semibold">{logo.title}</h2>
					</div>
					<p className="text-pretty text-sm leading-relaxed text-muted-foreground">{description}</p>
					{socialLinks.length > 0 ? (
						<ul className="flex items-center gap-6 text-muted-foreground">
							{socialLinks.map((social) => (
								<li key={social.label} className="font-medium hover:text-primary">
									<a href={social.href} aria-label={social.label}>
										{social.icon}
									</a>
								</li>
							))}
						</ul>
					) : null}
				</div>
				<div className="grid w-full min-w-0 gap-8 sm:grid-cols-2 medium:gap-10 xl:grid-cols-4 xl:gap-8">
					{sections.map((section) => (
						<div key={section.title} className="min-w-0">
							<h3 className="mb-3 text-sm font-semibold text-foreground">{section.title}</h3>
							<ul className="space-y-2.5 text-sm text-muted-foreground">
								{section.links.map((link) => (
									<li key={link.href}>
										<Link
											href={link.href}
											className="font-medium text-pretty transition-colors hover:text-primary"
										>
											{link.name}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
			<div className="border-border/60 mt-10 flex flex-col justify-between gap-4 border-t pt-8 text-xs font-medium text-muted-foreground medium:flex-row medium:items-center">
				<p>{copyright}</p>
				<ul className="flex flex-col gap-2 medium:flex-row medium:gap-6">
					{legalLinks.map((link) => (
						<li key={link.href}>
							<Link href={link.href} className="transition-colors hover:text-primary">
								{link.name}
							</Link>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
};

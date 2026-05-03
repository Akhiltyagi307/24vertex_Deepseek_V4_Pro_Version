"use client";

import React from "react";
import { FaFacebook, FaInstagram, FaLinkedin, FaTwitter } from "react-icons/fa";

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

const defaultSections = [
  {
    title: "Product",
    links: [
      { name: "Overview", href: "#" },
      { name: "Pricing", href: "#pricing" },
      { name: "Marketplace", href: "#" },
      { name: "Features", href: "#features" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "#" },
      { name: "Team", href: "#" },
      { name: "Blog", href: "#" },
      { name: "Careers", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Help", href: "#" },
      { name: "Sales", href: "#" },
      { name: "Advertise", href: "#" },
      { name: "Privacy", href: "/legal/privacy" },
    ],
  },
];

const defaultSocialLinks = [
  { icon: <FaInstagram className="size-5" />, href: "#", label: "Instagram" },
  { icon: <FaFacebook className="size-5" />, href: "#", label: "Facebook" },
  { icon: <FaTwitter className="size-5" />, href: "#", label: "Twitter" },
  { icon: <FaLinkedin className="size-5" />, href: "#", label: "LinkedIn" },
];

const defaultLegalLinks = [
  { name: "Terms and Conditions", href: "/legal/terms" },
  { name: "Privacy Policy", href: "/legal/privacy" },
];

export const Footer7 = ({
  logo = {
    url: "/",
    src: "/brand/logo-icon.png",
    alt: "24vertex logo",
    title: "24vertex",
  },
  sections = defaultSections,
  description = "EduAI keeps students, parents, and teachers aligned with focused practice, clear assignment workflows, and role-based dashboards.",
  socialLinks = defaultSocialLinks,
  copyright = `© ${new Date().getFullYear()} 24vertex. All rights reserved.`,
  legalLinks = defaultLegalLinks,
}: Footer7Props) => {
  return (
    <section className="py-16 medium:py-20">
      <div className="container mx-auto">
        <div className="flex w-full flex-col justify-between gap-10 xl:flex-row xl:items-start xl:text-left">
          <div className="flex w-full flex-col justify-between gap-6 xl:items-start">
            <div className="flex items-center gap-2 xl:justify-start">
              <a href={logo.url}>
                <img src={logo.src} alt={logo.alt} title={logo.title} className="h-8 w-8 rounded-md object-cover" />
              </a>
              <h2 className="text-xl font-semibold">{logo.title}</h2>
            </div>
            <p className="max-w-[70%] text-sm text-muted-foreground">{description}</p>
            <ul className="flex items-center space-x-6 text-muted-foreground">
              {socialLinks.map((social, idx) => (
                <li key={idx} className="font-medium hover:text-primary">
                  <a href={social.href} aria-label={social.label}>
                    {social.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid w-full gap-6 medium:grid-cols-3 xl:gap-20">
            {sections.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                <h3 className="mb-4 font-bold">{section.title}</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {section.links.map((link, linkIdx) => (
                    <li key={linkIdx} className="font-medium hover:text-primary">
                      <a href={link.href}>{link.name}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col justify-between gap-4 py-8 text-xs font-medium text-muted-foreground medium:flex-row medium:items-center medium:text-left">
          <p className="order-2 xl:order-1">{copyright}</p>
          <ul className="order-1 flex flex-col gap-2 medium:order-2 medium:flex-row">
            {legalLinks.map((link, idx) => (
              <li key={idx} className="hover:text-primary">
                <a href={link.href}> {link.name}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

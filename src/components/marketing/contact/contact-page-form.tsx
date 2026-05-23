"use client";

import { useSearchParams } from "next/navigation";

import { ContactForm, type ContactInquiryType } from "@/components/marketing/contact/contact-form";

function parseInquiryType(value: string | null): ContactInquiryType {
	if (value === "school" || value === "press") return value;
	return "parent";
}

export function ContactPageForm() {
	const params = useSearchParams();
	const type = parseInquiryType(params.get("type"));
	return <ContactForm defaultInquiryType={type} />;
}

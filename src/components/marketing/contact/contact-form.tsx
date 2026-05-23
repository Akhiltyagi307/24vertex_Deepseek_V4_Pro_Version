"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const textareaClassName =
	"min-h-[120px] w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 medium:text-sm dark:bg-input/30";

export type ContactInquiryType = "parent" | "school" | "press";

type ContactFormProps = {
	defaultInquiryType?: ContactInquiryType;
	className?: string;
};

export function ContactForm({ defaultInquiryType = "parent", className }: ContactFormProps) {
	const [inquiryType, setInquiryType] = React.useState<ContactInquiryType>(defaultInquiryType);
	const [name, setName] = React.useState("");
	const [email, setEmail] = React.useState("");
	const [phone, setPhone] = React.useState("");
	const [message, setMessage] = React.useState("");
	const [website, setWebsite] = React.useState("");
	const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

	React.useEffect(() => {
		setInquiryType(defaultInquiryType);
	}, [defaultInquiryType]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setStatus("loading");
		setErrorMessage(null);
		try {
			const res = await fetch("/api/contact", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					inquiryType,
					name,
					email,
					phone: phone.trim() || undefined,
					message,
					website,
				}),
			});
			const data = (await res.json()) as { ok?: boolean; message?: string };
			if (!res.ok || !data.ok) {
				setStatus("error");
				setErrorMessage(data.message ?? "Something went wrong. Try again.");
				return;
			}
			setStatus("success");
			setName("");
			setEmail("");
			setPhone("");
			setMessage("");
		} catch {
			setStatus("error");
			setErrorMessage("Network error. Check your connection and try again.");
		}
	}

	if (status === "success") {
		return (
			<div
				className={cn(
					"border-border/60 rounded-xl border bg-card px-6 py-8 text-center",
					className,
				)}
				role="status"
			>
				<p className="text-lg font-semibold text-foreground">Message sent</p>
				<p className="text-muted-foreground mt-2 text-sm medium:text-base">
					We read every note. Expect a reply within 2 business days for billing, or 5 for school
					demos.
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className={cn("space-y-5", className)}>
			<div className="space-y-2">
				<Label htmlFor="inquiry-type">I am reaching out as</Label>
				<div className="flex flex-wrap gap-2">
					{(
						[
							["parent", "Parent"],
							["school", "School"],
							["press", "Press"],
						] as const
					).map(([value, label]) => (
						<Button
							key={value}
							type="button"
							variant={inquiryType === value ? "default" : "outline"}
							size="sm"
							className="rounded-full"
							onClick={() => setInquiryType(value)}
						>
							{label}
						</Button>
					))}
				</div>
			</div>

			<div className="grid gap-4 medium:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="contact-name">Name</Label>
					<Input
						id="contact-name"
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						autoComplete="name"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="contact-email">Email</Label>
					<Input
						id="contact-email"
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
					/>
				</div>
			</div>

			<div className="space-y-2">
				<Label htmlFor="contact-phone">Phone (optional)</Label>
				<Input
					id="contact-phone"
					type="tel"
					value={phone}
					onChange={(e) => setPhone(e.target.value)}
					autoComplete="tel"
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="contact-message">Message</Label>
				<textarea
					id="contact-message"
					required
					rows={5}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder="Tell us what you need help with (at least 20 characters)."
					className={textareaClassName}
				/>
			</div>

			<div className="sr-only" aria-hidden>
				<Label htmlFor="contact-website">Website</Label>
				<Input
					id="contact-website"
					tabIndex={-1}
					autoComplete="off"
					value={website}
					onChange={(e) => setWebsite(e.target.value)}
				/>
			</div>

			{errorMessage ? (
				<p className="text-destructive text-sm" role="alert">
					{errorMessage}
				</p>
			) : null}

			<Button type="submit" className="h-11 w-full rounded-full font-semibold" disabled={status === "loading"}>
				{status === "loading" ? "Sending…" : "Send message"}
			</Button>
		</form>
	);
}

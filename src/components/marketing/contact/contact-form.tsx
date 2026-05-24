"use client";

import {
	ArrowRight,
	CheckCircle2,
	GraduationCap,
	Mail,
	MessageSquare,
	Newspaper,
	User,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseIndianPhone } from "@/lib/marketing/contact/phone";
import { cn } from "@/lib/utils";

export type ContactInquiryType = "parent" | "school" | "press";

type InquiryOption = {
	value: ContactInquiryType;
	label: string;
	icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
	helper: string;
	sla: string;
};

const INQUIRY_OPTIONS: readonly InquiryOption[] = [
	{
		value: "parent",
		label: "Parent",
		icon: User,
		helper: "Billing, account, or a learning question about your child.",
		sla: "Within 2 business days",
	},
	{
		value: "school",
		label: "School",
		icon: GraduationCap,
		helper: "Book a demo, pricing, or a campus pilot.",
		sla: "Within 5 business days",
	},
	{
		value: "press",
		label: "Press",
		icon: Newspaper,
		helper: "Press kit, founder interviews, partnerships.",
		sla: "Within 5 business days",
	},
];

const MESSAGE_MAX = 4000;
const MESSAGE_MIN = 20;
const NAME_MIN = 2;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FieldKey = "name" | "email" | "phone" | "message";
type FieldErrors = Partial<Record<FieldKey, string>>;

type ContactFormProps = {
	defaultInquiryType?: ContactInquiryType;
	supportEmail?: string | null;
	className?: string;
};

export function ContactForm({
	defaultInquiryType = "parent",
	supportEmail = null,
	className,
}: ContactFormProps) {
	const [selected, setSelected] = React.useState<InquiryOption>(
		() => INQUIRY_OPTIONS.find((o) => o.value === defaultInquiryType) ?? INQUIRY_OPTIONS[0],
	);
	const [name, setName] = React.useState("");
	const [email, setEmail] = React.useState("");
	const [phone, setPhone] = React.useState("");
	const [message, setMessage] = React.useState("");
	const [website, setWebsite] = React.useState("");
	const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
	const [sentSnapshot, setSentSnapshot] = React.useState<{
		firstName: string;
		email: string;
		sla: string;
	} | null>(null);

	React.useEffect(() => {
		const next = INQUIRY_OPTIONS.find((o) => o.value === defaultInquiryType);
		if (next) setSelected(next);
	}, [defaultInquiryType]);

	const messageLength = message.length;
	const messageTooShort = messageLength > 0 && messageLength < MESSAGE_MIN;

	function focusField(id: string) {
		if (typeof document === "undefined") return;
		const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
		el?.focus();
	}

	function clearFieldError(field: FieldKey) {
		setFieldErrors((prev) => {
			if (!prev[field]) return prev;
			const next = { ...prev };
			delete next[field];
			return next;
		});
	}

	/** Run all client-side checks. Returns the first invalid field, or null. */
	function validate(): { field: FieldKey; message: string } | null {
		const errors: FieldErrors = {};
		if (name.trim().length < NAME_MIN) {
			errors.name = "Add your name so we know who to reply to.";
		}
		const trimmedEmail = email.trim();
		if (!trimmedEmail) {
			errors.email = "Add an email so we can reply.";
		} else if (!EMAIL_RE.test(trimmedEmail)) {
			errors.email = "That email looks off. Double check the format.";
		}
		const trimmedPhone = phone.trim();
		if (trimmedPhone && !parseIndianPhone(trimmedPhone)) {
			errors.phone = "Indian mobile only. 10 digits starting with 6, 7, 8, or 9.";
		}
		if (message.trim().length < MESSAGE_MIN) {
			errors.message = `A few more lines, please. At least ${MESSAGE_MIN} characters.`;
		}
		setFieldErrors(errors);
		const order: readonly FieldKey[] = ["name", "email", "phone", "message"];
		for (const field of order) {
			const msg = errors[field];
			if (msg) return { field, message: msg };
		}
		return null;
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (status === "loading") return;
		const firstError = validate();
		if (firstError) {
			setErrorMessage(firstError.message);
			focusField(`contact-${firstError.field}`);
			setStatus("error");
			return;
		}
		setStatus("loading");
		setErrorMessage(null);
		try {
			const res = await fetch("/api/contact", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					inquiryType: selected.value,
					name: name.trim(),
					email: email.trim(),
					phone: phone.trim() || undefined,
					message: message.trim(),
					website,
				}),
			});
			const data = (await res.json()) as {
				ok?: boolean;
				message?: string;
				field?: FieldKey | "inquiryType";
				code?: string;
			};
			if (!res.ok || !data.ok) {
				setStatus("error");
				const friendly = data.message ?? "Something went wrong. Try again.";
				setErrorMessage(friendly);
				if (data.field && data.field !== "inquiryType") {
					setFieldErrors((prev) => ({ ...prev, [data.field as FieldKey]: friendly }));
					focusField(`contact-${data.field}`);
				}
				return;
			}
			setSentSnapshot({
				firstName: name.trim().split(/\s+/)[0] ?? "there",
				email: email.trim(),
				sla: selected.sla.toLowerCase(),
			});
			setStatus("success");
			setName("");
			setEmail("");
			setPhone("");
			setMessage("");
			setFieldErrors({});
		} catch {
			setStatus("error");
			setErrorMessage("Network error. Check your connection and try again.");
		}
	}

	if (status === "success" && sentSnapshot) {
		return (
			<div
				className={cn(
					"mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card px-6 py-12 text-center medium:px-10 medium:py-14",
					className,
				)}
				role="status"
				aria-live="polite"
			>
				<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
					<CheckCircle2 className="h-6 w-6" aria-hidden />
				</div>
				<h3 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-foreground">
					Thanks, {sentSnapshot.firstName}. Your note is in.
				</h3>
				<p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground medium:text-base">
					We will reply to{" "}
					<span className="font-medium text-foreground">{sentSnapshot.email}</span>{" "}
					{sentSnapshot.sla}. No automated reply, no marketing follow-up.
				</p>
				<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							setStatus("idle");
							setSentSnapshot(null);
						}}
					>
						Send another
					</Button>
					{supportEmail ? (
						<a
							href={`mailto:${supportEmail}`}
							className="text-link inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
						>
							<Mail className="h-4 w-4" aria-hidden />
							{supportEmail}
						</a>
					) : null}
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"grid gap-12 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:gap-16 xl:items-start",
				className,
			)}
		>
			<form onSubmit={onSubmit} noValidate className="min-w-0">
				<fieldset className="space-y-3">
					<legend className="text-sm font-medium text-foreground">
						I am reaching out as
					</legend>
					<div
						role="radiogroup"
						aria-label="Inquiry type"
						className="inline-flex w-full flex-wrap gap-1.5 rounded-full border border-border/70 bg-muted/40 p-1 medium:w-auto"
					>
						{INQUIRY_OPTIONS.map((option) => {
							const isSelected = selected.value === option.value;
							const Icon = option.icon;
							return (
								<button
									key={option.value}
									type="button"
									role="radio"
									aria-checked={isSelected}
									onClick={() => setSelected(option)}
									className={cn(
										"inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium outline-none transition-[color,background-color,box-shadow] duration-150 medium:flex-none",
										"focus-visible:ring-3 focus-visible:ring-ring/50",
										isSelected
											? "bg-primary text-primary-foreground shadow-sm"
											: "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
									)}
								>
									<Icon className="h-4 w-4" aria-hidden />
									{option.label}
								</button>
							);
						})}
					</div>
					<p
						key={selected.value}
						className="text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
					>
						{selected.helper}{" "}
						<span className="text-foreground/80">{selected.sla.toLowerCase()}.</span>
					</p>
				</fieldset>

				<div className="mt-10 grid gap-5 medium:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="contact-name" className="font-medium">
							Your name
						</Label>
						<Input
							id="contact-name"
							name="name"
							required
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								clearFieldError("name");
							}}
							autoComplete="name"
							placeholder="Priya Sharma"
							className="h-11"
							aria-invalid={fieldErrors.name ? true : undefined}
							aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
						/>
						{fieldErrors.name ? (
							<p id="contact-name-error" className="text-destructive text-xs">
								{fieldErrors.name}
							</p>
						) : null}
					</div>
					<div className="space-y-2">
						<Label htmlFor="contact-email" className="font-medium">
							Email
						</Label>
						<Input
							id="contact-email"
							name="email"
							type="email"
							inputMode="email"
							required
							value={email}
							onChange={(e) => {
								setEmail(e.target.value);
								clearFieldError("email");
							}}
							autoComplete="email"
							placeholder="you@example.com"
							className="h-11"
							aria-invalid={fieldErrors.email ? true : undefined}
							aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
						/>
						{fieldErrors.email ? (
							<p id="contact-email-error" className="text-destructive text-xs">
								{fieldErrors.email}
							</p>
						) : null}
					</div>
				</div>

				<div className="mt-5 space-y-2">
					<div className="flex items-baseline justify-between">
						<Label htmlFor="contact-phone" className="font-medium">
							Phone
						</Label>
						<span className="text-xs text-muted-foreground">Optional, India only</span>
					</div>
					<Input
						id="contact-phone"
						name="phone"
						type="tel"
						inputMode="tel"
						value={phone}
						onChange={(e) => {
							setPhone(e.target.value);
							clearFieldError("phone");
						}}
						onBlur={() => {
							const trimmed = phone.trim();
							if (trimmed && !parseIndianPhone(trimmed)) {
								setFieldErrors((prev) => ({
									...prev,
									phone: "Indian mobile only. 10 digits starting with 6, 7, 8, or 9.",
								}));
							}
						}}
						autoComplete="tel"
						placeholder="+91 98765 43210"
						className="h-11"
						aria-invalid={fieldErrors.phone ? true : undefined}
						aria-describedby={
							fieldErrors.phone ? "contact-phone-error" : "contact-phone-help"
						}
					/>
					{fieldErrors.phone ? (
						<p id="contact-phone-error" className="text-destructive text-xs">
							{fieldErrors.phone}
						</p>
					) : (
						<p id="contact-phone-help" className="text-muted-foreground text-xs">
							Indian mobile only. Country code optional.
						</p>
					)}
				</div>

				<div className="mt-5 space-y-2">
					<div className="flex items-baseline justify-between">
						<Label htmlFor="contact-message" className="font-medium">
							What can we help with?
						</Label>
						<span
							className={cn(
								"text-xs tabular-nums",
								messageTooShort
									? "text-destructive"
									: messageLength > MESSAGE_MAX * 0.9
										? "text-foreground/70"
										: "text-muted-foreground",
							)}
							aria-live="polite"
						>
							{messageLength.toLocaleString()} / {MESSAGE_MAX.toLocaleString()}
						</span>
					</div>
					<textarea
						id="contact-message"
						name="message"
						required
						rows={6}
						maxLength={MESSAGE_MAX}
						value={message}
						onChange={(e) => {
							setMessage(e.target.value);
							clearFieldError("message");
						}}
						placeholder={
							selected.value === "school"
								? "Tell us about your school, year levels, and what you are looking to evaluate."
								: selected.value === "press"
									? "Tell us about the story, your outlet, and your deadline."
									: "Tell us about the grade, board, and what your child is stuck on."
						}
						aria-invalid={fieldErrors.message ? true : undefined}
						aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
						className={cn(
							"w-full min-w-0 rounded-xl border bg-background px-3.5 py-3 text-base leading-relaxed transition-colors outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 medium:text-[15px] dark:bg-input/30",
							fieldErrors.message
								? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
								: "border-input",
						)}
					/>
					{fieldErrors.message ? (
						<p id="contact-message-error" className="text-destructive text-xs">
							{fieldErrors.message}
						</p>
					) : messageTooShort ? (
						<p className="text-muted-foreground text-xs">
							At least {MESSAGE_MIN} characters so we can help.
						</p>
					) : null}
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
					<p
						className="mt-5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
						role="alert"
					>
						{errorMessage}
					</p>
				) : null}

				<div className="mt-8 flex flex-col-reverse gap-4 medium:flex-row medium:items-center medium:justify-between">
					<p className="text-xs text-muted-foreground">
						We will only use this to reply to you. Nothing else, ever.
					</p>
					<Button
						type="submit"
						size="lg"
						disabled={status === "loading"}
						className="h-11 w-full rounded-full px-6 font-semibold medium:w-auto"
					>
						{status === "loading" ? (
							"Sending…"
						) : (
							<>
								Send message
								<ArrowRight className="h-4 w-4" aria-hidden />
							</>
						)}
					</Button>
				</div>
			</form>

			<aside aria-labelledby="contact-aside-title" className="min-w-0 xl:sticky xl:top-24">
				<div className="rounded-2xl border border-border/70 bg-card px-6 py-7 medium:px-7 medium:py-8">
					<p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
						After you hit send
					</p>
					<h3
						id="contact-aside-title"
						className="mt-2 text-balance text-lg font-semibold tracking-tight text-foreground"
					>
						Where your note actually lands.
					</h3>

					<ol className="relative mt-7 space-y-6 border-l border-border/80 pl-6">
						{[
							{
								title: "You hit Send",
								body: "Your message routes to a real 24Vertex inbox. No bot, no auto-reply.",
							},
							{
								title: "We triage within a day",
								body: "Parent notes go to the support lead. School and press go to the founder.",
							},
							{
								title: `The right person replies, ${selected.sla.toLowerCase()}`,
								body: "From a human inbox you can reply to. Faster on weekdays.",
							},
							{
								title: "We keep going until it is resolved",
								body: "No ticket closure tricks. We follow up until the question is actually answered.",
							},
						].map((step, idx) => (
							<li key={step.title} className="relative">
								<span
									className="absolute -left-[27px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-4 ring-background"
									aria-hidden
								/>
								<p className="text-sm font-medium text-foreground">
									<span className="text-muted-foreground tabular-nums mr-1.5">
										{(idx + 1).toString().padStart(2, "0")}
									</span>
									{step.title}
								</p>
								<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
									{step.body}
								</p>
							</li>
						))}
					</ol>

					{supportEmail ? (
						<div className="mt-8 border-t border-border/60 pt-5">
							<p className="text-xs text-muted-foreground">Prefer email?</p>
							<a
								href={`mailto:${supportEmail}`}
								className="mt-1.5 inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-link"
							>
								<MessageSquare className="h-4 w-4 text-primary" aria-hidden />
								<span className="underline-offset-4 hover:underline">{supportEmail}</span>
							</a>
						</div>
					) : null}
				</div>
			</aside>
		</div>
	);
}

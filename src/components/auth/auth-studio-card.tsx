import Image from "next/image";
import Link from "next/link";

import { AuthStudentReviewsRotator } from "@/components/auth/auth-student-reviews-rotator";
import { Card, CardContent } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";

// Base64 8×6 JPEG generated from auth-fractal-glass.png via sharp; Next/Image
// skips auto-blur for AVIF inputs, so we provide a manual blurDataURL.
const AUTH_FRACTAL_BLUR_DATA =
	"data:image/jpeg;base64,/9j/2wBDABcQERQRDhcUEhQaGBcbIjklIh8fIkYyNSk5UkhXVVFIUE5bZoNvW2F8Yk5QcptzfIeLkpSSWG2grJ+OqoOPko3/2wBDARgaGiIeIkMlJUONXlBejY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY3/wAARCAAGAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAbEAADAAIDAAAAAAAAAAAAAAAAAQMCBAUiQf/EABQBAQAAAAAAAAAAAAAAAAAAAAL/xAAaEQACAgMAAAAAAAAAAAAAAAAAAQIRBCFR/9oADAMBAAIRAxEAPwCDR03yEa3rklRdsWl6ABwdthydONcP/9k=";

type AuthStudioCardProps = {
	children: React.ReactNode;
	className?: string;
	/** Omit the terms row when a nested layout already shows it. */
	showLegalFooter?: boolean;
};

/**
 * shadcn login-04 style: form column + brand art column inside a single card.
 * Uses the same fractal panel asset as the previous auth split shell.
 */
export function AuthStudioCard({
	children,
	className,
	showLegalFooter = true,
}: AuthStudioCardProps) {
	return (
		<div className={cn("flex w-full flex-col gap-4", className)}>
			{/* overflow-visible so nested panels can use backdrop-filter (Card defaults to overflow-hidden). */}
			<Card className="gap-0 overflow-visible p-0 py-0 shadow-lg shadow-black/20">
				<CardContent className="grid gap-0 overflow-visible p-0 px-0 group-data-[size=sm]/card:px-0 medium:grid-cols-2">
					<div className="flex min-h-0 flex-col overflow-hidden rounded-l-xl p-6 medium:p-7 medium:p-8">
						{children}
					</div>
					<div className="relative hidden min-h-0 bg-muted medium:block medium:min-h-[min(52vh,28rem)] medium:rounded-r-xl">
						<div className="absolute inset-0 z-0 overflow-hidden medium:rounded-r-xl">
							<Image
								src="/brand/auth-fractal-glass.avif"
								alt=""
								fill
								className="object-cover"
								sizes="(min-width: 768px) 480px, 0px"
								placeholder="blur"
								blurDataURL={AUTH_FRACTAL_BLUR_DATA}
								priority={false}
							/>
							<div
								aria-hidden
								className="pointer-events-none absolute inset-0 z-[1] bg-linear-to-t from-black/25 via-transparent to-black/20"
							/>
						</div>
						<AuthStudentReviewsRotator />
					</div>
				</CardContent>
			</Card>
			{showLegalFooter ? (
				<FieldDescription className="mx-auto max-w-prose px-2 text-center text-xs leading-relaxed text-muted-foreground medium:px-6">
					By continuing, you agree to our{" "}
					<Link
						href="/legal/terms"
						className="text-foreground underline underline-offset-4 hover:text-foreground"
					>
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link
						href="/legal/privacy"
						className="text-foreground underline underline-offset-4 hover:text-foreground"
					>
						Privacy Policy
					</Link>
					.
				</FieldDescription>
			) : null}
		</div>
	);
}

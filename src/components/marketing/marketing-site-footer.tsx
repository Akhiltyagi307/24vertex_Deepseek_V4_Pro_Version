import { Footer7 } from "@/components/ui/footer-7";
import { MARKETING_FOOTER_SECTIONS } from "@/lib/marketing/marketing-nav";

/**
 * The brand mark is `.png` everywhere in marketing surfaces (header, manifest,
 * JSON-LD, mobile nav). Footer used `.avif` by default, creating a per-page
 * extension mismatch for the same asset; passing `.png` here normalizes it.
 * Next/Image still negotiates AVIF/WebP delivery via the image optimizer.
 */
const FOOTER_LOGO = {
	url: "/",
	src: "/brand/logo-icon.png",
	alt: "24Vertex logo, the green chapter mastery mark",
	title: "24Vertex",
};

export function MarketingSiteFooter() {
	return (
		<footer className="border-border/60 mt-auto w-full shrink-0 border-t bg-background px-4 medium:px-6 xl:px-8">
			<div className="mx-auto w-full max-w-7xl">
				<Footer7 sections={[...MARKETING_FOOTER_SECTIONS]} logo={FOOTER_LOGO} />
			</div>
		</footer>
	);
}

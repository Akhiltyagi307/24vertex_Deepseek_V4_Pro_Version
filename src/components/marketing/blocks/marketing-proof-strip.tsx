import Image from "next/image";

import { cn } from "@/lib/utils";

type MarketingProofStripProps = {
	src: string;
	alt: string;
	caption: string;
	width?: number;
	height?: number;
	className?: string;
};

export function MarketingProofStrip({
	src,
	alt,
	caption,
	width = 1280,
	height = 720,
	className,
}: MarketingProofStripProps) {
	return (
		<figure className={cn("space-y-3", className)}>
			<div className="border-border/60 overflow-hidden rounded-xl border bg-card shadow-sm">
				<Image
					src={src}
					alt={alt}
					width={width}
					height={height}
					className="h-auto w-full object-cover object-top"
					sizes="(min-width: 64rem) 1152px, 100vw"
				/>
			</div>
			<figcaption className="text-muted-foreground text-center text-sm medium:text-base">{caption}</figcaption>
		</figure>
	);
}

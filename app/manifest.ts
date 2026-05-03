import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "EduAI",
		short_name: "EduAI",
		description: "Adaptive assessment and practice for grades 6 to 12.",
		start_url: "/",
		display: "standalone",
		background_color: "#0a0a0a",
		theme_color: "#2ea070",
		icons: [
			{
				src: "/brand/logo-icon.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
		],
	};
}

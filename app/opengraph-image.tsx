import { ImageResponse } from "next/og";

export const alt = "EduAI — Adaptive assessment and practice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
	return new ImageResponse(
		(
			<div
				style={{
					height: "100%",
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "flex-start",
					justifyContent: "center",
					padding: "80px",
					background: "linear-gradient(135deg, #0a0a0a 0%, #122218 100%)",
					color: "#ffffff",
					fontFamily: "system-ui, -apple-system, sans-serif",
				}}
			>
				<div
					style={{
						color: "#3ECF8E",
						fontSize: 28,
						fontWeight: 600,
						letterSpacing: 2,
						textTransform: "uppercase",
						marginBottom: 24,
					}}
				>
					EduAI
				</div>
				<div
					style={{
						fontSize: 80,
						fontWeight: 700,
						lineHeight: 1.05,
						letterSpacing: -2,
						maxWidth: 900,
					}}
				>
					Practice smarter. Stay aligned.
				</div>
				<div
					style={{
						marginTop: 32,
						fontSize: 28,
						color: "rgba(255,255,255,0.72)",
						maxWidth: 880,
						lineHeight: 1.35,
					}}
				>
					Adaptive assessment, parent visibility, and class-level signals for grades 6 to 12.
				</div>
			</div>
		),
		{ ...size },
	);
}

import path from "node:path";
import sharp from "sharp";

const portals = ["student", "teacher", "parent"];
const widths = [1280, 2560];
const marketingDir = path.join(process.cwd(), "public/marketing");

for (const portal of portals) {
	const input = path.join(marketingDir, `${portal}-portal-dashboard.png`);
	const meta = await sharp(input).metadata();
	console.log(`${portal}: ${meta.width}x${meta.height}`);

	for (const width of widths) {
		const resized = sharp(input).resize(width, null, {
			kernel: sharp.kernel.lanczos3,
			withoutEnlargement: true,
		});

		await resized
			.clone()
			.webp({ quality: 95, effort: 6, smartSubsample: false })
			.toFile(path.join(marketingDir, `${portal}-portal-dashboard-${width}.webp`));

		await resized
			.clone()
			.avif({ quality: 90, effort: 6, chromaSubsampling: "4:4:4" })
			.toFile(path.join(marketingDir, `${portal}-portal-dashboard-${width}.avif`));

		console.log(`  wrote ${width}w variants`);
	}
}

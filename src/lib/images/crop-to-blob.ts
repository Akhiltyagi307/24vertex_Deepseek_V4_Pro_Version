import type { Area } from "react-easy-crop";

/** Export size — supports ~2× DPR on large (~432px) profile previews while staying under 5MB. */
const MAX_OUTPUT_INITIAL = 1024;
const MAX_BYTES = 5 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener("load", () => resolve(image));
		image.addEventListener("error", (e) => reject(e));
		image.src = src;
	});
}

function drawCroppedToCanvas(
	image: HTMLImageElement,
	pixelCrop: Area,
	maxDimension: number,
): HTMLCanvasElement {
	const scale = Math.min(maxDimension / pixelCrop.width, maxDimension / pixelCrop.height, 1);
	const outW = Math.max(1, Math.round(pixelCrop.width * scale));
	const outH = Math.max(1, Math.round(pixelCrop.height * scale));

	const canvas = document.createElement("canvas");
	canvas.width = outW;
	canvas.height = outH;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Could not get canvas context");
	}
	ctx.drawImage(
		image,
		pixelCrop.x,
		pixelCrop.y,
		pixelCrop.width,
		pixelCrop.height,
		0,
		0,
		outW,
		outH,
	);
	return canvas;
}

/**
 * Renders the cropped region to a bitmap and encodes as WebP, then JPEG if needed; shrinks dimensions until under 5MB.
 */
export async function getCroppedImageBlob(
	imageSrc: string,
	pixelCrop: Area,
): Promise<{ blob: Blob; mimeType: string }> {
	const image = await loadImage(imageSrc);
	let maxDim = MAX_OUTPUT_INITIAL;

	for (let attempt = 0; attempt < 6; attempt++) {
		const canvas = drawCroppedToCanvas(image, pixelCrop, maxDim);

		let blob: Blob | null = await new Promise((resolve) => {
			canvas.toBlob((b) => resolve(b), "image/webp", 0.88);
		});
		let mimeType = "image/webp";

		if (!blob || blob.size > MAX_BYTES) {
			blob = await new Promise((resolve) => {
				canvas.toBlob((b) => resolve(b), "image/jpeg", 0.75);
			});
			mimeType = "image/jpeg";
		}

		if (blob && blob.size <= MAX_BYTES) {
			return { blob, mimeType };
		}

		maxDim = Math.floor(maxDim * 0.75);
		if (maxDim < 96) {
			throw new Error("Could not produce an image under the size limit.");
		}
	}

	throw new Error("Could not encode image");
}

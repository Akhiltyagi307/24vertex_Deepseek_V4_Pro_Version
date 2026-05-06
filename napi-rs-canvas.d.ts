// `@napi-rs/canvas` is an OPTIONAL runtime dep used solely by the OCR fallback
// in `src/lib/doubt/attachments/extract-pdf.ts`. It's loaded via dynamic import
// inside a try/catch so the absence of the package at runtime is tolerated.
// We declare the module here so TypeScript doesn't fail on the import call.
declare module "@napi-rs/canvas" {
	export function createCanvas(width: number, height: number): unknown;
}

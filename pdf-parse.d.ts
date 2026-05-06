declare module "pdf-parse" {
	export interface PdfParseResult {
		text: string;
		numpages?: number;
		numrender?: number;
		info?: Record<string, unknown>;
		metadata?: Record<string, unknown>;
		version?: string;
	}
	const pdfParse: (data: Buffer | Uint8Array | ArrayBuffer) => Promise<PdfParseResult>;
	export default pdfParse;
}

declare module "mjml" {
	interface MjmlError {
		formattedMessage?: string;
	}

	function mjml(
		input: string,
		options?: { validationLevel?: "strict" | "soft" | "skip" },
	): { html: string; errors: MjmlError[] };

	export default mjml;
}

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function WizardSummaryCard({
	title,
	description,
	subjectName,
	topicNames,
	difficultyLabel,
	durationLabel,
}: {
	title: string;
	description: string;
	subjectName: string | null;
	topicNames: string[];
	difficultyLabel: string;
	durationLabel: string;
}) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-lg">{title}</CardTitle>
				<CardDescription className="text-base leading-relaxed">{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5 pt-0">
				<Separator />
				<dl className="space-y-5">
					<div>
						<dt className="text-muted-foreground text-sm font-medium">Subject</dt>
						<dd className="mt-1.5 text-foreground text-base leading-snug">
							{subjectName ?? "—"}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-sm font-medium">
							Topics ({topicNames.length})
						</dt>
						<dd className="mt-2">
							{topicNames.length ? (
								<ul className="text-foreground list-inside list-disc space-y-1.5 text-base leading-snug">
									{topicNames.map((name, i) => (
										<li key={`${i}-${name}`}>{name}</li>
									))}
								</ul>
							) : (
								<p className="text-muted-foreground text-base">—</p>
							)}
						</dd>
					</div>
					<div className="grid gap-5 medium:grid-cols-2">
						<div>
							<dt className="text-muted-foreground text-sm font-medium">Difficulty</dt>
							<dd className="mt-1.5 text-foreground text-base leading-snug">
								{difficultyLabel}
							</dd>
						</div>
						<div>
							<dt className="text-muted-foreground text-sm font-medium">Duration</dt>
							<dd className="mt-1.5 text-foreground text-base leading-snug">
								{durationLabel}
							</dd>
						</div>
					</div>
				</dl>
			</CardContent>
		</Card>
	);
}

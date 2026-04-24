import type { LucideIcon } from "lucide-react";
import {
	Atom,
	BookCopy,
	BookOpen,
	BookText,
	Calculator,
	CircleDollarSign,
	FlaskConical,
	Globe,
	Landmark,
	Laptop,
	Library,
	Music,
	NotebookPen,
	Palette,
	Scale,
	Sigma,
} from "lucide-react";

/** Brand green well — matches dashboard subject tiles and `--primary` / `--subject-grid-icon`. */
const SUBJECT_CARD_ICON_SHELL =
	"bg-primary/18 ring-primary/40 dark:bg-primary/[0.14] dark:ring-primary/25";
const SUBJECT_CARD_ICON_GLYPH = "text-subject-grid-icon";

export type SubjectCardIconConfig = {
	Icon: LucideIcon;
	shellClassName: string;
	iconClassName: string;
};

function brandSubjectConfig(icon: LucideIcon): SubjectCardIconConfig {
	return {
		Icon: icon,
		shellClassName: SUBJECT_CARD_ICON_SHELL,
		iconClassName: SUBJECT_CARD_ICON_GLYPH,
	};
}

/** Icon plus brand-green well + glyph; icon shape still follows the subject name. */
export function getSubjectCardIconConfig(subjectName: string): SubjectCardIconConfig {
	const n = subjectName.toLowerCase();
	if (n.includes("economics")) return brandSubjectConfig(CircleDollarSign);
	if (n.includes("political")) return brandSubjectConfig(Scale);
	if (n.includes("workbook")) return brandSubjectConfig(NotebookPen);
	if (n.includes("supplementary")) return brandSubjectConfig(BookCopy);
	if (n.includes("literature")) return brandSubjectConfig(Library);
	if (n.includes("english")) return brandSubjectConfig(BookText);
	if (n.includes("math") || n.includes("algebra") || n.includes("geometry"))
		return brandSubjectConfig(Calculator);
	if (n.includes("physics")) return brandSubjectConfig(Atom);
	if (n.includes("chem") || n.includes("biology") || n.includes("science"))
		return brandSubjectConfig(FlaskConical);
	if (n.includes("history") || n.includes("civics")) return brandSubjectConfig(Landmark);
	if (n.includes("geo")) return brandSubjectConfig(Globe);
	if (n.includes("computer") || n.includes("ict") || n.includes("coding"))
		return brandSubjectConfig(Laptop);
	if (n.includes("art") || n.includes("design")) return brandSubjectConfig(Palette);
	if (n.includes("music")) return brandSubjectConfig(Music);
	if (n.includes("stat") || n.includes("calculus")) return brandSubjectConfig(Sigma);
	return brandSubjectConfig(BookOpen);
}

/** Picks a representative Lucide icon from the subject display name (not grouped — each subject is distinct). */
export function getSubjectLucideIcon(subjectName: string): LucideIcon {
	return getSubjectCardIconConfig(subjectName).Icon;
}

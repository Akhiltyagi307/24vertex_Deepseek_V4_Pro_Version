import type { VisualExemplar } from "../exemplars-type";
import { MATHEMATICS_EXEMPLARS } from "./mathematics";
import { PHYSICS_EXEMPLARS } from "./physics";
import { BIOLOGY_EXEMPLARS } from "./biology";
import { CHEMISTRY_EXEMPLARS } from "./chemistry";
import { ACCOUNTANCY_EXEMPLARS } from "./accountancy";
import { ECONOMICS_STATISTICS_EXEMPLARS } from "./economics-statistics";
import { BUSINESS_STUDIES_EXEMPLARS } from "./business-studies";
import { GEOGRAPHY_SOCIAL_SCIENCE_EXEMPLARS } from "./geography-social-science";
import { ENGLISH_EXEMPLARS } from "./english";
import { SCIENCE_EXEMPLARS } from "./science";
import { ADDED_EXEMPLARS } from "./added";

export const ALL_EXEMPLARS: ReadonlyArray<VisualExemplar> = [
	...MATHEMATICS_EXEMPLARS,
	...PHYSICS_EXEMPLARS,
	...BIOLOGY_EXEMPLARS,
	...CHEMISTRY_EXEMPLARS,
	...ACCOUNTANCY_EXEMPLARS,
	...ECONOMICS_STATISTICS_EXEMPLARS,
	...BUSINESS_STUDIES_EXEMPLARS,
	...GEOGRAPHY_SOCIAL_SCIENCE_EXEMPLARS,
	...ENGLISH_EXEMPLARS,
	...SCIENCE_EXEMPLARS,
	...ADDED_EXEMPLARS,
];

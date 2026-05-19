import type { VisualExemplar } from "../exemplars-type";

export const CHEMISTRY_EXEMPLARS: ReadonlyArray<VisualExemplar> = [

	// ───────────────────────────────────────────────────────────────────────
	// CHEMISTRY
	// ───────────────────────────────────────────────────────────────────────
	{
		stem: "Explain why the bond angle in H₂O is approximately 104.5° and not 109.5°.",
		topicKeywords: ["vsepr", "molecular geometry", "water", "bond angle", "electron pair repulsion"],
		visual: null,
		subjects: ["chemistry"],
	},
	{
		stem: "Identify the functional group present in the molecule shown.",
		topicKeywords: ["organic chemistry", "functional group", "carboxylic acid", "spectator structure"],
		visual: {
			caption: "Ethanoic acid (acetic acid) skeletal — methyl plus carboxyl C(=O)OH.",
			altText:
				"Two-carbon backbone with a carbonyl carbon bonded to an OH group and a methyl group.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CC(=O)O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "Name the organic compound whose structure is shown and state the homologous series it belongs to.",
		topicKeywords: ["aromatic", "benzene", "homologous series", "organic nomenclature"],
		visual: {
			caption: "Skeletal structure of benzene.",
			altText:
				"Hexagonal ring of six carbons with alternating bonds; one hydrogen at each vertex implied.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "c1ccccc1",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "The structure shown is ethanol. Name the functional group present and the class of this compound.",
		topicKeywords: ["alcohol", "functional group", "ethanol", "hydroxyl"],
		visual: {
			caption: "Skeletal structure of ethanol.",
			altText:
				"Two-carbon chain; the second carbon carries an OH group.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CCO",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "Identify the compound shown and classify it as monosaccharide, disaccharide, or polysaccharide.",
		topicKeywords: ["carbohydrate", "glucose", "monosaccharide", "biomolecule"],
		visual: {
			caption: "Open-chain structure of glucose.",
			altText:
				"Six-carbon chain with an aldehyde group at carbon 1 and hydroxyl groups at carbons 2 through 6.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "OCC(O)C(O)C(O)C(O)C=O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "Name the compound whose structure is shown and identify its IUPAC suffix.",
		topicKeywords: ["aldehyde", "iupac", "organic nomenclature", "propanal"],
		visual: {
			caption: "Skeletal structure of propanal.",
			altText:
				"Three-carbon chain with a terminal aldehyde group at carbon 1.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CCC=O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "The molecule shown is carbon dioxide. How many $\\sigma$ and $\\pi$ bonds involve the central carbon?",
		topicKeywords: ["chemical bonding", "sigma bond", "pi bond", "lewis structure"],
		visual: {
			caption: "Line structure of carbon dioxide (O=C=O).",
			altText:
				"Central carbon double-bonded to two oxygen atoms; linear arrangement.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "O=C=O",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The structure shown is a primary amine. Write its IUPAC name.",
		topicKeywords: ["amine", "primary amine", "organic nomenclature", "functional group"],
		visual: {
			caption: "Skeletal structure of methylamine.",
			altText:
				"Single carbon bonded to an amino group NH2.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "CN",
				display: "2d",
				label: null,
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "The ball-and-stick model represents methane. How many hydrogen atoms are bonded to the central carbon?",
		topicKeywords: ["molecular shape", "tetrahedral", "methane", "structural model"],
		visual: {
			caption: "Methane structural model (2D depiction of tetrahedral connectivity).",
			altText:
				"Central carbon with four identical bonds arranged tetrahedrally toward hydrogen atoms; textbook methane geometry.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "C",
				display: "2d",
				label: "Methane (CH₄)",
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The skeletal structure shown includes one stereogenic centre. State whether the drawn enantiomer has R or S configuration at that carbon (assume standard CIP priorities).",
		topicKeywords: ["enantiomer", "chirality", "cip priorities", "r s configuration"],
		visual: {
			caption: "L-Alanine — 2D structure with tetrahedral stereochemistry.",
			altText:
				"Central alpha carbon bonded to an amino group, carboxyl group, methyl side chain, and hydrogen; wedge-and-dash at the stereocentre indicates one enantiomer.",
			spec: {
				kind: "chemistry_molecule",
				smiles: "N[C@H](C)C(=O)O",
				display: "2d",
				label: "Alanine",
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "Classify the reaction shown: is it synthesis, decomposition, or displacement?",
		topicKeywords: ["classification of reaction", "combination reaction", "water formation"],
		visual: {
			caption: "Formation of water from hydrogen and oxygen.",
			altText: "Chemical equation with hydrogen and oxygen as reactants and water as product.",
			spec: {
				kind: "chemistry_reaction",
				ce: "2 H2 + O2 -> 2 H2O",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The balanced equation shown represents an esterification reaction. Name the ester formed.",
		topicKeywords: ["esterification", "organic reaction", "ester", "ethyl acetate"],
		visual: {
			caption: "Esterification of acetic acid with ethanol.",
			altText:
				"Acetic acid and ethanol on the left of the reaction arrow; ethyl acetate and water on the right.",
			spec: {
				kind: "chemistry_reaction",
				ce: "CH3COOH + C2H5OH -> CH3COOC2H5 + H2O",
				label: "Esterification",
			},
		},
		subjects: ["chemistry"],
	},
	{
		stem: "The equation shown represents a neutralisation reaction. Identify the salt formed.",
		topicKeywords: ["acid base", "neutralisation", "salt", "ionic compound"],
		visual: {
			caption: "Neutralisation of hydrochloric acid with sodium hydroxide.",
			altText:
				"Hydrochloric acid and sodium hydroxide on the left; sodium chloride and water on the right of the reaction arrow.",
			spec: {
				kind: "chemistry_reaction",
				ce: "HCl + NaOH -> NaCl + H2O",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "Using the equation shown, state the type of reaction and identify the oxidising agent.",
		topicKeywords: ["combustion", "oxidation reduction", "redox", "oxygen"],
		visual: {
			caption: "Complete combustion of methane in oxygen.",
			altText:
				"Methane and oxygen on the left of the reaction arrow; carbon dioxide and water as products on the right.",
			spec: {
				kind: "chemistry_reaction",
				ce: "CH4 + 2 O2 -> CO2 + 2 H2O",
				label: "Combustion",
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The equation shown represents thermal decomposition of hydrogen peroxide. Identify the type of reaction.",
		topicKeywords: ["decomposition", "catalyst omitted", "peroxide"],
		visual: {
			caption: "Decomposition of hydrogen peroxide into water and oxygen.",
			altText:
				"Hydrogen peroxide on the left of the arrow; water and oxygen gas on the right.",
			spec: {
				kind: "chemistry_reaction",
				ce: "2 H2O2 -> 2 H2O + O2",
				label: null,
			},
		},
		subjects: ["chemistry", "science"],
	},
	{
		stem: "The reversible reaction shown reaches dynamic equilibrium in a closed vessel. What happens to the rates of the forward and backward reactions at equilibrium?",
		topicKeywords: ["chemical equilibrium", "dynamic equilibrium", "forward reaction", "haber"],
		visual: {
			caption: "Synthesis of ammonia — reversible equilibrium.",
			altText:
				"Nitrogen and hydrogen as reactants linked by a double-headed arrow to ammonia as product; balanced stoichiometric coefficients.",
			spec: {
				kind: "chemistry_reaction",
				ce: "N2 + 3 H2 <=> 2 NH3",
				label: "Haber process (equilibrium)",
			},
		},
		subjects: ["chemistry", "science"],
	},
];

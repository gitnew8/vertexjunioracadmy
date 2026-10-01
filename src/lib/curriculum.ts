// Pre-loaded curriculum: Class -> Subject -> Chapter -> Topics
// Used by Quick Templates and the Voice AI Agent so teachers never type.

export type Chapter = { name: string; topics: string[] };
export type SubjectMap = Record<string, Chapter[]>;

export const CLASSES = [
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
] as const;

const ch = (name: string, topics: string[]): Chapter => ({ name, topics });

const PRE_PRIMARY: SubjectMap = {
  Maths: [
    ch("Numbers 1-20", ["Counting", "Number recognition", "Missing numbers", "Before & after"]),
    ch("Shapes & Sizes", ["Circle, square, triangle", "Big & small", "Long & short"]),
    ch("Simple Addition", ["Add with pictures", "Add up to 10"]),
    ch("Patterns & Colours", ["Colour names", "Repeating patterns"]),
  ],
  English: [
    ch("Alphabet A-Z", ["Capital letters", "Small letters", "Beginning sounds"]),
    ch("Phonics", ["Vowel sounds", "CVC words", "Rhyming words"]),
    ch("My World Words", ["Fruits", "Animals", "Body parts", "Colours"]),
  ],
  Hindi: [
    ch("स्वर और व्यंजन", ["अ से अः", "क से ज्ञ", "मात्रा पहचान"]),
    ch("सरल शब्द", ["दो अक्षर के शब्द", "तीन अक्षर के शब्द"]),
    ch("चित्र शब्द", ["फल", "पशु-पक्षी", "रंग"]),
  ],
  GK: [
    ch("Myself & Family", ["My body", "My family", "Good habits"]),
    ch("Around Us", ["Animals & their homes", "Fruits & vegetables", "Festivals"]),
  ],
};

const PRIMARY_1_2: SubjectMap = {
  Maths: [
    ch("Numbers up to 100", ["Counting", "Place value", "Comparing numbers", "Number names"]),
    ch("Addition", ["Add without carry", "Add with carry", "Word problems"]),
    ch("Subtraction", ["Subtract without borrow", "Subtract with borrow", "Word problems"]),
    ch("Shapes & Space", ["2D shapes", "3D shapes", "Patterns"]),
    ch("Measurement", ["Length", "Weight", "Capacity"]),
    ch("Time & Money", ["Clock reading", "Days & months", "Indian coins & notes"]),
  ],
  English: [
    ch("Nouns", ["Naming words", "Singular & plural", "Proper & common nouns"]),
    ch("Verbs & Adjectives", ["Action words", "Describing words"]),
    ch("Vocabulary", ["Opposites", "Rhyming words", "One word many"]),
    ch("Sentences", ["Making sentences", "Capital letters & full stop"]),
    ch("Reading Comprehension", ["Short story", "Picture reading"]),
  ],
  Hindi: [
    ch("वर्णमाला और मात्राएँ", ["स्वर", "व्यंजन", "मात्रा वाले शब्द"]),
    ch("शब्द भंडार", ["विलोम शब्द", "वचन", "गिनती"]),
    ch("वाक्य रचना", ["सरल वाक्य", "चित्र वर्णन"]),
  ],
  EVS: [
    ch("My Family & Me", ["Family members", "My body", "Good habits"]),
    ch("Plants Around Us", ["Parts of a plant", "Types of plants", "Uses of plants"]),
    ch("Animals Around Us", ["Domestic & wild", "Homes of animals", "Food of animals"]),
    ch("Food, Water & Air", ["Healthy food", "Sources of water", "Clean air"]),
  ],
  GK: [
    ch("India & Festivals", ["National symbols", "Festivals", "Famous places"]),
    ch("Science & Nature", ["Seasons", "Birds", "Transport"]),
  ],
};

const PRIMARY_3_5: SubjectMap = {
  Maths: [
    ch("Large Numbers", ["Place value", "Comparing & ordering", "Rounding off"]),
    ch("Four Operations", ["Addition & subtraction", "Multiplication", "Division", "Word problems"]),
    ch("Factors & Multiples", ["Factors", "Multiples", "HCF & LCM basics"]),
    ch("Fractions", ["Like & unlike fractions", "Equivalent fractions", "Addition of fractions"]),
    ch("Decimals", ["Reading decimals", "Addition & subtraction", "Money as decimals"]),
    ch("Geometry", ["Lines & angles", "2D & 3D shapes", "Symmetry"]),
    ch("Measurement", ["Length, weight, capacity", "Perimeter & area", "Time & calendar"]),
    ch("Data Handling", ["Pictograph", "Bar graph", "Tally marks"]),
  ],
  English: [
    ch("Nouns & Pronouns", ["Kinds of nouns", "Gender", "Pronouns"]),
    ch("Verbs & Tenses", ["Present tense", "Past tense", "Future tense", "Helping verbs"]),
    ch("Adjectives & Adverbs", ["Degrees of comparison", "Kinds of adverbs"]),
    ch("Sentences", ["Types of sentences", "Subject & predicate", "Punctuation"]),
    ch("Vocabulary", ["Synonyms", "Antonyms", "Homophones", "Prefix & suffix"]),
    ch("Comprehension & Writing", ["Unseen passage", "Paragraph writing", "Letter writing"]),
  ],
  Hindi: [
    ch("हिंदी व्याकरण", ["संज्ञा", "सर्वनाम", "विशेषण", "क्रिया"]),
    ch("शब्द ज्ञान", ["पर्यायवाची", "विलोम", "अनेक शब्दों के लिए एक शब्द", "मुहावरे"]),
    ch("वाक्य और विराम चिह्न", ["वाक्य के भेद", "विराम चिह्न"]),
    ch("रचना", ["अपठित गद्यांश", "अनुच्छेद लेखन", "पत्र लेखन"]),
  ],
  EVS: [
    ch("Living & Non-living", ["Characteristics", "Examples"]),
    ch("Plants", ["Parts & functions", "Photosynthesis basics", "Seed germination"]),
    ch("Animals", ["Habitats", "Food habits", "Adaptation"]),
    ch("Human Body", ["Digestive system", "Skeletal system", "Sense organs"]),
    ch("Our Environment", ["Air, water, soil", "Pollution", "Natural resources"]),
    ch("Our Country", ["States & capitals", "Transport & communication", "Festivals"]),
  ],
  GK: [
    ch("India", ["National symbols", "Freedom fighters", "States & capitals"]),
    ch("World", ["Continents & oceans", "Famous monuments", "Inventions"]),
    ch("Science & Sports", ["Scientists", "Sports & players", "Current affairs"]),
  ],
  Computer: [
    ch("Computer Basics", ["Parts of computer", "Input & output devices", "Uses of computer"]),
    ch("Working with Software", ["Paint", "MS Word basics", "Keyboard & mouse"]),
  ],
};

const MIDDLE_6_8: SubjectMap = {
  Maths: [
    ch("Integers", ["Number line", "Addition & subtraction", "Multiplication & division", "Properties"]),
    ch("Fractions & Decimals", ["Operations on fractions", "Operations on decimals", "Word problems"]),
    ch("Rational Numbers", ["Representation", "Operations", "Properties"]),
    ch("Algebraic Expressions", ["Terms & coefficients", "Addition & subtraction", "Identities"]),
    ch("Linear Equations", ["Solving equations", "Word problems", "Transposition"]),
    ch("Ratio, Proportion & Percentage", ["Ratio", "Unitary method", "Profit & loss", "Simple interest"]),
    ch("Geometry", ["Lines & angles", "Triangles", "Quadrilaterals", "Circles"]),
    ch("Mensuration", ["Perimeter & area", "Surface area", "Volume"]),
    ch("Data Handling", ["Mean, median, mode", "Bar graphs", "Probability basics"]),
    ch("Exponents & Powers", ["Laws of exponents", "Standard form"]),
  ],
  Science: [
    ch("Food & Nutrition", ["Components of food", "Balanced diet", "Deficiency diseases"]),
    ch("Materials & Separation", ["Properties of materials", "Methods of separation", "Changes around us"]),
    ch("Living World", ["Plant parts", "Body movements", "Habitat & adaptation", "Cell structure"]),
    ch("Motion & Force", ["Types of motion", "Measurement of distance", "Force & pressure", "Friction"]),
    ch("Light & Sound", ["Reflection of light", "Shadows", "Production of sound", "Characteristics of sound"]),
    ch("Electricity & Magnetism", ["Electric circuit", "Conductors & insulators", "Magnets"]),
    ch("Heat & Temperature", ["Measuring temperature", "Transfer of heat", "Conductors of heat"]),
    ch("Natural Resources", ["Air & water", "Pollution", "Conservation", "Coal & petroleum"]),
    ch("Acids, Bases & Salts", ["Indicators", "Neutralisation", "Everyday uses"]),
    ch("Reproduction in Plants & Animals", ["Modes of reproduction", "Pollination", "Life cycle"]),
  ],
  English: [
    ch("Grammar: Parts of Speech", ["Nouns", "Pronouns", "Adjectives", "Verbs", "Adverbs", "Prepositions"]),
    ch("Tenses", ["Present", "Past", "Future", "Perfect forms"]),
    ch("Sentence Structure", ["Active & passive voice", "Direct & indirect speech", "Clauses"]),
    ch("Vocabulary", ["Synonyms & antonyms", "Idioms & phrases", "Word formation"]),
    ch("Reading & Writing", ["Unseen passage", "Notice & message", "Letter writing", "Story writing"]),
  ],
  Hindi: [
    ch("व्याकरण", ["संज्ञा व सर्वनाम", "विशेषण व क्रिया", "काल", "वाच्य"]),
    ch("शब्द व शब्द-भेद", ["उपसर्ग-प्रत्यय", "संधि", "समास", "पर्यायवाची-विलोम"]),
    ch("रचना", ["अपठित गद्यांश", "निबंध लेखन", "पत्र लेखन", "संवाद लेखन"]),
    ch("मुहावरे व लोकोक्तियाँ", ["प्रचलित मुहावरे", "अर्थ व प्रयोग"]),
  ],
  SST: [
    ch("History", ["Early humans", "Ancient civilisations", "Mughal empire", "Freedom struggle"]),
    ch("Geography", ["Earth & globe", "Maps", "Climate", "Resources"]),
    ch("Civics", ["Government", "Democracy", "Constitution", "Local self-government"]),
  ],
  Computer: [
    ch("Computer Fundamentals", ["Hardware & software", "Memory & storage", "Operating system"]),
    ch("Applications", ["MS Word", "MS Excel", "MS PowerPoint"]),
    ch("Internet & Safety", ["Browsing & email", "Cyber safety", "Digital etiquette"]),
  ],
};

const SECONDARY_9_10: SubjectMap = {
  Maths: [
    ch("Number Systems", ["Rational & irrational numbers", "Real numbers", "Euclid's division lemma"]),
    ch("Polynomials", ["Zeroes of polynomial", "Division algorithm", "Identities"]),
    ch("Linear Equations in Two Variables", ["Graphical method", "Substitution & elimination", "Word problems"]),
    ch("Quadratic Equations", ["Factorisation", "Quadratic formula", "Nature of roots"]),
    ch("Arithmetic Progression", ["nth term", "Sum of n terms", "Word problems"]),
    ch("Triangles & Circles", ["Similarity", "Pythagoras theorem", "Tangents to a circle"]),
    ch("Coordinate Geometry", ["Distance formula", "Section formula", "Area of triangle"]),
    ch("Trigonometry", ["Trigonometric ratios", "Identities", "Heights & distances"]),
    ch("Mensuration", ["Surface areas", "Volumes", "Areas related to circles"]),
    ch("Statistics & Probability", ["Mean, median, mode", "Ogive", "Probability"]),
  ],
  Science: [
    ch("Chemical Reactions & Equations", ["Types of reactions", "Balancing equations", "Corrosion"]),
    ch("Acids, Bases & Salts", ["pH scale", "Common salts", "Indicators"]),
    ch("Metals & Non-metals", ["Properties", "Reactivity series", "Extraction"]),
    ch("Carbon & its Compounds", ["Covalent bonding", "Homologous series", "Soaps & detergents"]),
    ch("Life Processes", ["Nutrition", "Respiration", "Transportation", "Excretion"]),
    ch("Control & Coordination", ["Nervous system", "Hormones", "Plant movements"]),
    ch("Reproduction & Heredity", ["Modes of reproduction", "Mendel's laws", "Evolution"]),
    ch("Light", ["Reflection", "Refraction", "Lenses", "Human eye"]),
    ch("Electricity & Magnetic Effects", ["Ohm's law", "Series & parallel", "Magnetic field", "Electric motor"]),
    ch("Our Environment", ["Ecosystem", "Food chain", "Management of resources"]),
  ],
  English: [
    ch("Grammar", ["Tenses", "Modals", "Subject-verb agreement", "Determiners"]),
    ch("Transformation", ["Active & passive voice", "Reported speech", "Sentence reordering"]),
    ch("Reading", ["Factual passage", "Discursive passage", "Note making"]),
    ch("Writing", ["Formal letter", "Article writing", "Analytical paragraph"]),
    ch("Literature", ["Prose", "Poetry", "Character sketch"]),
  ],
  Hindi: [
    ch("व्याकरण", ["संधि", "समास", "अलंकार", "रस", "वाच्य"]),
    ch("अपठित बोध", ["गद्यांश", "काव्यांश"]),
    ch("लेखन", ["निबंध", "पत्र", "सूचना व विज्ञापन"]),
    ch("साहित्य", ["गद्य भाग", "काव्य भाग"]),
  ],
  SST: [
    ch("History", ["Nationalism in India", "Nationalism in Europe", "Industrialisation", "Print culture"]),
    ch("Geography", ["Resources & development", "Agriculture", "Minerals & energy", "Manufacturing"]),
    ch("Civics", ["Power sharing", "Federalism", "Political parties", "Democracy outcomes"]),
    ch("Economics", ["Development", "Sectors of economy", "Money & credit", "Globalisation"]),
  ],
};

export const CURRICULUM: Record<string, SubjectMap> = {
  LKG: PRE_PRIMARY,
  UKG: PRE_PRIMARY,
  "Class 1": PRIMARY_1_2,
  "Class 2": PRIMARY_1_2,
  "Class 3": PRIMARY_3_5,
  "Class 4": PRIMARY_3_5,
  "Class 5": PRIMARY_3_5,
  "Class 6": MIDDLE_6_8,
  "Class 7": MIDDLE_6_8,
  "Class 8": MIDDLE_6_8,
  "Class 9": SECONDARY_9_10,
  "Class 10": SECONDARY_9_10,
};

export function subjectsFor(cls: string): string[] {
  return Object.keys(CURRICULUM[cls] || {});
}

export function chaptersFor(cls: string, subject: string): Chapter[] {
  return CURRICULUM[cls]?.[subject] || [];
}

export function topicsFor(cls: string, subject: string, chapter: string): string[] {
  return chaptersFor(cls, subject).find((c) => c.name === chapter)?.topics || [];
}

/** Compact catalogue text used to ground the voice agent. */
export function curriculumHint(cls?: string, subject?: string): string {
  if (!cls || !CURRICULUM[cls]) return `Available classes: ${CLASSES.join(", ")}`;
  const map = CURRICULUM[cls];
  const subs = subject && map[subject] ? { [subject]: map[subject] } : map;
  return Object.entries(subs)
    .map(([s, chs]) => `${s}: ${chs.map((c) => c.name).join(" | ")}`)
    .join("\n");
}

/** Loose matcher so spoken text like "class six", "maths", "integer" resolves. */
export function matchClass(text: string): string | null {
  const t = text.toLowerCase();
  const words: Record<string, string> = {
    one: "1", ek: "1", two: "2", do: "2", three: "3", teen: "3", four: "4", char: "4",
    five: "5", paanch: "5", panch: "5", six: "6", chhe: "6", che: "6", seven: "7", saat: "7",
    eight: "8", aath: "8", nine: "9", nau: "9", ten: "10", das: "10",
  };
  if (/\blkg\b/.test(t)) return "LKG";
  if (/\bukg\b/.test(t)) return "UKG";
  const num = t.match(/(?:class|kaksha|कक्षा)\s*([0-9]{1,2})/);
  if (num) return `Class ${Number(num[1])}`;
  for (const [w, n] of Object.entries(words)) {
    if (new RegExp(`(class|kaksha)\\s*${w}\\b`).test(t)) return `Class ${n}`;
  }
  const bare = t.match(/\b([1-9]|10)\s*(?:th|st|nd|rd)?\s*(?:class|kaksha)/);
  if (bare) return `Class ${Number(bare[1])}`;
  return null;
}

export const ENERGETIC_NAMES: Record<string, string> = {
  'Ji': 'Introverted Judgment',
  'Je': 'Extroverted Judgment',
  'Pi': 'Introverted Perception',
  'Pe': 'Extroverted Perception'
};

export const FUNCTION_NAMES: Record<string, string> = {
  'Fi': 'Introverted Feeling',
  'Te': 'Extroverted Thinking',
  'Ti': 'Introverted Thinking',
  'Fe': 'Extroverted Feeling',
  'Ne': 'Extroverted Intuition',
  'Si': 'Introverted Sensing',
  'Se': 'Extroverted Sensing',
  'Ni': 'Introverted Intuition'
};

export const FUNCTION_ORDER = ['Se', 'Si', 'Ne', 'Ni', 'Te', 'Ti', 'Fe', 'Fi'];

export const MOTIF_DEFINITIONS: Record<string, Record<string, string[]>> = {
  'Je': {
    'Philosophical': [
      'Causality: The universe is contingent on cause-effect sequences (inputs-outputs)',
      'Language Universe: The universe is fundamentally a language/code/syntax "running"',
      'Vector Ontology: Objects are their vectors/functionalities (verbs)'
    ],
    'Behavioural': [
      'Productivity and Efficiency: Businessminded, Achievement Focus, Entrepreneurship',
      'Willpower & Personal Challenge: Conscientiousness, self-control, motivation',
      'Politics & Leadership: Management positions, mentorship roles, coaching/guidance'
    ],
    'Linguistic': [
      'Syllogistic Form: Given X, then Y; If-then statements, conditional logic',
      'Authoritative Form: Speaking with a strong expectation for others to accept and follow the statement'
    ]
  },
  'Pi': {
    'Philosophical': [
      'Temporal Ontology: Objects are their entire episodic totality, not just the present',
      'Coordinates: Everything has a somewhere/someplace, positionality is central to objects',
      'Processes: Everything is "a process", there are no "timeless" absolutes, just temporary states'
    ],
    'Behavioural': [
      'Philosophical Focus: Study of classic/modern philosophy; creation of their own',
      'History & Narratives: History, novel writing, screenwriting, storytelling, playwriting',
      'Steadiness & Temperance: Caution, conservatism, long-term thinking, dependability'
    ],
    'Linguistic': [
      'Dense Information: Reference-rich, information heavy sentences',
      'Long Elaborations: Prolonged backstories, long paragraphs and buildup'
    ]
  },
  'Pe': {
    'Philosophical': [
      'Realtime Ontology: Life and reality is "now" — "presence" is our primary existence',
      'Refresh Factor: Reality needs constant renewal, freedom from the "past", the outdated and unflowing',
      'The Undiscovered: The "unknown" is real, vast, and awaiting exploration; lust for universal mystery'
    ],
    'Behavioural': [
      'Life Experiences: "Day to Day" vlogging, social media upkeep, recent adventures, passions, trips',
      'Playfulness & Humor: Banter, jokes, comedy & child-like fun, sanguine traits',
      'Beauty, Art & Creativity: Singing music, dance, instruments, artwork, aesthetics, cosmetics'
    ],
    'Linguistic': [
      'Short Phrases: With quick follow-ups',
      'Casual Language: Informal tone and style'
    ]
  },
  'Ji': {
    'Philosophical': [
      'Essentialism: Seeking fundamental essences to objects, pure, timeless, ideal forms',
      'Non-contingents: Articulating starting axioms and absolutes that are static eternals',
      'Existentialism: Preoccupation with "meaning of life" and living in an authentic manner'
    ],
    'Behavioural': [
      'Identity & Individualism: Precious sense of self identity, private values, idiosyncratic, counter-cultural',
      'Idealistic: Imagining utopian worlds, society, selves, beauty and aspiring for that in their life',
      'Pickiness & Perfection: Meticulous, obsessive crafts, quality-over-quantity, choosy, selective'
    ],
    'Linguistic': [
      "Self-Evaluating: \"I\" language that points inward to evaluate one's own subjective opinion/belief",
      'Terseness: Brief, minimalist language, stating things statically without much elaboration'
    ]
  },
  'Fe': {
    'Philosophical': [
      'Teleology: The universe is a teleological/purposeful/wilful evolution unfolding',
      'Panpsychism: The universe is made of conscious agents interacting',
      'I-Thou Ontology: Our being is co-defined by our interaction with others'
    ],
    'Behavioural': [
      'Transmutable Soul: Character is malleable and contingent on what we do/believe',
      'Mind Over Body: Mental mastery over our physical limitations and overall self',
      'Social Dynamics: Moving social dynamics, leveraging social economics via transactions'
    ],
    'Linguistic': [
      'Persuasive Cadence: Pacing, word choice and delivery meant to maximize affect',
      'Familiar Tone: Friendly, colloquial tone to invoke relatability and camaraderie'
    ]
  },
  'Te': {
    'Philosophical': [
      'Mechanics: The universe operates based on clockwork rules',
      'Objectivity: Causality is impersonal/objective/dispassionate',
      'I-It Ontology: Objects are dead tools, to be used by living beings for their own aims'
    ],
    'Behavioural': [
      'Computation: Data analysis, computer science, programming, math, statistical modelling',
      'Government Systems: The legal system, economics, finance, military operations',
      'Engineering: Bioengineering, mechanical engineering, circuits, fluid mechanics, robotics, automotive'
    ],
    'Linguistic': [
      'Blunt Delivery: Matter-of-fact language, straightforward and unadorned',
      'Avalanching Facts: Communication via an impersonal series of causal events (news anchor style)'
    ]
  },
  'Ni': {
    'Philosophical': [
      'Translocal Isomorphisms: There are eternal patterns which manifest themselves across scenarios',
      'Temporal Isomorphisms: Time is cyclical and events "repeat" in waves or spirals; geometries',
      'Synchronicity: Coinciding events are brought together via an unknown force'
    ],
    'Behavioural': [
      'Consciousness: Mind-body problem, Brain research, NDE, psychedelics, phenomenology',
      'Mysticism: Cosmic Unity, Astrology, Tarot, Karma, "Eastern" theologies',
      'Archetypes & Stereotypes: Viewing "the same" features in many datasets, generalizing'
    ],
    'Linguistic': [
      'Convergent Events: Rather than one linear chronology, past is explained as separate events converging paths',
      'Cross-Domain Synthesis: Tying different domains/layers into the present topic, as real or as metaphors'
    ]
  },
  'Si': {
    'Philosophical': [
      'Chronology: Information follows temporal sequences in linear timelines',
      'Information Locality: Informational concepts are localized and sequential without gaps',
      'Modularity: Non-adjacent concepts are not connected, thus are separate modules/topics'
    ],
    'Behavioural': [
      'Numbers, Names, Dates: Heavy use of specific literal historical information in explanations',
      'Archeology & Geology: Investigation of artefacts, sediment layers, ruins/remains, cultural objects',
      'Traditionalism: A tie to a parent spiritual culture or tradition in a very literal manner'
    ],
    'Linguistic': [
      'Backstory & Context: Thorough setup and backstory provided for a given point or topic',
      'Step by Step Elaboration: Explanations that follow a brick-by-brick narrative sequence'
    ]
  },
  'Ti': {
    'Philosophical': [
      'First Principles: All things reduce down to one/few irreducible axioms',
      'Archimedean Point: Reaching for the maximally "unbiased," distant view that exists',
      'Third-Person Self: One\'s true self is known by observing your nature "beside oneself"'
    ],
    'Behavioural': [
      'Reductionism: Eliminating incongruent beliefs or ideas, clearing out asymmetries or errors',
      'Elegant Simplicity: Seeking elegant simplicity in design/art, dance, or any topic',
      'Castle Reconstruction: "From-scratch" reconstructing of a topic\'s framing, creating a very personal structure'
    ],
    'Linguistic': [
      'Ontological Clarifying: Heavy time spent defining initial "terms" and avoiding equivocations',
      'Semantic Disclaimers: Preemptive addressing of common misunderstandings, to ensure comprehension'
    ]
  },
  'Fi': {
    'Philosophical': [
      'Animism: All things carry a unique spark of consciousness and soul',
      'Radiation: Everything radiates out an essential spiritual character or "vibe"',
      'Embodied Self: One\'s true self is known by intimacy/contact with one\'s personal body'
    ],
    'Behavioural': [
      'Attunement & Purification: Desire to become attuned to one\'s inner truth and eliminate "noise" in the way',
      'Emotional Palate: Strong Resonances/Repulsions to things, based on (dis)harmony with their essence',
      'Raw Self-Expression: Self-exposure, exhibitionism, cross-dressing, queer identities, LGBTQ+'
    ],
    'Linguistic': [
      'Self-Revealing Language: Candid details of personal life, oversharing',
      'Direct Affirmation of Self-Properties: Declaring what one is directly, without speculation'
    ]
  },
  'Se': {
    'Philosophical': [
      'Actuality: Informational realism; "it is what it is" (abstract or concrete)',
      'Presence: Reality is "now"; this present moment',
      'Amplification: "Knowing" via immersion, intensity, augmentation, penetration/"contact"'
    ],
    'Behavioural': [
      'Visceral Experiences: Intense stimuli seeking, extreme hot/cold/pain/pleasure, thrills and stunts',
      'Athletics & Competitiveness: Team sports, esports, martial arts, gaming, vitality & volition',
      'Sensuality & Aesthetics: Fashion, modelling, cosmetics/makeup, ergonomics'
    ],
    'Linguistic': [
      'Vivid Realism: Description of objects/experiences in visceral detail, highlighting the overall feeling evoked',
      'Trendy Language: On-trend slang words and references'
    ]
  },
  'Ne': {
    'Philosophical': [
      'Allocentrism: The present moment is multi-meaning and multi-angled. Relativism of viewpoints',
      'Potentiality: "What could be" is as real as what is; optimistic belief in the "unborn"',
      'Flight: True living requires leaving this "one possibility" to enter the imaginal realms'
    ],
    'Behavioural': [
      'Puns, Parodies & Wordplay: Mini-skits, imitations of characters, voice and face modulation',
      'Fantastical Exploration: "What-if" thinking, fantasy world building, make-believe, daydreaming, escapism',
      'Tinkering & Hodgepodgeing: Playing with mixing-and-matching objects or ideas into new combinations'
    ],
    'Linguistic': [
      'Indiscriminate Correlation: Large leaps of association between disparate points, farfetched ideas',
      'Tangent-Hopping: Topic-jumping, chasing side tangents, ending up far away from the starting topic'
    ]
  }
};

export type FunctionCode = 'Fi' | 'Te' | 'Ti' | 'Fe' | 'Ne' | 'Si' | 'Se' | 'Ni';
export type EnergeticCode = 'Ji' | 'Je' | 'Pe' | 'Pi';
export type Quadra = 'Alpha' | 'Beta' | 'Gamma' | 'Delta';

export function getLeadFunction(type: string): string {
  return type.substring(0, 2);
}

export function getAuxFunction(type: string): string {
  return type.substring(2, 4);
}

export function normalizeFunctionCode(func: string): string {
  if (!func) return '';
  const trimmed = func.trim();
  
  // 1. Check if it's already a code (e.g. "Se", "Se-lead", "Se-auxiliary", "Je")
  const code = trimmed.substring(0, 2);
  if (FUNCTION_NAMES[code] || ENERGETIC_NAMES[code]) return code;
  
  // 2. Check if it's a full name (e.g. "Extroverted Sensing")
  for (const [c, name] of Object.entries(FUNCTION_NAMES)) {
    if (trimmed.toLowerCase().includes(name.toLowerCase())) return c;
  }
  
  // 3. Fallback for common variations
  const lower = trimmed.toLowerCase();
  if (lower.includes('sensing')) {
    if (lower.includes('extroverted') || lower.includes('extraverted')) return 'Se';
    if (lower.includes('introverted')) return 'Si';
  }
  if (lower.includes('intuition')) {
    if (lower.includes('extroverted') || lower.includes('extraverted')) return 'Ne';
    if (lower.includes('introverted')) return 'Ni';
  }
  if (lower.includes('thinking')) {
    if (lower.includes('extroverted') || lower.includes('extraverted')) return 'Te';
    if (lower.includes('introverted')) return 'Ti';
  }
  if (lower.includes('feeling')) {
    if (lower.includes('extroverted') || lower.includes('extraverted')) return 'Fe';
    if (lower.includes('introverted')) return 'Fi';
  }

  return '';
}

export function getStructuredMotifs(values: boolean[]): FunctionMotifs[] {
  const functions = ['Je', 'Pi', 'Pe', 'Ji', 'Fe', 'Te', 'Ni', 'Si', 'Ti', 'Fi', 'Se', 'Ne'];
  const structured: FunctionMotifs[] = [];
  let currentIndex = 0;

  functions.forEach(func => {
    const defs = MOTIF_DEFINITIONS[func];
    const motifs: Motif[] = [];

    ['Philosophical', 'Behavioural', 'Linguistic'].forEach(cat => {
      const labels = defs[cat];
      labels.forEach(label => {
        motifs.push({
          category: cat as any,
          label,
          value: values[currentIndex] || false,
          index: currentIndex
        });
        currentIndex++;
      });
    });

    if (motifs.some(m => m.value)) {
      structured.push({
        function: func,
        motifs
      });
    }
  });

  return structured;
}

export function getDevelopmentName(symbol: string, leadEnergetic: string, behaviourQualia?: string): string {
  if (!leadEnergetic) {
    const genericMapping: Record<string, string> = {
      'I---': 'Standard',
      'II--': 'Full Reviser / Full Conductor',
      'I-I-': 'Double-Introverted / Double-Extroverted',
      'I--I': 'Judgement Polarized / Perception Polarized',
      'III-': 'Judgement Heavy / Perception Heavy',
      'II-I': 'Energy Inverted',
      'I-II': 'Antithetical',
      'IIII': 'Fully Conscious'
    };
    return genericMapping[symbol] || symbol;
  }

  const isJLead = leadEnergetic === 'Ji' || leadEnergetic === 'Je';
  
  // Use behaviourQualia from DB if provided, otherwise fallback to derived logic
  const isConductor = behaviourQualia 
    ? behaviourQualia.toLowerCase().includes('conductor')
    : (leadEnergetic === 'Je' || leadEnergetic === 'Pi');

  const mapping: Record<string, string> = {
    'I---': 'Standard',
    'II--': isConductor ? 'Full Conductor' : 'Full Reviser',
    'I-I-': (leadEnergetic === 'Je' || leadEnergetic === 'Pe') ? 'Double-Extroverted' : 'Double-Introverted',
    'I--I': isJLead ? 'Judgement Polarized' : 'Perception Polarized',
    'III-': isJLead ? 'Judgement Heavy' : 'Perception Heavy',
    'II-I': 'Energy Inverted',
    'I-II': 'Antithetical',
    'IIII': 'Fully Conscious'
  };

  return mapping[symbol] || symbol;
}

export function formatTypeDisplay(type: string): string {
  if (!type) return '';
  const lead = type.substring(0, 2);
  const aux = type.substring(2, 4);
  const isAuxUncertain = ['Ji', 'Je', 'Pe', 'Pi'].includes(aux);
  
  if (isAuxUncertain) {
    return `${lead}-lead`;
  }
  return type;
}

export interface Motif {
  category: 'Philosophical' | 'Behavioural' | 'Linguistic';
  label: string;
  value: boolean;
  index: number;
}

export interface FunctionMotifs {
  function: string;
  motifs: Motif[];
}

export interface DerivedCTData {
  functions: {
    lead: string;
    auxiliary: string;
    tertiary: string;
    polar: string;
  };
  energetics: {
    lead: string;
    auxiliary: string;
    tertiary: string;
    polar: string;
  };
  axes: {
    judgment: string;
    perception: string;
  };
  quadra: string;
}

export function getSubtypeName(subtype: string): string {
  const mapping: Record<string, string> = {
    'Ti+Ne': 'The Armchair Philosopher',
    'Ti+Si': 'The Scholar',
    'Si+Fe': 'The Eternal Parent',
    'Ne+Fe': 'The Social Clown',
    'Ti+Se': 'The Analytical Sensationalist',
    'Ti+Ni': 'The Alchemist',
    'Ni+Fe': 'The Guru',
    'Fe+Se': 'The Persona-Sensitive Sensationalist',
    'Fi+Se': 'The Sensual Individualist',
    'Fi+Ni': 'The Avant Garde',
    'Ni+Te': 'The Deadpan',
    'Te+Se': 'The Bulldozer',
    'Fi+Ne': 'The Fairy',
    'Fi+Si': 'The Gnome',
    'Si+Te': 'The Lawyer/Bureaucrat',
    'Te+Ne': 'The Nerd & Scientist'
  };
  return mapping[subtype] || '';
}

export function getEmotionalDescriptor(attitude: string, axis: string): string | null {
  if (!attitude) return null;
  const lowerAttitude = attitude.toLowerCase();
  const isBalanced = lowerAttitude.includes('balanced');
  
  if (isBalanced) return 'Neutral';
  if (!axis) return null;

  const isGuarded = lowerAttitude.includes('guarded') && !lowerAttitude.includes('unguarded');
  const isUnguarded = lowerAttitude.includes('unguarded');
  
  const cleanAxis = axis.trim();

  if (isBalanced) return 'Neutral';

  if (cleanAxis === 'Fe-Ti') {
    if (isGuarded) return 'Directive';
    if (isUnguarded) return 'Adaptive';
  }
  if (cleanAxis === 'Te-Fi') {
    if (isGuarded) return 'Unseelie';
    if (isUnguarded) return 'Seelie';
  }
  return null;
}

export function getAllMotifs(): { id: number; label: string; function: string }[] {
  const functions = ['Je', 'Pi', 'Pe', 'Ji', 'Fe', 'Te', 'Ni', 'Si', 'Ti', 'Fi', 'Se', 'Ne'];
  const all: { id: number; label: string; function: string }[] = [];
  let currentIndex = 0;

  functions.forEach(func => {
    const defs = MOTIF_DEFINITIONS[func];
    ['Philosophical', 'Behavioural', 'Linguistic'].forEach(cat => {
      const labels = defs[cat];
      labels.forEach(label => {
        all.push({
          id: currentIndex,
          label,
          function: func
        });
        currentIndex++;
      });
    });
  });

  return all;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

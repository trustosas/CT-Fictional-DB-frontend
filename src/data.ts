export interface Character {
  id: string;
  medium: string;
  source: string;
  year: string;
  workImageUrl: string;
  name: string;
  imageUrl: string;
  type: string;
  leadEnergetic: string;
  auxiliaryEnergetic: string;
  tertiaryEnergetic: string;
  polarEnergetic: string;
  leadFunction: string;
  auxiliaryFunction: string;
  tertiaryFunction: string;
  polarFunction: string;
  judgmentAxis: string;
  perceptionAxis: string;
  quadra: string;
  alternateType?: string;
  subtype: string;
  behaviourQualia: string;
  initialDevelopment: string;
  finalDevelopment: string;
  emotionalAttitude: string;
  analysis: string;
  notes?: string;
  isPublished: boolean;
  publishedDate?: string;
  editedDate?: string;
  motifValues?: boolean[];
}

export const CHARACTERS: Character[] = [];

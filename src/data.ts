export interface Character {
  id: string;
  medium: string;
  source: string;
  year: string;
  workImageUrl: string;
  name: string;
  imageUrl: string;
  type: string;
  leadFunction: string;
  auxiliaryFunction: string;
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

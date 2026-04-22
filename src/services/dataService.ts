import Papa from 'papaparse';
import { type Character } from '../data';

const CSV_URL = import.meta.env.VITE_DATABASE_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRhyird8EfAwfyJx4tyy7stnR10wzr8k3kyhZ1tSH9JZGmcKkD2e_Q0JmAGJrl1y15PCyghiRS1zRlT/pub?output=csv';

export async function fetchCharacters(): Promise<Character[]> {
  try {
    const response = await fetch(CSV_URL, {
      cache: 'no-store'
    });
    const csvText = await response.text();
    
    // Split into lines and skip the first 6 metadata/header rows
    const lines = csvText.split('\n');
    const dataLines = lines.slice(6).join('\n');
    
    return new Promise((resolve, reject) => {
      Papa.parse(dataLines, {
        header: false, // We'll map manually by index
        skipEmptyLines: 'greedy',
        complete: (results) => {
          const characters: Character[] = results.data.map((row: any, index: number) => {
            // Mapping based on the updated spreadsheet structure:
            // 0: Medium
            // 1: Work Title
            // 2: Year
            // 3: Work Image URL
            // 4: Name
            // 5: Subject Image URL
            // 6: Type
            // 7: Alternate Type
            // 8: Subtype (Inter-Function Dynamics)
            // 9: Lead Energetic
            // 10: Auxiliary Energetic
            // 11: Tertiary Energetic
            // 12: Polar Energetic
            // 13: Lead Function
            // 14: Auxiliary Function
            // 15: Tertiary Function
            // 16: Polar Function
            // 17: Judgment Axis
            // 18: Perception Axis
            // 19: Behaviour Qualia
            // 20: Quadra
            // 21: Emotional Attitude
            // 22: Unguardedness
            // 23: Guardedness
            // 24: Raw Quadra
            // 25: Initial Development
            // 26: Final Development
            // 27: Analysis
            // 28: Notes
            // 29: isPublished
            // 30: publishedDate
            // 31: editedDate
            // 32: isWorkArtOpaque
            // 33: Author
            // 34+: Motifs

            const name = row[4] || '';
            const type = row[6] || '';
            
            // Extract motif values starting from index 34
            const motifValues = row.slice(34).map((val: any) => {
              const sVal = String(val).trim().toUpperCase();
              return sVal === 'TRUE' || sVal === '1' || sVal === 'YES';
            });

            const isPublished = ['TRUE', '1', 'YES', 'T', 'Y'].includes(String(row[29]).trim().toUpperCase());
            const isWorkArtOpaque = ['TRUE', '1', 'YES', 'T', 'Y'].includes(String(row[32]).trim().toUpperCase());

            return {
              id: `char-${index}`,
              medium: row[0] || '',
              source: row[1] || '',
              year: row[2] || '',
              workImageUrl: row[3] || '',
              name: name.trim(),
              imageUrl: row[5] || '',
              type: type.trim(),
              leadEnergetic: row[9] || '',
              auxiliaryEnergetic: row[10] || '',
              tertiaryEnergetic: row[11] || '',
              polarEnergetic: row[12] || '',
              leadFunction: row[13] || '',
              auxiliaryFunction: row[14] || '',
              tertiaryFunction: row[15] || '',
              polarFunction: row[16] || '',
              judgmentAxis: row[17] || '',
              perceptionAxis: row[18] || '',
              behaviourQualia: row[19] || '',
              quadra: row[20] || '',
              emotionalAttitude: row[21] || '',
              unguardedness: row[22] || '',
              guardedness: row[23] || '',
              rawQuadra: row[24] || '',
              alternateType: row[7] || '',
              subtype: row[8] || '',
              initialDevelopment: row[25] || '',
              finalDevelopment: row[26] || '',
              analysis: row[27] || '',
              notes: row[28] || '',
              isPublished,
              publishedDate: row[30] || '',
              editedDate: row[31] || '',
              isWorkArtOpaque,
              motifValues: motifValues.length > 0 ? motifValues : undefined
            };
          }).filter((char: any) => char.name && (char.type || char.rawQuadra) && char.name.toLowerCase() !== 'name');

          console.log(`Successfully parsed ${characters.length} characters from spreadsheet.`);
          resolve(characters);
        },
        error: (error: any) => {
          console.error('PapaParse error:', error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

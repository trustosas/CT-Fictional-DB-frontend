import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Papa from 'papaparse';

const app = express();
const PORT = 3000;

const CSV_URL = process.env.VITE_DATABASE_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRhyird8EfAwfyJx4tyy7stnR10wzr8k3kyhZ1tSH9JZGmcKkD2e_Q0JmAGJrl1y15PCyghiRS1zRlT/pub?output=csv';

let cachedCharacters: any[] = [];
let isFetching = false;

async function fetchAndCacheCharacters() {
  if (isFetching) return;
  isFetching = true;
  try {
    console.log('Fetching characters from Google Sheets...');
    const response = await fetch(CSV_URL);
    const csvText = await response.text();
    
    // Split into lines and skip the first 6 metadata/header rows
    const lines = csvText.split('\n');
    const dataLines = lines.slice(6).join('\n');
    
    const characters = await new Promise<any[]>((resolve, reject) => {
      Papa.parse(dataLines, {
        header: false,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          const parsedCharacters = results.data.map((row: any, index: number) => {
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
              author: row[33] || '',
              motifValues: motifValues.length > 0 ? motifValues : undefined
            };
          }).filter((char: any) => 
            char.name && 
            (char.type || char.rawQuadra) && 
            char.name.toLowerCase() !== 'name' &&
            char.isPublished &&
            char.author &&
            char.author.trim() !== ''
          );

          resolve(parsedCharacters);
        },
        error: (error: any) => {
          reject(error);
        }
      });
    });

    cachedCharacters = characters;
    console.log(`Successfully cached ${cachedCharacters.length} characters.`);
    return characters;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  } finally {
    isFetching = false;
  }
}

// Global cachedCharacters reference for the app
// Initial fetch
fetchAndCacheCharacters().catch(console.error);

// API routes
app.get("/api/characters", (req, res) => {
  res.json(cachedCharacters);
});

app.post("/api/sync", async (req, res) => {
  try {
    const data = await fetchAndCacheCharacters();
    res.json({ success: true, count: data?.length || 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

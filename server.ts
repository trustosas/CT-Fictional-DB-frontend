import express from "express";
import { createServer as createViteServer } from "vite";
import Papa from "papaparse";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Cache configuration
  const CSV_URL = process.env.VITE_DATABASE_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRhyird8EfAwfyJx4tyy7stnR10wzr8k3kyhZ1tSH9JZGmcKkD2e_Q0JmAGJrl1y15PCyghiRS1zRlT/pub?output=csv';

  // API route for characters
  app.get("/api/characters", async (req, res) => {
    try {
      const response = await fetch(CSV_URL);
      if (!response.ok) throw new Error('Failed to fetch from Google');
      
      const csvText = await response.text();
      const lines = csvText.split('\n');
      const dataLines = lines.slice(6).join('\n');
      
      Papa.parse(dataLines, {
        header: false,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          const characters = results.data.map((row: any, index: number) => {
            const name = row[4] || '';
            const type = row[6] || '';
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
            char.isPublished &&
            char.author && char.author.trim() !== ''
          );
          
          res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
          res.json(characters);
        },
        error: (error: any) => {
          res.status(500).json({ error: error.message });
        }
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Vite middleware for development
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

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ISR Cache Configuration
const CACHE_FILE = path.join(process.cwd(), '.csv_cache');
const REVALIDATE_MS = 60 * 1000;
let cachedCsv: string | null = null;
let lastFetchTime = 0;
let isFetching = false;

// Initial cache load from disk
async function loadCacheFromDisk() {
  try {
    const stats = await fs.stat(CACHE_FILE);
    cachedCsv = await fs.readFile(CACHE_FILE, 'utf-8');
    lastFetchTime = stats.mtimeMs;
    console.log(`[ISR] Loaded cache from disk. Age: ${Math.round((Date.now() - lastFetchTime) / 1000)}s`);
  } catch (err) {
    console.log('[ISR] No local cache found on disk.');
  }
}

async function fetchCsv() {
  const csvUrl = process.env.VITE_DATABASE_URL || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRhyird8EfAwfyJx4tyy7stnR10wzr8k3kyhZ1tSH9JZGmcKkD2e_Q0JmAGJrl1y15PCyghiRS1zRlT/pub?output=csv';
  
  if (isFetching) return cachedCsv;
  isFetching = true;

  try {
    console.log(`[ISR] Revalidating data from: ${csvUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(csvUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const text = await response.text();
    if (!text || text.length < 100) throw new Error('Received suspiciously small or empty CSV');

    cachedCsv = text;
    lastFetchTime = Date.now();
    
    // Save to disk for persistence across restarts
    await fs.writeFile(CACHE_FILE, text, 'utf-8');
    console.log(`[ISR] Cache updated and persisted at ${new Date(lastFetchTime).toISOString()}`);
    
    return cachedCsv;
  } catch (error) {
    console.error('[ISR] Fetch failed:', error);
    if (!cachedCsv) throw error;
    return cachedCsv; // return stale on failure
  } finally {
    isFetching = false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize cache
  await loadCacheFromDisk();

  // API Route for CSV Data with ISR (Stale-While-Revalidate)
  app.get('/api/data', async (req, res) => {
    const now = Date.now();
    const isExpired = !cachedCsv || (now - lastFetchTime) > REVALIDATE_MS;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Cache-Control', `public, s-maxage=${REVALIDATE_MS / 1000}, stale-while-revalidate=3600`);

    if (isExpired) {
      if (!cachedCsv) {
        // Hard wait for first-time fetch
        try {
          const data = await fetchCsv();
          res.setHeader('X-Cache-Status', 'MISS');
          return res.send(data);
        } catch (error) {
          return res.status(503).send('Data service temporarily unavailable');
        }
      } else {
        // Background revalidation, serve stale
        fetchCsv().catch(() => {});
        res.setHeader('X-Cache-Status', 'STALE');
        return res.send(cachedCsv);
      }
    }

    res.setHeader('X-Cache-Status', 'HIT');
    res.send(cachedCsv);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
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

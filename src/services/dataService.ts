import { type Character } from '../data';

const CACHE_KEY = 'ct_characters_cache';
const CACHE_TIME_KEY = 'ct_characters_cache_time';

let cachedCharacters: Character[] | null = null;
let lastFetchTime: number = 0;
let activeFetch: Promise<Character[]> | null = null;

export async function fetchCharacters(forceRefresh = false): Promise<Character[]> {
  // If forceRefresh is requested, hit the sync endpoint first to refresh the server memory
  if (forceRefresh) {
    try {
      console.log('Requesting server sync...');
      await fetch('/api/sync', { method: 'POST' });
    } catch (e) {
      console.error('Failed to sync server cache', e);
    }
  }

  // Check memory cache first if not forcing
  if (!forceRefresh && cachedCharacters) {
    return cachedCharacters;
  }

  // Check localStorage if not forcing
  if (!forceRefresh) {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        cachedCharacters = parsed;
        return parsed;
      } catch (e) {
        console.error('Failed to parse cached data', e);
      }
    }
  }

  try {
    // When triggering a force refresh, append a timestamp to bypass Vercel's Edge Cache
    const url = forceRefresh ? `/api/characters?t=${Date.now()}` : '/api/characters';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch from server API');
    
    const characters = await response.json();
    
    cachedCharacters = characters;
    lastFetchTime = Date.now();
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(characters));
      localStorage.setItem(CACHE_TIME_KEY, lastFetchTime.toString());
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }

    return characters;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

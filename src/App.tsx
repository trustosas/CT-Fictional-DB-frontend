import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams, Routes, Route, useLocation } from 'react-router-dom';
import { Search, ArrowRight, X, Zap, Activity, Compass, Layers, ChevronLeft, ChevronDown, Info, Loader2, AlertCircle, Menu, Check, User, FileText, Hash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { formatDistanceToNow } from 'date-fns';
import { CHARACTERS as STATIC_CHARACTERS, type Character } from './data';
import { slugify, formatAnalysisForDiscord, getStructuredMotifs, getDevelopmentName, getSubtypeName, formatTypeDisplay, deriveQuadra, deriveAxesFromQuadra, normalizeFunctionCode, ENERGETIC_NAMES, FUNCTION_NAMES, FUNCTION_ORDER, getEmotionalDescriptor, getEmotionalCategory, checkEmotionalMatch, getAllMotifs, matchesFilters, type FilterState } from './lib/ct-logic';
import { fetchCharacters } from './services/dataService';

type View = 'medium' | 'work' | 'feed' | 'all-works';

const parseDatabaseDate = (dateStr: string) => {
  if (!dateStr) return null;
  
  try {
    const s = dateStr.trim();
    if (!s) return null;

    // Split Date and Time components
    let datePart = '';
    let timePart = '';
    
    if (s.includes(' ')) {
      const parts = s.split(/\s+/);
      datePart = parts[0];
      timePart = parts[1];
    } else if (s.includes('T')) {
      const parts = s.split('T');
      datePart = parts[0];
      timePart = parts[1];
    } else {
      datePart = s;
    }

    // 1. Process Date Part (M/D/YYYY or D/M/YYYY or YYYY-MM-DD)
    let y = '', m = '', d = '';
    const slashMatch = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    
    if (slashMatch) {
      const [_, p1, p2, p3] = slashMatch;
      y = p3.length === 2 ? `20${p3}` : p3;
      
      const val1 = parseInt(p1);
      const val2 = parseInt(p2);
      
      if (val1 > 12) {
        // Must be D/M/Y
        d = p1.padStart(2, '0');
        m = p2.padStart(2, '0');
      } else if (val2 > 12) {
        // Must be M/D/Y
        m = p1.padStart(2, '0');
        d = p2.padStart(2, '0');
      } else {
        // Ambiguous - default to Lagos/International preference (D/M/Y)
        d = p1.padStart(2, '0');
        m = p2.padStart(2, '0');
      }
    } else {
      const isoMatch = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (isoMatch) {
        y = isoMatch[1];
        m = isoMatch[2].padStart(2, '0');
        d = isoMatch[3].padStart(2, '0');
      } else {
        // Might be a native date string that Date() can handle directly
        const fallback = new Date(s);
        return isNaN(fallback.getTime()) ? null : fallback;
      }
    }

    // 2. Process Time Part (HH:mm:ss)
    let hh = '00', mm = '00', ss = '00';
    if (timePart) {
      const cleanTime = timePart.split(/[Z+-]/)[0];
      const tMatch = cleanTime.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (tMatch) {
        hh = tMatch[1].padStart(2, '0');
        mm = tMatch[2].padStart(2, '0');
        ss = (tMatch[3] || '00').padStart(2, '0');
      }
    }

    // 3. Process Offset (Default to Lagos UTC+1 if missing)
    let offset = '+01:00';
    const offsetMatch = s.match(/([+-]\d{2}):?(\d{2})$|Z$/);
    if (offsetMatch) {
      if (offsetMatch[0] === 'Z') {
        offset = 'Z';
      } else {
        offset = `${offsetMatch[1]}:${offsetMatch[2]}`;
      }
    }

    // Construct Strict ISO 8601 String
    const isoString = `${y}-${m}-${d}T${hh}:${mm}:${ss}${offset}`;
    const date = new Date(isoString);
    
    return isNaN(date.getTime()) ? null : date;
  } catch (e) {
    return null;
  }
};

const formatDate = (dateStr: string) => {
  const date = parseDatabaseDate(dateStr);
  if (!date) return dateStr;
  
  const hasTime = dateStr.includes(' ') || dateStr.includes('T');
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  if (hasTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
    options.hour12 = true;
  }

  return new Intl.DateTimeFormat(undefined, options).format(date);
};

const getRelativeTime = (dateStr: string) => {
  const date = parseDatabaseDate(dateStr);
  if (!date) return '';
  return `(${formatDistanceToNow(date, { addSuffix: true })})`;
};

const pluralize = (count: number, singular: string, plural?: string) => {
  if (count === 1) return singular;
  return plural || `${singular}s`;
};

function MarkdownAnalysis({ markdown }: { markdown: string }) {
  return (
    <div className="relative group">
      <div className="prose prose-sm max-w-none prose-neutral opacity-90 leading-relaxed font-serif text-lg prose-p:last:mb-0">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeRaw]}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppContent />} />
      <Route path="/all-works" element={<AppContent />} />
      <Route path="/works" element={<AppContent />} />
      <Route path="/:mediumSlug" element={<AppContent />} />
      <Route path="/:mediumSlug/:workSlug" element={<AppContent />} />
      <Route path="/:mediumSlug/:workSlug/:subjectSlug" element={<AppContent />} />
    </Routes>
  );
}

function SmartWorkImage({ src, alt, className, isOpaque }: { src: string, alt: string, className?: string, isOpaque?: boolean }) {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait' | null>(null);
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`${className} flex items-center justify-center bg-[#1a1a1a]/5 opacity-20`}>
        <FileText className="w-12 h-12" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt}
      onLoad={(e) => {
        const img = e.currentTarget;
        setOrientation(img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait');
      }}
      onError={() => setHasError(true)}
      className={`${className} ${
        isOpaque === true 
          ? (orientation === 'portrait' ? 'object-contain p-0' : 'object-cover p-0') 
          : 'object-contain p-6'
      }`}
      referrerPolicy="no-referrer"
    />
  );
}

function SmartSubjectImage({ src, alt, className }: { src: string, alt: string, className?: string }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-[#1a1a1a]/5 gap-2`}>
        <User className="w-12 h-12 opacity-10" />
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] opacity-30">Portrait Unavailable</p>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}

function PaginationControls({ 
  total, 
  current, 
  onChange, 
  itemsPerPage 
}: { 
  total: number, 
  current: number, 
  onChange: (val: number) => void,
  itemsPerPage: number
}) {
  const totalPages = Math.ceil(total / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-6 mt-12 py-8 border-t border-[#1a1a1a]/5">
      <button 
        onClick={() => {
          onChange(Math.max(1, current - 1));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        disabled={current === 1}
        className="group flex items-center gap-1 sm:gap-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] px-2.5 sm:px-5 py-2 sm:py-2.5 border border-[#1a1a1a]/20 rounded-full disabled:opacity-10 hover:bg-[#1a1a1a] hover:text-[#f5f2ed] transition-all"
      >
        <ChevronLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
        <span className="hidden xs:inline">Prev</span>
      </button>
      
      <div className="flex items-center gap-1.5 sm:gap-3 font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.1em]">
        <span className="opacity-30 hidden xs:inline">Page</span>
        <span className="font-bold">{current}</span>
        <span className="opacity-30">of</span>
        <span>{totalPages}</span>
      </div>

      <button 
        onClick={() => {
          onChange(Math.min(totalPages, current + 1));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        disabled={current === totalPages}
        className="group flex items-center gap-1 sm:gap-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] px-2.5 sm:px-5 py-2 sm:py-2.5 border border-[#1a1a1a]/20 rounded-full disabled:opacity-10 hover:bg-[#1a1a1a] hover:text-[#f5f2ed] transition-all"
      >
        <span className="hidden xs:inline">Next</span>
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mediumSlug, workSlug, subjectSlug } = useParams();
  const [characters, setCharacters] = useState<Character[]>(STATIC_CHARACTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncTrigger, setShowSyncTrigger] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 10;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [workSortOrder, setWorkSortOrder] = useState<'az' | 'year' | 'subjects' | 'published' | 'edited'>(() => {
    return (localStorage.getItem('workSortOrder') as any) || 'published';
  });
  const [subjectSortOrder, setSubjectSortOrder] = useState<'published' | 'edited'>(() => {
    return (localStorage.getItem('subjectSortOrder') as any) || 'published';
  });

  useEffect(() => {
    localStorage.setItem('workSortOrder', workSortOrder);
  }, [workSortOrder]);

  useEffect(() => {
    localStorage.setItem('subjectSortOrder', subjectSortOrder);
  }, [subjectSortOrder]);

  const [selectedQuadra, setSelectedQuadra] = useState<string | null>(() => localStorage.getItem('selectedQuadra'));
  const [selectedDevelopment, setSelectedDevelopment] = useState<string | null>(() => localStorage.getItem('selectedDevelopment'));
  const [selectedJudgmentAxis, setSelectedJudgmentAxis] = useState<string | null>(() => localStorage.getItem('selectedJudgmentAxis'));
  const [selectedPerceptionAxis, setSelectedPerceptionAxis] = useState<string | null>(() => localStorage.getItem('selectedPerceptionAxis'));
  const [selectedLeadEnergetic, setSelectedLeadEnergetic] = useState<string | null>(() => localStorage.getItem('selectedLeadEnergetic'));
  const [selectedAuxEnergetic, setSelectedAuxEnergetic] = useState<string | null>(() => localStorage.getItem('selectedAuxEnergetic'));
  const [selectedBehaviourQualia, setSelectedBehaviourQualia] = useState<string | null>(() => localStorage.getItem('selectedBehaviourQualia'));
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(() => localStorage.getItem('selectedSubtype'));
  const [selectedEmotionalAttitude, setSelectedEmotionalAttitude] = useState<string | null>(() => localStorage.getItem('selectedEmotionalAttitude'));
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null); // Legacy, will replace with authors
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>(() => {
    const saved = localStorage.getItem('selectedAuthors');
    if (saved) return JSON.parse(saved);
    // Migration: check old selectedAuthor
    const old = localStorage.getItem('selectedAuthor');
    return old ? [old] : [];
  });
  const [selectedMotifs, setSelectedMotifs] = useState<number[]>(() => {
    const saved = localStorage.getItem('selectedMotifs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (selectedQuadra) localStorage.setItem('selectedQuadra', selectedQuadra);
    else localStorage.removeItem('selectedQuadra');
  }, [selectedQuadra]);

  useEffect(() => {
    if (selectedDevelopment) localStorage.setItem('selectedDevelopment', selectedDevelopment);
    else localStorage.removeItem('selectedDevelopment');
  }, [selectedDevelopment]);

  useEffect(() => {
    if (selectedJudgmentAxis) localStorage.setItem('selectedJudgmentAxis', selectedJudgmentAxis);
    else localStorage.removeItem('selectedJudgmentAxis');
  }, [selectedJudgmentAxis]);

  useEffect(() => {
    if (selectedPerceptionAxis) localStorage.setItem('selectedPerceptionAxis', selectedPerceptionAxis);
    else localStorage.removeItem('selectedPerceptionAxis');
  }, [selectedPerceptionAxis]);

  useEffect(() => {
    if (selectedLeadEnergetic) localStorage.setItem('selectedLeadEnergetic', selectedLeadEnergetic);
    else localStorage.removeItem('selectedLeadEnergetic');
  }, [selectedLeadEnergetic]);

  useEffect(() => {
    if (selectedAuxEnergetic) localStorage.setItem('selectedAuxEnergetic', selectedAuxEnergetic);
    else localStorage.removeItem('selectedAuxEnergetic');
  }, [selectedAuxEnergetic]);

  useEffect(() => {
    if (selectedBehaviourQualia) localStorage.setItem('selectedBehaviourQualia', selectedBehaviourQualia);
    else localStorage.removeItem('selectedBehaviourQualia');
  }, [selectedBehaviourQualia]);

  useEffect(() => {
    if (selectedSubtype) localStorage.setItem('selectedSubtype', selectedSubtype);
    else localStorage.removeItem('selectedSubtype');
  }, [selectedSubtype]);

  useEffect(() => {
    if (selectedEmotionalAttitude) localStorage.setItem('selectedEmotionalAttitude', selectedEmotionalAttitude);
    else localStorage.removeItem('selectedEmotionalAttitude');
  }, [selectedEmotionalAttitude]);

  useEffect(() => {
    localStorage.setItem('selectedAuthors', JSON.stringify(selectedAuthors));
  }, [selectedAuthors]);

  useEffect(() => {
    localStorage.setItem('selectedMotifs', JSON.stringify(selectedMotifs));
  }, [selectedMotifs]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeMotifDesc, setActiveMotifDesc] = useState<string | null>(null);
  const [activeMotifId, setActiveMotifId] = useState<string | null>(null);
  const [motifAnchor, setMotifAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const [wasOnFeed, setWasOnFeed] = useState(false);
  const [accessedViaAll, setAccessedViaAll] = useState(false);
  const [analysisMarkdown, setAnalysisMarkdown] = useState<string>('');
  const [isFetchingAnalysis, setIsFetchingAnalysis] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'notFound' | 'empty' | 'available'>('idle');
  const [copyStatus, setCopyStatus] = useState<'macro' | 'mini' | 'loading' | 'image' | 'imageError' | 'work-mini' | 'work-macro' | null>(null);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [showWorkShareOptions, setShowWorkShareOptions] = useState(false);
  const shareOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const workShareOptionsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [latestCommitSha, setLatestCommitSha] = useState<string | null>(null);

  const fetchLatestCommitSha = async () => {
    const repo = import.meta.env.VITE_ANALYSES_REPO || 'trustosas/CT-in-Fiction-Analyses';
    const branches = ['main', 'master'];
    
    for (const branch of branches) {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`, {
          mode: 'cors',
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          return data.sha;
        }
      } catch (err) {
        // Silently fail
      }
    }
    return null;
  };

  const fetchAnalysisMarkdown = async (content: string, sha?: string | null) => {
    if (!content) return '';
    const trimmed = content.trim();

    // Helper to extract "owner/repo" from any GitHub URL or string
    const getRepoParts = (str: string): string => {
      if (!str) return 'trustosas/CT-in-Fiction-Analyses';
      if (str.includes('github.com')) {
        try {
          const u = new URL(str.startsWith('http') ? str : `https://${str}`);
          const segments = u.pathname.split('/').filter(Boolean);
          if (segments.length >= 2) return `${segments[0]}/${segments[1]}`;
        } catch (e) { /* ignore */ }
      }
      // If it's already "owner/repo" or just a string, return as is (but clean it)
      return str.replace('https://github.com/', '').replace('http://github.com/', '').split('/').slice(0, 2).join('/');
    };
    
    // Helper to extract relative file path from a full GitHub URL
    const getFilePath = (str: string): string => {
      if (!str.startsWith('http')) return str;
      try {
        const u = new URL(str);
        const segments = u.pathname.split('/').filter(Boolean);
        if (segments.length < 3) return '';
        
        // Skip user and repo
        const owner = segments[0];
        const repoName = segments[1];
        
        let startIdx = 2;
        if (u.hostname === 'github.com') {
          // /owner/repo/blob/branch/path...
          if (segments[2] === 'blob' || segments[2] === 'raw' || segments[2] === 'tree') {
            startIdx = 4;
          } else {
            startIdx = 3; // owner/repo/branch/path...
          }
        } else if (u.hostname === 'raw.githubusercontent.com') {
          // /owner/repo/branch/path... or /owner/repo/refs/heads/branch/path...
          if (segments[2] === 'refs' && segments[3] === 'heads') {
            startIdx = 5;
          } else {
            startIdx = 3;
          }
        }
        return segments.slice(startIdx).join('/');
      } catch (e) {
        return str;
      }
    };

    const envRepo = import.meta.env.VITE_ANALYSES_REPO;
    const repoDefault = (envRepo && envRepo.trim().length > 0) ? envRepo.trim() : 'trustosas/CT-in-Fiction-Analyses';
    
    let targetRepo = '';
    let targetFilePath = '';

    if (trimmed.startsWith('http') && trimmed.includes('github.com')) {
      targetRepo = getRepoParts(trimmed);
      targetFilePath = getFilePath(trimmed);
    } else if (trimmed.startsWith('http')) {
      // Non-GitHub URL: fetch directly
      try {
        const res = await fetch(trimmed, { cache: 'no-store' });
        return res.ok ? await res.text() : `### Fetch Error\n\nHTTP ${res.status} when loading analysis.`;
      } catch (e) {
        return `### Connection Error\n\nFailed to reach: \`${trimmed}\``;
      }
    } else {
      // Relative path
      targetRepo = getRepoParts(repoDefault);
      targetFilePath = trimmed;
    }

    // Clean and encode the path
    const cleanPath = targetFilePath
      .split('/')
      .filter(s => s)
      .map(segment => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');

    if (!cleanPath) return '### Path Error\n\nNo valid file path detected.';

    // Build refs to try in priority order
    // 1: SHA (pinned version)
    // 2: main (latest on main)
    const refs = [];
    if (sha) refs.push(sha);
    refs.push('main');
    // master as a last resort fallback
    refs.push('master');

    const candidates: string[] = [];
    refs.forEach(ref => {
      const u = `https://raw.githubusercontent.com/${targetRepo}/${ref}/${cleanPath}`;
      candidates.push(u);
      if (!u.toLowerCase().endsWith('.md')) {
        candidates.push(u + '.md');
      }
    });

    const uniqueCandidates = Array.from(new Set(candidates));

    const tryFetch = async (url: string) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.text();
    };

    for (const url of uniqueCandidates) {
      try {
        return await tryFetch(url);
      } catch (err) {
        // next
      }
    }

    return null;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [mediumSlug, workSlug, searchQuery, selectedQuadra, selectedDevelopment, selectedJudgmentAxis, selectedPerceptionAxis, selectedLeadEnergetic, selectedAuxEnergetic, selectedBehaviourQualia, selectedSubtype, selectedEmotionalAttitude, selectedMotifs]);
  const loadData = async (isSilent = false, force = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      setIsSyncing(true);
      if (subjectSlug) {
        setAnalysisMarkdown('');
        setAnalysisStatus('idle');
        setIsFetchingAnalysis(true);
      }
      
      // Fetch both characters and the latest commit SHA in parallel
      const [data, sha] = await Promise.all([
        fetchCharacters(force),
        fetchLatestCommitSha()
      ]);

      if (sha) setLatestCommitSha(sha);

      if (data && data.length > 0) {
        setCharacters(data);
        setError(null);
        if (force) setShowSyncTrigger(false);

        // If we are on a subject page, fetch the analysis too
        if (subjectSlug) {
          const char = data.find(c => slugify(c.name) === subjectSlug);
          if (char && char.analysis) {
            const markdown = await fetchAnalysisMarkdown(char.analysis, sha);
            if (markdown === null) {
              setAnalysisStatus('notFound');
            } else if (markdown.trim() === '') {
              setAnalysisStatus('empty');
              setAnalysisMarkdown('');
            } else {
              setAnalysisMarkdown(markdown);
              setAnalysisStatus('available');
            }
          } else {
            setAnalysisStatus('notFound');
          }
          setIsFetchingAnalysis(false);
          setExpandedSections(prev => new Set(prev).add('analysis'));
        }

        setRefreshTrigger(prev => prev + 1);
      } else {
        setError('Database is empty or inaccessible. Please check "Publish to Web" settings.');
      }
    } catch (err) {
      console.error('Failed to load dynamic data:', err);
      setError('Sync Failed. Ensure Spreadsheet is "Published to Web" as CSV.');
    } finally {
      if (!isSilent) setIsLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refetch data when navigating to a subject page to ensure latest analysis URL and data
  useEffect(() => {
    if (subjectSlug) {
      loadData(true); // Silent refresh
    } else {
      setAnalysisMarkdown('');
    }
  }, [subjectSlug]);

  const publishedCharacters = useMemo(() => {
    return characters.filter(c => c.isPublished && c.author);
  }, [characters]);

  const media = useMemo(() => Array.from(new Set(publishedCharacters.map(c => c.medium))).sort(), [publishedCharacters]);

  const works = useMemo(() => {
    const workMap = new Map<string, { id: string; title: string; imageUrl: string; year: string; isOpaque: boolean; medium: string }>();
    publishedCharacters.forEach(char => {
      const title = char.source?.trim() || 'Unknown';
      const year = char.year?.trim() || '';
      const medium = char.medium?.trim() || '';
      const workImageUrl = char.workImageUrl?.trim() || '';
      
      // Identity is defined by Title + Medium + Year + Image to allow distinct editions/remakes
      const key = `${title}|${medium}|${year}|${workImageUrl}`.toLowerCase();
      
      const existing = workMap.get(key);
      if (!existing) {
        workMap.set(key, { 
          id: key,
          title, 
          imageUrl: workImageUrl, 
          year,
          isOpaque: !!char.isWorkArtOpaque,
          medium
        });
      } else if (char.isWorkArtOpaque) {
        existing.isOpaque = true;
      }
    });
    return Array.from(workMap.values());
  }, [publishedCharacters]);

  const activeMedium = useMemo(() => {
    if (!mediumSlug) return null;
    return media.find(m => slugify(m) === mediumSlug) || null;
  }, [mediumSlug, media]);

  const activeWork = useMemo(() => {
    if (!workSlug) return null;
    return works.find(w => slugify(w.title) === workSlug)?.title || null;
  }, [workSlug, works]);

  const selectedCharacter = useMemo(() => {
    if (!subjectSlug) return null;
    return publishedCharacters.find(c => slugify(c.name) === subjectSlug) || null;
  }, [subjectSlug, publishedCharacters]);

  const similarByActiveMotif = useMemo(() => {
    if (!activeMotifId) return { currentWork: [], allMedia: [] };
    const motifIdx = parseInt(activeMotifId);
    
    const all = publishedCharacters.filter(c => 
      c.id !== selectedCharacter?.id && 
      c.motifValues && 
      c.motifValues[motifIdx]
    );
    
    return {
      currentWork: all.filter(c => c.source === selectedCharacter?.source),
      allMedia: all
    };
  }, [activeMotifId, publishedCharacters, selectedCharacter]);

  const currentView = useMemo(() => {
    if (location.pathname === '/all-works' || location.pathname === '/works') return 'all-works';
    if (workSlug) return 'work';
    if (mediumSlug) return 'medium';
    return 'feed';
  }, [mediumSlug, workSlug, location.pathname]);

  const navigateToWork = (work: { title: string; medium: string }) => {
    if (currentView === 'all-works') {
      setAccessedViaAll(true);
    } else if (currentView === 'feed') {
      setAccessedViaAll(false);
    }
    navigate(`/${slugify(work.medium)}/${slugify(work.title)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToMedium = (mediumName: string) => {
    if (currentView !== 'all-works' && currentView !== 'medium' && currentView !== 'work') {
      setAccessedViaAll(false);
    }
    navigate(`/${slugify(mediumName)}`);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = () => {
    setAccessedViaAll(false);
    navigate('/');
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToAllWorks = () => {
    setAccessedViaAll(false);
    navigate('/all-works');
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCharacter = (char: Character | null) => {
    if (char) {
      if (currentView === 'all-works') {
        setAccessedViaAll(true);
      } else if (currentView === 'feed') {
        setAccessedViaAll(false);
      }
      setWasOnFeed(!mediumSlug && !workSlug);
      navigate(`/${slugify(char.medium)}/${slugify(char.source)}/${slugify(char.name)}`);
    } else {
      if (wasOnFeed) {
        navigate('/');
      } else if (activeWork && activeMedium) {
        navigate(`/${slugify(activeMedium)}/${slugify(activeWork)}`);
      } else if (activeMedium) {
        navigate(`/${slugify(activeMedium)}`);
      } else {
        navigate('/');
      }
      setWasOnFeed(false);
      setAccessedViaAll(false);
    }
  };

  useEffect(() => {
    const handleEvents = (e: Event) => {
      if (!activeMotifId) return;
      
      if (e.type === 'scroll') {
        setActiveMotifId(null);
        setActiveMotifDesc(null);
        setMotifAnchor(null);
        return;
      }

      if (e.type === 'mousedown' || e.type === 'touchstart') {
        const target = e.target as HTMLElement;
        if (bubbleRef.current && !bubbleRef.current.contains(target) && !target.closest('[data-motif-id]')) {
          setActiveMotifId(null);
          setActiveMotifDesc(null);
          setMotifAnchor(null);
        }
      }
    };

    window.addEventListener('scroll', handleEvents, true);
    window.addEventListener('mousedown', handleEvents);
    window.addEventListener('touchstart', handleEvents);

    return () => {
      window.removeEventListener('scroll', handleEvents, true);
      window.removeEventListener('mousedown', handleEvents);
      window.removeEventListener('touchstart', handleEvents);
    };
  }, [activeMotifId]);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  useEffect(() => {
    setActiveMotifDesc(null);
    setActiveMotifId(null);
    setMotifAnchor(null);
    setExpandedSections(new Set());
  }, [selectedCharacter]);

  useEffect(() => {
    let title = 'CT in Fiction';
    if (selectedCharacter) {
      title = selectedCharacter.name;
    } else if (currentView === 'work' && activeWork) {
      title = activeWork;
    } else if (currentView === 'medium' && activeMedium) {
      title = activeMedium;
    }
    document.title = title;
  }, [currentView, activeWork, activeMedium, selectedCharacter]);

  // Handle #analysis hash scrolling
  useEffect(() => {
    if (location.hash === '#analysis' && !isFetchingAnalysis && selectedCharacter) {
      const el = document.getElementById('analysis');
      if (el) {
        // Use a timeout to ensure DOM is fully rendered/layout computed after expansion & markdown injection
        const timer = setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [location.hash, analysisStatus, isFetchingAnalysis, selectedCharacter?.id]);

  const handleCopyImage = async (url: string) => {
    if (!url) return;
    setCopyStatus('loading');
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('image');
    } catch (err) {
      setCopyStatus('imageError');
    }
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const viewFilteredCharacters = useMemo(() => {
    return publishedCharacters.filter(char => {
      if (currentView === 'work' && activeWork && char.source !== activeWork) return false;
      if (currentView === 'medium' && activeMedium && char.medium !== activeMedium) return false;
      return true;
    });
  }, [publishedCharacters, currentView, activeWork, activeMedium]);

  const currentFilters = useMemo(() => ({
    quadra: selectedQuadra,
    judgmentAxis: selectedJudgmentAxis,
    perceptionAxis: selectedPerceptionAxis,
    leadEnergetic: selectedLeadEnergetic,
    auxEnergetic: selectedAuxEnergetic,
    development: selectedDevelopment,
    behaviourQualia: selectedBehaviourQualia,
    subtype: selectedSubtype,
    emotionalAttitude: selectedEmotionalAttitude,
    authors: selectedAuthors,
    motifs: selectedMotifs
  }), [selectedQuadra, selectedJudgmentAxis, selectedPerceptionAxis, selectedLeadEnergetic, selectedAuxEnergetic, selectedDevelopment, selectedBehaviourQualia, selectedSubtype, selectedEmotionalAttitude, selectedAuthors, selectedMotifs]);

  const developments = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, development: null })
    );
    return Array.from(new Set(filtered.map(c => c.finalDevelopment || c.initialDevelopment))).filter(Boolean).filter(i => i.toLowerCase() !== 'all').sort();
  }, [viewFilteredCharacters, currentFilters]);
  
  const quadras = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, quadra: null })
    );
    const items = filtered.map(c => c.quadra || c.rawQuadra).filter(Boolean);
    return Array.from(new Set(items as string[])).filter(i => i.toLowerCase() !== 'all').sort();
  }, [viewFilteredCharacters, currentFilters]);

  const judgmentAxes = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, judgmentAxis: null })
    );
    const items = filtered.map(c => c.judgmentAxis || deriveAxesFromQuadra(c.rawQuadra || c.quadra).judgment).filter(Boolean);
    return Array.from(new Set(items as string[])).filter(i => i.toLowerCase() !== 'all').sort();
  }, [viewFilteredCharacters, currentFilters]);

  const energetics = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, leadEnergetic: null })
    );
    const items = filtered.map(c => c.leadEnergetic).filter(Boolean);
    return Array.from(new Set(items as string[])).filter(i => i.toLowerCase() !== 'all').sort();
  }, [viewFilteredCharacters, currentFilters]);

  const perceptionAxes = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, perceptionAxis: null })
    );
    const items = filtered.map(c => c.perceptionAxis || deriveAxesFromQuadra(c.rawQuadra || c.quadra).perception).filter(Boolean);
    return Array.from(new Set(items as string[])).filter(i => i.toLowerCase() !== 'all').sort();
  }, [viewFilteredCharacters, currentFilters]);

  const auxEnergetics = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, auxEnergetic: null })
    );
    const items = filtered.map(c => c.auxiliaryEnergetic).filter(Boolean);
    return Array.from(new Set(items as string[])).filter(i => i && i.toLowerCase() !== 'all').sort();
  }, [viewFilteredCharacters, currentFilters]);

  const behaviourQualias = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, behaviourQualia: null })
    );
    return Array.from(new Set(filtered.map(c => c.behaviourQualia))).filter(Boolean).filter(i => i.toLowerCase() !== 'all').sort();
  }, [viewFilteredCharacters, currentFilters]);

  const subtypes = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, subtype: null })
    );
    return Array.from(new Set(filtered.map(c => c.subtype))).filter(Boolean).filter(i => i.toLowerCase() !== 'all').sort();
  }, [viewFilteredCharacters, currentFilters]);

  const availableMotifs = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(char => 
      matchesFilters(char, { ...currentFilters, motifs: [] })
    );

    const all = getAllMotifs();
    const availableIds = new Set<number>();
    
    filtered.forEach(char => {
      if (char.motifValues) {
        char.motifValues.forEach((val, idx) => {
          if (val) availableIds.add(idx);
        });
      }
    });

    // Filter motifs that are present in the filtered set of characters
    return all.filter(opt => availableIds.has(opt.id));
  }, [viewFilteredCharacters, currentFilters]);

  const emotionalAttitudes = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, emotionalAttitude: null })
    );
    
    const items = new Set<string>();
    
    filtered.forEach(c => {
      const category = getEmotionalCategory(c.emotionalAttitude);
      if (category) items.add(category);
    });
    
    const order = ['Unguarded', 'Guarded', 'Neutral'];
    return Array.from(items).filter(Boolean).sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [viewFilteredCharacters, currentFilters]);

  const authors = useMemo(() => {
    const filtered = viewFilteredCharacters.filter(c => 
      matchesFilters(c, { ...currentFilters, authors: [] })
    );
    
    const items = new Set<string>();
    filtered.forEach(c => {
      if (c.author) items.add(c.author);
    });
    
    return Array.from(items).filter(Boolean).sort();
  }, [viewFilteredCharacters, currentFilters]);

  // Reset dependent filters if they become invalid
  useEffect(() => {
    if (selectedJudgmentAxis && !judgmentAxes.includes(selectedJudgmentAxis)) setSelectedJudgmentAxis(null);
    if (selectedLeadEnergetic && !energetics.includes(selectedLeadEnergetic)) setSelectedLeadEnergetic(null);
    if (selectedPerceptionAxis && !perceptionAxes.includes(selectedPerceptionAxis)) setSelectedPerceptionAxis(null);
    if (selectedAuxEnergetic && !auxEnergetics.includes(selectedAuxEnergetic)) setSelectedAuxEnergetic(null);
    if (selectedDevelopment && !developments.includes(selectedDevelopment)) setSelectedDevelopment(null);
    if (selectedBehaviourQualia && !behaviourQualias.includes(selectedBehaviourQualia)) setSelectedBehaviourQualia(null);
    if (selectedSubtype && !subtypes.includes(selectedSubtype)) setSelectedSubtype(null);
    if (selectedEmotionalAttitude && !emotionalAttitudes.includes(selectedEmotionalAttitude)) setSelectedEmotionalAttitude(null);
    
    const validAuthors = selectedAuthors.filter(a => authors.includes(a));
    if (validAuthors.length !== selectedAuthors.length) {
      setSelectedAuthors(validAuthors);
    }

    if (selectedQuadra && !quadras.includes(selectedQuadra)) setSelectedQuadra(null);

    const availableIds = availableMotifs.map(m => m.id);
    const validMotifs = selectedMotifs.filter(id => availableIds.includes(id));
    if (validMotifs.length !== selectedMotifs.length) {
      setSelectedMotifs(validMotifs);
    }
  }, [judgmentAxes, energetics, perceptionAxes, auxEnergetics, developments, behaviourQualias, subtypes, emotionalAttitudes, authors, quadras, availableMotifs, selectedMotifs]);

  const filteredCharacters = useMemo(() => {
    return publishedCharacters
      .filter(char => {
        // View filtering
        if (currentView === 'work' && activeWork && char.source !== activeWork) return false;
        if (currentView === 'medium' && activeMedium && char.medium !== activeMedium) return false;

        const matchesSearch = char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             char.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             formatTypeDisplay(char.type, char.rawQuadra).toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesSearch && matchesFilters(char, currentFilters);
      })
      .sort((a, b) => {
        const getTime = (char: any, isEditedSort: boolean) => {
          const dateStr = isEditedSort ? (char.editedDate || char.publishedDate) : char.publishedDate;
          const d = parseDatabaseDate(dateStr || '');
          return d ? d.getTime() : 0;
        };

        if (subjectSortOrder === 'edited') {
          return getTime(b, true) - getTime(a, true);
        }
        return getTime(b, false) - getTime(a, false);
      });
  }, [publishedCharacters, currentView, activeWork, activeMedium, searchQuery, currentFilters, subjectSortOrder]);

  const currentWorkData = activeWork ? works.find(w => w.title === activeWork) : null;

    const CustomSelect = ({ 
    label, 
    value, 
    options, 
    onChange, 
    placeholder 
  }: { 
    label: string, 
    value: string | null, 
    options: string[], 
    onChange: (val: string | null) => void,
    placeholder: string
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const progress = target.scrollTop / (target.scrollHeight - target.clientHeight);
      setScrollProgress(isNaN(progress) ? 0 : progress);
    };

    return (
      <div className="flex flex-col gap-1.5 group relative" ref={containerRef}>
        <label 
          onClick={() => setIsOpen(!isOpen)}
          className="font-mono text-[8px] uppercase tracking-widest opacity-70 text-[#1a1a1a] cursor-pointer"
        >
          {label}
        </label>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="w-full flex items-center justify-between bg-transparent border-b border-[#1a1a1a]/30 py-1.5 text-[10px] font-mono tracking-wider text-left transition-colors hover:border-[#1a1a1a]"
        >
          <span className={`transition-opacity ${value ? 'opacity-100 font-bold' : 'opacity-50 uppercase'}`}>
            {label === 'Development' && value ? (
              <span className="flex items-center gap-3">
                <span className="font-sans tracking-[0.2em] whitespace-nowrap">{value}</span>
                <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter font-normal">{getDevelopmentName(value, '', selectedBehaviourQualia || undefined)}</span>
              </span>
            ) : label === 'Inter-Function Dynamics' && value ? (
              <span className="flex items-center gap-3">
                <span className="font-serif italic text-sm whitespace-nowrap">{value}</span>
                <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter font-normal">{getSubtypeName(value)}</span>
              </span>
            ) : (label === 'Lead Energetic' || label === 'Auxiliary Energetic') && value ? (
              <span className="flex items-center gap-3">
                <span className="font-serif italic text-sm whitespace-nowrap">{value}</span>
                <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter font-normal">{ENERGETIC_NAMES[value]}</span>
              </span>
            ) : (label === 'Lead Function' || label === 'Auxiliary Function') && value ? (
              <span className="flex items-center gap-3">
                <span className="font-serif italic text-sm whitespace-nowrap">{value}</span>
                <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter font-normal">{FUNCTION_NAMES[value]}</span>
              </span>
            ) : label === 'Emotional Attitude' && value ? (
              <span className="flex items-center gap-3">
                <span className="font-serif italic text-sm whitespace-nowrap">{value}</span>
              </span>
            ) : (value || placeholder)}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-300 pointer-events-none ${isOpen ? 'rotate-180' : 'opacity-50 group-hover:opacity-100'}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute top-full left-0 right-0 mt-2 bg-[#f5f2ed] border border-[#1a1a1a]/20 shadow-2xl z-[100] overflow-hidden"
            >
              <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="max-h-[160px] overflow-y-auto minimal-scrollbar"
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); onChange(null); setIsOpen(false); }}
                  className="w-full px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-left hover:bg-[#1a1a1a]/5 transition-colors flex items-center justify-between border-b border-[#1a1a1a]/5"
                >
                  {placeholder}
                  {value === null && <Check className="w-3 h-3" />}
                </button>
                {options.map(opt => (
                  <button 
                    key={opt}
                    onClick={(e) => { e.stopPropagation(); onChange(opt); setIsOpen(false); }}
                    className="w-full px-4 py-3 text-[10px] font-mono tracking-wider text-left hover:bg-[#1a1a1a]/5 transition-colors flex items-center justify-between border-b border-[#1a1a1a]/5 last:border-0"
                  >
                    <div className="flex flex-col gap-0.5">
                        {label === 'Development' ? (
                          <>
                            <span className="font-sans text-sm font-bold tracking-[0.2em] whitespace-nowrap">{opt}</span>
                            <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">{getDevelopmentName(opt, '', selectedBehaviourQualia || undefined)}</span>
                          </>
                        ) : label === 'Inter-Function Dynamics' ? (
                          <>
                            <span className="font-serif italic text-sm whitespace-nowrap">{opt}</span>
                            <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter leading-tight">{getSubtypeName(opt)}</span>
                          </>
                        ) : (label === 'Lead Energetic' || label === 'Auxiliary Energetic') ? (
                          <>
                            <span className="font-serif italic text-sm whitespace-nowrap">{opt}</span>
                            <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter leading-tight">{ENERGETIC_NAMES[opt]}</span>
                          </>
                        ) : (label === 'Lead Function' || label === 'Auxiliary Function') ? (
                          <>
                            <span className="font-serif italic text-sm whitespace-nowrap">{opt}</span>
                            <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter leading-tight">{FUNCTION_NAMES[opt]}</span>
                          </>
                        ) : opt}
                    </div>
                    {value === opt && <Check className="w-3 h-3 flex-shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
              {/* Progress Indicator */}
              <div className="h-[1px] w-full bg-[#1a1a1a]/5">
                <motion.div 
                  className="h-full bg-[#1a1a1a]/40"
                  style={{ width: `${scrollProgress * 100}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const MultiSelect = ({ 
    label, 
    values, 
    options, 
    onChange, 
    placeholder 
  }: { 
    label: string, 
    values: number[], 
    options: { id: number; label: string; function: string }[], 
    onChange: (val: number[]) => void,
    placeholder: string
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => 
      opt.label.toLowerCase().includes(search.toLowerCase()) || 
      opt.function.toLowerCase().includes(search.toLowerCase())
    );

    const toggleOption = (id: number) => {
      if (values.includes(id)) {
        onChange(values.filter(v => v !== id));
      } else {
        onChange([...values, id]);
      }
    };

    return (
      <div className="flex flex-col gap-1.5 group relative" ref={containerRef}>
        <label className="font-mono text-[8px] uppercase tracking-widest opacity-70 text-[#1a1a1a]">
          {label}
        </label>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-transparent border-b border-[#1a1a1a]/30 py-1.5 text-[10px] font-mono tracking-wider text-left transition-colors hover:border-[#1a1a1a]"
        >
          <span className={`transition-opacity ${values.length > 0 ? 'opacity-100 font-bold' : 'opacity-50 uppercase'}`}>
            {values.length > 0 ? `${values.length} Selected` : placeholder}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-300 pointer-events-none ${isOpen ? 'rotate-180' : 'opacity-50 group-hover:opacity-100'}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-[#f5f2ed] border border-[#1a1a1a]/20 shadow-2xl z-[100] overflow-hidden flex flex-col"
            >
              <div className="p-2 border-b border-[#1a1a1a]/10">
                <input 
                  type="text"
                  placeholder="Search motifs..."
                  className="w-full bg-[#1a1a1a]/5 px-3 py-2 text-[10px] font-mono focus:outline-none rounded"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto minimal-scrollbar">
                {filteredOptions.map(opt => (
                  <button 
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className="w-full px-4 py-2 text-[10px] font-mono tracking-wider text-left hover:bg-[#1a1a1a]/5 transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="bg-[#1a1a1a]/10 px-1 py-0.5 rounded text-[8px]">{opt.function}</span>
                      <span className="truncate max-w-[140px]">{opt.label.split(':')[0]}</span>
                    </span>
                    {values.includes(opt.id) && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
              {values.length > 0 && (
                <button 
                  onClick={() => onChange([])}
                  className="p-2 text-[8px] font-mono uppercase tracking-widest text-center border-t border-[#1a1a1a]/10 hover:bg-[#1a1a1a]/5"
                >
                  Clear Selection
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const AuthorMultiSelect = ({ 
    label, 
    values, 
    options, 
    onChange, 
    placeholder 
  }: { 
    label: string, 
    values: string[], 
    options: string[], 
    onChange: (val: string[]) => void,
    placeholder: string
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt => 
      opt.toLowerCase().includes(search.toLowerCase())
    );

    const toggleOption = (val: string) => {
      if (values.includes(val)) {
        onChange(values.filter(v => v !== val));
      } else {
        onChange([...values, val]);
      }
    };

    return (
      <div className="flex flex-col gap-1.5 group relative" ref={containerRef}>
        <label 
          onClick={() => setIsOpen(!isOpen)}
          className="font-mono text-[8px] uppercase tracking-widest opacity-70 text-[#1a1a1a] cursor-pointer"
        >
          {label}
        </label>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className={`flex items-center justify-between w-full border-b border-[#1a1a1a]/30 py-1.5 px-0 text-left transition-all hover:border-[#1a1a1a] ${isOpen ? 'border-[#1a1a1a]' : ''}`}
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <span className={`font-mono text-[10px] uppercase tracking-wider truncate ${values.length > 0 ? 'text-[#1a1a1a] font-bold' : 'opacity-50'}`}>
              {values.length > 0 ? `${values.length} Selected` : placeholder}
            </span>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="flex-shrink-0 ml-2"
          >
            <ChevronDown className={`w-3 h-3 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-20 group-hover:opacity-100'}`} />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#1a1a1a]/10 shadow-2xl rounded-lg z-[100] overflow-hidden"
            >
              <div className="p-2 border-b border-[#1a1a1a]/5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-20" />
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Search..."
                    className="w-full bg-[#1a1a1a]/5 rounded-md py-2 pl-8 pr-3 font-mono text-[10px] focus:outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto editorial-scrollbar p-1">
                {filteredOptions.length === 0 && (
                  <div className="px-3 py-6 text-center opacity-30 font-mono text-[9px] uppercase tracking-widest">
                    No results
                  </div>
                )}
                {filteredOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 rounded-md transition-all text-left group/opt ${values.includes(opt) ? 'bg-[#1a1a1a] text-white' : 'hover:bg-[#1a1a1a]/5'}`}
                  >
                    <span className={`font-mono text-[10px] uppercase tracking-wider truncate flex-1 ${values.includes(opt) ? 'opacity-100' : 'opacity-60 group-hover/opt:opacity-100'}`}>
                      {opt}
                    </span>
                    {values.includes(opt) && <Check className="w-3 h-3 flex-shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
              {values.length > 0 && (
                <div className="p-2 border-t border-[#1a1a1a]/5 bg-[#f5f2ed]/30">
                  <button 
                    onClick={() => onChange([])}
                    className="w-full py-1.5 font-mono text-[8px] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity"
                  >
                    Clear Selected ({values.length})
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const worksInMedium = useMemo(() => {
    let list = currentView === 'all-works' ? works : works.filter(w => {
      if (!activeMedium) return false;
      const char = publishedCharacters.find(c => c.source === w.title);
      return char?.medium === activeMedium;
    });

    if (searchQuery && !(currentFilters.quadra || currentFilters.judgmentAxis || currentFilters.perceptionAxis || currentFilters.leadEnergetic || currentFilters.auxEnergetic || currentFilters.development || currentFilters.behaviourQualia || currentFilters.subtype || currentFilters.emotionalAttitude || currentFilters.motifs.length > 0)) {
      const query = searchQuery.toLowerCase();
      list = list.filter(w => {
        const char = publishedCharacters.find(c => c.source === w.title);
        return (
          w.title.toLowerCase().includes(query) || 
          w.year.toLowerCase().includes(query) ||
          (char?.medium.toLowerCase().includes(query))
        );
      });
    }

    // Apply Sorting
    const sorted = [...list].sort((a, b) => {
      const getWorkTime = (workTitle: string, isEditedSort: boolean) => {
        const workChars = publishedCharacters.filter(c => c.source === workTitle);
        if (workChars.length === 0) return 0;
        
        return Math.max(...workChars.map(c => {
          const dateStr = isEditedSort ? (c.editedDate || c.publishedDate) : c.publishedDate;
          const d = parseDatabaseDate(dateStr || '');
          return d ? d.getTime() : 0;
        }));
      };

      if (workSortOrder === 'published') {
        return getWorkTime(b.title, false) - getWorkTime(a.title, false);
      }
      if (workSortOrder === 'edited') {
        return getWorkTime(b.title, true) - getWorkTime(a.title, true);
      }
      if (workSortOrder === 'year') return b.year.localeCompare(a.year);
      if (workSortOrder === 'subjects') {
        const countA = publishedCharacters.filter(c => c.source === a.title).length;
        const countB = publishedCharacters.filter(c => c.source === b.title).length;
        return countB - countA;
      }
      return a.title.localeCompare(b.title); // Default to A-Z
    });

    return sorted;
  }, [publishedCharacters, activeMedium, works, currentView, searchQuery, currentFilters, workSortOrder]);

  const isNotFound = useMemo(() => {
    if (isLoading) return false;
    if (currentView === 'all-works') return false;
    if (mediumSlug && !activeMedium) return true;
    if (workSlug && !activeWork) return true;
    if (subjectSlug && !selectedCharacter) return true;
    return false;
  }, [isLoading, mediumSlug, activeMedium, workSlug, activeWork, subjectSlug, selectedCharacter, currentView]);

  const hasActiveFilters = useMemo(() => {
    if (currentView === 'all-works') {
       // In the Works (All Media) collection, archetype filters trigger the subject list
       return selectedQuadra || selectedDevelopment || selectedJudgmentAxis || selectedPerceptionAxis || selectedLeadEnergetic || selectedAuxEnergetic || selectedBehaviourQualia || selectedSubtype || selectedEmotionalAttitude || selectedAuthors.length > 0 || selectedMotifs.length > 0;
    }
    if (currentView === 'medium') {
       // Media pages (Individual mediums) are NOT affected by archetype filters
       return false;
    }
    return searchQuery || selectedQuadra || selectedDevelopment || selectedJudgmentAxis || selectedPerceptionAxis || selectedLeadEnergetic || selectedAuxEnergetic || selectedBehaviourQualia || selectedSubtype || selectedEmotionalAttitude || selectedAuthors.length > 0 || selectedMotifs.length > 0;
  }, [searchQuery, selectedQuadra, selectedDevelopment, selectedJudgmentAxis, selectedPerceptionAxis, selectedLeadEnergetic, selectedAuxEnergetic, selectedBehaviourQualia, selectedSubtype, selectedEmotionalAttitude, selectedAuthors, selectedMotifs, currentView]);

  const paginatedCharacters = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCharacters.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCharacters, currentPage, ITEMS_PER_PAGE]);

  const paginatedWorks = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return worksInMedium.slice(start, start + ITEMS_PER_PAGE);
  }, [worksInMedium, currentPage, ITEMS_PER_PAGE]);

  if (isLoading && (mediumSlug || workSlug || subjectSlug)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f2ed]">
        <Loader2 className="w-12 h-12 animate-spin mb-4 opacity-20" />
        <span className="font-mono text-xs uppercase tracking-widest opacity-40">Retrieving...</span>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f2ed] p-6 text-center">
        <h1 className="font-serif text-6xl mb-4">404</h1>
        <p className="font-mono text-xs uppercase tracking-widest opacity-50 mb-8">Subject or Source Not Found in Database</p>
        <button 
          onClick={navigateToHome}
          className="px-8 py-3 bg-[#1a1a1a] text-white font-mono text-xs uppercase tracking-widest rounded-full hover:bg-black transition-colors"
        >
          Return to Gallery
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 md:py-12 md:px-12 lg:px-24 max-w-[2000px] mx-auto overflow-x-hidden">
      {/* Hamburger Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-[#f5f2ed]/95 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-full md:w-[260px] bg-[#1a1a1a] text-white z-[70] p-6 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] opacity-40">Navigation</span>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-6 flex-1 overflow-y-auto no-scrollbar">
                <button 
                  onClick={navigateToHome}
                  className="block font-serif text-2xl hover:italic transition-all text-left w-full"
                >
                  Gallery
                </button>
                
                <div className="pt-6 border-t border-white/10">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] opacity-40 mb-4 block">{pluralize(media.length, 'Medium', 'Media')}</span>
                  <div className="space-y-2">
                    <button 
                      onClick={navigateToAllWorks}
                      className={`block font-serif text-lg hover:italic transition-all text-left w-full ${currentView === 'all-works' ? 'opacity-100 italic' : 'font-extralight opacity-50'} hover:opacity-100 py-0.5`}
                    >
                      All
                    </button>
                    {media.map(m => (
                      <button 
                        key={m}
                        onClick={() => navigateToMedium(m)}
                        className={`block font-serif text-lg hover:italic transition-all text-left w-full truncate ${activeMedium === m ? 'opacity-100 italic' : 'opacity-60'} hover:opacity-100 py-0.5`}
                        title={m}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </nav>

              <div className="pt-6 mt-auto border-t border-white/5 font-mono text-[8px] uppercase tracking-widest opacity-20">
                CT in Fiction v2.0
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Navigation / Breadcrumbs */}
      <nav className="flex items-center justify-between mb-12 border-b border-[#1a1a1a]/5 pb-6">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 -ml-2 hover:bg-[#1a1a1a]/5 rounded-full transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {currentView === 'feed' && (
            <button 
              onClick={navigateToHome}
              className="font-mono text-[10px] uppercase tracking-widest opacity-100 font-bold"
            >
              Gallery
            </button>
          )}

          {(currentView === 'all-works' || (accessedViaAll && (activeMedium || activeWork))) && (
            <>
              <button 
                onClick={navigateToAllWorks}
                className={`font-mono text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'all-works' ? 'opacity-100 font-medium' : 'opacity-30 hover:opacity-80 font-extralight'}`}
              >
                All
              </button>
            </>
          )}

          {activeMedium && (
            <>
              {(currentView === 'all-works' || accessedViaAll) && <span className="opacity-20 translate-y-[-1px]">/</span>}
              <button 
                onClick={() => navigateToMedium(activeMedium)}
                className={`font-mono text-[10px] uppercase tracking-widest transition-all truncate max-w-[150px] sm:max-w-[300px] ${currentView === 'medium' ? 'opacity-100 font-bold' : 'opacity-40 hover:opacity-100'}`}
                title={activeMedium}
              >
                {activeMedium}
              </button>
            </>
          )}
          {activeWork && (
            <>
              <span className="opacity-20 translate-y-[-1px]">/</span>
              <button 
                className="font-mono text-[10px] uppercase tracking-widest opacity-100 font-bold truncate max-w-[150px] xs:max-w-[200px] sm:max-w-[400px]"
                title={activeWork}
              >
                {activeWork}
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Header */}
      <header className="mb-8 border-b border-[#1a1a1a]/10 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl min-w-0">
            <div className="flex flex-col mb-4">
              <AnimatePresence>
                {showSyncTrigger && currentView === 'feed' && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    onClick={() => loadData(false, true)}
                    className="font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-all cursor-pointer mb-1 text-left"
                  >
                    Sync
                  </motion.button>
                )}
              </AnimatePresence>
              <div className="flex items-center gap-3">
                <span 
                  className={`font-mono text-xs uppercase tracking-widest transition-all ${currentView === 'feed' ? 'cursor-pointer hover:opacity-80' : 'opacity-50'}`}
                  onClick={() => currentView === 'feed' && setShowSyncTrigger(!showSyncTrigger)}
                >
                  {currentView === 'feed' ? 'Gallery' : 
                  currentView === 'all-works' ? 'All Media Collection' :
                  currentView === 'medium' ? `Medium Collection` :
                  currentView === 'work' ? 'Work Profile' : 'CT in Fiction v2.0'}
                </span>
                <AnimatePresence>
                  {isSyncing && !error && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1a1a1a]/5 text-[#1a1a1a] rounded-full border border-[#1a1a1a]/10"
                    >
                      <Loader2 className="w-2.5 h-2.5 animate-spin opacity-40" />
                      <span className="font-mono text-[8px] uppercase tracking-tighter opacity-60">Syncing...</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {error && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/5 text-red-500 rounded-full">
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span className="font-mono text-[8px] uppercase tracking-tighter">{error}</span>
                  </div>
                )}
              </div>
            </div>
            
            {currentView === 'feed' ? (
              <>
                <h1 className="font-serif text-4xl xs:text-5xl md:text-7xl leading-none tracking-tight mb-3">
                  Fictional <br />
                  <span className="italic">Archetypes</span>
                </h1>
                <p className="text-base opacity-70 leading-relaxed text-balance">
                  A specialized database exploring the Cognitive Types of fictional subjects.
                </p>
              </>
            ) : currentView === 'all-works' ? (
              <>
                <h1 className="font-serif text-4xl xs:text-5xl md:text-7xl leading-none tracking-tight mb-3">
                  All Media
                </h1>
                <p className="text-base opacity-70 leading-relaxed">
                  Exploring all {works.length} indexed {pluralize(works.length, 'work')} across all media types.
                </p>
              </>
            ) : currentView === 'medium' ? (
              <>
                <h1 className="font-serif text-4xl xs:text-5xl md:text-7xl leading-[1.1] tracking-tight mb-3 uppercase">
                  {activeMedium}
                </h1>
                <p className="text-base opacity-70 leading-relaxed">
                  {hasActiveFilters 
                    ? `Found ${filteredCharacters.length} ${pluralize(filteredCharacters.length, 'subject')} matching your criteria in ${activeMedium}.`
                    : `Exploring ${worksInMedium.length} ${pluralize(worksInMedium.length, 'work')} within the ${activeMedium} medium.`
                  }
                </p>
              </>
            ) : (
              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                {currentWorkData && (
                  <div 
                    onClick={() => currentWorkData.imageUrl && handleCopyImage(currentWorkData.imageUrl)}
                    className="w-48 aspect-video bg-[#1a1a1a]/5 rounded-sm overflow-hidden flex items-center justify-center cursor-pointer relative group/work-img active:scale-[0.98] transition-transform"
                    title="Click to copy image link"
                  >
                    <SmartWorkImage 
                      src={currentWorkData.imageUrl} 
                      alt={currentWorkData.title}
                      className="w-full h-full group-hover/work-img:scale-105 transition-transform"
                      isOpaque={currentWorkData.isOpaque}
                    />
                    <AnimatePresence>
                      {copyStatus === 'image' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
                        >
                          <span className="font-mono text-[8px] uppercase tracking-widest text-[#1a1a1a]">Link Copied</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <div>
                  <h1 
                    onClick={() => {
                      if (showWorkShareOptions) {
                        setShowWorkShareOptions(false);
                        if (workShareOptionsTimeoutRef.current) clearTimeout(workShareOptionsTimeoutRef.current);
                      } else {
                        setShowWorkShareOptions(true);
                        if (workShareOptionsTimeoutRef.current) clearTimeout(workShareOptionsTimeoutRef.current);
                        workShareOptionsTimeoutRef.current = setTimeout(() => setShowWorkShareOptions(false), 1500);
                      }
                    }}
                    onMouseEnter={() => {
                      setShowWorkShareOptions(true);
                      if (workShareOptionsTimeoutRef.current) clearTimeout(workShareOptionsTimeoutRef.current);
                    }}
                    onMouseLeave={() => {
                      workShareOptionsTimeoutRef.current = setTimeout(() => setShowWorkShareOptions(false), 1500);
                    }}
                    className="font-serif text-4xl xs:text-5xl md:text-7xl leading-[1.1] tracking-tight mb-2 select-none relative cursor-pointer"
                  >
                    {activeWork}
                    <AnimatePresence mode="wait">
                      {copyStatus && (copyStatus === 'work-mini' || copyStatus === 'work-macro') ? (
                        <motion.span
                          key={copyStatus}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute -top-6 left-0 font-mono text-[9px] uppercase tracking-widest text-[#1a1a1a]/40 pointer-events-none"
                        >
                          {copyStatus === 'work-macro' ? 'Full Work Catalog Copied' : 'Work Summary Copied'}
                        </motion.span>
                      ) : showWorkShareOptions && (
                        <motion.div
                          key="work-share-options"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          onMouseEnter={() => {
                            if (workShareOptionsTimeoutRef.current) clearTimeout(workShareOptionsTimeoutRef.current);
                          }}
                          onMouseLeave={() => {
                            workShareOptionsTimeoutRef.current = setTimeout(() => setShowWorkShareOptions(false), 1500);
                          }}
                          className="absolute -top-6 left-0 flex items-center gap-4 py-1"
                        >
                          <button 
                            onClick={() => {
                              const currentPageUrl = window.location.href.split('#')[0];
                              const baseOriginUrl = window.location.origin;
                              
                              const limit = 15;
                              const firstChars = filteredCharacters.slice(0, limit);
                              const remainingCount = filteredCharacters.length - limit;

                              const charList = firstChars.map(c => `${c.name} **${formatTypeDisplay(c.type, c.rawQuadra)}**`).join(' • ');
                              const suffix = remainingCount > 0 ? ` ...and ${remainingCount} more` : '';

                              const shareText = `# [${activeWork}](${currentPageUrl})\n${charList}${suffix}\n-# Shared from [CT in Fiction](${baseOriginUrl})`;
                              
                              navigator.clipboard.writeText(shareText).then(() => {
                                setCopyStatus('work-mini');
                                setShowWorkShareOptions(false);
                                setTimeout(() => setCopyStatus(null), 2000);
                              });
                            }}
                            className="font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-all cursor-pointer"
                          >
                            Mini
                          </button>
                          <button 
                            onClick={() => {
                              const currentPageUrl = window.location.href.split('#')[0];
                              const baseOriginUrl = window.location.origin;

                              const charList = filteredCharacters.map(c => `${c.name} **${formatTypeDisplay(c.type, c.rawQuadra)}**`).join(' • ');

                              const shareText = `# [${activeWork}](${currentPageUrl})\n${charList}\n-# Shared from [CT in Fiction](${baseOriginUrl})`;
                              
                              navigator.clipboard.writeText(shareText).then(() => {
                                setCopyStatus('work-macro');
                                setShowWorkShareOptions(false);
                                setTimeout(() => setCopyStatus(null), 2000);
                              });
                            }}
                            className="font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-all cursor-pointer"
                          >
                            Macro
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </h1>
                  <p className="font-mono text-xs uppercase tracking-widest opacity-50">
                    Release Year: {currentWorkData?.year} • {filteredCharacters.length} Indexed {pluralize(filteredCharacters.length, 'Subject')}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {currentView === 'all-works' || currentView === 'medium' ? (
            <div className="flex flex-col gap-4 w-full">
              <div className="relative w-full max-w-2xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                <input 
                  type="text"
                  placeholder="Search works..."
                  className="bg-transparent border-b border-[#1a1a1a]/20 py-3 pl-10 pr-4 focus:outline-none focus:border-[#1a1a1a] transition-colors w-full text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9px] uppercase tracking-widest opacity-30 whitespace-nowrap">Sort By</span>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'A-Z', value: 'az' },
                    { label: 'Year', value: 'year' },
                    { label: 'Scale', value: 'subjects' },
                    { label: 'Last Published', value: 'published' },
                    { label: 'Last Edited', value: 'edited' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setWorkSortOrder(opt.value as any)}
                      className={`px-4 py-2 rounded-full border font-mono text-[9px] uppercase tracking-widest transition-all ${
                        workSortOrder === opt.value 
                          ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' 
                          : 'border-[#1a1a1a]/10 hover:border-[#1a1a1a]/30 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (currentView === 'feed' || currentView === 'work') && (
            <div className="flex flex-col gap-4 w-full lg:w-auto">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                  <input 
                    type="text"
                    placeholder="Search subjects..."
                    className="bg-transparent border-b border-[#1a1a1a]/20 py-2 pl-10 pr-4 focus:outline-none focus:border-[#1a1a1a] transition-colors w-full sm:w-64 md:w-80"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-full border transition-all font-mono text-[10px] uppercase tracking-widest flex-shrink-0 ${
                    showFilters ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-[#1a1a1a]/20 hover:border-[#1a1a1a]'
                  }`}
                  title={showFilters ? 'Hide Filters' : 'Show Filters'}
                >
                  <Compass className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                  <span className="hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                </button>
              </div>

              {/* Sort Bar for Subjects */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9px] uppercase tracking-widest opacity-30 whitespace-nowrap">Sort By</span>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'Last Published', value: 'published' },
                    { label: 'Last Edited', value: 'edited' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSubjectSortOrder(opt.value as any)}
                      className={`px-4 py-2 rounded-full border font-mono text-[9px] uppercase tracking-widest transition-all ${
                        subjectSortOrder === opt.value 
                          ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' 
                          : 'border-[#1a1a1a]/10 hover:border-[#1a1a1a]/30 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <AnimatePresence>
                {showFilters && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="z-50"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-x-4 gap-y-6 pt-4">
                      <CustomSelect 
                        label="Quadra"
                        value={selectedQuadra}
                        options={quadras}
                        onChange={setSelectedQuadra}
                        placeholder="All"
                      />
                      <CustomSelect 
                        label="Qualia"
                        value={selectedBehaviourQualia}
                        options={behaviourQualias}
                        onChange={setSelectedBehaviourQualia}
                        placeholder="All"
                      />
                      <CustomSelect 
                        label="Lead Energetic"
                        value={selectedLeadEnergetic}
                        options={energetics}
                        onChange={setSelectedLeadEnergetic}
                        placeholder="All"
                      />
                      <CustomSelect 
                        label="Auxiliary Energetic"
                        value={selectedAuxEnergetic}
                        options={auxEnergetics}
                        onChange={setSelectedAuxEnergetic}
                        placeholder="All"
                      />
                      <CustomSelect 
                        label="Judgement Axis"
                        value={selectedJudgmentAxis}
                        options={judgmentAxes}
                        onChange={setSelectedJudgmentAxis}
                        placeholder="All"
                      />
                      <CustomSelect 
                        label="Perception Axis"
                        value={selectedPerceptionAxis}
                        options={perceptionAxes}
                        onChange={setSelectedPerceptionAxis}
                        placeholder="All"
                      />
                      <CustomSelect 
                        label="Development"
                        value={selectedDevelopment}
                        options={developments}
                        onChange={setSelectedDevelopment}
                        placeholder="All"
                      />
                      <CustomSelect 
                        label="Inter-Function Dynamics"
                        value={selectedSubtype}
                        options={subtypes}
                        onChange={setSelectedSubtype}
                        placeholder="All"
                      />
                      <CustomSelect 
                        label="Emotional Attitude"
                        value={selectedEmotionalAttitude}
                        options={emotionalAttitudes}
                        onChange={setSelectedEmotionalAttitude}
                        placeholder="All"
                      />
                      <AuthorMultiSelect 
                        label="Authors"
                        values={selectedAuthors}
                        options={authors}
                        onChange={setSelectedAuthors}
                        placeholder="All"
                      />
                      <MultiSelect 
                        label="Motifs"
                        values={selectedMotifs}
                        options={availableMotifs}
                        onChange={setSelectedMotifs}
                        placeholder="All"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {(selectedQuadra || selectedDevelopment || selectedJudgmentAxis || selectedPerceptionAxis || selectedLeadEnergetic || selectedAuxEnergetic || selectedBehaviourQualia || selectedSubtype || selectedEmotionalAttitude || selectedMotifs.length > 0) && (
                <div className="pt-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedQuadra(null);
                      setSelectedDevelopment(null);
                      setSelectedJudgmentAxis(null);
                      setSelectedPerceptionAxis(null);
                      setSelectedLeadEnergetic(null);
                      setSelectedAuxEnergetic(null);
                      setSelectedBehaviourQualia(null);
                      setSelectedSubtype(null);
                      setSelectedEmotionalAttitude(null);
                      setSelectedAuthors([]);
                      setSelectedMotifs([]);
                    }}
                    className="w-fit font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-1.5 transition-opacity"
                  >
                    <X className="w-3 h-3" /> Clear All Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Grid */}
      <main className="editorial-grid">
        <AnimatePresence mode="popLayout">
          {(currentView === 'all-works' || currentView === 'medium') && !hasActiveFilters && paginatedWorks.map((work) => (
            <motion.div
              key={work.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="character-card group cursor-pointer"
              onClick={() => navigateToWork(work)}
            >
              <div className="character-image-container aspect-[4/3] mb-4 bg-[#1a1a1a]/5 overflow-hidden flex items-center justify-center">
                <SmartWorkImage 
                  src={work.imageUrl} 
                  alt={work.title}
                  className="w-full h-full group-hover:scale-105 transition-transform"
                  isOpaque={work.isOpaque}
                />
              </div>
              <div className="flex justify-between items-end gap-4">
                <div className="min-w-0">
                  <span className="font-mono text-[7px] uppercase tracking-widest opacity-30 mb-1 block">
                    {publishedCharacters.find(c => c.source === work.title)?.medium}
                  </span>
                  <h3 className="font-serif text-3xl mb-1 group-hover:italic transition-all truncate leading-tight">{work.title}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-40 truncate">
                    {work.year} • {publishedCharacters.filter(c => (c.source?.trim() || 'Unknown') === work.title && (c.workImageUrl?.trim() || '') === work.imageUrl).length} {pluralize(publishedCharacters.filter(c => (c.source?.trim() || 'Unknown') === work.title && (c.workImageUrl?.trim() || '') === work.imageUrl).length, 'Subject')}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </motion.div>
          ))}

          {(currentView === 'feed' || currentView === 'work' || ((currentView === 'medium' || currentView === 'all-works') && hasActiveFilters)) && filteredCharacters.length === 0 && !isLoading ? (
            <div className="col-span-full py-32 text-center">
              <div className="max-w-md mx-auto">
                <AlertCircle className="w-12 h-12 mx-auto mb-6 opacity-20" />
                <h2 className="font-serif text-3xl mb-4">
                  {publishedCharacters.length === 0 ? 'Database Empty' : 'No Matches'}
                </h2>
                <p className="text-sm opacity-50 leading-relaxed">
                  {publishedCharacters.length === 0 
                    ? 'No subjects have been recorded in the database yet.'
                    : 'Try adjusting your search or filters to see more results.'}
                </p>
              </div>
            </div>
          ) : (currentView === 'feed' || currentView === 'work' || ((currentView === 'medium' || currentView === 'all-works') && hasActiveFilters)) && paginatedCharacters.map((char) => {
            return (
              <motion.div
                layout
                key={char.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="character-card group cursor-pointer"
                data-quadra={(char.quadra || char.rawQuadra || '').toLowerCase()}
                onClick={() => handleSelectCharacter(char)}
              >
                <div className="character-image-container aspect-[16/9] flex items-center justify-center bg-[#1a1a1a]/5 overflow-hidden">
                  <SmartSubjectImage 
                    src={char.imageUrl || ''} 
                    alt={char.name}
                    className="character-image object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="flex justify-between items-start mb-2 gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-serif text-2xl group-hover:italic transition-all truncate leading-tight mb-1" title={char.name}>{char.name}</h3>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToWork({ title: char.source, medium: char.medium });
                      }}
                      className="font-mono text-[11px] uppercase tracking-widest opacity-50 hover:opacity-100 hover:underline transition-all flex items-center gap-1.5 w-full min-w-0"
                      title={`${char.source} (${char.year})`}
                    >
                      <span className="truncate">{char.source}</span>
                      <span className="flex-shrink-0">({char.year})</span>
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="font-mono text-xs bg-[#1a1a1a]/5 px-2 py-1 rounded mb-1">{formatTypeDisplay(char.type, char.rawQuadra)}</span>
                    <span className={`font-sans text-sm font-bold tracking-[0.2em] whitespace-nowrap ${!char.finalDevelopment ? 'opacity-40' : ''}`}>
                      {char.finalDevelopment || char.initialDevelopment}
                    </span>
                    <span className="font-mono text-[10px] opacity-40 tracking-tighter">
                      {(() => {
                        const effectiveJAxis = char.judgmentAxis || deriveAxesFromQuadra(char.rawQuadra || char.quadra).judgment;
                        const descriptor = char.emotionalAttitude ? (getEmotionalDescriptor(char.emotionalAttitude, effectiveJAxis) || char.emotionalAttitude) : '';
                        return [
                          char.subtype?.trim(), 
                          descriptor
                        ].filter(s => s && s.length > 0).join(' • ');
                      })()}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </main>

      {/* Pagination */}
      {(currentView === 'medium' || currentView === 'all-works') && !hasActiveFilters && (
        <PaginationControls 
          total={worksInMedium.length} 
          current={currentPage} 
          onChange={setCurrentPage} 
          itemsPerPage={ITEMS_PER_PAGE} 
        />
      )}
      {(currentView === 'feed' || currentView === 'work' || ((currentView === 'medium' || currentView === 'all-works') && hasActiveFilters)) && (
        <PaginationControls 
          total={filteredCharacters.length} 
          current={currentPage} 
          onChange={setCurrentPage} 
          itemsPerPage={ITEMS_PER_PAGE} 
        />
      )}

      {/* Modal / Detail View */}
      <AnimatePresence>
        {selectedCharacter && (() => {
          const derivedAxes = deriveAxesFromQuadra(selectedCharacter.rawQuadra || selectedCharacter.quadra);
          const ct = {
            functions: {
              lead: selectedCharacter.leadFunction,
              auxiliary: selectedCharacter.auxiliaryFunction,
              tertiary: selectedCharacter.tertiaryFunction,
              polar: selectedCharacter.polarFunction
            },
            energetics: {
              lead: selectedCharacter.leadEnergetic,
              auxiliary: selectedCharacter.auxiliaryEnergetic,
              tertiary: selectedCharacter.tertiaryEnergetic,
              polar: selectedCharacter.polarEnergetic
            },
            axes: {
              judgment: selectedCharacter.judgmentAxis || derivedAxes.judgment,
              perception: selectedCharacter.perceptionAxis || derivedAxes.perception
            },
            quadra: deriveQuadra(selectedCharacter.judgmentAxis, selectedCharacter.perceptionAxis) || selectedCharacter.rawQuadra || selectedCharacter.quadra
          };
          return (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => handleSelectCharacter(null)}
                className="fixed inset-0 bg-[#f5f2ed]/90 backdrop-blur-sm z-40"
              />
              <motion.div 
                layoutId={selectedCharacter.id}
                className="fixed inset-y-0 right-0 w-full md:w-[750px] bg-[#f5f2ed] z-50 shadow-2xl p-8 md:p-16 overflow-y-auto"
                data-quadra={(selectedCharacter.quadra || selectedCharacter.rawQuadra || '').toLowerCase()}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                <div className="flex justify-between items-center mb-8">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] opacity-40 block">
                    Subject Profile
                  </span>
                  <button 
                    onClick={() => handleSelectCharacter(null)}
                    className="p-2 -mr-2 hover:bg-black/5 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="mb-12 relative group/subject">
                  <h2 
                    onClick={() => {
                      if (showShareOptions) {
                        setShowShareOptions(false);
                        if (shareOptionsTimeoutRef.current) clearTimeout(shareOptionsTimeoutRef.current);
                      } else {
                        setShowShareOptions(true);
                        if (shareOptionsTimeoutRef.current) clearTimeout(shareOptionsTimeoutRef.current);
                        shareOptionsTimeoutRef.current = setTimeout(() => setShowShareOptions(false), 1500);
                      }
                    }}
                    onMouseEnter={() => {
                      setShowShareOptions(true);
                      if (shareOptionsTimeoutRef.current) clearTimeout(shareOptionsTimeoutRef.current);
                    }}
                    onMouseLeave={() => {
                      shareOptionsTimeoutRef.current = setTimeout(() => setShowShareOptions(false), 1500);
                    }}
                    className="font-serif text-4xl xs:text-5xl md:text-7xl leading-tight mb-4 break-words select-none relative cursor-pointer"
                  >
                    {selectedCharacter.name}
                    <AnimatePresence mode="wait">
                      {copyStatus ? (
                        <motion.span
                          key={copyStatus}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="absolute -top-6 left-0 font-mono text-[9px] uppercase tracking-widest text-[#1a1a1a]/40 pointer-events-none"
                        >
                          {copyStatus === 'macro' ? 'Full Profile Copied' : 
                           copyStatus === 'mini' ? 'Mini Summary Copied' :
                           copyStatus === 'loading' ? 'Loading analysis...' : ''}
                        </motion.span>
                      ) : showShareOptions && (
                        <motion.div
                          key="share-options"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          onMouseEnter={() => {
                            if (shareOptionsTimeoutRef.current) clearTimeout(shareOptionsTimeoutRef.current);
                          }}
                          onMouseLeave={() => {
                            shareOptionsTimeoutRef.current = setTimeout(() => setShowShareOptions(false), 1500);
                          }}
                          className="absolute -top-6 left-0 flex items-center gap-4 py-1"
                        >
                          <button 
                            onClick={() => {
                              const currentPageUrl = window.location.href.split('#')[0];
                              const baseOriginUrl = window.location.origin;

                              const shareText = [
                                `# [${selectedCharacter.name}](${currentPageUrl})`,
                                `## ${formatTypeDisplay(selectedCharacter.type, selectedCharacter.rawQuadra)} | ${selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment}`,
                                `> **Source:** ${selectedCharacter.source} (${selectedCharacter.year})`,
                                selectedCharacter.subtype && `> **Inter-Function Dynamics:** ${selectedCharacter.subtype} (${getSubtypeName(selectedCharacter.subtype)})`,
                                selectedCharacter.behaviourQualia && `> **Qualia:** ${selectedCharacter.behaviourQualia}`,
                                `> **Development:** ${selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment} (${getDevelopmentName(selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment, selectedCharacter.leadEnergetic, selectedCharacter.behaviourQualia || undefined)})`,
                                selectedCharacter.emotionalAttitude && `> **Emotional Attitude:** ${selectedCharacter.emotionalAttitude} (${getEmotionalDescriptor(selectedCharacter.emotionalAttitude, ct.axes.judgment) || getEmotionalCategory(selectedCharacter.emotionalAttitude)})`,
                                selectedCharacter.unguardedness && `> **Unguardedness:** ${selectedCharacter.unguardedness}`,
                                selectedCharacter.guardedness && `> **Guardedness:** ${selectedCharacter.guardedness}`,
                                selectedCharacter.alternateType && `> **Alternate Type:** ${formatTypeDisplay(selectedCharacter.alternateType, selectedCharacter.rawQuadra)}`,
                                selectedCharacter.author && `> **Author:** ${selectedCharacter.author}`,
                                analysisStatus === 'available' && `[Analysis](${currentPageUrl}#analysis)`,
                                `-# Shared from [CT in Fiction](${baseOriginUrl})`
                              ].filter(item => typeof item === 'string').join('\n').replace(/\n\s*\n/g, '\n');
                              
                              navigator.clipboard.writeText(shareText).then(() => {
                                setCopyStatus('mini');
                                setShowShareOptions(false);
                                setTimeout(() => setCopyStatus(null), 2000);
                              });
                            }}
                            className="font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-all cursor-pointer"
                          >
                            Mini
                          </button>
                          <button 
                            onClick={() => {
                              if (isFetchingAnalysis) {
                                setCopyStatus('loading');
                                setTimeout(() => setCopyStatus(null), 2000);
                                return;
                              }

                              const motifsList = selectedCharacter.motifValues 
                                ? getStructuredMotifs(selectedCharacter.motifValues)
                                    .flatMap(group => 
                                      group.motifs
                                        .filter(m => m.value)
                                        .map(m => `**${group.function}** *${m.label.split(':')[0].trim()}*`)
                                    ).join(', ')
                                : null;

                               const currentPageUrl = window.location.href.split('#')[0];
                              const baseOriginUrl = window.location.origin;

                              const shareText = [
                                `# [${selectedCharacter.name}](${currentPageUrl})`,
                                `## ${formatTypeDisplay(selectedCharacter.type, selectedCharacter.rawQuadra)} | ${selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment}`,
                                `> **Source:** ${selectedCharacter.source} (${selectedCharacter.year})`,
                                selectedCharacter.subtype && `> **Inter-Function Dynamics:** ${selectedCharacter.subtype} (${getSubtypeName(selectedCharacter.subtype)})`,
                                selectedCharacter.behaviourQualia && `> **Qualia:** ${selectedCharacter.behaviourQualia}`,
                                `> **Development:** ${selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment} (${getDevelopmentName(selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment, selectedCharacter.leadEnergetic, selectedCharacter.behaviourQualia || undefined)})`,
                                selectedCharacter.emotionalAttitude && `> **Emotional Attitude:** ${selectedCharacter.emotionalAttitude} (${getEmotionalDescriptor(selectedCharacter.emotionalAttitude, ct.axes.judgment) || getEmotionalCategory(selectedCharacter.emotionalAttitude)})`,
                                selectedCharacter.unguardedness && `> **Unguardedness:** ${selectedCharacter.unguardedness}`,
                                selectedCharacter.guardedness && `> **Guardedness:** ${selectedCharacter.guardedness}`,
                                selectedCharacter.alternateType && `> **Alternate Type:** ${formatTypeDisplay(selectedCharacter.alternateType, selectedCharacter.rawQuadra)}`,
                                selectedCharacter.author && `> **Author:** ${selectedCharacter.author}`,
                                "### Energetics",
                                `**Lead:** ${ct.energetics.lead} • **Auxiliary:** ${ct.energetics.auxiliary} • **Tertiary:** ${ct.energetics.tertiary} • **Polar:** ${ct.energetics.polar}`,
                                "### Function Hierarchy",
                                `**Lead:** ${ct.functions.lead} • **Auxiliary:** ${ct.functions.auxiliary} • **Tertiary:** ${ct.functions.tertiary} • **Polar:** ${ct.functions.polar}`,
                                "### Axes & Quadra",
                                `- **Judgment:** ${ct.axes.judgment}`,
                                `- **Perception:** ${ct.axes.perception}`,
                                `- **Quadra:** ${ct.quadra}`,
                                motifsList && "### Observed Motif Profile",
                                motifsList && motifsList,
                                "### Analysis",
                                analysisStatus === 'available' ? formatAnalysisForDiscord(analysisMarkdown) : "_Analysis pending or missing._",
                                selectedCharacter.notes && "### Analyst Notes",
                                selectedCharacter.notes && selectedCharacter.notes.split('\n').map(line => `> ${line}`).join('\n'),
                                `-# Shared from [CT in Fiction](${baseOriginUrl})`
                              ].filter(item => typeof item === 'string').join('\n').replace(/\n\s*\n/g, '\n');
                              
                              navigator.clipboard.writeText(shareText).then(() => {
                                setCopyStatus('macro');
                                setShowShareOptions(false);
                                setTimeout(() => setCopyStatus(null), 2000);
                              });
                            }}
                            className="font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-all cursor-pointer"
                          >
                            Macro
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </h2>
                  <div className="flex gap-4 items-center w-full min-w-0">
                    <button 
                      onClick={() => navigateToWork({ title: selectedCharacter.source, medium: selectedCharacter.medium })}
                      className="font-serif italic text-xl opacity-60 hover:opacity-100 hover:underline transition-all text-left flex items-center gap-2 min-w-0 shrink flex-shrink"
                      title={`${selectedCharacter.source} (${selectedCharacter.year})`}
                    >
                      <span className="truncate">{selectedCharacter.source}</span>
                      <span className="flex-shrink-0">({selectedCharacter.year})</span>
                    </button>
                    <div className="h-px flex-1 bg-[#1a1a1a]/10" />
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="font-mono text-sm font-bold mb-0.5">{formatTypeDisplay(selectedCharacter.type, selectedCharacter.rawQuadra)}</span>
                      <span className={`font-sans text-lg font-bold tracking-[0.2em] leading-none whitespace-nowrap ${!selectedCharacter.finalDevelopment ? 'opacity-40' : ''}`}>
                        {selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment}
                      </span>
                    </div>
                  </div>
                </div>

                <div 
                  onClick={() => selectedCharacter.imageUrl && handleCopyImage(selectedCharacter.imageUrl)}
                  className="aspect-[16/9] rounded-sm overflow-hidden mb-12 relative group bg-[#1a1a1a]/5 flex items-center justify-center cursor-pointer active:scale-[0.99] transition-transform select-none"
                >
                  <SmartSubjectImage 
                    src={selectedCharacter.imageUrl || ''} 
                    alt={selectedCharacter.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  
                  {selectedCharacter.imageUrl && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                        <p className="text-white font-mono text-[10px] uppercase tracking-widest">
                          {copyStatus === 'image' ? 'Link Copied' : 
                           copyStatus === 'loading' ? 'Copying...' : 
                           copyStatus === 'imageError' ? 'Failed to Copy' : 
                           'Tapping Copies Image Link'}
                        </p>
                      </div>
                      
                      <AnimatePresence>
                        {copyStatus === 'image' && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 backdrop-blur-[2px]"
                          >
                            <div className="bg-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-600" />
                              <span className="font-mono text-[10px] uppercase tracking-widest text-black">Link Copied</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>

                {/* Core Profile Data */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
                  {selectedCharacter.subtype && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Inter-Function Dynamics</p>
                      <span className="font-serif italic text-xl block leading-none mb-1">{selectedCharacter.subtype}</span>
                      <p className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">{getSubtypeName(selectedCharacter.subtype)}</p>
                    </div>
                  )}
                  {selectedCharacter.behaviourQualia && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Qualia</p>
                      <span className="font-serif italic text-xl block leading-none">{selectedCharacter.behaviourQualia}</span>
                    </div>
                  )}
                  {selectedCharacter.initialDevelopment && selectedCharacter.finalDevelopment && selectedCharacter.initialDevelopment !== selectedCharacter.finalDevelopment && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Initial Dev</p>
                      <span className="font-sans text-xl font-bold tracking-[0.2em] block leading-none mb-1">{selectedCharacter.initialDevelopment}</span>
                      <p className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">{getDevelopmentName(selectedCharacter.initialDevelopment, selectedCharacter.leadEnergetic, selectedCharacter.behaviourQualia || undefined)}</p>
                    </div>
                  )}
                  {(selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment) && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Development</p>
                      <span className="font-sans text-xl font-bold tracking-[0.2em] block leading-none mb-1">{selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment}</span>
                      <p className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">{getDevelopmentName(selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment, selectedCharacter.leadEnergetic, selectedCharacter.behaviourQualia || undefined)}</p>
                    </div>
                  )}
                  {selectedCharacter.emotionalAttitude && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Emotional Attitude</p>
                      {getEmotionalDescriptor(selectedCharacter.emotionalAttitude, ct.axes.judgment) ? (
                        <>
                          <p className="font-serif italic text-xl leading-none mb-1">
                            {getEmotionalDescriptor(selectedCharacter.emotionalAttitude, ct.axes.judgment)}
                          </p>
                          <p className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">
                            {selectedCharacter.emotionalAttitude === 'Balanced' ? 'Balanced' : selectedCharacter.emotionalAttitude}
                          </p>
                        </>
                      ) : (
                        <p className="font-serif italic text-xl leading-none">{selectedCharacter.emotionalAttitude}</p>
                      )}
                    </div>
                  )}
                  {selectedCharacter.unguardedness && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Unguardedness</p>
                      <span className="font-serif italic text-xl block leading-none">{selectedCharacter.unguardedness}</span>
                    </div>
                  )}
                  {selectedCharacter.guardedness && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Guardedness</p>
                      <span className="font-serif italic text-xl block leading-none">{selectedCharacter.guardedness}</span>
                    </div>
                  )}
                  {selectedCharacter.alternateType && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Alternate Type</p>
                      <p className="font-serif italic text-xl leading-none">{formatTypeDisplay(selectedCharacter.alternateType, selectedCharacter.rawQuadra)}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="space-y-6">
                    <div className="border-b border-[#1a1a1a]/5 pb-4">
                      <button 
                        onClick={() => toggleSection('energetics')}
                        className="w-full flex items-center justify-between group"
                      >
                        <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 flex items-center gap-2 group-hover:opacity-100 transition-opacity">
                          <Zap className="w-3 h-3" /> Energetics
                        </h4>
                        <ChevronDown className={`w-3 h-3 opacity-20 group-hover:opacity-100 transition-all ${expandedSections.has('energetics') ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('energetics') && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-2 gap-4 pt-4">
                              {Object.entries(ct.energetics).filter(([_, val]) => val).map(([key, val]) => (
                                <div key={key} className="border border-[#1a1a1a]/5 p-3 rounded bg-[#f5f2ed]/20">
                                  <p className="font-mono text-[9px] uppercase opacity-40 mb-1">{key}</p>
                                  <div className="flex flex-col">
                                    <p className="font-serif italic text-base leading-tight">{val}</p>
                                    <p className="font-mono text-[8px] opacity-40 uppercase tracking-tighter">{ENERGETIC_NAMES[val]}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="border-b border-[#1a1a1a]/5 pb-4">
                      <button 
                        onClick={() => toggleSection('functions')}
                        className="w-full flex items-center justify-between group"
                      >
                        <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 flex items-center gap-2 group-hover:opacity-100 transition-opacity">
                          <Layers className="w-3 h-3" /> Function Hierarchy
                        </h4>
                        <ChevronDown className={`w-3 h-3 opacity-20 group-hover:opacity-100 transition-all ${expandedSections.has('functions') ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {expandedSections.has('functions') && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-2 gap-4 pt-4">
                              {Object.entries(ct.functions).filter(([_, val]) => val).map(([key, val]) => (
                                <div key={key} className="border border-[#1a1a1a]/5 p-3 rounded bg-[#f5f2ed]/20">
                                  <p className="font-mono text-[9px] uppercase opacity-40 mb-1">{key}</p>
                                  <div className="flex flex-col">
                                    <p className="font-serif italic text-base leading-tight">{val}</p>
                                    <p className="font-mono text-[8px] opacity-40 uppercase tracking-tighter">{FUNCTION_NAMES[val as string]}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <Compass className="w-3 h-3" /> Axes & Quadra
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {ct.axes.judgment && (
                          <div className="border border-[#1a1a1a]/5 p-3 rounded">
                            <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Judgment</p>
                            <p className="font-serif italic text-base">{ct.axes.judgment}</p>
                          </div>
                        )}
                        {ct.axes.perception && (
                          <div className="border border-[#1a1a1a]/5 p-3 rounded">
                            <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Perception</p>
                            <p className="font-serif italic text-base">{ct.axes.perception}</p>
                          </div>
                        )}
                        {ct.quadra && (
                          <div className="border border-[#1a1a1a]/5 p-3 rounded bg-[#1a1a1a] text-white">
                            <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Quadra</p>
                            <p className="font-serif italic text-base">{ct.quadra}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analysis Section (Full-width) */}
                <div id="analysis" className="border-t border-[#1a1a1a]/10 pt-4 mt-12 scroll-mt-24">
                    <button 
                      onClick={() => toggleSection('analysis')}
                      className="w-full flex items-center justify-between group py-2"
                    >
                      <div className="flex items-center gap-4">
                        <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40 flex items-center gap-2 group-hover:opacity-100 transition-opacity">
                          <Activity className="w-3 h-3" /> Analysis
                        </h4>
                        <a 
                          href="#analysis"
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-20 hover:!opacity-60 transition-opacity translate-y-[1px]"
                        >
                          <Hash className="w-3 h-3" />
                        </a>
                        <AnimatePresence mode="wait">
                          {isFetchingAnalysis ? (
                            <motion.span 
                              key="fetching"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.4 }}
                              exit={{ opacity: 0 }}
                              className="font-mono text-[9px] uppercase tracking-widest italic"
                            >
                              Fetching...
                            </motion.span>
                          ) : !expandedSections.has('analysis') ? (
                            <motion.span 
                              key="status"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.4 }}
                              className="font-mono text-[9px] uppercase tracking-widest italic"
                            >
                              {analysisStatus === 'empty' ? 'Analysis Pending' : analysisStatus === 'notFound' ? 'Entry Missing' : ''}
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </div>
                      <ChevronDown className={`w-4 h-4 opacity-20 group-hover:opacity-100 transition-all ${expandedSections.has('analysis') ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {expandedSections.has('analysis') && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4">
                            {analysisStatus === 'available' ? (
                              <MarkdownAnalysis markdown={analysisMarkdown} />
                            ) : !isFetchingAnalysis ? (
                              <div className="opacity-40">
                                <p className="font-serif italic text-lg mb-1">
                                  {analysisStatus === 'empty' ? "Analysis pending" : "Entry missing"}
                                </p>
                                <p className="font-mono text-[9px] uppercase tracking-widest">
                                  {analysisStatus === 'empty' 
                                    ? "Finalizing subject breakdown." 
                                    : "Subject not yet indexed."}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Metadata Footer */}
                    <div className="flex flex-col sm:flex-row gap-8 pt-6 border-t border-[#1a1a1a]/5 opacity-60 mt-12">
                      {selectedCharacter.author && (
                        <div className="flex flex-col gap-1">
                          <p className="font-mono text-[8px] uppercase tracking-widest opacity-40">Author</p>
                          <p className="font-mono text-[10px] font-bold">
                            {selectedCharacter.author}
                          </p>
                        </div>
                      )}
                      {selectedCharacter.publishedDate && (
                        <div className="flex flex-col gap-1">
                          <p className="font-mono text-[8px] uppercase tracking-widest opacity-40">Published</p>
                          <div className="flex flex-col">
                            <p className="font-mono text-[10px] font-bold">
                              {formatDate(selectedCharacter.publishedDate)}
                            </p>
                            <p className="font-mono text-[9px] opacity-40 italic">
                              {getRelativeTime(selectedCharacter.publishedDate)}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedCharacter.editedDate && selectedCharacter.editedDate !== selectedCharacter.publishedDate && (
                        <div className="flex flex-col gap-1">
                          <p className="font-mono text-[8px] uppercase tracking-widest opacity-40">Last Edited</p>
                          <div className="flex flex-col">
                            <p className="font-mono text-[10px] font-bold">
                              {formatDate(selectedCharacter.editedDate)}
                            </p>
                            <p className="font-mono text-[9px] opacity-40 italic">
                              {getRelativeTime(selectedCharacter.editedDate)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                {selectedCharacter.motifValues && (() => {
                  const structuredMotifs = getStructuredMotifs(selectedCharacter.motifValues);
                  const activeMotifs = structuredMotifs.flatMap(group => 
                    group.motifs
                      .filter(m => m.value)
                      .map(m => ({
                        ...m,
                        function: group.function,
                        name: m.label.split(':')[0].trim(),
                        description: `${m.category}: ${m.label.split(':').slice(1).join(':').trim()}`
                      }))
                  );

                  if (activeMotifs.length === 0) return null;

                  return (
                    <div className="mb-12 mt-12 relative">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Observed Motif Profile
                      </h4>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {activeMotifs.map((motif) => {
                          const motifId = motif.index.toString();
                          const isActive = activeMotifId === motifId;
                          
                          return (
                            <div key={motifId} className="relative">
                              <button
                                data-motif-id={motifId}
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  if (isActive) {
                                    setActiveMotifId(null);
                                    setActiveMotifDesc(null);
                                    setMotifAnchor(null);
                                  } else {
                                    setActiveMotifId(motifId);
                                    setActiveMotifDesc(motif.description);
                                    setMotifAnchor({ 
                                      top: rect.top, 
                                      left: rect.left, 
                                      width: rect.width,
                                      height: rect.height
                                    });
                                  }
                                }}
                                className={`group flex items-center gap-1.5 px-2 py-1 rounded-full transition-all text-left ${
                                  isActive ? 'bg-[#1a1a1a] text-white' : 'bg-[#1a1a1a]/5 hover:bg-[#1a1a1a]/10'
                                }`}
                              >
                                <span className={`font-mono text-[8px] font-bold px-1 py-0.5 rounded uppercase ${
                                  isActive ? 'bg-white/20 text-white' : 'bg-[#1a1a1a]/10'
                                }`}>
                                  {motif.function}
                                </span>
                                <span className="text-[10px] font-medium">
                                  {motif.name}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <AnimatePresence>
                        {activeMotifDesc && motifAnchor && (() => {
                          const bubbleWidth = Math.min(320, window.innerWidth - 32);
                          const leftPos = Math.max(16, Math.min(motifAnchor.left + motifAnchor.width / 2 - bubbleWidth / 2, window.innerWidth - bubbleWidth - 16));
                          const showAbove = motifAnchor.top + motifAnchor.height + 150 > window.innerHeight;
                          const tailLeft = motifAnchor.left + motifAnchor.width / 2 - leftPos;

                          return (
                            <motion.div
                              ref={bubbleRef}
                              initial={{ opacity: 0, scale: 0.9, y: showAbove ? 10 : -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: showAbove ? 10 : -10 }}
                              className="fixed z-[100] bg-[#1a1a1a] text-white p-4 rounded-xl shadow-2xl border border-white/10"
                              style={{
                                width: bubbleWidth,
                                left: leftPos,
                                top: showAbove ? 'auto' : motifAnchor.top + motifAnchor.height + 12,
                                bottom: showAbove ? (window.innerHeight - motifAnchor.top) + 12 : 'auto',
                              }}
                            >
                              {/* Speech Bubble Tail */}
                              <div 
                                className={`absolute w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent ${
                                  showAbove 
                                    ? 'border-t-[8px] border-t-[#1a1a1a] -bottom-2' 
                                    : 'border-b-[8px] border-b-[#1a1a1a] -top-2'
                                }`}
                                style={{ left: Math.max(12, Math.min(tailLeft - 8, bubbleWidth - 24)) }}
                              />

                              <p className="font-mono text-[8px] uppercase tracking-widest opacity-40 mb-2">Motif Definition</p>
                              <p className="text-[11px] leading-relaxed italic opacity-90 pr-4 mb-4">
                                {activeMotifDesc}
                              </p>

                              <div className="pt-4 border-t border-white/10">
                                <p className="font-mono text-[7px] uppercase tracking-[0.2em] opacity-40 mb-3">Similar Characters</p>
                                <div className="flex flex-wrap gap-2">
                                  <button 
                                    onClick={() => {
                                      const motifIdx = parseInt(activeMotifId);
                                      setSelectedQuadra(null);
                                      setSelectedDevelopment(null);
                                      setSelectedJudgmentAxis(null);
                                      setSelectedPerceptionAxis(null);
                                      setSelectedLeadEnergetic(null);
                                      setSelectedAuxEnergetic(null);
                                      setSelectedBehaviourQualia(null);
                                      setSelectedSubtype(null);
                                      setSelectedEmotionalAttitude(null);
                                      setSelectedMotifs([motifIdx]);
                                      setActiveMotifId(null);
                                      setActiveMotifDesc(null);
                                      if (selectedCharacter) {
                                        navigate(`/${slugify(selectedCharacter.medium)}/${slugify(selectedCharacter.source)}`);
                                      }
                                    }}
                                    className="text-[9px] font-mono uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                                  >
                                    Current Work
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const motifIdx = parseInt(activeMotifId);
                                      setSelectedQuadra(null);
                                      setSelectedDevelopment(null);
                                      setSelectedJudgmentAxis(null);
                                      setSelectedPerceptionAxis(null);
                                      setSelectedLeadEnergetic(null);
                                      setSelectedAuxEnergetic(null);
                                      setSelectedBehaviourQualia(null);
                                      setSelectedSubtype(null);
                                      setSelectedEmotionalAttitude(null);
                                      setSelectedMotifs([motifIdx]);
                                      setActiveMotifId(null);
                                      setActiveMotifDesc(null);
                                      if (selectedCharacter) {
                                        navigate(`/${slugify(selectedCharacter.medium)}`);
                                      }
                                    }}
                                    className="text-[9px] font-mono uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                                  >
                                    Current Medium
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const motifIdx = parseInt(activeMotifId);
                                      setSelectedQuadra(null);
                                      setSelectedDevelopment(null);
                                      setSelectedJudgmentAxis(null);
                                      setSelectedPerceptionAxis(null);
                                      setSelectedLeadEnergetic(null);
                                      setSelectedAuxEnergetic(null);
                                      setSelectedBehaviourQualia(null);
                                      setSelectedSubtype(null);
                                      setSelectedEmotionalAttitude(null);
                                      setSelectedMotifs([motifIdx]);
                                      setActiveMotifId(null);
                                      setActiveMotifDesc(null);
                                      navigate('/');
                                    }}
                                    className="text-[9px] font-mono uppercase tracking-wider bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors"
                                  >
                                    All
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })()}
                      </AnimatePresence>
                    </div>
                  );
                })()}

                {selectedCharacter.notes && (
                  <div className="mb-12 mt-12 p-6 bg-[#1a1a1a]/5 rounded-sm border-l-2 border-[#1a1a1a]/20">
                    <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-2 flex items-center gap-2">
                      <Info className="w-3 h-3" /> Analyst Notes
                    </h4>
                    <p className="text-xs opacity-60 italic">{selectedCharacter.notes}</p>
                  </div>
                )}

                <div className="border-t border-[#1a1a1a]/10 pt-8">
                  <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-6">Work Reference</h4>
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <button 
                      onClick={() => navigateToWork({ title: selectedCharacter.source, medium: selectedCharacter.medium })}
                      className="w-full md:w-64 aspect-video bg-[#1a1a1a]/5 rounded-sm overflow-hidden flex items-center justify-center hover:bg-[#1a1a1a]/10 transition-colors group"
                    >
                      <SmartWorkImage 
                        src={selectedCharacter.workImageUrl} 
                        alt={selectedCharacter.source}
                        className="w-full h-full group-hover:scale-105 transition-transform"
                        isOpaque={currentWorkData?.isOpaque ?? selectedCharacter.isWorkArtOpaque}
                      />
                    </button>
                    <div>
                      <p className="font-serif text-xl mb-1">{selectedCharacter.source}</p>
                      <p className="font-mono text-xs opacity-50">Original Release: {selectedCharacter.year}</p>
                      <p className="font-mono text-[10px] opacity-30 uppercase mt-1">Medium: {selectedCharacter.medium}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      <footer className="mt-16 pt-8 border-t border-[#1a1a1a]/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-40">
          © 2026 CT in Fiction. All rights reserved.
        </p>
        <div className="flex gap-8 font-mono text-[10px] uppercase tracking-widest opacity-40">
          <a href="https://docs.google.com/spreadsheets/d/1IQxu5vK1Zr4twJ1rcxVgDiS-EnhoKj79K9thuOtdpic/edit?usp=drivesdk" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity">Database</a>
          <a href="https://app.trakt.tv/profile/trust02" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity">Trakt</a>
          <a href="mailto:osayandeosas1000@gmail.com" className="hover:opacity-100 transition-opacity">Contact</a>
        </div>
      </footer>
    </div>
  );
}

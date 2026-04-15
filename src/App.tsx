import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams, Routes, Route } from 'react-router-dom';
import { Search, ArrowRight, X, Zap, Activity, Compass, Layers, ChevronLeft, ChevronDown, Info, Loader2, AlertCircle, Menu, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { CHARACTERS as STATIC_CHARACTERS, type Character } from './data';
import { slugify, deriveCTData, getStructuredMotifs, getDevelopmentName, getSubtypeName, formatTypeDisplay } from './lib/ct-logic';
import { fetchCharacters } from './services/dataService';

type View = 'medium' | 'work' | 'feed';

const parseDatabaseDate = (dateStr: string) => {
  if (!dateStr) return null;
  
  try {
    // Handle M/D/YYYY format (e.g., 4/14/2026)
    let processedStr = dateStr;
    const dateParts = dateStr.split(' ')[0].split('/');
    if (dateParts.length === 3 && dateParts[2].length === 4) {
      const [m, d, y] = dateParts;
      const isoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      processedStr = dateStr.replace(dateStr.split(' ')[0], isoDate);
    }

    let normalizedStr = processedStr;
    if (!processedStr.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(processedStr)) {
      // Append +01:00 to treat it as a GMT+1 timestamp
      // We use T separator for ISO compatibility
      normalizedStr = processedStr.includes(' ') ? processedStr.replace(' ', 'T') + '+01:00' : processedStr;
    }
    
    let date = new Date(normalizedStr);
    if (isNaN(date.getTime())) {
      date = new Date(dateStr);
    }
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
    <div className="mb-8 relative group">
      <div className="prose prose-sm max-w-none prose-neutral opacity-90 leading-relaxed font-serif text-lg">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
      <Route path="/:mediumSlug" element={<AppContent />} />
      <Route path="/:mediumSlug/:workSlug" element={<AppContent />} />
      <Route path="/:mediumSlug/:workSlug/:subjectSlug" element={<AppContent />} />
    </Routes>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { mediumSlug, workSlug, subjectSlug } = useParams();
  const [characters, setCharacters] = useState<Character[]>(STATIC_CHARACTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedQuadra, setSelectedQuadra] = useState<string | null>(null);
  const [selectedDevelopment, setSelectedDevelopment] = useState<string | null>(null);
  const [selectedLeadFunction, setSelectedLeadFunction] = useState<string | null>(null);
  const [selectedBehaviourQualia, setSelectedBehaviourQualia] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeMotifDesc, setActiveMotifDesc] = useState<string | null>(null);
  const [activeMotifId, setActiveMotifId] = useState<string | null>(null);
  const [motifAnchor, setMotifAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const [analysisMarkdown, setAnalysisMarkdown] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [latestCommitSha, setLatestCommitSha] = useState<string | null>(null);

  const fetchLatestCommitSha = async () => {
    try {
      // Use a standard JSON fetch which is often more reliable in browser environments
      const res = await fetch('https://api.github.com/repos/trustosas/CT-in-Fiction-Analyses/commits/main', {
        mode: 'cors',
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        return data.sha;
      }
    } catch (err) {
      // Silently fail to avoid console noise if the API is unreachable or blocked
      // The system will fallback to the randomized cache buster automatically
    }
    return null;
  };

  const fetchAnalysisMarkdown = async (content: string, sha?: string | null) => {
    if (!content) return '';
    const trimmedContent = content.trim();
    const urlPattern = /^https?:\/\//;
    let url = '';

    if (urlPattern.test(trimmedContent)) {
      url = trimmedContent;
      // If it's a GitHub raw URL and we have a SHA, use it for deterministic cache busting
      if (url.includes('raw.githubusercontent.com') && sha) {
        url = url.replace('/refs/heads/main/', `/${sha}/`);
        url = url.replace('/main/', `/${sha}/`);
      }
    } else {
      // Handle relative paths by prepending the GitHub raw base URL
      const base = 'https://raw.githubusercontent.com/trustosas/CT-in-Fiction-Analyses';
      const path = trimmedContent.split('/').map(segment => encodeURIComponent(segment)).join('/');
      
      // If we have a SHA, use it directly. Otherwise use refs/heads/main
      if (sha) {
        url = `${base}/${sha}/${path}`;
      } else {
        url = `${base}/refs/heads/main/${path}`;
      }
    }

    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`HTTP error! status: ${res.status}${errorText ? ` - ${errorText.substring(0, 100)}` : ''}`);
      }
      return await res.text();
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
      return `Failed to load analysis from: ${url}\n\nError: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      if (subjectSlug) setAnalysisMarkdown('');
      
      // Fetch both characters and the latest commit SHA in parallel
      const [data, sha] = await Promise.all([
        fetchCharacters(),
        fetchLatestCommitSha()
      ]);

      if (sha) setLatestCommitSha(sha);

      if (data && data.length > 0) {
        setCharacters(data);
        setError(null);

        // If we are on a subject page, fetch the analysis too
        if (subjectSlug) {
          const char = data.find(c => slugify(c.name) === subjectSlug);
          if (char && char.analysis) {
            const markdown = await fetchAnalysisMarkdown(char.analysis, sha);
            setAnalysisMarkdown(markdown);
          }
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
    return characters.filter(c => c.isPublished);
  }, [characters]);

  const media = useMemo(() => Array.from(new Set(publishedCharacters.map(c => c.medium))).sort(), [publishedCharacters]);

  const works = useMemo(() => {
    const workMap = new Map<string, { title: string; imageUrl: string; year: string }>();
    publishedCharacters.forEach(char => {
      if (!workMap.has(char.source)) {
        workMap.set(char.source, { 
          title: char.source, 
          imageUrl: char.workImageUrl, 
          year: char.year 
        });
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

  const currentView = useMemo(() => {
    if (workSlug) return 'work';
    if (mediumSlug) return 'medium';
    return 'feed';
  }, [mediumSlug, workSlug]);

  const navigateToWork = (workTitle: string) => {
    const char = publishedCharacters.find(c => c.source === workTitle);
    if (char) {
      navigate(`/${slugify(char.medium)}/${slugify(workTitle)}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToMedium = (mediumName: string) => {
    navigate(`/${slugify(mediumName)}`);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = () => {
    navigate('/');
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToFeed = () => {
    navigate('/');
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCharacter = (char: Character | null) => {
    if (char) {
      navigate(`/${slugify(char.medium)}/${slugify(char.source)}/${slugify(char.name)}`);
    } else {
      if (activeWork && activeMedium) {
        navigate(`/${slugify(activeMedium)}/${slugify(activeWork)}`);
      } else if (activeMedium) {
        navigate(`/${slugify(activeMedium)}`);
      } else {
        navigate('/');
      }
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

  const types = useMemo(() => {
    const filtered = publishedCharacters.filter(c => {
      const ct = c.type ? deriveCTData(c.type) : null;
      return !selectedQuadra || (ct && ct.quadra.toLowerCase() === selectedQuadra.toLowerCase());
    });
    return Array.from(new Set(filtered.map(c => c.type)))
      .filter(t => {
        if (!t) return false;
        const ct = deriveCTData(t);
        return ct.functions.aux !== null; // Only clear type codes (with specific aux)
      })
      .sort();
  }, [publishedCharacters, selectedQuadra]);

  const developments = useMemo(() => {
    const filtered = publishedCharacters.filter(c => {
      const matchesType = !selectedType || c.type === selectedType;
      const ct = c.type ? deriveCTData(c.type) : null;
      const matchesQuadra = !selectedQuadra || (ct && ct.quadra.toLowerCase() === selectedQuadra.toLowerCase());
      return matchesType && matchesQuadra;
    });
    return Array.from(new Set(filtered.map(c => c.finalDevelopment))).filter(Boolean).sort();
  }, [publishedCharacters, selectedType, selectedQuadra]);
  
  const quadras = useMemo(() => {
    const items = publishedCharacters.map(c => c.type ? deriveCTData(c.type).quadra : null).filter(Boolean);
    return Array.from(new Set(items as string[])).sort();
  }, [publishedCharacters]);

  const functions = useMemo(() => {
    const filtered = publishedCharacters.filter(c => {
      const matchesType = !selectedType || c.type === selectedType;
      const ct = c.type ? deriveCTData(c.type) : null;
      const matchesQuadra = !selectedQuadra || (ct && ct.quadra.toLowerCase() === selectedQuadra.toLowerCase());
      return matchesType && matchesQuadra;
    });
    const items = filtered.map(c => c.type ? deriveCTData(c.type).functions.lead : null).filter(Boolean);
    return Array.from(new Set(items as string[])).sort();
  }, [publishedCharacters, selectedType, selectedQuadra]);

  const behaviourQualias = useMemo(() => {
    const filtered = publishedCharacters.filter(c => {
      const matchesType = !selectedType || c.type === selectedType;
      const ct = c.type ? deriveCTData(c.type) : null;
      const matchesQuadra = !selectedQuadra || (ct && ct.quadra.toLowerCase() === selectedQuadra.toLowerCase());
      return matchesType && matchesQuadra;
    });
    return Array.from(new Set(filtered.map(c => c.behaviourQualia))).filter(Boolean).sort();
  }, [publishedCharacters, selectedType, selectedQuadra]);

  const subtypes = useMemo(() => {
    const filtered = publishedCharacters.filter(c => {
      const matchesType = !selectedType || c.type === selectedType;
      const ct = c.type ? deriveCTData(c.type) : null;
      const matchesQuadra = !selectedQuadra || (ct && ct.quadra.toLowerCase() === selectedQuadra.toLowerCase());
      return matchesType && matchesQuadra;
    });
    return Array.from(new Set(filtered.map(c => c.subtype))).filter(Boolean).sort();
  }, [publishedCharacters, selectedType, selectedQuadra]);

  // Reset dependent filters if they become invalid
  useEffect(() => {
    if (selectedType && !types.includes(selectedType)) setSelectedType(null);
  }, [selectedQuadra, types]);

  useEffect(() => {
    if (selectedDevelopment && !developments.includes(selectedDevelopment)) setSelectedDevelopment(null);
  }, [selectedType, selectedQuadra, developments]);

  useEffect(() => {
    if (selectedLeadFunction && !functions.includes(selectedLeadFunction)) setSelectedLeadFunction(null);
  }, [selectedType, selectedQuadra, functions]);

  useEffect(() => {
    if (selectedBehaviourQualia && !behaviourQualias.includes(selectedBehaviourQualia)) setSelectedBehaviourQualia(null);
  }, [selectedType, selectedQuadra, behaviourQualias]);

  useEffect(() => {
    if (selectedSubtype && !subtypes.includes(selectedSubtype)) setSelectedSubtype(null);
  }, [selectedType, selectedQuadra, subtypes]);
  
  const filteredCharacters = useMemo(() => {
    return publishedCharacters
      .filter(char => {
        // View filtering
        if (currentView === 'work' && activeWork && char.source !== activeWork) return false;
        if (currentView === 'medium' && activeMedium && char.medium !== activeMedium) return false;

        const matchesSearch = char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             char.source.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = !selectedType || char.type === selectedType;
        
        // Derived data filtering
        const ct = char.type ? deriveCTData(char.type) : null;
        const matchesQuadra = !selectedQuadra || (ct && ct.quadra.toLowerCase() === selectedQuadra.toLowerCase());
        const matchesFunction = !selectedLeadFunction || (ct && ct.functions.lead.toLowerCase() === selectedLeadFunction.toLowerCase());
        const matchesBehaviourQualia = !selectedBehaviourQualia || char.behaviourQualia === selectedBehaviourQualia;
        const matchesSubtype = !selectedSubtype || char.subtype === selectedSubtype;
        
        // Development filtering (case-insensitive for robustness)
        const matchesDevelopment = !selectedDevelopment || 
                              (char.finalDevelopment && char.finalDevelopment.toLowerCase() === selectedDevelopment.toLowerCase());

        return matchesSearch && matchesType && matchesQuadra && matchesDevelopment && matchesFunction && matchesBehaviourQualia && matchesSubtype;
      })
      .sort((a, b) => {
        // Sort by publishedDate descending (newest first)
        const dateA = a.publishedDate || '';
        const dateB = b.publishedDate || '';
        return dateB.localeCompare(dateA);
      });
  }, [publishedCharacters, currentView, activeWork, activeMedium, searchQuery, selectedType, selectedQuadra, selectedLeadFunction, selectedDevelopment, selectedBehaviourQualia, selectedSubtype]);

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

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter font-normal">{getDevelopmentName(value, selectedType || '', selectedBehaviourQualia || undefined)}</span>
              </span>
            ) : label === 'Subtype' && value ? (
              <span className="flex items-center gap-3">
                <span className="font-serif italic text-sm whitespace-nowrap">{value}</span>
                <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter font-normal">{getSubtypeName(value)}</span>
              </span>
            ) : label === 'Type' && value ? (
              formatTypeDisplay(value)
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
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#1a1a1a]/20 shadow-2xl z-[100] max-h-60 overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={(e) => { e.stopPropagation(); onChange(null); setIsOpen(false); }}
                className="w-full px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-left hover:bg-[#1a1a1a]/10 transition-colors flex items-center justify-between border-b border-[#1a1a1a]/5"
              >
                {placeholder}
                {value === null && <Check className="w-3 h-3" />}
              </button>
              {options.map(opt => (
                <button 
                  key={opt}
                  onClick={(e) => { e.stopPropagation(); onChange(opt); setIsOpen(false); }}
                  className="w-full px-4 py-3 text-[10px] font-mono tracking-wider text-left hover:bg-[#1a1a1a]/10 transition-colors flex items-center justify-between border-b border-[#1a1a1a]/5 last:border-0"
                >
                  <div className="flex flex-col gap-0.5">
                      {label === 'Development' ? (
                        <>
                          <span className="font-sans text-sm font-bold tracking-[0.2em] whitespace-nowrap">{opt}</span>
                          <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">{getDevelopmentName(opt, selectedType || '', selectedBehaviourQualia || undefined)}</span>
                        </>
                      ) : label === 'Subtype' ? (
                        <>
                          <span className="font-serif italic text-sm whitespace-nowrap">{opt}</span>
                          <span className="font-mono text-[9px] opacity-40 uppercase tracking-tighter leading-tight">{getSubtypeName(opt)}</span>
                        </>
                      ) : label === 'Type' ? (
                        formatTypeDisplay(opt)
                      ) : opt}
                  </div>
                  {value === opt && <Check className="w-3 h-3 flex-shrink-0 ml-2" />}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const worksInMedium = useMemo(() => {
    if (!activeMedium) return [];
    const workMap = new Map<string, { title: string; imageUrl: string; year: string }>();
    publishedCharacters
      .filter(c => c.medium === activeMedium)
      .forEach(char => {
        if (!workMap.has(char.source)) {
          workMap.set(char.source, { 
            title: char.source, 
            imageUrl: char.workImageUrl, 
            year: char.year 
          });
        }
      });
    return Array.from(workMap.values());
  }, [publishedCharacters, activeMedium]);

  const isNotFound = useMemo(() => {
    if (isLoading) return false;
    if (mediumSlug && !activeMedium) return true;
    if (workSlug && !activeWork) return true;
    if (subjectSlug && !selectedCharacter) return true;
    return false;
  }, [isLoading, mediumSlug, activeMedium, workSlug, activeWork, subjectSlug, selectedCharacter]);

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
        <p className="font-mono text-xs uppercase tracking-widest opacity-50 mb-8">Subject or Source Not Found in Archives</p>
        <button 
          onClick={navigateToHome}
          className="px-8 py-3 bg-[#1a1a1a] text-white font-mono text-xs uppercase tracking-widest rounded-full hover:bg-black transition-colors"
        >
          Return to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-12 md:px-12 lg:px-24">
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
                  onClick={navigateToFeed}
                  className="block font-serif text-2xl hover:italic transition-all text-left w-full"
                >
                  Feed
                </button>
                
                <div className="pt-6 border-t border-white/10">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] opacity-40 mb-4 block">{pluralize(media.length, 'Medium', 'Media')}</span>
                  <div className="space-y-2">
                    {media.map(m => (
                      <button 
                        key={m}
                        onClick={() => navigateToMedium(m)}
                        className="block font-serif text-lg hover:italic transition-all text-left w-full opacity-60 hover:opacity-100 py-0.5"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </nav>

              <div className="pt-6 mt-auto border-t border-white/5 font-mono text-[8px] uppercase tracking-widest opacity-20">
                CT in Fiction v1.0
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
          <button 
            onClick={navigateToFeed}
            className={`font-mono text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'feed' ? 'opacity-100 font-bold' : 'opacity-40 hover:opacity-100'}`}
          >
            Feed
          </button>
          {activeMedium && (
            <>
              <span className="opacity-20">/</span>
              <button 
                onClick={() => navigateToMedium(activeMedium)}
                className={`font-mono text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'medium' ? 'opacity-100 font-bold' : 'opacity-40 hover:opacity-100'}`}
              >
                {activeMedium}
              </button>
            </>
          )}
          {activeWork && (
            <>
              <span className="opacity-20">/</span>
              <button 
                className="font-mono text-[10px] uppercase tracking-widest opacity-100 font-bold whitespace-nowrap"
              >
                {activeWork}
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Header */}
      <header className="mb-20 border-b border-[#1a1a1a]/10 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-xs uppercase tracking-widest opacity-50">
                {currentView === 'feed' ? 'Media Library' : 
                 currentView === 'medium' ? `Medium: ${activeMedium}` :
                 currentView === 'work' ? 'Work Profile' : 'CT in Fiction v1.0'}
              </span>
              {isLoading && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1a1a1a]/5 rounded-full">
                  <Loader2 className="w-2.5 h-2.5 animate-spin opacity-40" />
                  <span className="font-mono text-[8px] uppercase tracking-tighter opacity-40">Syncing...</span>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/5 text-red-500 rounded-full">
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span className="font-mono text-[8px] uppercase tracking-tighter">{error}</span>
                </div>
              )}
            </div>
            
            {currentView === 'feed' ? (
              <>
                <h1 className="font-serif text-6xl md:text-8xl leading-none tracking-tight mb-6">
                  Fictional <br />
                  <span className="italic">Archetypes</span>
                </h1>
                <p className="text-lg opacity-70 leading-relaxed">
                  A specialized database exploring the cognitive architectures of fictional subjects. 
                </p>
              </>
            ) : currentView === 'medium' ? (
              <>
                <h1 className="font-serif text-6xl md:text-8xl leading-none tracking-tight mb-6 uppercase">
                  {activeMedium}
                </h1>
                <p className="text-lg opacity-70 leading-relaxed">
                  Exploring {worksInMedium.length} {pluralize(worksInMedium.length, 'work')} within the {activeMedium} medium.
                </p>
              </>
            ) : (
              <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
                {currentWorkData && (
                  <div className="w-48 aspect-video bg-[#1a1a1a]/5 rounded-sm flex items-center justify-center p-4">
                    <img 
                      src={currentWorkData.imageUrl} 
                      alt={currentWorkData.title}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <h1 className="font-serif text-5xl md:text-7xl leading-none tracking-tight mb-4">
                    {activeWork}
                  </h1>
                  <p className="font-mono text-xs uppercase tracking-widest opacity-50">
                    Release Year: {currentWorkData?.year} • {filteredCharacters.length} Indexed {pluralize(filteredCharacters.length, 'Subject')}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {(currentView === 'feed' || currentView === 'work') && (
            <div className="flex flex-col gap-6 w-full md:w-auto">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                  <input 
                    type="text"
                    placeholder="Search subjects..."
                    className="bg-transparent border-b border-[#1a1a1a]/20 py-2 pl-10 pr-4 focus:outline-none focus:border-[#1a1a1a] transition-colors w-full md:w-80"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all font-mono text-[10px] uppercase tracking-widest ${
                    showFilters ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-[#1a1a1a]/20 hover:border-[#1a1a1a]'
                  }`}
                >
                  <Compass className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>
              
              <AnimatePresence>
                {showFilters && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="z-50"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 pt-4">
                      <CustomSelect 
                        label="Quadra"
                        value={selectedQuadra}
                        options={quadras}
                        onChange={setSelectedQuadra}
                        placeholder="All Quadras"
                      />
                      <CustomSelect 
                        label="Type"
                        value={selectedType}
                        options={types}
                        onChange={setSelectedType}
                        placeholder="All Types"
                      />
                      <CustomSelect 
                        label="Development"
                        value={selectedDevelopment}
                        options={developments}
                        onChange={setSelectedDevelopment}
                        placeholder="All Developments"
                      />
                      <CustomSelect 
                        label="Qualia"
                        value={selectedBehaviourQualia}
                        options={behaviourQualias}
                        onChange={setSelectedBehaviourQualia}
                        placeholder="All Qualias"
                      />
                      <CustomSelect 
                        label="Subtype"
                        value={selectedSubtype}
                        options={subtypes}
                        onChange={setSelectedSubtype}
                        placeholder="All Subtypes"
                      />
                      <CustomSelect 
                        label="Lead Function"
                        value={selectedLeadFunction}
                        options={functions}
                        onChange={setSelectedLeadFunction}
                        placeholder="All Functions"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {(selectedQuadra || selectedType || selectedDevelopment || selectedLeadFunction || selectedBehaviourQualia || selectedSubtype) && (
                <div className="pt-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedQuadra(null);
                      setSelectedType(null);
                      setSelectedDevelopment(null);
                      setSelectedLeadFunction(null);
                      setSelectedBehaviourQualia(null);
                      setSelectedSubtype(null);
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
          {currentView === 'medium' && worksInMedium.map((work) => (
            <motion.div
              key={work.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="character-card group cursor-pointer"
              onClick={() => navigateToWork(work.title)}
            >
              <div className="character-image-container aspect-[4/3] mb-6 bg-[#1a1a1a]/5 p-8 flex items-center justify-center">
                <img 
                  src={work.imageUrl} 
                  alt={work.title}
                  className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="font-serif text-3xl mb-1 group-hover:italic transition-all">{work.title}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-40">
                    {work.year} • {publishedCharacters.filter(c => c.source === work.title).length} {pluralize(publishedCharacters.filter(c => c.source === work.title).length, 'Subject')}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </motion.div>
          ))}

          {(currentView === 'feed' || currentView === 'work') && filteredCharacters.length === 0 && !isLoading && (
            <div className="col-span-full py-32 text-center">
              <div className="max-w-md mx-auto">
                <AlertCircle className="w-12 h-12 mx-auto mb-6 opacity-20" />
                <h2 className="font-serif text-3xl mb-4">No {pluralize(0, 'Subject')} Found</h2>
                <p className="text-sm opacity-50 leading-relaxed">
                  No subjects match your current search or filter criteria in the database.
                </p>
              </div>
            </div>
          )}
          {(currentView === 'feed' || currentView === 'work') && filteredCharacters.map((char) => {
            const ct = deriveCTData(char.type);
            return (
              <motion.div
                layout
                key={char.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="character-card group cursor-pointer"
                onClick={() => handleSelectCharacter(char)}
              >
                <div className="character-image-container aspect-[16/9]">
                  <img 
                    src={char.imageUrl} 
                    alt={char.name}
                    referrerPolicy="no-referrer"
                    className="character-image object-cover group-hover:scale-105"
                  />
                </div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-serif text-2xl group-hover:italic transition-all">{char.name}</h3>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToWork(char.source);
                      }}
                      className="font-mono text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 hover:underline transition-all"
                    >
                      {char.source} ({char.year})
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-xs bg-[#1a1a1a]/5 px-2 py-1 rounded mb-1">{formatTypeDisplay(char.type)}</span>
                    <span className={`font-sans text-sm font-bold tracking-[0.2em] whitespace-nowrap ${!char.finalDevelopment ? 'opacity-40' : ''}`}>
                      {char.finalDevelopment || char.initialDevelopment}
                    </span>
                    <span className="font-mono text-[9px] opacity-40 tracking-tighter">
                      {[char.subtype?.trim(), char.behaviourQualia?.trim()].filter(s => s && s.length > 0).join(' • ')}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </main>

      {/* Modal / Detail View */}
      <AnimatePresence>
        {selectedCharacter && (() => {
          const ct = deriveCTData(selectedCharacter.type);
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

                <div className="mb-12">
                  <h2 className="font-serif text-5xl md:text-7xl leading-tight mb-4">
                    {selectedCharacter.name}
                  </h2>
                  <div className="flex gap-4 items-center">
                    <button 
                      onClick={() => navigateToWork(selectedCharacter.source)}
                      className="font-serif italic text-xl opacity-60 hover:opacity-100 hover:underline transition-all text-left"
                    >
                      {selectedCharacter.source} ({selectedCharacter.year})
                    </button>
                    <div className="h-px flex-1 bg-[#1a1a1a]/10" />
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-mono text-sm font-bold mb-1">{formatTypeDisplay(selectedCharacter.type)}</span>
                      <span className={`font-sans text-lg font-bold tracking-[0.2em] leading-none whitespace-nowrap ${!selectedCharacter.finalDevelopment ? 'opacity-40' : ''}`}>
                        {selectedCharacter.finalDevelopment || selectedCharacter.initialDevelopment}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="aspect-[16/9] rounded-sm overflow-hidden mb-12 relative group bg-[#1a1a1a]/5">
                  <img 
                    src={selectedCharacter.imageUrl} 
                    alt={selectedCharacter.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                     <p className="text-white font-mono text-[10px] uppercase tracking-widest">Subject Visual Reference</p>
                  </div>
                </div>

                {/* Core Profile Data */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
                  {selectedCharacter.subtype && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Subtype</p>
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
                  {selectedCharacter.initialDevelopment && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Initial Dev</p>
                      <span className="font-sans text-xl font-bold tracking-[0.2em] block leading-none mb-1">{selectedCharacter.initialDevelopment}</span>
                      <p className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">{getDevelopmentName(selectedCharacter.initialDevelopment, selectedCharacter.type, selectedCharacter.behaviourQualia)}</p>
                    </div>
                  )}
                  {selectedCharacter.finalDevelopment && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Final Dev</p>
                      <span className="font-sans text-xl font-bold tracking-[0.2em] block leading-none mb-1">{selectedCharacter.finalDevelopment}</span>
                      <p className="font-mono text-[9px] opacity-40 uppercase tracking-tighter">{getDevelopmentName(selectedCharacter.finalDevelopment, selectedCharacter.type, selectedCharacter.behaviourQualia)}</p>
                    </div>
                  )}
                  {selectedCharacter.emotionalAttitude && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Emotional Attitude</p>
                      <p className="font-serif italic text-xl leading-none">{selectedCharacter.emotionalAttitude}</p>
                    </div>
                  )}
                  {selectedCharacter.alternateType && (
                    <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                      <p className="font-mono text-[9px] uppercase opacity-40 mb-2">Alternate Type</p>
                      <p className="font-serif italic text-xl leading-none">{selectedCharacter.alternateType}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
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
                                  <p className="font-serif italic text-base">{val}</p>
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
                          <Layers className="w-3 h-3" /> Function Stack
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
                                  <p className="font-serif italic text-base">{val}</p>
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

                    <div>
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Analysis
                      </h4>
                      <MarkdownAnalysis markdown={analysisMarkdown} />
                      
                      <div className="flex flex-col gap-6 pt-6 border-t border-[#1a1a1a]/10">
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
                    <div className="mb-16 relative">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-6 flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Observed Motif Profile
                      </h4>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {activeMotifs.map((motif, idx) => {
                          const motifId = `${motif.function}-${idx}`;
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
                              <p className="text-[11px] leading-relaxed italic opacity-90 pr-4">
                                {activeMotifDesc}
                              </p>
                            </motion.div>
                          );
                        })()}
                      </AnimatePresence>
                    </div>
                  );
                })()}

                {selectedCharacter.notes && (
                  <div className="mb-16 p-6 bg-[#1a1a1a]/5 rounded-sm border-l-2 border-[#1a1a1a]/20">
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
                      onClick={() => navigateToWork(selectedCharacter.source)}
                      className="w-full md:w-64 aspect-video bg-[#1a1a1a]/5 rounded-sm flex items-center justify-center p-6 hover:bg-[#1a1a1a]/10 transition-colors group"
                    >
                      <img 
                        src={selectedCharacter.workImageUrl} 
                        alt={selectedCharacter.source}
                        className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
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

      <footer className="mt-32 pt-12 border-t border-[#1a1a1a]/10 flex flex-col md:flex-row justify-between items-center gap-4">
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

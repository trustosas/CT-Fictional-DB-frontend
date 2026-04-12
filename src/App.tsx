import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ArrowRight, X, Zap, Activity, Compass, Layers, ChevronLeft, ChevronDown, Info, Loader2, AlertCircle, Menu, Check } from 'lucide-react';
import { CHARACTERS as STATIC_CHARACTERS, type Character } from './data';
import { deriveCTData, getStructuredMotifs } from './lib/ct-logic';
import { fetchCharacters } from './services/dataService';

type View = 'home' | 'medium' | 'work' | 'archive';

export default function App() {
  const [characters, setCharacters] = useState<Character[]>(STATIC_CHARACTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('archive');
  const [activeWork, setActiveWork] = useState<string | null>(null);
  const [activeMedium, setActiveMedium] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedQuadra, setSelectedQuadra] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [selectedLeadEnergetic, setSelectedLeadEnergetic] = useState<string | null>(null);
  const [selectedLeadFunction, setSelectedLeadFunction] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [activeMotifDesc, setActiveMotifDesc] = useState<string | null>(null);
  const [activeMotifId, setActiveMotifId] = useState<string | null>(null);

  useEffect(() => {
    setActiveMotifDesc(null);
    setActiveMotifId(null);
  }, [selectedCharacter]);

  useEffect(() => {
    let title = 'CT in Fiction DB';
    if (selectedCharacter) {
      title = `${selectedCharacter.name} | CT in Fiction DB`;
    } else if (currentView === 'work' && activeWork) {
      title = `${activeWork} | CT in Fiction DB`;
    } else if (currentView === 'medium' && activeMedium) {
      title = `${activeMedium} | CT in Fiction DB`;
    }
    document.title = title;
  }, [currentView, activeWork, activeMedium, selectedCharacter]);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const data = await fetchCharacters();
        if (data && data.length > 0) {
          setCharacters(data);
          setError(null);
        } else {
          setError('Database is empty or inaccessible. Please check "Publish to Web" settings.');
        }
      } catch (err) {
        console.error('Failed to load dynamic data:', err);
        setError('Sync Failed. Ensure Spreadsheet is "Published to Web" as CSV.');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const types = useMemo(() => Array.from(new Set(characters.map(c => c.type))).sort(), [characters]);
  const subtypes = useMemo(() => Array.from(new Set(characters.map(c => c.subtype))).sort(), [characters]);
  
  const quadras = useMemo(() => {
    const items = characters.map(c => c.type ? deriveCTData(c.type).quadra : null).filter(Boolean);
    return Array.from(new Set(items as string[])).sort();
  }, [characters]);

  const energetics = useMemo(() => {
    const items = characters.map(c => c.type ? deriveCTData(c.type).energetics.lead : null).filter(Boolean);
    return Array.from(new Set(items as string[])).sort();
  }, [characters]);

  const functions = useMemo(() => {
    const items = characters.map(c => c.type ? deriveCTData(c.type).functions.lead : null).filter(Boolean);
    return Array.from(new Set(items as string[])).sort();
  }, [characters]);
  
  const media = useMemo(() => Array.from(new Set(characters.map(c => c.medium))).sort(), [characters]);

  const works = useMemo(() => {
    const workMap = new Map<string, { title: string; imageUrl: string; year: string }>();
    characters.forEach(char => {
      if (!workMap.has(char.source)) {
        workMap.set(char.source, { 
          title: char.source, 
          imageUrl: char.workImageUrl, 
          year: char.year 
        });
      }
    });
    return Array.from(workMap.values());
  }, [characters]);

  const filteredCharacters = characters.filter(char => {
    // View filtering
    if (currentView === 'work' && activeWork && char.source !== activeWork) return false;
    if (currentView === 'medium' && activeMedium && char.medium !== activeMedium) return false;

    const matchesSearch = char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         char.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedType || char.type === selectedType;
    
    // Derived data filtering
    const ct = char.type ? deriveCTData(char.type) : null;
    const matchesQuadra = !selectedQuadra || (ct && ct.quadra.toLowerCase() === selectedQuadra.toLowerCase());
    const matchesEnergetic = !selectedLeadEnergetic || (ct && ct.energetics.lead.toLowerCase() === selectedLeadEnergetic.toLowerCase());
    const matchesFunction = !selectedLeadFunction || (ct && ct.functions.lead.toLowerCase() === selectedLeadFunction.toLowerCase());
    
    // Subtype filtering (case-insensitive for robustness)
    const matchesSubtype = !selectedSubtype || 
                          (char.subtype && char.subtype.toLowerCase() === selectedSubtype.toLowerCase());

    return matchesSearch && matchesType && matchesQuadra && matchesSubtype && matchesEnergetic && matchesFunction;
  });

  const navigateToWork = (workTitle: string) => {
    setActiveWork(workTitle);
    setCurrentView('work');
    setSelectedCharacter(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToMedium = (mediumName: string) => {
    setActiveMedium(mediumName);
    setCurrentView('medium');
    setActiveWork(null);
    setSelectedCharacter(null);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = () => {
    setCurrentView('archive');
    setActiveMedium(null);
    setActiveWork(null);
    setSelectedCharacter(null);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToArchive = () => {
    setCurrentView('archive');
    setActiveMedium(null);
    setActiveWork(null);
    setSelectedCharacter(null);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
        <label className="font-mono text-[8px] uppercase tracking-widest opacity-70 text-[#1a1a1a]">{label}</label>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-transparent border-b border-[#1a1a1a]/30 py-1.5 text-[10px] font-mono tracking-wider text-left transition-colors hover:border-[#1a1a1a]"
        >
          <span className={`transition-opacity ${value ? 'opacity-100 font-bold' : 'opacity-50 uppercase'}`}>
            {value || placeholder}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'opacity-50 group-hover:opacity-100'}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#1a1a1a]/20 shadow-2xl z-[100] max-h-60 overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => { onChange(null); setIsOpen(false); }}
                className="w-full px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-left hover:bg-[#1a1a1a]/10 transition-colors flex items-center justify-between border-b border-[#1a1a1a]/5"
              >
                {placeholder}
                {!value && <Check className="w-3 h-3" />}
              </button>
              {options.map(opt => (
                <button 
                  key={opt}
                  onClick={() => { onChange(opt); setIsOpen(false); }}
                  className="w-full px-4 py-2 text-[10px] font-mono tracking-wider text-left hover:bg-[#1a1a1a]/10 transition-colors flex items-center justify-between"
                >
                  {opt}
                  {value === opt && <Check className="w-3 h-3" />}
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
    characters
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
  }, [characters, activeMedium]);

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
                  onClick={navigateToArchive}
                  className="block font-serif text-2xl hover:italic transition-all text-left w-full"
                >
                  Archive
                </button>
                
                <div className="pt-6 border-t border-white/10">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] opacity-40 mb-4 block">Media</span>
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
                CT Archive v1.0
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
            onClick={navigateToArchive}
            className={`font-mono text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${currentView === 'archive' ? 'opacity-100 font-bold' : 'opacity-40 hover:opacity-100'}`}
          >
            Archive
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
                {currentView === 'home' ? 'Media Library' : 
                 currentView === 'medium' ? `Medium: ${activeMedium}` :
                 currentView === 'work' ? 'Work Profile' : 'Archive v1.0'}
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
            
            {currentView === 'archive' ? (
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
                  Exploring {worksInMedium.length} works within the {activeMedium} medium.
                </p>
              </>
            ) : currentView === 'archive' ? (
              <>
                <h1 className="font-serif text-6xl md:text-8xl leading-none tracking-tight mb-6">
                  Fictional <br />
                  <span className="italic">Archetypes</span>
                </h1>
                <p className="text-lg opacity-70 leading-relaxed">
                  A specialized database exploring the cognitive architectures of fictional subjects. 
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
                    Release Year: {currentWorkData?.year} • {filteredCharacters.length} Indexed Subjects
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {(currentView === 'archive' || currentView === 'work') && (
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
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 pt-4">
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
                        label="Subtype"
                        value={selectedSubtype}
                        options={subtypes}
                        onChange={setSelectedSubtype}
                        placeholder="All Subtypes"
                      />
                      <CustomSelect 
                        label="Lead Energetic"
                        value={selectedLeadEnergetic}
                        options={energetics}
                        onChange={setSelectedLeadEnergetic}
                        placeholder="All Energetics"
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

              {(selectedQuadra || selectedType || selectedSubtype || selectedLeadEnergetic || selectedLeadFunction) && (
                <button 
                  onClick={() => {
                    setSelectedQuadra(null);
                    setSelectedType(null);
                    setSelectedSubtype(null);
                    setSelectedLeadEnergetic(null);
                    setSelectedLeadFunction(null);
                  }}
                  className="font-mono text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-1.5 transition-opacity"
                >
                  <X className="w-3 h-3" /> Clear All Filters
                </button>
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
                    {work.year} • {characters.filter(c => c.source === work.title).length} Subjects
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
            </motion.div>
          ))}

          {(currentView === 'archive' || currentView === 'work') && filteredCharacters.length === 0 && !isLoading && (
            <div className="col-span-full py-32 text-center">
              <div className="max-w-md mx-auto">
                <AlertCircle className="w-12 h-12 mx-auto mb-6 opacity-20" />
                <h2 className="font-serif text-3xl mb-4">No Subjects Found</h2>
                <p className="text-sm opacity-50 leading-relaxed mb-8">
                  The archive is currently empty or the live sync is disconnected. 
                  If you are the administrator, ensure your Google Sheet is 
                  <strong> Published to the Web</strong> as a <strong>CSV</strong>.
                </p>
                <div className="p-6 bg-[#1a1a1a]/5 rounded-sm text-left">
                  <p className="font-mono text-[10px] uppercase tracking-widest mb-4 opacity-40">Troubleshooting Steps:</p>
                  <ol className="font-mono text-[10px] space-y-2 opacity-60">
                    <li>1. Open your Google Sheet</li>
                    <li>2. File &gt; Share &gt; Publish to web</li>
                    <li>3. Select "Entire Document" and "Comma-separated values (.csv)"</li>
                    <li>4. Click Publish and refresh this page</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
          {(currentView === 'archive' || currentView === 'work') && filteredCharacters.map((char) => {
            const ct = deriveCTData(char.type);
            return (
              <motion.div
                layout
                key={char.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="character-card group cursor-pointer"
                onClick={() => setSelectedCharacter(char)}
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
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-xs bg-[#1a1a1a]/5 px-2 py-1 rounded">{char.type}</span>
                    <span className="font-mono text-[9px] opacity-40">{char.subtype}</span>
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
                onClick={() => setSelectedCharacter(null)}
                className="fixed inset-0 bg-[#f5f2ed]/90 backdrop-blur-sm z-40"
              />
              <motion.div 
                layoutId={selectedCharacter.id}
                className="fixed inset-y-0 right-0 w-full md:w-[750px] bg-white z-50 shadow-2xl p-8 md:p-16 overflow-y-auto"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                <button 
                  onClick={() => setSelectedCharacter(null)}
                  className="absolute top-8 right-8 p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="mb-12">
                  <span className="font-mono text-xs uppercase tracking-[0.2em] opacity-40 mb-4 block">
                    Subject Dossier
                  </span>
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
                    <div className="flex flex-col items-end">
                      <span className="font-mono text-sm font-bold">{selectedCharacter.type}</span>
                      <span className="font-mono text-[10px] opacity-40">{selectedCharacter.subtype}</span>
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

                {/* Development & Attitude */}
                <div className="grid grid-cols-3 gap-4 mb-12">
                  <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                    <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Initial Dev</p>
                    <p className="font-mono text-lg font-bold tracking-widest">{selectedCharacter.initialDevelopment}</p>
                  </div>
                  <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                    <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Final Dev</p>
                    <p className="font-mono text-lg font-bold tracking-widest">{selectedCharacter.finalDevelopment}</p>
                  </div>
                  <div className="border border-[#1a1a1a]/5 p-4 rounded bg-[#f5f2ed]/30">
                    <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Emotional Attitude</p>
                    <p className="font-serif italic text-lg">{selectedCharacter.emotionalAttitude}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
                  <div className="space-y-8">
                    <div>
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Energetics
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(ct.energetics).map(([key, val]) => (
                          <div key={key} className="border border-[#1a1a1a]/5 p-3 rounded">
                            <p className="font-mono text-[9px] uppercase opacity-40 mb-1">{key}</p>
                            <p className="font-serif italic text-lg">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Functions
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {Object.entries(ct.functions).map(([key, val]) => (
                          <div key={key} className="border border-[#1a1a1a]/5 p-3 rounded">
                            <p className="font-mono text-[9px] uppercase opacity-40 mb-1">{key}</p>
                            <p className="font-serif italic text-lg">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <Compass className="w-3 h-3" /> Axes & Quadra
                      </h4>
                      <div className="space-y-4">
                        <div className="border border-[#1a1a1a]/5 p-3 rounded">
                          <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Judgment Axis</p>
                          <p className="font-serif italic text-lg">{ct.axes.judgment}</p>
                        </div>
                        <div className="border border-[#1a1a1a]/5 p-3 rounded">
                          <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Perception Axis</p>
                          <p className="font-serif italic text-lg">{ct.axes.perception}</p>
                        </div>
                        <div className="border border-[#1a1a1a]/5 p-3 rounded bg-[#1a1a1a] text-white">
                          <p className="font-mono text-[9px] uppercase opacity-40 mb-1">Quadra</p>
                          <p className="font-serif italic text-lg">{ct.quadra}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Analysis
                      </h4>
                      <p className="text-sm leading-relaxed opacity-80">
                        {selectedCharacter.analysis}
                      </p>
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
                        description: m.label.split(':').slice(1).join(':').trim()
                      }))
                  );

                  if (activeMotifs.length === 0) return null;

                  return (
                    <div className="mb-16 relative">
                      <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-6 flex items-center gap-2">
                        <Layers className="w-3 h-3" /> Observed Motif Profile
                      </h4>
                      
                      <div className="flex flex-wrap gap-2">
                        {activeMotifs.map((motif, idx) => {
                          const motifId = `${motif.function}-${idx}`;
                          const isActive = activeMotifId === motifId;
                          
                          return (
                            <div key={motifId} className="relative">
                              <button
                                onClick={() => {
                                  if (isActive) {
                                    setActiveMotifId(null);
                                    setActiveMotifDesc(null);
                                  } else {
                                    setActiveMotifId(motifId);
                                    setActiveMotifDesc(motif.description);
                                  }
                                }}
                                className={`group flex items-center gap-2 px-3 py-1.5 rounded-full transition-all text-left ${
                                  isActive ? 'bg-[#1a1a1a] text-white' : 'bg-[#1a1a1a]/5 hover:bg-[#1a1a1a]/10'
                                }`}
                              >
                                <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  isActive ? 'bg-white/20 text-white' : 'bg-[#1a1a1a]/10'
                                }`}>
                                  {motif.function}
                                </span>
                                <span className={`font-mono text-[9px] uppercase ${
                                  isActive ? 'text-white/60' : 'opacity-40'
                                }`}>
                                  {motif.category}
                                </span>
                                <span className="text-[11px] font-medium">
                                  {motif.name}
                                </span>
                              </button>

                              <AnimatePresence>
                                {isActive && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute bottom-full left-0 mb-3 w-64 p-4 bg-[#1a1a1a] text-white rounded-sm shadow-xl z-10 origin-bottom-left"
                                  >
                                    <div className="absolute bottom-0 left-6 translate-y-1/2 rotate-45 w-2 h-2 bg-[#1a1a1a]" />
                                    <p className="font-mono text-[8px] uppercase tracking-widest opacity-40 mb-2">Definition</p>
                                    <p className="text-[11px] leading-relaxed italic opacity-90">
                                      {motif.description}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {selectedCharacter.notes && (
                  <div className="mb-16 p-6 bg-[#1a1a1a]/5 rounded-sm border-l-2 border-[#1a1a1a]/20">
                    <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40 mb-2 flex items-center gap-2">
                      <Info className="w-3 h-3" /> Researcher Notes
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
          © 2026 Cognitive Typology Archive. All rights reserved.
        </p>
        <div className="flex gap-8 font-mono text-[10px] uppercase tracking-widest opacity-40">
          <a href="#" className="hover:opacity-100 transition-opacity">Methodology</a>
          <a href="#" className="hover:opacity-100 transition-opacity">Database</a>
          <a href="#" className="hover:opacity-100 transition-opacity">Privacy</a>
        </div>
      </footer>
    </div>
  );
}

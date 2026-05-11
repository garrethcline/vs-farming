// Top header + tab navigation. Designed as a "title page" of a field journal.
import { motion } from 'framer-motion';
import { ModPill } from '../ui/Primitives.jsx';
import { useTheme } from '../../lib/useTheme.js';

const TABS = [
  { id: 'decision',  label: 'Decision',  hint: 'rank crops', primary: true },
  { id: 'dashboard', label: 'Dashboard', hint: 'overview' },
  { id: 'plots',     label: 'Plots',     hint: 'track farms' },
  { id: 'calendar',  label: 'Calendar',  hint: 'plantability' },
  { id: 'crops',     label: 'Crops',     hint: 'reference' },
  { id: 'berries',    label: 'Berries',     hint: 'bushes' },
  { id: 'fruittrees', label: 'Fruit Trees', hint: 'orchards & grafting' },
  { id: 'animals',    label: 'Animals',     hint: 'husbandry' },
  { id: 'bees',       label: 'Bees',        hint: 'hives & honey' },
  { id: 'greenhouse', label: 'Greenhouse',  hint: 'multi-tier design' },
  { id: 'fertilizers', label: 'Fertilizers', hint: 'NPK + perk', mod: true },
  { id: 'climate',   label: 'Climate',   hint: 'temperature' },
  { id: 'simulator', label: 'Simulator', hint: 'single crop' },
  { id: 'timer',     label: 'Timer',     hint: 'real-time calc' },
  { id: 'scouting',  label: 'Scouting',  hint: 'try latitudes', beta: true },
  { id: 'estimator', label: 'Estimator',  hint: 'fit climate', beta: true },
  { id: 'sccrafting',label: 'SC Crafting', hint: 'mod recipes', beta: true },
  { id: 'forager',   label: 'Forager',     hint: 'wild spawns', beta: true },
  { id: 'mushrooms', label: 'Mushrooms',   hint: 'cellar troughs', beta: true, mod: true },
  { id: 'settings',  label: 'Settings',  hint: 'config' },
  { id: 'reference', label: 'Reference', hint: 'glossary' },
];

export function Header({ activeTab, onTab, hasPerk, betaFlags = {} }) {
  // Filter out beta tabs that aren't enabled
  const visibleTabs = TABS.filter(t => {
    if (!t.beta) return true;
    if (t.id === 'scouting') return !!betaFlags.climateScouting;
    if (t.id === 'estimator') return !!betaFlags.climateEstimator;
    if (t.id === 'sccrafting') return !!betaFlags.scCrafting;
    if (t.id === 'forager') return !!betaFlags.forager;
    if (t.id === 'mushrooms') return !!betaFlags.mushrooms;
    return false;
  });

  return (
    <header className="border-b border-parchment-300/60">
      {/* Title block */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-10 pb-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="section-eyebrow mb-3">A Field Guide for the Vintage Farmer</div>
            <h1 className="heading-display text-5xl md:text-6xl lg:text-7xl tracking-tight">
              The <span className="heading-italic">Vintage</span> Farming
            </h1>
            <h1 className="heading-display text-5xl md:text-6xl lg:text-7xl tracking-tight -mt-1">
              <span className="heading-italic">Almanac</span> &amp; Dashboard
            </h1>
            <p className="mt-4 text-sm text-ink-600 max-w-xl leading-relaxed font-sans">
              A planner for Vintage Story farming. Most numbers come from the
              decompiled game source; some are derived or estimated, and those
              are flagged in-place.
            </p>
          </div>
          {/* Decorative element + theme toggle on the right */}
          <div className="flex items-start gap-3">
            <ThemeToggle />
            <div className="hidden lg:block flex-shrink-0">
              <FieldOrnament />
            </div>
          </div>
        </div>
      </div>

      {/* Tab nav strip */}
      <nav className="max-w-7xl mx-auto px-6 lg:px-10 -mb-px">
        <div className="flex gap-1 overflow-x-auto pb-0 -mb-px">
          {visibleTabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              tab={tab}
              hasPerk={hasPerk}
              onClick={() => onTab(tab.id)}
            />
          ))}
        </div>
      </nav>
    </header>
  );
}

function TabButton({ tab, active, hasPerk, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center px-4 py-3 group whitespace-nowrap min-w-[88px] transition-colors duration-150 ${
        active ? 'text-forest-900' : 'text-ink-500 hover:text-forest-700'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {tab.primary && <span className="text-amber-500 text-[10px] -mr-0.5">★</span>}
        {tab.beta && (
          <span
            className="text-[9px] uppercase tracking-wider px-1 py-px rounded bg-amber-200/60 text-amber-900 font-semibold"
            style={{ fontVariationSettings: '"opsz" 12' }}
          >
            beta
          </span>
        )}
        <span className={`font-display text-base ${active ? '' : ''}`} style={{fontVariationSettings: '"opsz" 30'}}>
          {tab.label}
        </span>
      </div>
      <span className="text-[10px] text-ink-400 mt-0.5 italic font-sans">
        {tab.hint}
      </span>
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-forest-700"
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
        />
      )}
    </button>
  );
}

// Theme toggle. Labeled pill with sun/moon icon. Visible enough that
// people don't miss it. Memory: a lot of users didn't know the toggle existed.
function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 transition-all duration-200 hover:shadow-sm group text-sm font-medium"
      style={{
        borderColor: 'var(--accent-primary)',
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-primary)',
      }}
    >
      <motion.span
        key={theme}
        initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="text-base leading-none"
      >
        {isDark ? '☾' : '☀'}
      </motion.span>
      <span className="hidden sm:inline tabular text-xs">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}

// Hand-drawn-feeling ornament (a simple SVG floral)
function FieldOrnament() {
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" className="text-forest-700/60">
      <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        {/* Stem */}
        <path d="M 60 78 Q 60 60 60 35" />
        {/* Leaves */}
        <path d="M 60 60 Q 50 55 38 50 Q 48 56 60 60" fill="currentColor" fillOpacity="0.15" />
        <path d="M 60 50 Q 70 45 82 40 Q 72 46 60 50" fill="currentColor" fillOpacity="0.15" />
        {/* Wheat-head suggestion */}
        <ellipse cx="60" cy="20" rx="2" ry="14" />
        <ellipse cx="55" cy="22" rx="1.5" ry="10" />
        <ellipse cx="65" cy="22" rx="1.5" ry="10" />
        <ellipse cx="51" cy="26" rx="1" ry="7" />
        <ellipse cx="69" cy="26" rx="1" ry="7" />
        {/* Tendril top */}
        <path d="M 60 8 Q 58 4 55 3" />
        <path d="M 60 8 Q 62 4 65 3" />
      </g>
    </svg>
  );
}

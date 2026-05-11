// UI primitives for the field-guide aesthetic.
import { motion } from 'framer-motion';

export function Card({ children, className = '', accent = false, elevated = false }) {
  return (
    <div className={`${elevated ? 'card-elevated' : 'card'} ${accent ? 'border-l-4 border-l-forest-700' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ eyebrow, title, subtitle, accessory, className = '' }) {
  return (
    <div className={`px-6 pt-5 pb-4 border-b border-parchment-300/50 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow && <div className="section-eyebrow mb-1">{eyebrow}</div>}
          <h3 className="font-display text-2xl text-forest-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-ink-600 mt-1">{subtitle}</p>}
        </div>
        {accessory && <div className="flex-shrink-0">{accessory}</div>}
      </div>
    </div>
  );
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

// Animated reveal
export function Reveal({ children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// "MOD" pill
export function ModPill({ small = false }) {
  return (
    <span className={`pill-mod ${small ? 'text-[9px] px-1.5 py-0' : ''}`}>
      <span className="opacity-70">●</span> Mod
    </span>
  );
}

// Toggle switch with proper field-guide styling
export function Toggle({ checked, onChange, label, helperText, modWarning = false }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <span className="relative inline-block w-10 h-5 mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <span className="absolute inset-0 bg-parchment-400 rounded-full transition-colors duration-200 peer-checked:bg-forest-700"></span>
        <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-parchment-50 rounded-full shadow-paper transition-transform duration-200 peer-checked:translate-x-5"></span>
      </span>
      <div className="flex-1 select-none">
        <span className="text-sm font-medium text-ink-800 flex items-center gap-2">
          {label}
          {modWarning && <ModPill small />}
        </span>
        {helperText && <span className="block text-xs text-ink-500 mt-0.5">{helperText}</span>}
      </div>
    </label>
  );
}

// Stat block. For large readouts
export function Stat({ label, value, sub, accent, className = '' }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="section-eyebrow text-[10px]">{label}</span>
      <span className={`font-display text-3xl mt-1 ${accent || 'text-forest-900'}`} style={{ fontVariationSettings: '"opsz" 144, "SOFT" 30' }}>
        {value}
      </span>
      {sub && <span className="text-xs text-ink-500 mt-0.5">{sub}</span>}
    </div>
  );
}

// Decorative ornament between sections
export function Flourish({ children = '◆ ◆ ◆' }) {
  return <div className="flourish-divider" aria-hidden="true">{children}</div>;
}

// Status badges (color-coded by level)
export function StatusBadge({ level, children, className = '' }) {
  const colorMap = {
    ok: 'bg-forest-100 text-forest-800 border-forest-200',
    info: 'bg-parchment-200 text-ink-700 border-parchment-300',
    warn: 'bg-amber-300/40 text-amber-900 border-amber-300',
    severe: 'bg-terra-300/30 text-terra-900 border-terra-300',
    danger: 'bg-terra-300/30 text-terra-900 border-terra-300',
    'top pick': 'bg-forest-200 text-forest-900 border-forest-300 font-semibold',
    leading: 'bg-forest-200 text-forest-900 border-forest-300 font-semibold',
    good: 'bg-forest-100 text-forest-800 border-forest-200',
    viable: 'bg-forest-100 text-forest-800 border-forest-200',
    risky: 'bg-amber-300/40 text-amber-900 border-amber-300',
    "won't finish": 'bg-terra-300/30 text-terra-900 border-terra-300',
    'cold/heat damage': 'bg-terra-300/30 text-terra-900 border-terra-300',
  };
  const cls = colorMap[level] || colorMap.info;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${cls} ${className}`}>
      {children}
    </span>
  );
}

// Nutrient axis indicator (colored dot + letter)
export function NutrientChip({ axis, value }) {
  const colors = {
    N: 'bg-nitrogen text-parchment-50',
    P: 'bg-phosphorus text-parchment-50',
    K: 'bg-potassium text-ink-900',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono ${colors[axis]}`}>
      <span className="font-bold">{axis}</span>
      {value !== undefined && <span className="opacity-90">{value}</span>}
    </span>
  );
}

// Simple icon container
export function IconCircle({ children, accent = 'forest', size = 'md' }) {
  const sizes = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
  };
  const accents = {
    forest: 'bg-forest-100 text-forest-800 border-forest-200',
    amber: 'bg-amber-300/40 text-amber-900 border-amber-300',
    terra: 'bg-terra-300/30 text-terra-900 border-terra-300',
  };
  return (
    <div className={`rounded-full flex items-center justify-center border ${sizes[size]} ${accents[accent]}`}>
      {children}
    </div>
  );
}

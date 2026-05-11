// Theme: light/dark toggle. Persists to localStorage so the choice survives
// reloads. Defaults to the user's OS preference if no choice is stored.
import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'vs-farming-theme';

function readSavedTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch (e) { /* localStorage blocked */ }
  return null;
}

function osPreference() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Apply theme as early as possible (called once at app boot from main.jsx).
export function initTheme() {
  const theme = readSavedTheme() || osPreference();
  applyTheme(theme);
  return theme;
}

export function useTheme() {
  const [theme, setTheme] = useState(() => readSavedTheme() || osPreference());

  // Keep the DOM in sync if the state ever changes by means other than toggle()
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
      return next;
    });
  }, []);

  const set = useCallback((next) => {
    if (next !== 'light' && next !== 'dark') return;
    setTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
  }, []);

  return [theme, toggle, set];
}

// Resolved chart colors for the current theme. Recharts SVG fill/stroke
// props don't resolve CSS variables, so this hook reads the active theme
// and returns concrete colors.
const CHART_COLORS = {
  light: {
    bgPage: '#FAF5E8',
    bandKnockout: '#FAF5E8',
    avgLine: '#1B4332',
    grid: '#DDD0B6',
    axisText: '#5C5854',
    axisLine: '#C7BAA0',
    referenceLine: '#7A6E5C',
    today: '#BC4749',
    growingSeasonBg: 'rgba(116, 165, 127, 0.08)',
  },
  dark: {
    bgPage: '#141C18',
    bandKnockout: '#141C18',
    avgLine: '#95D5B2',
    grid: 'rgba(82, 121, 111, 0.25)',
    axisText: '#C7BAA0',
    axisLine: '#5C5040',
    referenceLine: '#A89B82',
    today: '#E48580',
    growingSeasonBg: 'rgba(116, 198, 157, 0.06)',
  },
};

export function useChartColors() {
  const [theme] = useTheme();
  return CHART_COLORS[theme] || CHART_COLORS.light;
}

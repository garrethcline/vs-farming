import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { bootstrapClimate } from './lib/useClimate.js';
import { initTheme } from './lib/useTheme.js';
import { setDaysPerMonth } from './data/climate.js';
import './styles/index.css';

// Apply saved/preferred theme before first paint to avoid a light-to-dark flash
initTheme();

// Read saved daysPerMonth from localStorage and seed the climate module BEFORE
// any component renders. Otherwise the first paint would use the default of 9
// even if the user has saved e.g. 20 d/m.
try {
  const raw = localStorage.getItem('vs-farming-dashboard-v1');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.settings?.daysPerMonth) setDaysPerMonth(parsed.settings.daysPerMonth);
  }
} catch (e) { /* not fatal; App.jsx useEffect will sync anyway */ }

// Kick off climate loading. Tries (in order):
//   1. localStorage custom upload (instant)
//   2. ./climate.csv from the deployment (~50ms)
//   3. Inline DEFAULT_CLIMATE (synchronous fallback)
// React components subscribed via useClimate() will re-render on change.
bootstrapClimate();

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

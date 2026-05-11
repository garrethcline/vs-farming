import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Header } from './components/layout/Header.jsx';
import { useSettings } from './lib/storage.js';
import { ModPill } from './components/ui/Primitives.jsx';
import { setDaysPerMonth } from './data/climate.js';
import { reparseClimateForDpm } from './lib/useClimate.js';

import DecisionPage from './pages/Decision.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import PlotsPage from './pages/Plots.jsx';
import CalendarPage from './pages/Calendar.jsx';
import CropsPage from './pages/Crops.jsx';
import BerriesPage from './pages/Berries.jsx';
import FruitTreesPage from './pages/FruitTrees.jsx';
import AnimalsPage from './pages/Animals.jsx';
import BeesPage from './pages/Bees.jsx';
import MultitierPage from './pages/Multitier.jsx';
import FertilizersPage from './pages/Fertilizers.jsx';
import ClimatePage from './pages/Climate.jsx';
import SimulatorPage from './pages/Simulator.jsx';
import ScoutingPage from './pages/Scouting.jsx';
import ClimateEstimatorPage from './pages/ClimateEstimator.jsx';
import SCCraftingPage from './pages/SCCrafting.jsx';
import ForagerPage from './pages/Forager.jsx';
import MushroomsPage from './pages/Mushrooms.jsx';
import TimerPage from './pages/Timer.jsx';
import SettingsPage from './pages/Settings.jsx';
import ReferencePage from './pages/Reference.jsx';

const PAGES = {
  decision:   DecisionPage,
  dashboard:  DashboardPage,
  plots:      PlotsPage,
  calendar:   CalendarPage,
  crops:      CropsPage,
  berries:    BerriesPage,
  fruittrees: FruitTreesPage,
  animals:    AnimalsPage,
  bees:       BeesPage,
  greenhouse: MultitierPage,
  fertilizers: FertilizersPage,
  climate:    ClimatePage,
  simulator:  SimulatorPage,
  scouting:   ScoutingPage,
  estimator:  ClimateEstimatorPage,
  sccrafting: SCCraftingPage,
  forager:    ForagerPage,
  mushrooms:  MushroomsPage,
  timer:      TimerPage,
  settings:   SettingsPage,
  reference:  ReferencePage,
};

const BETA_PAGES = {
  scouting: 'climateScouting',
  estimator: 'climateEstimator',
  sccrafting: 'scCrafting',
  forager: 'forager',
  mushrooms: 'mushrooms',
};

export default function App() {
  // Tab state: read from URL hash on first load, write back on changes
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'decision';
    const hash = window.location.hash.replace('#', '');
    return PAGES[hash] ? hash : 'decision';
  });
  const [settings] = useSettings();

  // Keep the climate module's _daysPerMonth in sync with user settings,
  // so that helper functions (dayLabel, daysPerYear, climateWindow) all
  // reflect the user's actual server config. Also re-parse the bundled
  // climate CSV using the new dpm so day-to-temp mapping stays correct.
  useEffect(() => {
    setDaysPerMonth(settings.daysPerMonth);
    reparseClimateForDpm(settings.daysPerMonth);
  }, [settings.daysPerMonth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [tab]);

  // Listen to manual hash changes (back button, deep links)
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '');
      if (PAGES[hash]) setTab(hash);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const betaFlags = settings.experimentalFeatures || {};
  // Gate beta pages: if user is on a beta tab whose flag is off, fall back.
  const requiredFlag = BETA_PAGES[tab];
  const allowedTab = (requiredFlag && !betaFlags[requiredFlag]) ? 'decision' : tab;
  const Page = PAGES[allowedTab] || DecisionPage;
  const playerClass = settings.playerClass || 'commoner';
  const showClassBanner = playerClass !== 'commoner';

  return (
    <div className="min-h-screen flex flex-col">
      <Header activeTab={allowedTab} onTab={setTab} hasPerk={showClassBanner} betaFlags={betaFlags} />

      {/* Mod compatibility banner. Shows when a non-Commoner class is selected. */}
      {showClassBanner && (
        <div className="bg-amber-300/10 border-b border-amber-300/30">
          <div className="max-w-7xl mx-auto px-6 lg:px-10 py-2 flex items-center gap-3 text-xs text-amber-900">
            <ModPill small />
            <span>
              Specialized Classes is on. Yield numbers are adjusted for the <strong>{playerClass}</strong> class.
              Switch in <button className="underline hover:text-forest-700" onClick={() => setTab('settings')}>Settings</button>.
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-10 py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="border-t border-parchment-300/40 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 text-xs text-ink-500 italic space-y-1">
          <p>A field guide for the vintage farmer. The numbers come straight from the game files. Climate's pulled from your own server's /debug exptempplot.</p>
          <p className="not-italic text-ink-400">Targets Vintage Story 1.22.2 stable; source decompiled from 1.22.1 · Specialized Classes 2.2.2 (<span className="font-mono">specializedclasses</span>) · NDL MushroomGrowth 2.0.2 (<span className="font-mono">ndlmushroomgrowth</span>)</p>
        </div>
      </footer>
    </div>
  );
}

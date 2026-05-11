// localStorage layer. Keeps plots, activity log, and settings persistent.
// Falls back gracefully if storage is unavailable (private mode, etc.).

import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'vs-farming-dashboard-v1';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

const DEFAULT_STATE = {
  settings: {
    today: 84,            // 4 May, Year 0 at dpm=20: (5-1)*20 + 4 = 84
    daysPerMonth: 20,     // user's server runs 20 d/m (16 real-world hours per game day)
    realHoursPerMonth: 16, // wall-clock hours per game month. Read from the in-game world settings panel.
    // Real-time game-clock sync. When set, the dashboard auto-advances
    // settings.today as real wall-clock time passes. Only kicks in if the
    // user explicitly synced; otherwise everything works manually as before.
    //   realtimeAnchor.realTimestamp = ms epoch when sync was set
    //   realtimeAnchor.gameDay       = the in-game day at that moment
    //   realtimeAnchor.gameHour      = the in-game hour at that moment (0-23)
    // Speed is derived from daysPerMonth + realHoursPerMonth, no extra field.
    realtimeAnchor: null,
    playerClass: 'commoner',
    defaultSoil: 50,
    defaultGreenhouse: false,
    // How to value crop output. See SATIETY_MODES in data/crops.js.
    satietyMode: 'auto',
    // Biome rainfall, fed into the moisture-driven grow-rate factor.
    // User's server runs "almost always" rain (HUD shows ~89% rainfall).
    rainfallFrequency: 'almost_always',  // very_rare / rarely / uncommon / common / very_common / almost_always
    // Which side of the equator the player's spawn is on. In VS, equator is
    // at z=0; positive z is south. North-of-equator means south is the
    // warmer direction. Player can flip this if their server spawn is south
    // of the equator.
    hemisphere: 'north',  // 'north' | 'south'
    // World config flag; gates whether underground crops can grow at all.
    allowUndergroundFarming: true,
    // Score weights. 1.0 = current behavior. 0 = ignore that factor. >1 = amplify.
    weights: {
      satiety: 1.0,
      growSpeed: 1.0,
      frostSafety: 1.0,
      rotation: 1.0,
      followUp: 1.0,
      damage: 1.0,
    },
    // Per-food-category boost. 1.0 = no preference. Bump a category to rank
    // those crops higher (e.g. Protein 1.5 if you're short on protein).
    categoryBoosts: {
      Vegetable: 1.0,
      Fruit: 1.0,
      Grain: 1.0,
      Protein: 1.0,
      Dairy: 1.0,
      Spice: 1.0,
    },
    // Beta-gated experimental features. Unstable, mod-fragile, or
    // assumption-heavy work that we want feedback on before promoting
    // to first-class. Off by default.
    experimentalFeatures: {
      climateScouting: false,
      climateEstimator: false,
      scCrafting: false,
      forager: false,
      mushrooms: false,
    },
    // Server world config. Mirrors the WorldConfig section of
    // serverconfig.json. Lets the user tell the app what their server
    // is actually running so projection and damage models match.
    // Defaults match the bundled climate's source server.
    worldConfig: {
      polarEquatorDistance: 25000,   // server uses 25k (default is 50k)
      worldClimate: 'realistic',
      globalTemperature: 1.0,
      globalPrecipitation: 1.0,
      seasons: 'spawn',
      cropGrowthRateMul: 1.0,
      saplingGrowthRate: 0.5,        // 'Faster (0.5x)' = saplings finish in half the time
      landcover: 0.70,               // 70% = more forest than vanilla's 0.50
      landformScale: 3.0,            // 300% = larger landforms
      worldWidth: 51000,
      worldLength: 51000,
      harshWinters: true,
      allowCropDeath: true,
      processCrops: true,
      allowUndergroundFarming: true,
      daysPerMonth: 20,
    },
  },
  plots: [
    { id: 'P01', owner: 'You', soil: 50, greenhouse: false, waterDistance: 1, underground: false, lightLevel: 22, depthBelowSea: 0, crop: '', plantDay: null, n: 50, p: 50, k: 50, poolN: 0, poolP: 0, poolK: 0, notes: '' },
    { id: 'P02', owner: 'You', soil: 50, greenhouse: false, waterDistance: 1, underground: false, lightLevel: 22, depthBelowSea: 0, crop: '', plantDay: null, n: 50, p: 50, k: 50, poolN: 0, poolP: 0, poolK: 0, notes: '' },
  ],
  activity: [],
  decisionState: {
    mode: 'standalone',
    plotId: 'P01',
    soil: 50,
    greenhouse: false,
    willFert: false,
    fertKey: 'none',
    curN: 50, curP: 50, curK: 50,
    poolN: 0, poolP: 0, poolK: 0,
    prevNutrient: '',
  },
};

// Migrate older saved state to the current shape. Specifically: previous
// builds stored a single `hasPerk` boolean for the SC mod fertilizer perk.
// Map that to playerClass = 'farmhand' (since Farmhand is the class that
// carried the perk) so existing users don't lose their setup.
function migrate(saved) {
  if (!saved) return null;
  const s = { ...DEFAULT_STATE, ...saved };
  s.settings = { ...DEFAULT_STATE.settings, ...(saved.settings || {}) };
  // Deep-merge weights and categoryBoosts so older saves don't lose newly-added keys.
  s.settings.weights = { ...DEFAULT_STATE.settings.weights, ...(saved.settings?.weights || {}) };
  s.settings.categoryBoosts = { ...DEFAULT_STATE.settings.categoryBoosts, ...(saved.settings?.categoryBoosts || {}) };
  s.settings.experimentalFeatures = { ...DEFAULT_STATE.settings.experimentalFeatures, ...(saved.settings?.experimentalFeatures || {}) };
  s.settings.worldConfig = { ...DEFAULT_STATE.settings.worldConfig, ...(saved.settings?.worldConfig || {}) };
  if (s.settings.playerClass === undefined) {
    s.settings.playerClass = saved.settings?.hasPerk ? 'farmhand' : 'commoner';
  }
  // hasPerk left in place for any older code paths that still read it,
  // but Settings/App now drive off playerClass.
  s.settings.hasPerk = s.settings.playerClass === 'farmhand';
  // Backfill plot fields. waterDistance defaults to 1 (within 1 block of
  // water), giving a moisture floor of 0.75. The game's formula:
  // BESoilNutrition.cs:233 -> minMoisture = clamp(1 - waterDistance/4, 0, 1).
  // Older saves had nearWater (boolean); migrate it to waterDistance.
  s.plots = (s.plots || []).map(p => {
    const out = { underground: false, lightLevel: 22, depthBelowSea: 0, ...p };
    if (out.waterDistance === undefined) {
      // Migrate: nearWater true -> distance 1 (default), false -> distance 4 (far)
      out.waterDistance = (out.nearWater === false) ? 4 : 1;
    }
    delete out.nearWater;
    return out;
  });
  return s;
}

// Read the entire state once at module load
let _state = migrate(readAll()) || DEFAULT_STATE;

// Listeners for state changes (so multiple useAppState hooks stay in sync)
const _listeners = new Set();

function notify() {
  for (const l of _listeners) l();
}

export function getState() {
  return _state;
}

export function setState(updater) {
  if (typeof updater === 'function') {
    _state = updater(_state);
  } else {
    _state = { ..._state, ...updater };
  }
  writeAll(_state);
  notify();
}

// React hook: subscribe to the entire state object
export function useAppState() {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force(x => x + 1);
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }, []);
  return _state;
}

// Specialized hook for settings only
export function useSettings() {
  const state = useAppState();
  const update = useCallback((patch) => {
    setState(s => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);
  return [state.settings, update];
}

// Plots
export function usePlots() {
  const state = useAppState();
  const updatePlot = useCallback((id, patch) => {
    setState(s => ({
      ...s,
      plots: s.plots.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  }, []);
  const addPlot = useCallback(() => {
    setState(s => {
      const nextN = s.plots.length + 1;
      const id = `P${String(nextN).padStart(2, '0')}`;
      return {
        ...s,
        plots: [...s.plots, {
          id, owner: '', soil: 50, greenhouse: false, waterDistance: 1,
          underground: false, lightLevel: 22, depthBelowSea: 0,
          crop: '', plantDay: null, count: 10,
          n: 50, p: 50, k: 50,
          poolN: 0, poolP: 0, poolK: 0, notes: '',
        }],
      };
    });
  }, []);
  const removePlot = useCallback((id) => {
    setState(s => ({ ...s, plots: s.plots.filter(p => p.id !== id) }));
  }, []);
  return { plots: state.plots, updatePlot, addPlot, removePlot };
}

// Activity log
export function useActivity() {
  const state = useAppState();
  const addEntry = useCallback((entry) => {
    setState(s => ({
      ...s,
      activity: [
        { ...entry, ts: new Date().toISOString() },
        ...s.activity,
      ].slice(0, 200), // keep last 200
    }));
  }, []);
  const clearLog = useCallback(() => {
    setState(s => ({ ...s, activity: [] }));
  }, []);
  return { activity: state.activity, addEntry, clearLog };
}

// Decision state (the form on the Decision tab. Preserved across nav)
export function useDecisionState() {
  const state = useAppState();
  const update = useCallback((patch) => {
    setState(s => ({ ...s, decisionState: { ...s.decisionState, ...patch } }));
  }, []);
  return [state.decisionState, update];
}

// Reset everything to defaults
export function resetAll() {
  _state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  writeAll(_state);
  notify();
}

// useGameClock: derives the current in-game (day, hour, fractional) from a
// real-time anchor + the daysPerMonth/realHoursPerMonth speed. Re-renders
// every `intervalMs` milliseconds. Returns null if no anchor is set.
//
// When the integer day rolls past settings.today, components can use the
// returned `liveDay` to call updateSettings({today: liveDay}) themselves.
// this hook deliberately does NOT mutate state, so multiple components
// reading the clock don't fight each other.
import { useEffect as _useEffect, useState as _useState } from 'react';
export function useGameClock(intervalMs = 15000) {
  const [, settings] = [useAppState(), null];  // ensure subscription
  const s = useAppState();
  const [now, setNow] = _useState(() => Date.now());
  _useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  const anchor = s.settings.realtimeAnchor;
  if (!anchor) return null;

  const dpm = s.settings.daysPerMonth || 9;
  const realHoursPerMonth = s.settings.realHoursPerMonth || 16;
  const realMinutesPerGameDay = (realHoursPerMonth * 60) / dpm;

  const elapsedRealMs = now - anchor.realTimestamp;
  const elapsedGameDays = elapsedRealMs / (realMinutesPerGameDay * 60 * 1000);

  // Anchor was at (gameDay, gameHour). Add elapsed days fractionally.
  const fractional = anchor.gameDay + (anchor.gameHour ?? 0) / 24 + elapsedGameDays;
  const liveDay = Math.floor(fractional);
  const liveHour = Math.floor(((fractional - liveDay) * 24));
  const liveMinute = Math.floor(((fractional - liveDay) * 24 - liveHour) * 60);

  return {
    liveDay,
    liveHour,
    liveMinute,
    fractional,
    realMinutesPerGameDay,
    isLive: true,
  };
}

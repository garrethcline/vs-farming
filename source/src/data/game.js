// Soil tiers from BESoilNutrition.Fertilities (vssurvivalmod).
// Bony soil exists in worldgen but isn't tillable, so the planner ignores it.
export const SOILS = {
  verylow:  { key: 'verylow',  name: 'Barren',      val: 5,  tillable: true, notes: 'Sparse / desert / sand-adjacent.' },
  low:      { key: 'low',      name: 'Low',         val: 25, tillable: true, notes: 'Forest floor drops as Low when tilled.' },
  medium:   { key: 'medium',   name: 'Medium',      val: 50, tillable: true, notes: 'Most temperate biomes.' },
  compost:  { key: 'compost',  name: 'High',        val: 65, tillable: true, notes: 'Rich/composted soil. Often called "High Fertility" on the wiki.' },
  high:     { key: 'high',     name: 'Terra Preta', val: 80, tillable: true, notes: 'Best naturally-occurring. Internal code name is "high"; community + wiki call it "Terra Preta".' },
};

export const SOILS_LIST = ['verylow','low','medium','compost','high'].map(k => SOILS[k]);

// Alias retained so older imports don't crash. Same as SOILS_LIST now.
export const SOILS_PLANTABLE = SOILS_LIST;

// Fertilizer NPK profiles, from the fertilizer item JSONs.
export const FERTILIZERS = {
  none:      { key: 'none',      name: 'None',      n: 0,  p: 0,  k: 0,  notes: 'Skip fertilizing.' },
  compost:   { key: 'compost',   name: 'Compost',   n: 40, p: 8,  k: 8,  notes: 'Best all-rounder. Strong N.' },
  saltpeter: { key: 'saltpeter', name: 'Saltpeter', n: 13, p: 0,  k: 44, notes: 'Best for K-required crops.' },
  bonemeal:  { key: 'bonemeal',  name: 'Bonemeal',  n: 3,  p: 30, k: 0,  notes: 'Best for P-required crops.' },
  potash:    { key: 'potash',    name: 'Potash',    n: 0,  p: 0,  k: 60, notes: 'Highest single-axis K. Also one-time PermaBoost +15 K.' },
};

export const FERTILIZERS_LIST = Object.values(FERTILIZERS);

// Specialized Classes mod (Farmhand "fertilizer" trait)
// fertilizerPermanencePercentage stat = +0.25 (25%) per application
// effect: originalFertility[N|P|K] += INT(ROUND(props.NPK * 0.25, 1))
// hard-clamped to [0, 100] per axis
// MOD ONLY: only applies if Specialized Classes mod is installed
export const SC_MOD = {
  name: 'Specialized Classes',
  url: 'https://mods.vintagestory.at/specializedclasses',
  perkPercent: 0.25,
  fertCap: 100,
};

// Per-application perk additions (rounded per axis)
export function perkBoost(fertilizer, perkPct = 0.25) {
  return {
    n: Math.round(fertilizer.n * perkPct * 10) / 10 | 0, // INT(ROUND(NPK * pct, 1))
    p: Math.round(fertilizer.p * perkPct * 10) / 10 | 0,
    k: Math.round(fertilizer.k * perkPct * 10) / 10 | 0,
  };
}

// Get fertilizer by key (safe lookup)
export function fertilizer(key) {
  return FERTILIZERS[key] || FERTILIZERS.none;
}

// Game-mechanics constants
export const GAME = {
  fertilityRecoverySpeed: 0.25,
  growthRateMul: 1.0,
  delayGrowthBelowSunLight: 19,
  lossPerLevel: 0.1,
  delayGrowthBelowTemp: 10,
  lossPerDegree: 0.1,
  tickHoursMin: 3.0,
  tickHoursMax: 4.0,
  tickHoursMean: 3.5,
  poolMax: 150,
  slowReleasePerTick: 0.25,
  damageDeathThresholdHours: 48,
  defaultMoisture: 0.75,
  defaultCold: -5,       // BlockCropPropertiesType.cs default for ColdDamageBelow
  defaultHeat: 40,       // BlockCropPropertiesType.cs default for HeatDamageAbove
  defaultStuntMul: 0.5,
  defaultRipeColdMul: 0.5,
};

// All 10 cultivated berry varieties.
//
// Sources:
//  - Behavior: vssurvivalmod /Systems/Farming/BEBehaviorFruitingBush.cs,
//              FruitingBush.cs, BlockBehaviorFruitingBush.cs
//  - Block data: assets/survival/blocktypes/plant/fruitingbush.json
//  - Cutting:    assets/survival/blocktypes/plant/fruitingbushcutting.json
//  - Wild gen:   assets/survival/worldgen/blockpatches/berrybush.json
//  - Satiety:    assets/survival/itemtypes/food/fruit.json
//
// Wild bush grows from seed-stage to first ripe in roughly 6.5 game-months
// (3m young + 1m empty + 0.5m flowering + 1m ripening + 1m ripe). After
// the first harvest, the bush returns to "empty" and re-cycles every 2.5
// months. A cutting matures in 2-4 months and arrives at the "empty" stage,
// so the time from planting a cutting to first ripe is similar.
//
// Temperature gates apply to all varieties:
//   pause growth:    below 4°C, above 30°C
//   reset to young:  below -3°C, above 38°C
//
// Currants (blackcurrant, redcurrant, whitecurrant) have a tighter dormancy
// envelope: dormant below -2°C, wake at 12°C. Other 7 varieties: dormant
// below -5°C, wake at 15°C.

// Common cycle stages (months on average) shared by all varieties.
export const BERRY_STAGES = {
  young:     { months: 3,   note: 'Newly planted from seed. No fruit yet.' },
  empty:     { months: 1,   note: 'Mature plant. No flowers yet.' },
  flowering: { months: 0.5, note: 'Visible blossoms. Attracts bees.' },
  ripening:  { months: 1,   note: 'Green fruits forming.' },
  ripe:      { months: 1,   note: 'Harvestable. Click to harvest, returns to empty.' },
};

export const FIRST_RIPE_MONTHS = 6.5;     // young→ripe path
export const RECYCLE_MONTHS    = 2.5;     // empty→ripe path (post-first-harvest)

// Default NPK consumption per state. Cloudberry and strawberry use a softer
// schedule (half each tier).
const NPK_DEFAULT = {
  bountiful:  { n: 10, p: 10, k: 10 },
  healthy:    { n: 7,  p: 7,  k: 7  },
  struggling: { n: 4,  p: 4,  k: 4  },
  barren:     { n: 1,  p: 1,  k: 1  },
};

const NPK_LIGHT = {
  bountiful:  { n: 5,   p: 5,   k: 5   },
  healthy:    { n: 3.5, p: 3.5, k: 3.5 },
  struggling: { n: 2,   p: 2,   k: 2   },
  barren:     { n: 0.5, p: 0.5, k: 0.5 },
};

// Per-variety. Climate ranges below are the WILD bush ranges (worldgen);
// cultivated bushes don't have a separate climate constraint per se but
// will pause / reset growth based on the global temperature gates above.
//
//   yieldRipe      : avg fruits dropped per ripe stage (harvested)
//   satietyPerFruit: from fruit.json nutritionPropsByType. Most are 80;
//                    cranberry is 60.
//   satietyPerHarvest = yieldRipe × satietyPerFruit
//   wildClimate    : worldgen ranges. Useful for "which biomes have these"
//                    but cultivated bushes work outside these ranges too.
//
// The "tier" is shorthand for the NPK consumption schedule:
//   default = 10/7/4/1 per axis
//   light   = 5/3.5/2/0.5 per axis
//
// Currants are flagged isCurrant: true; their dormancy envelope is tighter.
export const BERRIES = {
  blueberry: {
    key: 'blueberry', name: 'Blueberry',
    yieldRipe: 5.5, satietyPerFruit: 80,
    npkTier: 'default', isCurrant: false,
    wildClimate: { minTemp: -2, maxTemp: 18, minRain: 0.3, maxRain: 0.7, maxFertility: 0.5 },
    note: 'Cool-temperate, moderate rainfall, low to mid fertility. Common in pine forests.',
  },
  blackberry: {
    key: 'blackberry', name: 'Blackberry',
    yieldRipe: 5.5, satietyPerFruit: 80,
    npkTier: 'default', isCurrant: false,
    wildClimate: { minTemp: -2, maxTemp: 23, minRain: 0.35, maxFertility: 0.8 },
    note: 'Wide temperature range. Forest-edge plant.',
  },
  raspberry: {
    key: 'raspberry', name: 'Raspberry',
    yieldRipe: 5.5, satietyPerFruit: 80,
    npkTier: 'default', isCurrant: false,
    wildClimate: { minTemp: -15, maxTemp: 10, minRain: 0.3, minFertility: 0.6 },
    note: 'Cold-tolerant. Wants high fertility. Hard to find in warm biomes.',
  },
  beautyberry: {
    key: 'beautyberry', name: 'Beautyberry',
    yieldRipe: 5.5, satietyPerFruit: 80,
    npkTier: 'default', isCurrant: false,
    wildClimate: { minTemp: 10, maxTemp: 22, minRain: 0.45, maxRain: 1, maxFertility: 1 },
    note: 'Warm-temperate. Wider rainfall tolerance. Open forests.',
  },
  cranberry: {
    key: 'cranberry', name: 'Cranberry',
    yieldRipe: 5.5, satietyPerFruit: 60,
    npkTier: 'default', isCurrant: false,
    wildClimate: { minTemp: -2, maxTemp: 18, minRain: 0.45, maxRain: 1, maxFertility: 1 },
    note: 'Wet biomes. Lower per-fruit satiety (60 vs default 80).',
  },
  blackcurrant: {
    key: 'blackcurrant', name: 'Blackcurrant',
    yieldRipe: 5.5, satietyPerFruit: 80,
    npkTier: 'default', isCurrant: true,
    wildClimate: { minTemp: -2, maxTemp: 23, minRain: 0.3, maxRain: 0.7, minFertility: 0.25, maxFertility: 0.6 },
    note: 'Currant. Tighter dormancy envelope (dormant below -2°C, wake at 12°C).',
  },
  redcurrant: {
    key: 'redcurrant', name: 'Redcurrant',
    yieldRipe: 5.5, satietyPerFruit: 80,
    npkTier: 'default', isCurrant: true,
    wildClimate: { minTemp: -3, maxTemp: 22, minRain: 0.3, maxRain: 0.7, minFertility: 0.25, maxFertility: 0.6 },
    note: 'Currant. Slightly more cold-tolerant than blackcurrant.',
  },
  whitecurrant: {
    key: 'whitecurrant', name: 'Whitecurrant',
    yieldRipe: 5.5, satietyPerFruit: 80,
    npkTier: 'default', isCurrant: true,
    wildClimate: { minTemp: 0, maxTemp: 24, minRain: 0.3, maxRain: 0.7, minFertility: 0.25, maxFertility: 0.6 },
    note: 'Currant. Rarest in worldgen (chance 0.03 vs 0.12 for the others).',
  },
  strawberry: {
    key: 'strawberry', name: 'Strawberry',
    yieldRipe: 2.75, satietyPerFruit: 80,
    npkTier: 'light', isCurrant: false,
    wildClimate: { minTemp: -2, maxTemp: 18, minRain: 0.45, maxRain: 1, maxFertility: 1 },
    note: 'Half yield of other bushes (2.75 vs 5.5). Gentler on soil (NPK light tier).',
  },
  cloudberry: {
    key: 'cloudberry', name: 'Cloudberry',
    yieldRipe: 2.75, satietyPerFruit: 80,
    npkTier: 'light', isCurrant: false,
    wildClimate: { minTemp: -20, maxTemp: -3, minRain: 0.5, maxFertility: 0.5 },
    note: 'Cold-only (-20 to -3°C wild range). Half yield, gentler on soil. Boreal indicator.',
  },
};

export const BERRIES_LIST = [
  'blueberry', 'blackberry', 'raspberry', 'beautyberry', 'cranberry',
  'blackcurrant', 'redcurrant', 'whitecurrant', 'strawberry', 'cloudberry',
].map(k => BERRIES[k]);

export function berryNpk(berry) {
  return berry.npkTier === 'light' ? NPK_LIGHT : NPK_DEFAULT;
}

export function berrySatietyPerHarvest(berry) {
  return Math.round(berry.yieldRipe * berry.satietyPerFruit * 10) / 10;
}

// Per-month satiety once mature: the recycle is 2.5 months and gives one
// ripe stage of yieldRipe × satietyPerFruit.
export function berrySatietyPerMonth(berry) {
  return berrySatietyPerHarvest(berry) / RECYCLE_MONTHS;
}

// Temperature gates shared by all varieties (with currant override for
// the dormancy bounds). Applied as the bush evaluates whether to advance
// stages.
export function berryTempGates(berry) {
  return {
    pauseBelow: 4,
    pauseAbove: 30,
    resetBelow: -3,
    resetAbove: 38,
    dormantBelow: berry.isCurrant ? -2 : -5,
    wakeAbove:    berry.isCurrant ? 12 : 15,
  };
}

// Specialized Classes effects (informational):
//
//   Vintner gatherer  : forageDropRate +1.0   → wild bushes 2× drops
//                       (cultivated bushes likely unaffected; needs code
//                       confirmation in BEBehaviorFruitingBush.GetDrops)
//   Vintner picker    : faster harvest swing, no yield change
//   sheltered/overkill: -25% on forageDropRate (wild bushes 0.75×)
//   Forester nursery  : treeSeedDropRate +3.0 (trees only, not berries)
export const BERRY_CLASS_NOTES = {
  vintner: 'Best class for berries if cultivated bushes scale by forageDropRate. Wild bushes definitely get +100% drops.',
  forester: 'No berry bonus. Strong on tree seeds only.',
  sheltered: '0.75× wild berry drops (Blackguard, Brickmaker, Clockmaker, Messenger, Quarrier, Spelunker).',
  overkill: '0.75× wild berry drops (Butcher, Hunter while carrying overkill).',
};

// =====================================================================
// Climate analysis. Given the user's bundled climate, work out whether
// a berry will produce here, when it wakes from dormancy, and roughly
// how many harvests per year are realistic.
//
// Game rules from BEBehaviorFruitingBush.cs:
//   - Dormant state takes precedence over reset. If temp drops below
//     goDormantBelow (-2 currants, -5 others) the bush goes dormant.
//     It stays dormant until temp climbs above leaveDormantAbove
//     (12 currants, 15 others).
//   - If temp is between dormantBelow and resetBelow without crossing
//     dormantBelow first (rare, requires sharp swings), the bush in a
//     fruiting stage drops back to Empty (lose ~2.5 months of progress).
//     Reset to Young only happens for unhealthy/young bushes.
//   - Pause range (4 < temp < 30): timer suspended. Bush sits and waits.
//   - Active range (4-30): timer ticks down toward next stage.
//
// The first thing to check: does this climate have warm enough days
// (> leaveDormantAbove) for the bush to wake up at all? In subarctic
// climates with summer max around 15°C, non-currants (wake at 15) may
// barely wake; currants (wake at 12) wake more reliably.
// =====================================================================
export function berryClimateAnalysis(berry, climate) {
  if (!Array.isArray(climate) || climate.length === 0) return null;
  const gates = berryTempGates(berry);

  // Day-by-day classification using the daily AVERAGE temperature.
  // dormant : avg <= goDormantBelow → bush would go dormant
  // pausedCold : goDormantBelow < avg < pauseBelow → not growing, not dormant
  // active : pauseBelow <= avg <= pauseAbove → bush can advance stages
  // pausedHot : pauseAbove < avg < resetAbove → paused due to heat
  // reset : avg >= resetAbove → would reset (rare)
  let dormantDays = 0;
  let pausedColdDays = 0;
  let activeDays = 0;
  let pausedHotDays = 0;
  let resetDays = 0;
  let firstWakeDay = null; // first day where temp >= leaveDormantAbove (after a dormancy)

  // Walk through climate, track wake events
  let inDormancy = false;
  for (let i = 0; i < climate.length; i++) {
    const t = climate[i].avg;
    if (t <= gates.dormantBelow) { dormantDays++; inDormancy = true; }
    else if (t < gates.pauseBelow) pausedColdDays++;
    else if (t <= gates.pauseAbove) {
      activeDays++;
      // First wake event: was dormant, now warm enough to leave
      if (inDormancy && t >= gates.wakeAbove && firstWakeDay === null) {
        firstWakeDay = i + 1;
      }
      if (t >= gates.wakeAbove) inDormancy = false;
    }
    else if (t < gates.resetAbove) pausedHotDays++;
    else { resetDays++; }
  }

  // Will the climate ever wake the bush?
  const peakAvgTemp = Math.max(...climate.map(c => c.avg));
  const couldWake = peakAvgTemp >= gates.wakeAbove;

  // After first wake, how many full 2.5-month cycles fit in the
  // remaining active days? RECYCLE_MONTHS × dpm = days per cycle.
  const dpm = Math.round(climate.length / 12); // 9 for 108-day year
  const daysPerCycle = RECYCLE_MONTHS * dpm;
  let estimatedHarvestsPerYear = 0;
  if (firstWakeDay !== null) {
    // Active days from first wake to year end
    const remainingActive = climate.slice(firstWakeDay - 1)
      .filter(c => c.avg >= gates.pauseBelow && c.avg <= gates.pauseAbove).length;
    estimatedHarvestsPerYear = Math.floor(remainingActive / daysPerCycle);
  }

  return {
    couldWake,
    peakAvgTemp,
    firstWakeDay,
    activeDays,
    dormantDays,
    pausedColdDays,
    pausedHotDays,
    resetDays,
    estimatedHarvestsPerYear,
    daysPerCycle,
  };
}

// Apply class drop-rate buff to per-harvest yield. The buff only
// applies to bushes whose block has forageStatAffected: true. The
// game source confirms wild bushes use this; whether cultivated do
// depends on the cultivated blocktype JSON, which often differs.
// Conservative default: don't apply to cultivated; user can flip
// the includeCultivated flag if their server confirms.
export function berryClassYieldMul(forageDropRate, includeCultivated = false) {
  if (!includeCultivated) return 1.0;
  return forageDropRate || 1.0;
}

// Core mechanics from vssurvivalmod source (BlockEntityFastForwardGrowth, BESoilNutrition).
// All formulas follow the C# code exactly; not the wiki.

import { GAME } from '../data/game.js';
import { TICKS_PER_DAY } from '../data/climate.js';

// Per-tick probability of growth/regen progressing (BlockEntityFastForwardGrowth.cs).
// growthChance = 1 + (T - 10) * 0.1, clamped to [0, 1]
// Below 0C: 0, at 10C+: 1.0, linear in between.
export function growthChance(temp) {
  return Math.max(0, Math.min(1, 1 + (temp - 10) * 0.1));
}

// Daily-average growth chance under a sinusoidal hourly temperature curve.
// The game samples temperature per tick (every 3-4 hours), so a day with
// avg=5C but min=-2 max=12 has many warm ticks at full speed and a few cold
// ticks paused. Using growthChance(avg) alone underweights warm-hour throughput
// when there's diurnal swing. This integrates growthChance over 24 hours of
// a cosine peaking at 4 PM, troughing at 4 AM.
//
// Pass a climate entry like {avg, min, max}. If min == max (no swing recorded),
// falls back to growthChance(avg).
export function dailyGrowthChance(climateEntry) {
  const dMin = climateEntry?.min ?? climateEntry?.avg ?? 10;
  const dMax = climateEntry?.max ?? climateEntry?.avg ?? 10;
  const dAvg = climateEntry?.avg ?? 10;
  if (dMin >= 10) return 1.0;
  if (dMax <= 0) return 0;
  if (dMax === dMin) return growthChance(dAvg);
  const amp = (dMax - dMin) / 2;
  const cAvg = (dMin + dMax) / 2;
  let sum = 0;
  for (let h = 0; h < 24; h++) {
    const T = cAvg + amp * Math.cos(2 * Math.PI * (h - 16) / 24);
    sum += growthChance(T);
  }
  return sum / 24;
}

// Moisture-driven growth factor. Direct port of BESoilNutrition.GetGrowthRate's
// moistFactor: (m*100/70 - 0.143)^0.35, with a 0.01 floor inside the power so it
// never returns NaN at zero moisture.
//   m = 0.10 -> ~0.18    (BEFarmland.cs:79 also blocks growth entirely below 0.1)
//   m = 0.30 -> ~0.64
//   m = 0.50 -> ~0.83
//   m = 0.70 -> ~0.95
//   m = 1.00 -> ~1.09
export function gameMoistFactor(m) {
  return Math.pow(Math.max(0.01, m * 100 / 70 - 0.143), 0.35);
}

// Rainfall buckets. Keys match what's stored in settings. `wgen` is the
// WorldgenRainfall midpoint of the bucket from
// vsessentialsmod/Systems/CharacterExtraDialogs.cs:131-156. Used for display.
export const RAINFALL_BUCKETS = {
  very_rare:     { wgen: 0.075 },
  rarely:        { wgen: 0.225 },
  uncommon:      { wgen: 0.375 },
  common:        { wgen: 0.575 },
  very_common:   { wgen: 0.80  },
  almost_always: { wgen: 0.95  },
};

// Steady-state grow-rate multiplier as a {min, expected, max} range.
// Indexed by [waterDistance][rainfallKey]. Numbers come from a 200k-hour
// Monte Carlo of the game's pipeline:
//   precip pipeline: vsessentialsmod/Systems/Weather/WeatherSystemBase.cs:151-205
//   moisture math:   vssurvivalmod/BlockEntity/BESoilNutrition.cs:231-271
//   moistFactor:     BESoilNutrition.cs:404 (m*100/70 - 0.143)^0.35
// Each hour: moisture decays 1/96, gains precipitation/3 if sky-exposed,
// floored at minMoisture = clamp(1 - waterDistance/4, 0, 1).
//
// "min" and "max" are the 10th and 90th percentile factors over the year, so
// they reflect realistic unlucky/lucky stretches rather than extreme outliers.
// "expected" is the mean.
//
// waterDistance is Chebyshev distance (max(|dx|, |dz|)) from BESoilNutrition.cs:169.
// Touching a water block in any of the 8 horizontal slots = distance 1, NOT 0.
// Distance 0 is impossible (would mean the farmland and water share a position).
//   1 = touching water (minMoisture = 0.75, factor floors at 0.97)
//   2 = 1 block away (minMoisture = 0.50, factor floors at 0.82)
//   3 = 2 blocks away (minMoisture = 0.25, factor floors at 0.58)
//   4 = 3+ blocks away (minMoisture = 0, fully rainfall-dependent)
export const RAINFALL_RANGES = {
  1: {
    very_rare:     { min: 0.97, expected: 0.97, max: 0.97 },
    rarely:        { min: 0.97, expected: 0.98, max: 0.98 },
    uncommon:      { min: 0.97, expected: 0.99, max: 1.03 },
    common:        { min: 0.99, expected: 1.05, max: 1.09 },
    very_common:   { min: 1.07, expected: 1.08, max: 1.09 },
    almost_always: { min: 1.08, expected: 1.09, max: 1.09 },
  },
  2: {
    very_rare:     { min: 0.82, expected: 0.82, max: 0.82 },
    rarely:        { min: 0.82, expected: 0.82, max: 0.82 },
    uncommon:      { min: 0.82, expected: 0.84, max: 0.90 },
    common:        { min: 0.97, expected: 1.04, max: 1.09 },
    very_common:   { min: 1.07, expected: 1.08, max: 1.09 },
    almost_always: { min: 1.08, expected: 1.09, max: 1.09 },
  },
  3: {
    very_rare:     { min: 0.58, expected: 0.58, max: 0.58 },
    rarely:        { min: 0.58, expected: 0.59, max: 0.59 },
    uncommon:      { min: 0.58, expected: 0.62, max: 0.71 },
    common:        { min: 0.96, expected: 1.04, max: 1.09 },
    very_common:   { min: 1.07, expected: 1.08, max: 1.09 },
    almost_always: { min: 1.08, expected: 1.09, max: 1.09 },
  },
  4: {
    very_rare:     { min: 0.00, expected: 0.00, max: 0.00 },
    rarely:        { min: 0.00, expected: 0.00, max: 0.00 },
    uncommon:      { min: 0.00, expected: 0.05, max: 0.25 },
    common:        { min: 0.96, expected: 1.04, max: 1.09 },
    very_common:   { min: 1.07, expected: 1.08, max: 1.09 },
    almost_always: { min: 1.08, expected: 1.09, max: 1.09 },
  },
};

// Snap a numeric distance to the supported tiers. Anything 4+ collapses to 4
// (no moisture floor at all, fully rainfall-dependent).
export function snapWaterDistance(d) {
  const n = Number.isFinite(d) ? Math.round(d) : 1;
  if (n <= 1) return 1;
  if (n >= 4) return 4;
  return n;
}

// Effective grow-rate range from rainfall + waterDistance + greenhouse.
// Greenhouses block sky exposure (no rain reaches the soil), but assume an
// internal water source, so we treat them as waterDistance = 1 with a flat range.
export function rainfallGrowRange(rainfallKey, waterDistance, greenhouse = false) {
  if (greenhouse) {
    const f = 0.97;
    return { min: f, expected: f, max: f };
  }
  const tier = snapWaterDistance(waterDistance ?? 1);
  const byBucket = RAINFALL_RANGES[tier] || RAINFALL_RANGES[1];
  return byBucket[rainfallKey] || byBucket.common;
}

// Single-value version for the score. Returns the expected (mean) factor.
export function rainfallGrowFactor(rainfallKey, greenhouse = false, waterDistance = 1) {
  return rainfallGrowRange(rainfallKey, waterDistance, greenhouse).expected;
}

// Light-driven grow-rate multiplier. Direct port of BlockEntityFastForwardGrowth.cs:88-89:
//   lightpenalty = max(0, seaLevel - cropY)   // only when underground gate is OFF
//   sunlight = MaxLight if gate ON, else OnlySunLight
//   factor = clamp(1 - (19 - (sunlight - lightpenalty)) * 0.1, 0, 1)
// Defaults from FarmingConfig (ModSystemFarming.cs:17-18):
//   DelayGrowthBelowSunLight = 19, LossPerLevel = 0.1.
//
// Inputs from the UI:
//   underground: is the crop in a roofed/buried location (no sunlight)
//   lightLevel: the actual light at the crop block (0-32). Outdoor noon = 22.
//   depthBelowSea: blocks below sea level (only matters when underground gate off).
//   allowUnderground: the world config flag.
//
// Returns 0 when the gate blocks growth (underground + flag off + no sunlight).
export function lightGrowthFactor({ underground = false, lightLevel = 22, depthBelowSea = 0, allowUnderground = false } = {}) {
  let sunlight, penalty;
  if (underground) {
    if (!allowUnderground) return 0; // gated, no growth
    sunlight = lightLevel; // MaxLight (torches, lanterns count)
    penalty = 0;
  } else {
    sunlight = lightLevel; // OnlySunLight; default 22 for noon outdoor
    penalty = Math.max(0, depthBelowSea);
  }
  const factor = 1 - (19 - (sunlight - penalty)) * 0.1;
  return Math.max(0, Math.min(1, factor));
}

// Nutrient growth factor. The step function from BESoilNutrition.GetGrowthRate.
// `n` is the effective nutrient level (current or projected average).
// `moistF` is the moisture factor; baseline 1.0 if plot has water.
export function nutrientFactor(n, moistF = 1.0) {
  if (moistF === 0) return 0.1;
  if (n > 75) return 1.10;
  if (n > 50) return 1.00;
  if (n > 35) return 0.90;
  if (n > 20) return 0.60;
  if (n > 5)  return 0.30;
  return 0.10;
}

// Hours per 24h day spent below a temperature threshold, given the day's
// daily min and max. Models intra-day temperature as a sinusoid peaking at
// 4 PM and bottoming at 4 AM, a much better approximation than the prior
// "did temp ever cross threshold" boolean.
//
//   T(h) = avg + amp * cos(2π * (h - 16) / 24)    where amp = (max-min)/2
//
// Closed form: hours below cold = 24 * (1 - acos((cold - avg)/amp) / π)
// (clamped to [0, 24] for the degenerate min==max and out-of-range cases.)
export function hoursBelow(dayMin, dayMax, threshold) {
  if (dayMax <= threshold) return 24;       // entire day at or below threshold
  if (dayMin >= threshold) return 0;        // entire day above threshold
  const amp = (dayMax - dayMin) / 2;
  if (amp <= 0) return dayMin < threshold ? 24 : 0;
  const avg = (dayMin + dayMax) / 2;
  const k = (threshold - avg) / amp;        // expected to be in (-1, 1) here
  if (k <= -1) return 0;
  if (k >= 1) return 24;
  return 24 * (1 - Math.acos(k) / Math.PI);
}

// Symmetric helper for hours above a heat threshold.
export function hoursAbove(dayMin, dayMax, threshold) {
  if (dayMin >= threshold) return 24;
  if (dayMax <= threshold) return 0;
  const amp = (dayMax - dayMin) / 2;
  if (amp <= 0) return dayMax > threshold ? 24 : 0;
  const avg = (dayMin + dayMax) / 2;
  const k = (threshold - avg) / amp;
  if (k <= -1) return 24;
  if (k >= 1) return 0;
  return 24 * Math.acos(k) / Math.PI;
}

// Walk the crop's grow window day-by-day and simulate the game's leaky-bucket
// damage accumulator (BEFarmland.cs:108-160).
//
// Per-day evolution:
//   bucket += hoursBelowCold        (every hour below cold = +1 to bucket)
//   bucket -= (24 - hoursBelowCold) / 10   (good hours leak the bucket 10x slower)
//   bucket = max(0, bucket)
//   if bucket > 48: crop dies
//
// IMPORTANT: callers must pass an already-greenhouse-shifted climate when
// greenhouse mode is on. The `greenhouse` parameter is informational only
// (used for return shape and downstream logic); it does NOT add a temperature
// offset, since callers already pre-bump climate temps by +5.
//
// Returns: { willDie, peakDamage, daysAtRisk, flagged, deathDay }.
//   willDie    : bucket ever crossed 48 → crop is dead, zero drops
//   flagged    : bucket ever > 0 → game sets the damage flag → drops × stuntMul
//   peakDamage : highest bucket value reached during grow
//   daysAtRisk : count of days where temp dipped below cold (or above heat)
//   deathDay   : day-of-year the crop died, or null
export function simulateCropDamage(crop, plantDay, growDays, climate, greenhouse = false) {
  const cold = crop.cold ?? GAME.defaultCold;
  const heat = (crop.heat === undefined || crop.heat >= 9999) ? GAME.defaultHeat : crop.heat;
  if (!climate || climate.length === 0) {
    return { willDie: false, peakDamage: 0, daysAtRisk: 0, flagged: false, deathDay: null, cold, heat };
  }
  let coldBucket = 0, heatBucket = 0;
  let peakCold = 0, peakHeat = 0;
  let daysAtRisk = 0;
  let flagged = false;
  let willDie = false;
  let deathDay = null;
  const yearLen = climate.length;
  const totalDays = Math.ceil(growDays);
  for (let i = 0; i < totalDays; i++) {
    const day = plantDay + i;
    const idx = ((Math.floor(day) - 1) % yearLen + yearLen) % yearLen;
    const c = climate[idx];
    const dMin = c.min;
    const dMax = c.max;
    const hBelow = hoursBelow(dMin, dMax, cold);
    const hAbove = hoursAbove(dMin, dMax, heat);
    if (hBelow > 0 || hAbove > 0) { daysAtRisk++; flagged = true; }
    coldBucket = Math.max(0, coldBucket + hBelow - (24 - hBelow) / 10);
    heatBucket = Math.max(0, heatBucket + hAbove - (24 - hAbove) / 10);
    peakCold = Math.max(peakCold, coldBucket);
    peakHeat = Math.max(peakHeat, heatBucket);
    if (!willDie && (coldBucket > 48 || heatBucket > 48)) {
      willDie = true;
      deathDay = day;
    }
  }
  return {
    willDie,
    peakDamage: Math.max(peakCold, peakHeat),
    peakCold,
    peakHeat,
    daysAtRisk,
    flagged,
    deathDay,
    cold,
    heat,
  };
}

// Damage analysis given a temperature window.
// Returns { coldDamage, heatDamage, riskLevel, willDie, ... } where riskLevel is
// 'ok' / 'risk' / 'severe' / 'fatal' based on the leaky-bucket simulation.
//
// If `climate + plantDay + growDays` are passed, runs the full per-day
// simulation. Otherwise falls back to the old window-based heuristic for
// backwards compatibility (tests, abstract analysis).
export function damageRisk(crop, windowMin, windowMax, opts = {}) {
  const cold = crop.cold ?? GAME.defaultCold;
  const heat = (crop.heat === undefined || crop.heat >= 9999) ? GAME.defaultHeat : crop.heat;

  // If we have a climate context, run the proper per-day leaky-bucket sim.
  // damageRisk owns the greenhouse shift: if greenhouse=true and the climate
  // looks unshifted (caller passed raw climate), bump it +5 here. Callers
  // who pre-shifted climateForSim should pass greenhouse=false to avoid a
  // double shift. simulateCropDamage itself does NO shifting.
  if (opts.climate && opts.plantDay != null && opts.growDays != null) {
    const climateForSim = opts.greenhouse
      ? opts.climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
      : opts.climate;
    const sim = simulateCropDamage(crop, opts.plantDay, opts.growDays, climateForSim);
    let level = 'ok';
    if (sim.willDie) level = 'fatal';
    else if (sim.peakDamage > 24) level = 'severe';
    else if (sim.flagged) level = 'risk';
    return {
      coldDamage: Math.max(0, cold - windowMin),  // kept for back-compat display
      heatDamage: Math.max(0, windowMax - heat),
      riskLevel: level,
      willDie: sim.willDie,
      peakDamage: sim.peakDamage,
      daysAtRisk: sim.daysAtRisk,
      flagged: sim.flagged,
      deathDay: sim.deathDay,
      cold, heat,
    };
  }

  // Fallback: window-only heuristic (no climate context).
  let coldDamage = 0, heatDamage = 0;
  if (windowMin < cold) coldDamage = cold - windowMin;
  if (windowMax > heat) heatDamage = windowMax - heat;
  let level = 'ok';
  if (coldDamage > 5 || heatDamage > 5) level = 'severe';
  else if (coldDamage > 0 || heatDamage > 0) level = 'risk';
  return { coldDamage, heatDamage, riskLevel: level, willDie: false, flagged: coldDamage > 0 || heatDamage > 0, cold, heat };
}

// Yield multiplier from damage risk + crop's stuntMul.
//   fatal  → 0.0  (crop died; no drops)
//   risk/severe → stuntMul (default 0.5; rye/carrot/parsnip/etc 0.75)
//   ok     → 1.0
export function damageMultiplier(crop, risk) {
  if (risk.willDie || risk.riskLevel === 'fatal') return 0.0;
  if (risk.riskLevel === 'ok') return 1.0;
  return crop.stuntMul ?? GAME.defaultStuntMul;
}

// Frost-safety factor for the score formula.
// Compares harvest day to season-end (last day above freezing).
// 1.0 if harvest comfortably before season end, 0.6 if barely, 0 if won't finish.
export function frostSafety(plantDay, growDays, seasonEndDay, greenhouse = false) {
  if (greenhouse) return 1.0;
  const harvestDay = plantDay + growDays;
  if (harvestDay > seasonEndDay) return 0;
  if (harvestDay > seasonEndDay - 5) return 0.6; // barely finishes
  return 1.0;
}

// Compute drain per stage (consumption / (stages - 1) since drain happens at transitions).
export function stageDrain(crop) {
  return crop.cons / Math.max(1, crop.stages - 1);
}

// Total ticks for a full crop cycle.
export function cycleTicks(growDays) {
  return growDays * TICKS_PER_DAY;
}

// Slow-release pool drip behavior over a given number of ticks.
// Each tick: up to 0.25 from pool flows to nutrients[].
// Returns the total amount that the pool can release over `ticks` ticks
// (capped by pool size and by what fits in the 100-cap of nutrients[]).
export function poolReleaseOverTicks(poolSize, ticks) {
  return Math.min(poolSize, GAME.slowReleasePerTick * ticks);
}

// Effective average nutrient level during a crop's growth window.
// Inputs:
//   currentN: starting nutrient level (post-harvest, before any new fertilizing)
//   poolN:    slow-release pool for this axis (0-150)
//   crop:     the crop (used for cons + grow window)
//   growDays: full grow days for this crop
// Approximates: drain happens linearly, regen + slow-release fill happens linearly.
// Computes: end = max(0, current - (consumption - poolRelease))
// Returns: average over window = (current + end) / 2
export function averageEffectiveNutrient(currentN, poolN, crop, growDays) {
  const totalTicks = cycleTicks(growDays);
  const release = poolReleaseOverTicks(poolN, totalTicks);
  const netDrain = Math.max(0, crop.cons - release);
  const endN = Math.max(0, currentN - netDrain);
  return {
    start: currentN,
    end: endN,
    avg: (currentN + endN) / 2,
    poolRelease: release,
    netDrain,
  };
}

// Compute a {min, expected, max} range of effective grow days. Same stage-by-stage
// sim as effectiveGrowDays, run three times with different growSpeedMul values.
// Caller passes the moisture range from rainfallGrowRange and the lightF.
//
// "min" days = best-case fast harvest = baseDays / (best growSpeed) (lucky rain)
// "max" days = worst-case slow harvest = baseDays / (worst growSpeed) (unlucky rain)
//
// If plantDay + climate are passed, the sim accounts for daily temperature
// growth chance (autumn cooling stretches the tail of late-summer plantings).
//
// Returns Infinity for any range bound that stalls.
export function harvestDayRange(crop, baseGrowDays, startingNutrient, startingPool = 0, moistRange = { min: 1, expected: 1, max: 1 }, lightF = 1.0, plantDay = null, climate = null) {
  const fastSim = effectiveGrowDays(crop, baseGrowDays, startingNutrient, startingPool, moistRange.max * lightF, plantDay, climate);
  const expSim  = effectiveGrowDays(crop, baseGrowDays, startingNutrient, startingPool, moistRange.expected * lightF, plantDay, climate);
  const slowSim = effectiveGrowDays(crop, baseGrowDays, startingNutrient, startingPool, moistRange.min * lightF, plantDay, climate);
  // Per-stage random (game: stageHours *= 0.9 + 0.2 * rand). Each of the
  // (stages-1) transitions has uniform [0.9, 1.1]. Sum is approximately
  // normal: mean = 1.0 × baseline, std = sqrt((stages-1) × 0.0033) × baseline.
  // Typical 95% range = ±2σ ≈ ±0.115 × baseline / sqrt(stages-1) for the
  // average per-stage roll. This widens the moistF range to capture the
  // game's per-stage stochastic component.
  const stagesN = Math.max(2, crop.stages || 7);
  const transitions = stagesN - 1;
  // 95% range from per-stage random alone, as a multiplier on grow time
  const sigma = Math.sqrt(transitions * (0.2 * 0.2) / 12) / transitions;
  const randomRangeMul = 1.96 * sigma; // ~2σ
  const randomLow = 1 - randomRangeMul;   // ~0.94 for 8 stages
  const randomHigh = 1 + randomRangeMul;
  return {
    min: fastSim.stalled ? Infinity : fastSim.effectiveDays * randomLow,
    expected: expSim.stalled ? Infinity : expSim.effectiveDays,
    max: slowSim.stalled ? Infinity : slowSim.effectiveDays * randomHigh,
    stalled: expSim.stalled,
    endNutrient: expSim.endNutrient,
    endPool: expSim.endPool,
    perStageVariance: randomRangeMul,
  };
}

// Effective grow time given starting nutrients, slow-release pool, and a
// moisture-driven grow-rate multiplier. Stage-by-stage simulation matching
// the game's GetGrowthRate: each stage takes baseDaysPerStage / (nf * moistF).
// Slow-release drips from pool into nutrients across the stage duration.
//
// If `plantDay` and `climate` are provided, the simulation also walks
// day-by-day and applies the temperature growthChance from
// BlockEntityFastForwardGrowth.cs:
//   growthChance = clamp(1 + (T - 10) * 0.1, 0, 1)
// This catches late-summer plantings whose tail falls into autumn cooling
// and stretches well past their nominal grow time.
//
// Returns { effectiveDays, stalled, endNutrient, endPool, hitYearWall? }
export function effectiveGrowDays(
  crop,
  baseGrowDays,
  startingNutrient,
  startingPool = 0,
  moistF = 1.0,
  plantDay = null,
  climate = null,
) {
  const stagesN = Math.max(2, crop.stages || 7);
  const baseDaysPerStage = baseGrowDays / (stagesN - 1);
  const drainPerStage = crop.cons / (stagesN - 1);

  // If moisture is at zero, the plot can't grow at all.
  if (moistF <= 0) {
    return { effectiveDays: Infinity, stalled: true, endNutrient: startingNutrient, endPool: startingPool };
  }

  // Closed-form path (no climate context). Same as before.
  if (plantDay == null || !Array.isArray(climate) || climate.length === 0) {
    let nutrient = startingNutrient;
    let pool = startingPool;
    let totalDays = 0;
    let stalled = false;
    const NUTRIENT_CAP_WITH_POOL = 100;

    for (let s = 0; s < stagesN - 1; s++) {
      // Drip pool BEFORE computing nutrient factor so this stage sees the
      // boosted nutrient level. The estimated stage time guides drip
      // duration; without it, pool would only contribute at transitions.
      const nfPre = nutrientFactor(nutrient);
      const combinedPre = nfPre * moistF;
      if (combinedPre < 0.05 && pool === 0) { stalled = true; break; }
      const stageDaysEst = combinedPre > 0 ? baseDaysPerStage / combinedPre : 0;
      if (pool > 0 && stageDaysEst > 0) {
        const dripTicks = stageDaysEst * TICKS_PER_DAY;
        const drip = Math.min(pool, GAME.slowReleasePerTick * dripTicks);
        pool = Math.max(0, pool - drip);
        nutrient = Math.min(NUTRIENT_CAP_WITH_POOL, nutrient + drip);
      }

      // Now compute the actual stage time using the (possibly boosted)
      // nutrient level. Re-evaluate factor since pool drip raised nutrient.
      const nf = nutrientFactor(nutrient);
      const combined = nf * moistF;
      if (combined < 0.05) {
        stalled = true;
        break;
      }
      const stageDays = baseDaysPerStage / combined;
      totalDays += stageDays;

      // Drain at stage transition.
      nutrient = Math.max(0, nutrient - drainPerStage);
    }

    return {
      effectiveDays: stalled ? Infinity : totalDays,
      stalled,
      endNutrient: nutrient,
      endPool: pool,
    };
  }

  // Climate-aware path. Walk day-by-day, accumulating per-stage progress
  // weighted by daily growthChance from temperature. Bail if we cross a
  // safety wall (e.g., a full game year past plant) without finishing.
  const yearLen = climate.length;
  const SAFETY_DAYS = Math.min(365, yearLen * 2);

  let nutrient = startingNutrient;
  let pool = startingPool;
  let stage = 0;            // stage index, 0..stagesN-2
  let stageProgress = 0;    // days of progress accumulated in this stage
  let stageDaysSpent = 0;   // for slow-release dripping
  let totalDays = 0;
  let stalled = false;

  while (stage < stagesN - 1) {
    if (totalDays >= SAFETY_DAYS) {
      // Crop didn't finish within a year. Treat as stalled (won't finish).
      stalled = true;
      break;
    }

    const day = plantDay + Math.floor(totalDays);
    const climateIdx = ((day - 1) % yearLen + yearLen) % yearLen;
    const c = climate[climateIdx];
    // Daily growth chance, integrated over a sinusoidal hourly temperature
    // curve. See dailyGrowthChance for why this is needed instead of
    // growthChance(c.avg) alone.
    const gc = dailyGrowthChance(c);

    // Pool drip happens every tick, raising nutrient toward the 100 cap.
    // Apply BEFORE computing nutrient factor so this stage sees the updated
    // level. Without daily drip, fertilizer pool would only raise nutrient
    // at stage transition, missing the bulk of the drip benefit.
    const NUTRIENT_CAP_WITH_POOL = 100;
    if (pool > 0) {
      // pre-stage drip (full day's drip from yesterday's pool)
      const dailyDrip = Math.min(pool, GAME.slowReleasePerTick * TICKS_PER_DAY);
      pool = Math.max(0, pool - dailyDrip);
      nutrient = Math.min(NUTRIENT_CAP_WITH_POOL, nutrient + dailyDrip);
    }

    const nf = nutrientFactor(nutrient);
    const dailyRate = gc * nf * moistF;

    if (dailyRate < 0.001 && totalDays > yearLen) {
      // Indefinitely stalled (e.g., crop sitting in winter forever)
      stalled = true;
      break;
    }

    if (dailyRate <= 0) {
      // Day is paused (cold). Spend the day with no progress.
      totalDays += 1;
      continue;
    }

    // How many days of this stage are remaining (in baseline-rate days)?
    const stageRemaining = baseDaysPerStage - stageProgress;
    // How many real days will it take at today's rate to consume that remainder?
    const daysToFinishStage = stageRemaining / dailyRate;

    // We move forward by at most 1 day at a time so the temperature can
    // change between days. If today's rate would finish the stage in less
    // than a day, advance the partial day and transition.
    if (daysToFinishStage <= 1.0) {
      const partialDay = daysToFinishStage;
      totalDays += partialDay;
      stageDaysSpent += partialDay;

      // Stage transition: drain nutrient. Pool drip already applied above.
      nutrient = Math.max(0, nutrient - drainPerStage);
      stage++;
      stageProgress = 0;
      stageDaysSpent = 0;
    } else {
      // Move forward exactly one day. Pool drip already applied above;
      // nutrient stays where it is until stage transition.
      stageProgress += dailyRate;
      totalDays += 1;
      stageDaysSpent += 1;
    }
  }

  return {
    effectiveDays: stalled ? Infinity : totalDays,
    stalled,
    endNutrient: nutrient,
    endPool: pool,
  };
}

// Soil nutrient recovery simulator. Source: BESoilNutrition.cs +
// BlockEntityFastForwardGrowth.cs.
//
// Mechanics:
// - fertilityRecoverySpeed = 0.25 per axis per ~3.5h tick (~6.857 ticks/day)
// - When EMPTY (no crop): all 3 axes regen at 0.25/tick → ~1.71/day at full rate
// - When GROWING (crop on tile): the crop's consumed axis regens 3x slower
//   (~0.57/day at full rate). Other axes regen normally.
// - When RIPE crop sits on tile: regen STOPS entirely on all axes
// - Capped at originalFertility (Medium=50, High=65, Terra Preta=80, etc)
//
// Per-tick growth-pause check (BlockEntityFastForwardGrowth.cs):
//   growthChance = 1 + (T - delayGrowthBelowTemperature) * lossPerDegree
// Default constants (ModSystemFarming.Config): delay=10°C, lossPerDegree=0.1.
//   T ≥ 10°C: 1.0 (full rate)
//   T = 5°C:  0.5 (half rate on average .  50% of ticks pause)
//   T = 0°C:  0.0 (always paused)
// Game does `growthPaused = rand() > growthChance` per tick. We approximate
// the expected daily rate as growthChance × full daily rate.
//
// Returns array of { day, n, p, k, paused, slow, capped, growthChance } per
// day. `paused` = no regen at all; `slow` = 0 < growthChance < 1.
export function simulateNutrientRecovery({
  startN, startP, startK,
  cap,                         // soil tier max (5/25/50/65/80)
  tileState,                   // 'empty' | 'growing' | 'ripe'
  growingNutrient = null,      // 'N' | 'P' | 'K' (when tileState='growing')
  climate,                     // array of {avg, ...} (one per game day)
  startDay = 1,                // game day to start (1-indexed)
  daysToSimulate = 240,
}) {
  if (!climate || climate.length === 0) return [];

  const HOURS_PER_DAY = 24;
  const HOURS_PER_TICK = 3.5;
  const TICKS_PER_DAY = HOURS_PER_DAY / HOURS_PER_TICK;  // ≈ 6.857
  const RECOVERY_PER_TICK = 0.25;
  const DELAY_GROWTH_BELOW_TEMP = 10;
  const LOSS_PER_DEGREE = 0.1;

  // Per-tick regen by axis given tile state (before temperature scaling)
  const regen = { N: RECOVERY_PER_TICK, P: RECOVERY_PER_TICK, K: RECOVERY_PER_TICK };
  if (tileState === 'ripe') {
    regen.N = 0; regen.P = 0; regen.K = 0;  // Rule 2
  } else if (tileState === 'growing' && growingNutrient) {
    regen[growingNutrient] = RECOVERY_PER_TICK / 3;  // Rule 3
  }

  // Per-day full-rate regen. Multiplied by growthChance per day.
  const fullDailyN = regen.N * TICKS_PER_DAY;
  const fullDailyP = regen.P * TICKS_PER_DAY;
  const fullDailyK = regen.K * TICKS_PER_DAY;

  let n = Math.min(cap, startN);
  let p = Math.min(cap, startP);
  let k = Math.min(cap, startK);

  const out = [];
  for (let i = 0; i < daysToSimulate; i++) {
    const day = startDay + i;
    const climateIdx = ((day - 1) % climate.length + climate.length) % climate.length;
    const c = climate[climateIdx];
    // Same sinusoidal-hourly integration as effectiveGrowDays. The game's
    // updateSoilFertility is gated on the same per-tick growthPaused dice
    // roll as crop growth, so recovery should use the same curve.
    const growthChanceDaily = dailyGrowthChance(c);

    if (growthChanceDaily > 0) {
      n = Math.min(cap, n + fullDailyN * growthChanceDaily);
      p = Math.min(cap, p + fullDailyP * growthChanceDaily);
      k = Math.min(cap, k + fullDailyK * growthChanceDaily);
    }

    const paused = growthChanceDaily <= 0;
    const slow = growthChanceDaily > 0 && growthChanceDaily < 1;
    const capped = (n >= cap - 0.01 && p >= cap - 0.01 && k >= cap - 0.01);
    out.push({
      day,
      n: +n.toFixed(2),
      p: +p.toFixed(2),
      k: +k.toFixed(2),
      paused, slow, capped, growthChance: growthChanceDaily,
    });
  }
  return out;
}

// Latest day-of-year you can plant a crop and still ripen before first frost.
// Walks backward looking for the first day where the crop's effective grow
// time (computed at that plant day) finishes in time. Climate-aware: takes
// seasonal cooling into account for slow crops planted late summer.
//
// Outdoor: harvest must finish before seasonEndDay (frost cutoff).
// Greenhouse: no frost cutoff (heated year-round). Walk the full climate
// array; the only failure mode is `effectiveGrowDays.stalled` if temps
// indoors still drop below growth threshold.
export function latestPlantDay({ crop, baseGrowDays, soilTier, seasonStartDay, seasonEndDay, climate, greenhouse = false, cropGrowthRateMul = 1.0, moistF = 1.0, lightF = 1.0 }) {
  const adjustedBase = baseGrowDays / cropGrowthRateMul;
  const climateForSim = greenhouse
    ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : climate;
  const yearLen = climate?.length ?? 0;
  // Greenhouse walks the full year; outdoor walks only the frost-free season.
  const walkFrom = greenhouse ? yearLen : seasonEndDay - 1;
  const walkTo = greenhouse ? 1 : seasonStartDay;
  for (let day = walkFrom; day >= walkTo; day--) {
    const sim = effectiveGrowDays(crop, adjustedBase, soilTier, 0, moistF * lightF, day, climateForSim);
    if (sim.stalled) continue;
    const harvestDay = day + sim.effectiveDays;
    // Outdoor: harvest must finish before frost. Greenhouse: no cutoff.
    if (!greenhouse && harvestDay > seasonEndDay) continue;
    // Reject days where the crop would die mid-grow per the leaky-bucket
    // damage sim. Without this, tender crops (rice, pineapple) in temperate
    // climates would falsely show a viable "plant by" date.
    const dmg = simulateCropDamage(crop, day, sim.effectiveDays, climate, greenhouse);
    if (dmg.willDie) continue;
    return {
      day,
      harvestDay: Math.round(harvestDay),
      effectiveGrowDays: sim.effectiveDays,
    };
  }
  return null;
}

// Decision Helper scoring engine.
// Mirrors the spreadsheet's Decision tab logic exactly.
//
// score = (yield/growDays * 100)
//         * nutrient_factor      (1.10 / 1.00 / 0.90 / 0.60 / 0.30 / 0.10)
//         * frost_safety         (1.0 / 0.6 / 0)
//         * damage_multiplier    (1.0 if no risk, else stuntMul)
//         * rotation_factor      (0.7 / 1.0 / 1.2)
//         * follow_up_factor     (1.3 / 1.1 / 1.0)

import { CROPS_LIST, growDays as cropGrowDays, cropSatiety } from '../data/crops.js';
import { FERTILIZERS, GAME, perkBoost } from '../data/game.js';
import { climateWindow, SEASON_END_DAY, DAYS_PER_MONTH, getCurrentClimate } from '../data/climate.js';
import {
  nutrientFactor, damageRisk, damageMultiplier, frostSafety,
  averageEffectiveNutrient, effectiveGrowDays, harvestDayRange,
  rainfallGrowFactor, rainfallGrowRange, lightGrowthFactor,
} from './mechanics.js';
import { classProduceYieldMul, classFlaxFiberMul, classStat } from '../data/specializedClasses.js';

// Effective slow-release pool given current pool + applied fertilizer.
// poolMax = 150 per axis.
export function effectivePool(currentPoolN, currentPoolP, currentPoolK, fertKey, willFert) {
  const fert = FERTILIZERS[fertKey] || FERTILIZERS.none;
  if (!willFert || fertKey === 'none') {
    return { n: currentPoolN, p: currentPoolP, k: currentPoolK };
  }
  return {
    n: Math.min(GAME.poolMax, currentPoolN + fert.n),
    p: Math.min(GAME.poolMax, currentPoolP + fert.p),
    k: Math.min(GAME.poolMax, currentPoolK + fert.k),
  };
}

// Determine rotation factor. The "previous crop's nutrient axis" is part of input.
// If new crop's required axis differs from prev → 1.2 (good rotation)
// If same as prev → 0.7 (bad)
// If no prev → 1.0
export function rotationFactor(crop, prevNutrient) {
  if (!prevNutrient || prevNutrient === '') return 1.0;
  if (crop.nutrient === prevNutrient) return 0.7;
  return 1.2;
}

// Follow-up factor: does another crop fit before season ends?
// 1.3 if fast follow-up (≥7 days left after harvest), 1.1 if any margin, 1.0 otherwise
export function followUpFactor(plantDay, growDays, seasonEndDay) {
  const harvest = plantDay + growDays;
  const margin = seasonEndDay - harvest;
  if (margin >= 7) return 1.3;
  if (margin >= 3) return 1.1;
  return 1.0;
}

// Score one crop given the current decision context.
// Returns { score, breakdown, ... } with all the data needed by the UI.
export function scoreCrop({
  crop,
  today,                  // current day-of-year (1..climate.length)
  soilTier,               // numeric, e.g. 65
  greenhouse = false,
  playerClass = 'commoner', // SC mod class. 'commoner' = vanilla.
  satietyMode = 'auto',// raw / processed / meal / bread
  willFert = false,
  fertKey = 'none',
  curN = 65, curP = 65, curK = 65,
  poolN = 0, poolP = 0, poolK = 0,
  prevNutrient = '',
  daysPerMonth = DAYS_PER_MONTH,
  seasonEndDay = SEASON_END_DAY,
  rainfallFrequency = 'common',  // bucket key from settings
  waterDistance = 1,             // per-plot water-source distance: 0 / 1 / 4 (default 1, "within 1 block")
  underground = false,           // per-plot: is the crop in a buried/roofed location
  lightLevel = 22,               // per-plot: light at the crop block (0-32)
  depthBelowSea = 0,             // per-plot: blocks below sea level (only matters when undergroundFlag is off)
  allowUndergroundFarming = false, // world config flag
  cropGrowthRateMul = 1.0,       // worldconfig: flat multiplier on crop growth speed
  // Score weights. Default 1.0 means "use the factor as-is". Higher than 1
  // makes that factor matter more, less than 1 dampens it. A weight of 0
  // turns the factor off entirely (treats it as 1.0 in the product).
  weights = {
    satiety: 1.0,        // how much you value food output per day
    growSpeed: 1.0,      // separate bonus for fast-finishing crops
    frostSafety: 1.0,    // willingness to gamble on a long crop
    rotation: 1.0,       // care about NPK rotation discipline
    followUp: 1.0,       // care about fitting another crop after
    damage: 1.0,         // how heavily cold/heat stunting penalizes
  },
  // Per-food-category multipliers. Default 1.0 = no preference. Bump Protein
  // to 1.5 if you're short on protein and want soybean/peanut to rank higher.
  categoryBoosts = {
    Vegetable: 1.0,
    Fruit: 1.0,
    Grain: 1.0,
    Protein: 1.0,
    Dairy: 1.0,
    Spice: 1.0,
  },
}) {
  const baseGrowDays = cropGrowDays(crop, daysPerMonth, cropGrowthRateMul);

  // Effective pool (current + fertilizer if applying)
  const pool = effectivePool(poolN, poolP, poolK, fertKey, willFert);

  // Per-axis current nutrient
  const currentForAxis = crop.nutrient === 'N' ? curN : crop.nutrient === 'P' ? curP : curK;
  const poolForAxis    = crop.nutrient === 'N' ? pool.n : crop.nutrient === 'P' ? pool.p : pool.k;

  // Moisture range: {min, expected, max} grow-rate multiplier from rainfall +
  // waterDistance + greenhouse. Score uses the expected; the breakdown shows
  // the full range so the player can see the unlucky/lucky stretch.
  const moistRange = rainfallGrowRange(rainfallFrequency, waterDistance, greenhouse);
  const moistF = moistRange.expected;

  // Light/depth grow-rate multiplier from BlockEntityFastForwardGrowth.
  // Outdoor plots default to lightLevel = 22 (full daylight). Greenhouses
  // are assumed sky-exposed (glass roof) so light = full as well.
  const lightF = greenhouse ? 1.0 : lightGrowthFactor({
    underground, lightLevel, depthBelowSea, allowUnderground: allowUndergroundFarming,
  });

  // Combined grow-speed multiplier. The game multiplies these independently,
  // so a low value on either axis (dry biome OR dim light) will slow growth.
  const growSpeedMul = moistF * lightF;

  // Effective grow days: stage-by-stage simulation that accounts for
  // nutrient-driven slowdown plus the combined moisture/light slowdown,
  // PLUS the daily temperature growth chance from the climate (so a planting
  // whose tail falls into autumn cooling correctly stretches past nominal).
  // Greenhouse adds +5C to every day's avg via climateAt; we apply that here
  // by shifting the climate array if greenhouse is on.
  const climateForSim = greenhouse
    ? getCurrentClimate().map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : getCurrentClimate();
  const sim = effectiveGrowDays(crop, baseGrowDays, currentForAxis, poolForAxis, growSpeedMul, today, climateForSim);
  const effGrowDays = sim.stalled ? baseGrowDays * 5 : sim.effectiveDays;
  const harvestDay = Math.round(today + effGrowDays);

  // Harvest day range: simulates lucky/unlucky moisture stretches so the UI can
  // show "harvest between day X and Y" instead of a single point estimate.
  const range = harvestDayRange(crop, baseGrowDays, currentForAxis, poolForAxis, moistRange, lightF, today, climateForSim);
  const harvestRange = {
    minDay: range.stalled ? null : Math.round(today + range.min),
    expectedDay: range.stalled ? null : Math.round(today + range.expected),
    maxDay: range.stalled ? null : Math.round(today + range.max),
    minDays: range.min,
    expectedDays: range.expected,
    maxDays: range.max,
  };

  // Climate window (over the EFFECTIVE growth period)
  const window = climateWindow(today, effGrowDays, greenhouse);

  // Damage risk: full per-day leaky-bucket sim against the climate.
  // Detects fatal cases (>48h accumulated below cold or above heat → death)
  // and "flagged" cases (any below-threshold time → 0.5x drops per game).
  const climateArr = getCurrentClimate();
  const risk = damageRisk(crop, window.min, window.max, {
    climate: climateArr, plantDay: today, growDays: effGrowDays, greenhouse,
  });

  // Frost safety: if effective harvest is after frost, score 0
  const frost = sim.stalled ? 0 : frostSafety(today, effGrowDays, seasonEndDay, greenhouse);

  // Effective average nutrient over the growth window
  const nut = averageEffectiveNutrient(currentForAxis, poolForAxis, crop, baseGrowDays);
  const nutFactor = nutrientFactor(nut.avg);

  // Damage multiplier
  const damMul = damageMultiplier(crop, risk);

  // Rotation factor
  const rotFactor = rotationFactor(crop, prevNutrient);

  // Follow-up factor (uses effective harvest)
  const followUp = sim.stalled ? 1.0 : followUpFactor(today, effGrowDays, seasonEndDay);

  // Class-based produce yield multiplier. 1.0 for Commoner. Farmhand = 1.5x
  // (cropProduceDropRate +0.5). Several classes carry uncultured/overkill,
  // so this can drop below 1.0.
  const classYieldMul = classProduceYieldMul(playerClass, crop);
  const effectiveYield = crop.yield * classYieldMul;

  // Side drops (flax fiber, etc). Each `extra` in crops.js declares a base
  // yield and a stat name to scale by. The fiber is a separate drop from the
  // main grain yield, so it doesn't ride on cropProduceDropRate; flax fiber
  // uses flaxFiberDropRate (Tailor's perk).
  const extras = (crop.extras || []).map(ex => {
    const stat = ex.scaledBy ? classStat(playerClass, ex.scaledBy) : 1;
    return {
      key: ex.key,
      name: ex.name,
      effectiveYield: Math.round(ex.baseYield * stat * 10) / 10,
      perDay: Math.round(((ex.baseYield * stat) / effGrowDays) * 100) / 100,
      scaledBy: ex.scaledBy,
      classMul: stat,
    };
  });

  // Satiety per harvest. Uses the user-selected mode (raw / processed / meal /
  // bread). The score's "value" axis: how much food output per day of plot.
  // Crops with 0 satiety in the chosen mode (grains in raw mode, non-grains
  // in bread mode, licorice always) get a tiny baseline so they're still
  // rankable but always sit at the bottom.
  const satietyPerUnit = cropSatiety(crop, satietyMode);
  const totalSatiety = effectiveYield * satietyPerUnit;
  const baseProductivity = (totalSatiety > 0 ? totalSatiety / effGrowDays : 0.1);

  // Apply user-tunable weights. Each weight is centered at 1.0 (no change).
  // For factors that already sit in roughly [0, 1.3] (frost, damage, rot,
  // followUp), we lerp from 1.0 toward the actual factor by the weight:
  //   weighted = 1 + weight * (factor - 1)
  // So weight=0 disables the factor (always 1.0), weight=1 keeps current
  // behavior, weight=2 doubles its swing.
  const lerp = (factor, w) => 1 + (w ?? 1) * (factor - 1);
  const wSatiety   = Math.max(0, weights?.satiety   ?? 1);
  const wGrowSpeed = Math.max(0, weights?.growSpeed ?? 1);
  const wFrost     = Math.max(0, weights?.frostSafety ?? 1);
  const wRotation  = Math.max(0, weights?.rotation  ?? 1);
  const wFollowUp  = Math.max(0, weights?.followUp  ?? 1);
  const wDamage    = Math.max(0, weights?.damage    ?? 1);

  // Satiety weight scales totalSatiety directly (above/below 1.0 = more/less
  // weight on food output). Power-style scaling so a weight of 0 still
  // produces a non-zero baseline rather than collapsing the score.
  const productivityWeighted = baseProductivity * wSatiety;

  // Grow-speed bonus rewards crops that finish in fewer effective days, on
  // top of the satiety/day calc. Multiplier ranges from ~0.5 (slow crop, big
  // weight) to ~2.0 (fast crop, big weight); weight=1 leaves things flat.
  const speedBonus = wGrowSpeed === 0 ? 1.0 : Math.pow(30 / Math.max(5, effGrowDays), wGrowSpeed - 1) * 1;
  // Note: 30 is the median crop grow time in days at default daysPerMonth. With
  // wGrowSpeed = 1 this collapses to 1.0. wGrowSpeed = 2 gives 30d crops 1.0,
  // 15d crops 2.0, 60d crops 0.5. Most users will leave this alone.

  // Per-category boost. 1.0 by default, lets the user push specific food types.
  const catBoost = (categoryBoosts && categoryBoosts[crop.foodCategory]) ?? 1.0;

  const score = sim.stalled ? 0
    : productivityWeighted
    * lerp(frost,    wFrost)
    * lerp(damMul,   wDamage)
    * lerp(rotFactor, wRotation)
    * lerp(followUp, wFollowUp)
    * speedBonus
    * catBoost;

  // Verdict.
  let verdict = 'ok';
  if (sim.stalled && lightF <= 0) verdict = 'too dark to grow';
  else if (sim.stalled && moistF <= 0) verdict = 'too dry to grow';
  else if (sim.stalled) verdict = 'stalls (nutrients)';
  else if (frost === 0) verdict = "won't finish";
  else if (totalSatiety <= 0) verdict = 'no food value';
  else if (risk.willDie || risk.riskLevel === 'fatal') verdict = 'crop will die';
  else if (risk.riskLevel === 'severe') verdict = 'cold/heat damage';
  else if (risk.riskLevel === 'risk') verdict = 'risky';
  // Note: 'top pick' and 'good' verdicts are now assigned by rankCrops()
  // relative to the best viable score in this context. See rankCrops below.

  return {
    crop,
    score: Math.round(score * 10) / 10,
    growDays: Math.round(effGrowDays * 10) / 10,
    baseGrowDays: Math.round(baseGrowDays * 10) / 10,
    harvestDay,
    harvestRange,
    stalled: sim.stalled,
    window,
    risk,
    frost,
    damMul,
    rotFactor,
    followUp,
    nutFactor,
    moistF,
    moistRange,
    lightF,
    nutrientProjection: nut,
    pool,
    verdict,
    classYieldMul,
    effectiveYield: Math.round(effectiveYield * 10) / 10,
    extras,
    totalSatiety: Math.round(totalSatiety),
    satietyPerDay: Math.round((totalSatiety > 0 ? totalSatiety / effGrowDays : 0) * 10) / 10,
    foodCategory: crop.foodCategory,
    // Drained-axis level at harvest. Used by bestChains to model the soil
    // state the next crop sees: a same-axis follow-up sees this depleted
    // level (slow grow), a different-axis follow-up sees fresh soilTier.
    endDrainedNutrient: sim.stalled ? 0 : Math.max(0, sim.endNutrient ?? 0),
    breakdown: {
      baseProductivity: Math.round(baseProductivity * 10) / 10,
      classYieldMul,
      satietyPerUnit,
      totalSatiety: Math.round(totalSatiety),
      nutFactor,
      moistF: Math.round(moistF * 100) / 100,
      moistMin: Math.round(moistRange.min * 100) / 100,
      moistMax: Math.round(moistRange.max * 100) / 100,
      lightF: Math.round(lightF * 100) / 100,
      frost,
      damMul,
      rotFactor,
      followUp,
    },
  };
}

// Score and rank all 18 crops. Returns array sorted by score descending.
// Verdict 'top pick' / 'good' are relative to the best viable crop in this
// specific context, so the labels stay meaningful regardless of climate or
// weight configuration. A crop within 10% of the best is "top pick"; within
// 50% is "good"; below that is unlabeled (just falls back to 'ok' or its
// own warning verdict like 'cold/heat damage' / 'risky').
export function rankCrops(ctx) {
  const results = CROPS_LIST.map(crop => scoreCrop({ ...ctx, crop }))
    .sort((a, b) => b.score - a.score);

  // Find best score among crops that aren't outright failing (must finish,
  // produce some food, not stalled). 'risky' and 'cold/heat damage' verdicts
  // do count as ranked because their score is already penalized by damageMul.
  const bestViableScore = Math.max(0, ...results
    .filter(r => !r.stalled && r.frost > 0 && r.totalSatiety > 0)
    .map(r => r.score));

  if (bestViableScore > 0) {
    for (const r of results) {
      // Don't overwrite warning verdicts; only relabel the neutral ones.
      if (r.verdict !== 'ok') continue;
      const ratio = r.score / bestViableScore;
      // Labels are RELATIVE to the best viable crop in this specific
      // context. "leading" = within 10% of the top score; "viable" =
      // within 50%. Neither is an endorsement; they're sort buckets.
      if (ratio >= 0.90) r.verdict = 'leading';
      else if (ratio >= 0.50) r.verdict = 'viable';
    }
  }

  return results;
}

// Best follow-up crop chains: try every crop as first, then every crop as second.
// Filter by: rotation must be different axis, second crop must finish by season end.
export function bestChains(ctx, topN = 3) {
  const firstResults = rankCrops(ctx).filter(r => r.frost > 0);
  const chains = [];

  for (const first of firstResults.slice(0, 6)) { // try top-6 firsts
    const harvestDay = first.harvestDay;
    if (harvestDay > ctx.seasonEndDay - 5) continue; // not enough time for follow-up

    // Compute the post-harvest state. The drained axis ends near 0 (or the
    // sim's actual endNutrient if pool was active). Non-drained axes recover
    // toward soilTier passively while the first crop grows. The second crop
    // sees this state, so a follow-up on the SAME axis is correctly penalized
    // (low nutrient → slow grow), while a different-axis follow-up gets a
    // fresh axis. This replaces the old "always reset to curN/P/K" which
    // hid the real penalty for back-to-back same-axis plantings.
    const drainedAxis = first.crop.nutrient;
    const drainedEnd = first.endDrainedNutrient ?? 0;
    const secondCtx = {
      ...ctx,
      today: harvestDay,
      prevNutrient: first.crop.nutrient,
      curN: drainedAxis === 'N' ? drainedEnd : ctx.soilTier,
      curP: drainedAxis === 'P' ? drainedEnd : ctx.soilTier,
      curK: drainedAxis === 'K' ? drainedEnd : ctx.soilTier,
    };
    const seconds = rankCrops(secondCtx).filter(r => r.frost > 0);
    if (seconds.length === 0) {
      chains.push({
        first,
        second: null,
        score: first.score,
        margin: ctx.seasonEndDay - harvestDay,
      });
    } else {
      const best = seconds[0];
      chains.push({
        first,
        second: best,
        score: first.score + best.score,
        margin: ctx.seasonEndDay - (harvestDay + best.growDays),
      });
    }
  }

  return chains.sort((a, b) => b.score - a.score).slice(0, topN);
}

// Generate textual warnings based on the context.
export function generateWarnings(ctx, ranking) {
  const warnings = [];

  // Frost approaching
  const daysLeft = ctx.seasonEndDay - ctx.today;
  if (daysLeft <= 5 && !ctx.greenhouse) {
    warnings.push({
      level: 'severe',
      title: 'Season ending',
      message: `Only ${daysLeft} days until first frost (day ${ctx.seasonEndDay}). Without a greenhouse, most crops won't finish in time.`,
    });
  } else if (daysLeft <= 14 && !ctx.greenhouse) {
    warnings.push({
      level: 'warn',
      title: 'Limited season',
      message: `${daysLeft} days until first frost. Stick to fast crops (Turnip, Carrot).`,
    });
  }

  // Low nutrient on critical axis
  const axes = [
    { axis: 'N', val: ctx.curN, label: 'Nitrogen' },
    { axis: 'P', val: ctx.curP, label: 'Phosphorus' },
    { axis: 'K', val: ctx.curK, label: 'Potassium' },
  ];
  const lowest = axes.reduce((a, b) => a.val < b.val ? a : b);
  if (lowest.val < 20) {
    warnings.push({
      level: 'severe',
      title: `${lowest.label} depleted`,
      message: `${lowest.axis} is at ${lowest.val}. ${lowest.axis}-required crops will struggle. Consider fertilizing or rotating to a different axis.`,
    });
  } else if (lowest.val < 35) {
    warnings.push({
      level: 'warn',
      title: `${lowest.label} low`,
      message: `${lowest.axis} is at ${lowest.val}. Growth will slow for ${lowest.axis}-required crops. Fertilize before planting them.`,
    });
  }

  // Pre-season notice
  if (ctx.today < 30 && !ctx.greenhouse) {
    warnings.push({
      level: 'info',
      title: 'Pre-season',
      message: `Day ${ctx.today}. Likely still too cold for outdoor planting. Rye and Carrot tolerate the most cold (-12 and -10).`,
    });
  }

  // Dry-biome notice. Outdoor plots far from water in arid biomes cant keep
  // moisture above the 0.1 grow-block threshold from rainfall alone.
  if (!ctx.greenhouse && (ctx.waterDistance ?? 1) >= 4) {
    const dry = ['very_rare', 'rarely', 'uncommon'].includes(ctx.rainfallFrequency);
    if (dry) {
      const labels = { very_rare: 'Very Rare', rarely: 'Rarely', uncommon: 'Uncommon' };
      warnings.push({
        level: ctx.rainfallFrequency === 'uncommon' ? 'warn' : 'severe',
        title: 'Too dry for outdoor farming',
        message: `Rainfall is "${labels[ctx.rainfallFrequency]}" and the plot is 4+ blocks from water. Soil moisture won't stay above the 0.1 grow threshold. Move the plot closer to water (within 1 block keeps moisture floored at 0.75) or build over a trough.`,
      });
    }
  }

  // Underground-with-flag-off notice. The world config defaults to
  // allowUndergroundFarming=false, in which case any plot marked underground
  // will sit at stage 1 forever. Make this loud.
  if (ctx.underground && !ctx.allowUndergroundFarming) {
    warnings.push({
      level: 'severe',
      title: 'Underground farming disabled',
      message: 'This plot is marked underground but allowUndergroundFarming is off in your world config. Crops here will not grow at all. Either flip the toggle in Settings or move the plot to the surface.',
    });
  } else if (ctx.underground && ctx.allowUndergroundFarming && (ctx.lightLevel ?? 22) < 14) {
    warnings.push({
      level: 'warn',
      title: 'Dim light underground',
      message: `Light level ${ctx.lightLevel ?? 0} gives a ${Math.round(Math.max(0, 1 - (19 - ctx.lightLevel) * 0.1) * 100)}% grow speed. Add lanterns to push light to 19 or higher for full speed.`,
    });
  }
  if (!ctx.underground && (ctx.depthBelowSea ?? 0) > 0) {
    const eff = 22 - ctx.depthBelowSea;
    if (eff < 19) {
      warnings.push({
        level: eff < 9 ? 'severe' : 'warn',
        title: 'Below sea level',
        message: `Plot is ${ctx.depthBelowSea} below sea level. Each block subtracts from effective sunlight. Effective light = ${eff}, grow speed = ${Math.round(Math.max(0, Math.min(1, 1 - (19 - eff) * 0.1)) * 100)}%.`,
      });
    }
  }

  // Top pick comments
  if (ranking[0]) {
    const top = ranking[0];
    if (top.frost === 0) {
      warnings.push({
        level: 'severe',
        title: 'No viable crops',
        message: 'No crop scores above zero. Every option either fails to finish before frost or has severe damage risk. Consider a greenhouse, or wait until next spring.',
      });
    }
  }

  return warnings;
}

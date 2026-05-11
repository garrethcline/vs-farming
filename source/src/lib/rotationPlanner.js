// Rotation planner. Given a set of crops the player wants to keep planting
// (e.g. "I MUST grow flax and soybean every season"), figure out the best
// way to schedule them on a fixed soil tier across one game year.
//
// Two strategies are evaluated:
//   1. SEPARATE tile groups (parallel). Each crop gets its own dedicated
//      tile group; they grow independently. Throughput per crop = year/cycle.
//   2. SHARED tile group (rotation). One tile group; crops alternate. Each
//      cycle is grow_A + regen + grow_B + regen + ... if same axis.
//
// Output for the user: a recommendation card per strategy with cycle
// timing, total harvests-per-year per crop, and a verdict.

import { CROPS_LIST, growDays } from '../data/crops.js';
import { effectiveGrowDays, simulateNutrientRecovery, nutrientFactor, simulateCropDamage } from '../lib/mechanics.js';

// How many days for a tile's drained axis to recover back to "viable" level
// after a harvest. Climate-aware.
//
// Subtlety: nutrientFactor uses a strict-greater check, so 50 NPK returns 0.90
// not 1.00. For soils that can exceed 50 (compost 65, terra preta 80), the
// regen target is 51 (the first level that returns 1.00). For medium soil
// (cap 50), full speed is unreachable, so the best we can do is regen back
// to the cap.
function regenDaysFor(crop, soilTier, climate, fromDay) {
  if (!climate || climate.length === 0) return 0;
  const drained = crop.nutrient;
  const postLevel = Math.max(0, soilTier - crop.cons);
  // Full-speed threshold per nutrientFactor: n > 50. For soils that can clear
  // it, target 51; for medium and below (cap 50), target the cap.
  const TARGET = soilTier > 50 ? 51 : soilTier;
  if (postLevel >= TARGET) return 0;
  const sim = simulateNutrientRecovery({
    startN: drained === 'N' ? postLevel : soilTier,
    startP: drained === 'P' ? postLevel : soilTier,
    startK: drained === 'K' ? postLevel : soilTier,
    cap: soilTier,
    tileState: 'empty',
    climate,
    startDay: fromDay,
    daysToSimulate: 240,
  });
  const hit = sim.find(d => {
    const v = drained === 'N' ? d.n : drained === 'P' ? d.p : d.k;
    return v >= TARGET;
  });
  return hit ? hit.day - fromDay : 240;  // worst case: full year
}

// SEPARATE STRATEGY: each crop runs on its own tile group, in parallel.
// Each crop's per-tile cycle = grow + regen-on-same-axis-for-self.
// Throughput per crop = (yearLen - season_start) / cycle_days, capped by frost.
export function planSeparateGroups({ crops, soilTier, dpm, daysPerMonth, climate, seasonStartDay = 1, seasonEndDay, greenhouse = false, cropGrowthRateMul = 1.0, moistF = 1.0, lightF = 1.0 }) {
  const climateForSim = greenhouse
    ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : climate;

  const groups = crops.map(crop => {
    const baseGrow = growDays(crop, daysPerMonth, cropGrowthRateMul);
    const sim = effectiveGrowDays(crop, baseGrow, soilTier, 0, moistF * lightF, seasonStartDay, climateForSim);
    if (sim.stalled) {
      return { crop, stalled: true, growDays: Infinity, regenDays: 0, cycleDays: Infinity, harvests: 0, plantDays: [], wouldDie: false };
    }
    const grow = sim.effectiveDays;
    // Regen after the first harvest, computed from when the harvest lands
    const firstHarvest = seasonStartDay + grow;
    const regen = regenDaysFor(crop, soilTier, climateForSim, firstHarvest);
    const cycle = grow + regen;

    // Walk through the year planting on day cursor whenever possible.
    // Skip plantings that would die from cold/heat damage.
    const plantDays = [];
    const damagedDays = [];
    let cursor = seasonStartDay;
    let wouldDieAtSeasonStart = false;
    while (cursor + grow <= seasonEndDay) {
      const damage = simulateCropDamage(crop, cursor, grow, climateForSim, greenhouse);
      if (damage.willDie) {
        if (cursor === seasonStartDay) wouldDieAtSeasonStart = true;
        // Skip this planting day, advance one day and try again
        cursor += 1;
        continue;
      }
      plantDays.push(cursor);
      if (damage.flagged) damagedDays.push(cursor);
      cursor = cursor + Math.ceil(grow) + Math.ceil(regen);
    }

    return {
      crop,
      stalled: false,
      growDays: grow,
      regenDays: regen,
      cycleDays: cycle,
      harvests: plantDays.length,
      plantDays,
      damagedDays,
      wouldDie: plantDays.length === 0 && wouldDieAtSeasonStart,
    };
  });

  return {
    strategy: 'separate',
    groups,
    totalHarvests: groups.reduce((s, g) => s + g.harvests, 0),
    requiresTiles: crops.length,  // one tile group per crop
  };
}

// SHARED STRATEGY: single tile group, crops alternate in fixed order. Each
// cycle round = grow_A + regen_A + grow_B + regen_B + ... loops to start.
// Total harvests of each crop in a year = floor(year / cycleRound).
export function planSharedGroup({ crops, soilTier, dpm, daysPerMonth, climate, seasonStartDay = 1, seasonEndDay, greenhouse = false, cropGrowthRateMul = 1.0, moistF = 1.0, lightF = 1.0 }) {
  const climateForSim = greenhouse
    ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : climate;

  const seq = [];
  let cursor = seasonStartDay;
  let safety = 0;
  let allFit = true;

  // Build a sequence that walks through crops in the given order, repeating
  // until we run out of season.
  while (cursor <= seasonEndDay && safety++ < 100) {
    let progressedThisRound = false;
    for (const crop of crops) {
      const baseGrow = growDays(crop, daysPerMonth, cropGrowthRateMul);
      const sim = effectiveGrowDays(crop, baseGrow, soilTier, 0, moistF * lightF, cursor, climateForSim);
      if (sim.stalled || cursor + sim.effectiveDays > seasonEndDay) {
        allFit = false;
        continue;
      }
      const grow = sim.effectiveDays;
      // Skip plantings that would die from cold/heat damage.
      const damage = simulateCropDamage(crop, cursor, grow, climateForSim, greenhouse);
      if (damage.willDie) {
        allFit = false;
        continue;
      }
      const harvest = cursor + grow;
      // Same-axis next? If next crop in cycle drains same axis, need regen.
      // Lookahead: the next crop after this in the rotation.
      const nextCrop = crops[(crops.indexOf(crop) + 1) % crops.length];
      const sameAxis = nextCrop && nextCrop.nutrient === crop.nutrient;
      const regen = sameAxis ? regenDaysFor(crop, soilTier, climateForSim, harvest) : 0;

      seq.push({
        crop,
        plantDay: Math.round(cursor),
        growDays: grow,
        harvestDay: Math.round(harvest),
        regenAfter: Math.round(regen),
        sameAxisNext: sameAxis,
        damaged: damage.flagged,
      });

      cursor = harvest + regen;
      progressedThisRound = true;
    }
    if (!progressedThisRound) break;
  }

  const harvestsPerCrop = {};
  for (const c of crops) harvestsPerCrop[c.key] = 0;
  for (const s of seq) harvestsPerCrop[s.crop.key]++;

  return {
    strategy: 'shared',
    sequence: seq,
    harvestsPerCrop,
    totalHarvests: seq.length,
    requiresTiles: 1,
    allFit,
  };
}

// STAGGERED PARALLEL: each crop runs on its own tile group, but the group is
// split into TWO sub-groups planted half-cycle apart. Total throughput is the
// same as planSeparateGroups, but harvests are spread out across the season
// instead of all hitting on the same days. Useful for feed-the-town setups
// where steady food supply matters more than peak yield.
export function planStaggeredGroups({ crops, soilTier, daysPerMonth, climate, seasonStartDay = 1, seasonEndDay, greenhouse = false, cropGrowthRateMul = 1.0, moistF = 1.0, lightF = 1.0 }) {
  const climateForSim = greenhouse
    ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : climate;

  const groups = crops.map(crop => {
    const baseGrow = growDays(crop, daysPerMonth, cropGrowthRateMul);
    const sim = effectiveGrowDays(crop, baseGrow, soilTier, 0, moistF * lightF, seasonStartDay, climateForSim);
    if (sim.stalled) {
      return { crop, stalled: true, growDays: Infinity, regenDays: 0, cycleDays: Infinity, subgroups: [], totalHarvests: 0 };
    }
    const grow = sim.effectiveDays;
    const firstHarvest = seasonStartDay + grow;
    const regen = regenDaysFor(crop, soilTier, climateForSim, firstHarvest);
    const cycle = grow + regen;
    const offset = Math.floor(cycle / 2);

    // Two sub-groups: one starts at seasonStartDay, the other at seasonStartDay + offset.
    const subgroups = [
      { label: 'A', plantDays: [], offset: 0 },
      { label: 'B', plantDays: [], offset },
    ];
    for (const sg of subgroups) {
      let cursor = seasonStartDay + sg.offset;
      while (cursor + grow <= seasonEndDay) {
        const damage = simulateCropDamage(crop, cursor, grow, climateForSim, greenhouse);
        if (damage.willDie) {
          cursor += 1;
          continue;
        }
        sg.plantDays.push(Math.round(cursor));
        cursor = cursor + Math.ceil(grow) + Math.ceil(regen);
      }
    }

    const totalHarvests = subgroups.reduce((s, g) => s + g.plantDays.length, 0);
    return {
      crop,
      stalled: false,
      growDays: grow,
      regenDays: regen,
      cycleDays: cycle,
      subgroups,
      totalHarvests,
    };
  });

  return {
    strategy: 'staggered',
    groups,
    totalHarvests: groups.reduce((s, g) => s + g.totalHarvests, 0),
    requiresTiles: crops.length * 2,  // 2 sub-groups per crop
  };
}

// FERTILIZER-BUFFERED SHARED TILE: one tile group, all crops alternate, but
// after every harvest you apply a strong K (or other axis) fertilizer to skip
// the regen window. Cycle = pure grow time. Trades fertilizer cost for max
// tile efficiency.
//
// Models the actual game mechanic per BESoilNutrition.OnBlockInteract:110-116:
// fertilizerProps.N|P|K is added to the slow-release pool (capped at 150
// per axis). The pool then drips into nutrients at 0.25/tick (capped at 100).
// Per-axis pool, drip dynamics are simulated across cycles so plant-time
// nutrient levels reflect what the game would actually have.
//
// Returns the same shape as planSharedGroup but adds `fertilizerCount` and
// `fertilizerKey` (potash for K, saltpeter for K backup, bonemeal for P,
// compost for N).
export function planFertilizerBuffered({ crops, soilTier, daysPerMonth, climate, seasonStartDay = 1, seasonEndDay, greenhouse = false, cropGrowthRateMul = 1.0, moistF = 1.0, lightF = 1.0 }) {
  const climateForSim = greenhouse
    ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : climate;

  // Pick a fertilizer per axis. Each entry's poolN/P/K is what the game
  // adds to the slow-release pool (fertilizerProps fields from JSON).
  // Compost goes to all three axes; potash/bonemeal are single-axis.
  // Note: vanilla potash also has a one-time PermaBoost +15 K on the first
  // application (raises originalFertility[K]), and SC mod's Farmhand class
  // has FertilizerPermanence which adds 25% of NPK to originalFertility on
  // every app. Neither affects grow time inside our model because pool drip
  // caps nutrient at 100 regardless of originalFertility; the boost matters
  // for inter-grow regen which we don't simulate. Documenting here so the
  // omission is intentional rather than hidden.
  const fertilizerByAxis = {
    K: { key: 'potash', name: 'Potash', poolN: 0, poolP: 0, poolK: 60 },
    P: { key: 'bonemeal', name: 'Bonemeal', poolN: 3, poolP: 30, poolK: 0 },
    N: { key: 'compost', name: 'Compost', poolN: 40, poolP: 8, poolK: 8 },
  };
  const POOL_CAP = 150;

  const seq = [];
  let cursor = seasonStartDay;
  let safety = 0;
  let fertilizerByCrop = {};
  // Track per-axis nutrients and slow-release pool. Soil starts at full,
  // pool starts empty; user fertilizes after each harvest.
  let n = soilTier, p = soilTier, k = soilTier;
  let poolN = 0, poolP = 0, poolK = 0;

  while (cursor <= seasonEndDay && safety++ < 100) {
    let progressed = false;
    for (const crop of crops) {
      const baseGrow = growDays(crop, daysPerMonth, cropGrowthRateMul);
      // Use actual axis level + pool for the grow-time sim. Pool drip during
      // grow boosts the drained axis above soilTier toward 100 cap, which
      // changes the effective nutrient factor and thus grow time.
      const axisLevel = crop.nutrient === 'N' ? n : crop.nutrient === 'P' ? p : k;
      const axisPool = crop.nutrient === 'N' ? poolN : crop.nutrient === 'P' ? poolP : poolK;
      const sim = effectiveGrowDays(crop, baseGrow, axisLevel, axisPool, moistF * lightF, cursor, climateForSim);
      if (sim.stalled || cursor + sim.effectiveDays > seasonEndDay) continue;
      const grow = sim.effectiveDays;
      const damage = simulateCropDamage(crop, cursor, grow, climateForSim, greenhouse);
      if (damage.willDie) continue;
      const harvest = cursor + grow;
      const fert = fertilizerByAxis[crop.nutrient];

      seq.push({
        crop,
        plantDay: Math.round(cursor),
        growDays: grow,
        harvestDay: Math.round(harvest),
        fertilizerKey: fert.key,
        fertilizerName: fert.name,
        damaged: damage.flagged,
        plantAxisLevel: axisLevel,
        plantAxisPool: axisPool,
      });

      // Update post-grow state from sim (drained axis after drain, pool
      // consumed by drip). Non-drained axes also drip from their pools, but
      // we approximate that as full regen during this crop's grow window.
      if (crop.nutrient === 'N') { n = sim.endNutrient; poolN = sim.endPool; }
      else if (crop.nutrient === 'P') { p = sim.endNutrient; poolP = sim.endPool; }
      else { k = sim.endNutrient; poolK = sim.endPool; }

      // Apply one fertilizer dose. Goes to the slow-release pool (capped
      // at 150 per axis), not directly to nutrients. The game does
      // slowReleaseNutrients[i] += fert[i].
      poolN = Math.min(POOL_CAP, poolN + fert.poolN);
      poolP = Math.min(POOL_CAP, poolP + fert.poolP);
      poolK = Math.min(POOL_CAP, poolK + fert.poolK);
      fertilizerByCrop[fert.key] = (fertilizerByCrop[fert.key] || 0) + 1;

      cursor = harvest;
      progressed = true;
    }
    if (!progressed) break;
  }

  const harvestsPerCrop = {};
  for (const c of crops) harvestsPerCrop[c.key] = 0;
  for (const s of seq) harvestsPerCrop[s.crop.key]++;

  return {
    strategy: 'fertilizer',
    sequence: seq,
    harvestsPerCrop,
    totalHarvests: seq.length,
    requiresTiles: 1,
    fertilizerByCrop,
  };
}

// Simulate a CROP-ROTATION cycle: ordered list of crops planted back-to-back
// on a single tile, no fertilizer, no fallow. Walk through several full cycles
// to detect steady state on each NPK axis. Reports per-step NPK at plant +
// harvest, plus a sustainability verdict.
//
// Sustainable = each axis stabilizes >= 35 (the viability cutoff). Anything
// below 35 means crops grow at reduced yield (60% or worse).
export function simulateRotationCycle({
  crops,
  soilTier,
  daysPerMonth,
  climate,
  seasonStartDay = 1,
  greenhouse = false,
  cropGrowthRateMul = 1.0,
  moistF = 1.0,
  lightF = 1.0,
  cycles = 4,
}) {
  if (!crops || crops.length === 0) return null;
  const climateForSim = greenhouse
    ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : climate;

  let n = soilTier, p = soilTier, k = soilTier;
  let day = seasonStartDay;
  const steps = [];
  let stalledStep = null;

  for (let c = 0; c < cycles; c++) {
    for (const crop of crops) {
      const baseGrow = growDays(crop, daysPerMonth, cropGrowthRateMul);
      // The grow-time sim must use the ACTUAL drained-axis level at plant
      // time (not soilTier), so that cycle-2+ replantings on a partially-
      // recovered axis correctly predict slower growth. Without this, the
      // simulator would over-promise cycle counts when the partner's regen
      // window doesn't fully refill the axis (e.g., short partner crops or
      // same-axis sequences mid-rotation).
      const drainedLevel = crop.nutrient === 'N' ? n : crop.nutrient === 'P' ? p : k;
      const sim = effectiveGrowDays(crop, baseGrow, drainedLevel, 0, moistF * lightF, day, climateForSim);
      if (sim.stalled) {
        stalledStep = { crop, day, cycle: c + 1 };
        break;
      }
      const grow = sim.effectiveDays;

      // Damage check: if temp goes far enough past cold/heat threshold for
      // long enough, the crop dies entirely (game's leaky-bucket: >48h
      // accumulated). For brief dips, drops are halved but the cycle still
      // completes. Mark the cycle as dead if applicable so verdicts reflect
      // actual game behavior.
      const damage = simulateCropDamage(crop, day, grow, climateForSim, greenhouse);
      if (damage.willDie) {
        stalledStep = { crop, day, cycle: c + 1, reason: 'died', deathDay: damage.deathDay };
        break;
      }

      // Capture state at plant
      const plantN = n, plantP = p, plantK = k;

      // Walk per-day during grow. Game applies drain at each stage transition
      // (cons / (stages-1) per transition over grow window) and regenerates
      // each tick (drained axis at 1/3 rate, others at full rate). Modeling
      // this as continuous per-day drain + regen is mathematically equivalent
      // to per-stage and captures the actual end-of-grow nutrient level.
      // Without this, the simulator would dump all drain at harvest, missing
      // the regen that happens once drain creates headroom under the cap.
      const growDaysCeil = Math.ceil(grow);
      const dailyDrain = crop.cons / Math.max(1, grow);
      const HOURS_PER_DAY = 24;
      const HOURS_PER_TICK = 3.5;
      const TICKS_PER_DAY = HOURS_PER_DAY / HOURS_PER_TICK;
      const RECOVERY_PER_TICK = 0.25;
      const fullDailyRegen = RECOVERY_PER_TICK * TICKS_PER_DAY;       // ~1.71/day
      const drainedAxisRegen = fullDailyRegen / 3;                     // ~0.57/day

      for (let i = 0; i < growDaysCeil; i++) {
        const cd = day + i;
        const cidx = ((Math.floor(cd) - 1) % climateForSim.length + climateForSim.length) % climateForSim.length;
        const T = climateForSim[cidx]?.avg ?? 10;
        const growthChance = Math.max(0, Math.min(1, 1 + (T - 10) * 0.1));
        // Last day may be a partial day; scale rates by the remainder
        const dayShare = (i === growDaysCeil - 1) ? (grow - (growDaysCeil - 1)) : 1.0;

        if (crop.nutrient === 'N') {
          n = Math.max(0, Math.min(soilTier, n - dailyDrain * dayShare + drainedAxisRegen * growthChance * dayShare));
          p = Math.min(soilTier, p + fullDailyRegen * growthChance * dayShare);
          k = Math.min(soilTier, k + fullDailyRegen * growthChance * dayShare);
        } else if (crop.nutrient === 'P') {
          p = Math.max(0, Math.min(soilTier, p - dailyDrain * dayShare + drainedAxisRegen * growthChance * dayShare));
          n = Math.min(soilTier, n + fullDailyRegen * growthChance * dayShare);
          k = Math.min(soilTier, k + fullDailyRegen * growthChance * dayShare);
        } else {
          k = Math.max(0, Math.min(soilTier, k - dailyDrain * dayShare + drainedAxisRegen * growthChance * dayShare));
          n = Math.min(soilTier, n + fullDailyRegen * growthChance * dayShare);
          p = Math.min(soilTier, p + fullDailyRegen * growthChance * dayShare);
        }
      }

      const harvestDay = Math.round(day + grow);
      steps.push({
        cycle: c + 1,
        crop,
        plantDay: Math.round(day),
        harvestDay,
        plantN: +plantN.toFixed(1), plantP: +plantP.toFixed(1), plantK: +plantK.toFixed(1),
        endN: +n.toFixed(1), endP: +p.toFixed(1), endK: +k.toFixed(1),
        growDays: grow,
      });

      day = harvestDay;
    }
    if (stalledStep) break;
  }

  // Steady-state check: compare each crop's PLANT-TIME drained-axis level
  // across cycles. A rotation is stable when the level each crop sees on
  // its own drained axis converges. Non-drained axes can drift cycle-to-
  // cycle (a partner crop's drain on N doesn't hurt a K-draining successor)
  // so they're irrelevant to whether yield holds steady.
  let isStable = false;
  let steadyState = null;
  if (cycles >= 2 && steps.length >= 2 * crops.length) {
    const lastCycleStart = steps.length - crops.length;
    const prevCycleStart = lastCycleStart - crops.length;
    let allStable = true;
    for (let i = 0; i < crops.length; i++) {
      const lastStep = steps[lastCycleStart + i];
      const prevStep = steps[prevCycleStart + i];
      if (!lastStep || !prevStep || lastStep.crop.key !== prevStep.crop.key) {
        allStable = false;
        break;
      }
      const axis = lastStep.crop.nutrient;
      const lastLvl = axis === 'N' ? lastStep.plantN : axis === 'P' ? lastStep.plantP : lastStep.plantK;
      const prevLvl = axis === 'N' ? prevStep.plantN : axis === 'P' ? prevStep.plantP : prevStep.plantK;
      if (Math.abs(lastLvl - prevLvl) >= 2) { allStable = false; break; }
    }
    isStable = allStable;
    const last = steps[lastCycleStart];
    steadyState = {
      n: last.endN, p: last.endP, k: last.endK,
      stableN: true, stableP: true, stableK: true,  // legacy fields, not used
    };
  }

  // Yield verdict uses PLANT-TIME axis levels: what each crop sees on its own
  // drained axis at the moment it's planted. Post-harvest values dip lower but
  // recover during the partner crop's grow time, so they aren't yield-relevant.
  // Without this distinction, a perfectly-sustainable rotation looks "failing".
  let plantTimeYields = null;
  let minPlantLevel = null;
  if (steps.length >= crops.length) {
    const lastCycleSteps = steps.slice(-crops.length);
    plantTimeYields = lastCycleSteps.map(s => {
      const axisLevel = s.crop.nutrient === 'N' ? s.plantN
        : s.crop.nutrient === 'P' ? s.plantP
        : s.plantK;
      return {
        crop: s.crop,
        axis: s.crop.nutrient,
        plantLevel: axisLevel,
        yieldFactor: nutrientFactor(axisLevel),
      };
    });
    minPlantLevel = Math.min(...plantTimeYields.map(p => p.plantLevel));
  }

  let yieldVerdict = 'unknown';
  if (minPlantLevel !== null) {
    // Match the game's BESoilNutrition.GetGrowthRate exactly: strict `>`.
    // These are GROWTH SPEED tiers: what nutrientFactor returns. Low values
    // mean slower growth (longer to ripen), not directly less food per harvest.
    if (minPlantLevel > 75) yieldVerdict = 'full+';      // 1.10x speed
    else if (minPlantLevel > 50) yieldVerdict = 'full';  // 1.00x speed
    else if (minPlantLevel > 35) yieldVerdict = 'lower'; // 0.90x speed
    else if (minPlantLevel > 20) yieldVerdict = 'poor';  // 0.60x speed
    else if (minPlantLevel > 5) yieldVerdict = 'failing'; // 0.30x speed
    else yieldVerdict = 'failing';                       // 0.10x speed
  }

  // Sustainable = stable AND every crop plants at level > 35 (>= 0.9x speed).
  // For greenhouse (year-round) we require multi-cycle convergence.
  // For outdoor we ALSO accept "1 cycle per year" sustainability: if cycle
  // 1 completed without stall/death and the in-season plant levels stay
  // above 35, the rotation works year over year (winter resets the soil
  // each year so plant-time levels reset to soilTier each spring).
  const cycle1Steps = steps.slice(0, crops.length);
  const cycle1Complete = cycle1Steps.length === crops.length && (!stalledStep || stalledStep.cycle > 1);
  const cycle1Levels = cycle1Steps.map(s => {
    const axis = s.crop.nutrient;
    return axis === 'N' ? s.plantN : axis === 'P' ? s.plantP : s.plantK;
  });
  const cycle1MinPlant = cycle1Levels.length > 0 ? Math.min(...cycle1Levels) : null;
  const oneCyclePerYearOK = cycle1Complete && cycle1MinPlant !== null && cycle1MinPlant > 35;

  const isSustainable = greenhouse
    ? (isStable && minPlantLevel !== null && minPlantLevel > 35)
    : oneCyclePerYearOK;

  // Annotate the failure reason for the UI. "winter-stall" means cycle 1
  // worked but later cycles in the same year couldn't fit; the rotation is
  // still sustainable as a once-per-year plan.
  let sustainabilityReason = null;
  if (!isSustainable) {
    if (!cycle1Complete) sustainabilityReason = stalledStep?.reason === 'died' ? 'died-cycle-1' : 'stalled-cycle-1';
    else if (cycle1MinPlant !== null && cycle1MinPlant <= 35) sustainabilityReason = 'low-plant-level';
    else sustainabilityReason = 'multi-cycle-unstable';
  } else if (!greenhouse && stalledStep && stalledStep.cycle > 1) {
    sustainabilityReason = 'one-cycle-per-year';  // sustainable but only once per year
  }

  return {
    steps,
    stalledStep,
    isStable,
    isSustainable,
    sustainabilityReason,
    steadyState,         // post-harvest snapshot (for diagnostic/trace display)
    plantTimeYields,     // per-crop plant-time level + yield factor (yield-relevant)
    yieldVerdict,
    minSteady: minPlantLevel,  // alias kept so existing UI code doesn't break
    minPlantLevel,
    cycles,
  };
}

// Suggest partner crops for a "must-have" crop. Score by:
//   - Different axis (mandatory: same axis = -infinity)
//   - Steady-state floor (higher is better; computed by quick 2-cycle sim)
//   - Total harvests per year for the rotation A→B→A→B...
// Returns top 5 partners with their pairing stats.
export function suggestRotationPartners({
  requiredCrop,
  candidateCrops,
  soilTier,
  daysPerMonth,
  climate,
  seasonStartDay = 1,
  seasonEndDay,
  greenhouse = false,
  cropGrowthRateMul = 1.0,
  moistF = 1.0,
  lightF = 1.0,
}) {
  const results = [];
  for (const partner of candidateCrops) {
    if (partner.key === requiredCrop.key) continue;
    if (partner.nutrient === requiredCrop.nutrient) continue;  // same axis = bad

    const sim = simulateRotationCycle({
      crops: [requiredCrop, partner],
      soilTier, daysPerMonth, climate, seasonStartDay,
      greenhouse, cropGrowthRateMul, moistF, lightF,
      cycles: 4,
    });
    if (!sim) continue;
    // Skip partners that fail outright in cycle 1 (died or stalled). A
    // one-cycle-per-year stall (cycle 2 in autumn) is fine: outdoor users
    // get a winter reset between years, so the rotation works year over year.
    if (sim.stalledStep && sim.stalledStep.cycle === 1) continue;
    // Use plant-time min from the fixed simulator. This is what determines
    // whether each crop in the rotation actually plants at viable levels.
    // Old code recomputed from post-harvest values, which over-penalized
    // sustainable rotations.
    const minSteady = sim.minPlantLevel ?? 0;

    // Total harvests in season: count how many steps fit between seasonStart
    // and seasonEnd
    let cycleStart = seasonStartDay;
    let harvestsInSeason = 0;
    for (let c = 0; c < 6; c++) {
      for (const crop of [requiredCrop, partner]) {
        const baseGrow = growDays(crop, daysPerMonth, cropGrowthRateMul);
        const eff = effectiveGrowDays(crop, baseGrow, soilTier, 0, moistF * lightF, cycleStart, climate);
        if (eff.stalled || cycleStart + eff.effectiveDays > seasonEndDay) {
          c = 999; break;
        }
        cycleStart += eff.effectiveDays;
        harvestsInSeason++;
      }
    }

    results.push({
      partner,
      sim,
      minSteady,
      harvestsInSeason,
      isSustainable: sim.isSustainable && minSteady > 35,
    });
  }

  // Score = (sustainable bonus) + minSteady + harvestsInSeason * 5
  results.sort((a, b) => {
    const sa = (a.isSustainable ? 50 : 0) + a.minSteady + a.harvestsInSeason * 5;
    const sb = (b.isSustainable ? 50 : 0) + b.minSteady + b.harvestsInSeason * 5;
    return sb - sa;
  });
  return results.slice(0, 6);
}

import { cropSatiety } from '../data/crops.js';

// AUTO-FILL THE SEASON: given a primary crop the player wants to keep
// replanting (e.g. flax or soybean on a dedicated half-farm), walk forward
// through the season picking crops greedily:
//   1. Plant the primary first (forced; the player picked it for a reason).
//   2. After any same-axis-as-primary harvest, plant a FILLER with a different
//      axis to let the primary's axis recover.
//   3. After a filler, replant the primary if it still fits and its axis is
//      viable (>= 35); otherwise pick another filler.
//   4. Stop when nothing fits in the remaining frost window.
// Filler ranking is by satiety-per-day with a penalty for repeating the same
// crop two slots in a row. Primary's satiety is irrelevant: it's planted
// because the player needs it, not for food math.
export function planSeasonAutoFill({
  primaryCrop,
  candidateCrops,
  soilTier,
  daysPerMonth,
  climate,
  seasonStartDay = 1,
  seasonEndDay,
  greenhouse = false,
  cropGrowthRateMul = 1.0,
  moistF = 1.0,
  lightF = 1.0,
  satietyMode = 'meal',
}) {
  const climateForSim = greenhouse
    ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : climate;

  let day = seasonStartDay;
  let n = soilTier, p = soilTier, k = soilTier;
  const sequence = [];
  let lastAxis = null;
  let lastCropKey = null;
  let totalSatiety = 0;
  let safety = 0;

  function tryPlant(crop) {
    const baseGrow = growDays(crop, daysPerMonth, cropGrowthRateMul);
    const axisLevel = crop.nutrient === 'N' ? n : crop.nutrient === 'P' ? p : k;
    // Use the actual current axis level for grow-time prediction, not the
    // soil cap. Mid-season replantings on a partially-recovered axis grow
    // slower than a fresh-soil planting.
    const eff = effectiveGrowDays(crop, baseGrow, axisLevel, 0, moistF * lightF, day, climateForSim);
    if (eff.stalled) return null;
    const grow = eff.effectiveDays;
    if (day + grow > seasonEndDay) return null;
    if (axisLevel < 35) return null;
    // Skip crops that would die of cold/heat damage. The leaky-bucket sim
    // walks the actual climate window: a Cassava planted day 180 in a
    // temperate climate will accumulate >48h below its 4C threshold and die.
    // For damaged-but-surviving plantings, drops are halved (mul = 0.5).
    const damage = simulateCropDamage(crop, day, grow, climateForSim, false);
    if (damage.willDie) return null;
    const dropMul = damage.flagged ? (crop.stuntMul ?? 0.5) : 1.0;
    return { crop, grow, axisLevel, dropMul };
  }

  function applyHarvest(pick) {
    const { crop, grow, dropMul } = pick;
    // Per-day drain + regen during grow (matches game's per-stage drain).
    const growDaysCeil = Math.ceil(grow);
    const dailyDrain = crop.cons / Math.max(1, grow);
    const HOURS_PER_DAY = 24;
    const HOURS_PER_TICK = 3.5;
    const TICKS_PER_DAY = HOURS_PER_DAY / HOURS_PER_TICK;
    const RECOVERY_PER_TICK = 0.25;
    const fullDailyRegen = RECOVERY_PER_TICK * TICKS_PER_DAY;
    const drainedAxisRegen = fullDailyRegen / 3;
    for (let i = 0; i < growDaysCeil; i++) {
      const cd = day + i;
      const cidx = ((Math.floor(cd) - 1) % climateForSim.length + climateForSim.length) % climateForSim.length;
      const T = climateForSim[cidx]?.avg ?? 10;
      const growthChance = Math.max(0, Math.min(1, 1 + (T - 10) * 0.1));
      const dayShare = (i === growDaysCeil - 1) ? (grow - (growDaysCeil - 1)) : 1.0;
      if (crop.nutrient === 'N') {
        n = Math.max(0, Math.min(soilTier, n - dailyDrain * dayShare + drainedAxisRegen * growthChance * dayShare));
        p = Math.min(soilTier, p + fullDailyRegen * growthChance * dayShare);
        k = Math.min(soilTier, k + fullDailyRegen * growthChance * dayShare);
      } else if (crop.nutrient === 'P') {
        p = Math.max(0, Math.min(soilTier, p - dailyDrain * dayShare + drainedAxisRegen * growthChance * dayShare));
        n = Math.min(soilTier, n + fullDailyRegen * growthChance * dayShare);
        k = Math.min(soilTier, k + fullDailyRegen * growthChance * dayShare);
      } else {
        k = Math.max(0, Math.min(soilTier, k - dailyDrain * dayShare + drainedAxisRegen * growthChance * dayShare));
        n = Math.min(soilTier, n + fullDailyRegen * growthChance * dayShare);
        p = Math.min(soilTier, p + fullDailyRegen * growthChance * dayShare);
      }
    }
    const satPerDrop = cropSatiety(crop, satietyMode);
    const sat = (crop.yield || 1) * satPerDrop * (dropMul ?? 1.0);
    sequence.push({
      crop,
      plantDay: Math.round(day),
      growDays: grow,
      harvestDay: Math.round(day + grow),
      endN: +n.toFixed(1),
      endP: +p.toFixed(1),
      endK: +k.toFixed(1),
      satiety: Math.round(sat),
      satPerDrop,
      damageMul: dropMul ?? 1.0,
      yield: crop.yield || 1,
      isPrimary: crop.key === primaryCrop.key,
    });
    totalSatiety += sat;
    day = day + grow;
    lastAxis = crop.nutrient;
    lastCropKey = crop.key;
  }

  // Step 1: Plant primary first (forced). If the primary can't survive on
  // day 1 of season (e.g., warm-season crop facing spring frost), walk
  // forward until it can; then start the rotation from that day.
  let primaryPick = tryPlant(primaryCrop);
  if (!primaryPick) {
    const maxWalk = Math.min(seasonEndDay - day, 60);
    for (let walk = 1; walk <= maxWalk; walk++) {
      day = seasonStartDay + walk;
      primaryPick = tryPlant(primaryCrop);
      if (primaryPick) break;
    }
  }
  if (!primaryPick) {
    return {
      sequence: [], primaryCount: 0, fillerCount: 0, totalSatiety: 0,
      totalHarvests: 0, finalNPK: { n, p, k }, daysUsed: 0,
      daysRemaining: seasonEndDay - seasonStartDay,
      stalledOnPrimary: true,
    };
  }
  applyHarvest(primaryPick);

  // Step 2: Alternate fillers and primaries until nothing fits.
  while (day < seasonEndDay && safety++ < 30) {
    const lastWasPrimaryAxis = lastAxis === primaryCrop.nutrient;

    if (lastWasPrimaryAxis) {
      // Just drained primary's axis. Pick best filler with DIFFERENT axis.
      const candidates = candidateCrops
        .filter(c => c.nutrient !== primaryCrop.nutrient && c.key !== primaryCrop.key)
        .map(tryPlant)
        .filter(Boolean);
      if (candidates.length === 0) break;
      candidates.sort((a, b) => {
        // Score = total satiety per harvest / grow days, with axis/repeat penalties.
        // Per-drop satiety alone misleads when yields differ (pumpkin: 2 drops × 560,
        // sunflower: 6.5 drops × 300). Multiply by yield for true output.
        const totalSatA = (a.crop.yield || 1) * cropSatiety(a.crop, satietyMode);
        const totalSatB = (b.crop.yield || 1) * cropSatiety(b.crop, satietyMode);
        let sa = totalSatA / Math.max(1, a.grow);
        let sb = totalSatB / Math.max(1, b.grow);
        if (a.crop.nutrient === lastAxis) sa *= 0.4;
        if (b.crop.nutrient === lastAxis) sb *= 0.4;
        if (a.crop.key === lastCropKey) sa *= 0.6;
        if (b.crop.key === lastCropKey) sb *= 0.6;
        return sb - sa;
      });
      applyHarvest(candidates[0]);
    } else {
      // Primary's axis has had time to recover. Try replanting primary.
      const primaryRetry = tryPlant(primaryCrop);
      if (primaryRetry) {
        applyHarvest(primaryRetry);
      } else {
        // Primary doesn't fit (out of season or axis still depleted).
        // Fill with best different-axis crop.
        const candidates = candidateCrops
          .filter(c => c.nutrient !== lastAxis)
          .map(tryPlant)
          .filter(Boolean);
        if (candidates.length === 0) break;
        candidates.sort((a, b) => {
          const totalSatA = (a.crop.yield || 1) * cropSatiety(a.crop, satietyMode);
          const totalSatB = (b.crop.yield || 1) * cropSatiety(b.crop, satietyMode);
          let sa = totalSatA / Math.max(1, a.grow);
          let sb = totalSatB / Math.max(1, b.grow);
          if (a.crop.key === lastCropKey) sa *= 0.6;
          if (b.crop.key === lastCropKey) sb *= 0.6;
          return sb - sa;
        });
        applyHarvest(candidates[0]);
      }
    }
  }

  const primaryCount = sequence.filter(s => s.isPrimary).length;
  const fillerCount = sequence.length - primaryCount;
  const finalNPK = sequence.length > 0
    ? { n: sequence[sequence.length - 1].endN, p: sequence[sequence.length - 1].endP, k: sequence[sequence.length - 1].endK }
    : { n: soilTier, p: soilTier, k: soilTier };

  return {
    sequence,
    primaryCount,
    fillerCount,
    totalSatiety,
    totalHarvests: sequence.length,
    finalNPK,
    daysUsed: sequence.length > 0 ? sequence[sequence.length - 1].harvestDay - seasonStartDay : 0,
    daysRemaining: seasonEndDay - (sequence.length > 0 ? sequence[sequence.length - 1].harvestDay : seasonStartDay),
  };
}

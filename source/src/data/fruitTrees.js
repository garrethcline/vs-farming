// All 12 cultivated fruit tree varieties.
//
// Sources:
//   Game source:
//     vssurvivalmod/Systems/FruitTree/FruitTreeProperties.cs
//     vssurvivalmod/Systems/FruitTree/BlockFruitTreeBranch.cs
//     vssurvivalmod/Systems/FruitTree/FruitTreeGrowingBranchBH.cs
//   JSON data:
//     blocktypes/plant/fruittreebranch.json (per-variety properties)
//     blocktypes/plant/fruittreefoliage.json
//     itemtypes/food/fruit.json (fruit satiety values)
//   Handbook:
//     config/handbook/22-fruittrees.json
//
// LIFECYCLE (deciduous trees):
//   1. Plant cutting in farmland. Becomes a Young branch.
//   2. Young branch grows over multiple growthStepDays into a full tree.
//   3. Vernalization: tree must accumulate vernalizationHours of cold
//      (under vernalizationTemp) during dormancy or it won't flower.
//   4. Dormancy: enters when temp drops below enterDormancyTemp, leaves
//      when temp rises above leaveDormancyTemp. Loses leaves entering.
//   5. Flowers (avg 4.5 days). Then fruits (per-variety).
//   6. Fruits ripen, get harvestable.
//   7. After harvest, returns to bare and waits for next vernalization.
//
// LIFECYCLE (evergreen, mango/olive/orange/breadfruit/lychee/pomegranate):
//   No vernalization step. Blossoms at year-relative time blossomAtYearRel
//   (e.g. 0.3 = ~30% into the year). Loses leaves only if temp drops under
//   looseLeavesBelowTemp.
//
// GRAFTING (BlockFruitTreeBranch.cs:118-125):
//   You can graft a cutting onto an existing tree's side branch (any face
//   except down). Constraint: cutting and rootstock must share the same
//   cycleType. Deciduous to deciduous, evergreen to evergreen. Mixing fails
//   with error code 'fruittreecutting-ctypemix'. Graft chance is set per
//   variety as cuttingGraftChance (all 12 varieties = 0.6).
//
// PLANTING FROM CUTTING:
//   Cutting can plant on farmland (downward face). Survival chance is the
//   variety's cuttingRootingChance (all 12 = 0.4). FruitTreeGrowingBranchBH.cs:384.

export const TREE_TYPES = {
  pinkapple: {
    key: 'pinkapple', name: 'Pink Apple',
    cycleType: 'Deciduous',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-pinkapple',
    fruitSatietyRaw: 80, fruitSatietyInMeal: 120,
    avgFruitsPerHarvest: 6,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 21,
    ripeDays: 9,
    growthStepDays: 5,
    vernalizationHours: 250,
    vernalizationTemp: 3,
    enterDormancyTemp: -3,
    leaveDormancyTemp: 19,
    dieBelowTemp: -24,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: -5, max: 18 },
    worldgenRain: { min: 0.5, max: 1.0 },
    notes: 'Coldest-tolerant of the apples (-24°C kill). Worldgen prefers Common-rain temperate.',
  },
  redapple: {
    key: 'redapple', name: 'Red Apple',
    cycleType: 'Deciduous',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-redapple',
    fruitSatietyRaw: 80, fruitSatietyInMeal: 120,
    avgFruitsPerHarvest: 4,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 18,
    ripeDays: 12,
    growthStepDays: 5,
    vernalizationHours: 250,
    vernalizationTemp: 2,
    enterDormancyTemp: -3,
    leaveDormancyTemp: 19,
    dieBelowTemp: -28,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: -9, max: 18 },
    worldgenRain: { min: 0.5, max: 0.9 },
    notes: 'Hardiest apple (-28°C kill). Lowest wild-spawn rain (down to 0.5).',
  },
  yellowapple: {
    key: 'yellowapple', name: 'Yellow Apple',
    cycleType: 'Deciduous',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-yellowapple',
    fruitSatietyRaw: 80, fruitSatietyInMeal: 120,
    avgFruitsPerHarvest: 5,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 23,
    ripeDays: 10,
    growthStepDays: 5,
    vernalizationHours: 250,
    vernalizationTemp: 4,
    enterDormancyTemp: -3,
    leaveDormancyTemp: 19,
    dieBelowTemp: -22,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: 0, max: 22 },
    worldgenRain: { min: 0.6, max: 1.0 },
    notes: 'Warm-temperate apple. Doesn\'t spawn below 0°C average.',
  },
  cherry: {
    key: 'cherry', name: 'Cherry',
    cycleType: 'Deciduous',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-cherry',
    fruitSatietyRaw: 40, fruitSatietyInMeal: 60,
    avgFruitsPerHarvest: 8,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 11,
    ripeDays: 9,
    growthStepDays: 5,
    vernalizationHours: 250,
    vernalizationTemp: 5,
    enterDormancyTemp: -3,
    leaveDormancyTemp: 19,
    dieBelowTemp: -20,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: 0, max: 24 },
    worldgenRain: { min: 0.6, max: 1.0 },
    notes: 'Fastest fruiting deciduous (11d fruiting). Lower satiety per fruit (40) but tied with lychee for biggest harvest (8 fruits).',
  },
  pear: {
    key: 'pear', name: 'Pear',
    cycleType: 'Deciduous',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-pear',
    fruitSatietyRaw: 80, fruitSatietyInMeal: 120,
    avgFruitsPerHarvest: 5,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 20,
    ripeDays: 28,
    growthStepDays: 5,
    vernalizationHours: 250,
    vernalizationTemp: 2,
    enterDormancyTemp: -4.5,
    leaveDormancyTemp: 19,
    dieBelowTemp: -28,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: -10, max: 19 },
    worldgenRain: { min: 0.5, max: 1.0 },
    notes: 'Long ripe window (28 days, longest of any tree). Tolerates -28°C kill, deepest dormancy (-4.5°C entry).',
  },
  peach: {
    key: 'peach', name: 'Peach',
    cycleType: 'Deciduous',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-peach',
    fruitSatietyRaw: 80, fruitSatietyInMeal: 120,
    avgFruitsPerHarvest: 5,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 17,
    ripeDays: 8,
    growthStepDays: 5,
    vernalizationHours: 250,
    vernalizationTemp: 5,
    enterDormancyTemp: -3,
    leaveDormancyTemp: 19,
    dieBelowTemp: -12,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: 10, max: 17 },
    worldgenRain: { min: 0.55, max: 1.0 },
    notes: 'Narrowest worldgen temp window (10 to 17). Less cold-tolerant than apples (-12°C kill).',
  },
  mango: {
    key: 'mango', name: 'Mango',
    cycleType: 'Evergreen',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-mango',
    fruitSatietyRaw: 80, fruitSatietyInMeal: 120,
    avgFruitsPerHarvest: 4,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 50,
    ripeDays: 10,
    growthStepDays: 5,
    blossomAtYearRel: 0.2,
    looseLeavesBelowTemp: 3,
    dieBelowTemp: 10,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: 28, max: 50 },
    worldgenRain: { min: 0.6, max: 1.0 },
    notes: 'Tropical evergreen. Blossoms at 20% of year. Dies if average temperature falls under 10°C (must be very warm).',
  },
  olive: {
    key: 'olive', name: 'Olive',
    cycleType: 'Evergreen',
    foodCategory: 'Vegetable',
    fruitItem: 'vegetable-olive',
    fruitSatietyRaw: 100, fruitSatietyInMeal: 150,
    avgFruitsPerHarvest: 4,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 40,
    ripeDays: 24,
    growthStepDays: 5,
    blossomAtYearRel: 0.3,
    looseLeavesBelowTemp: 0,
    dieBelowTemp: 7,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: 22, max: 50 },
    worldgenRain: { min: 0.3, max: 0.5 },
    notes: 'Categorized as Vegetable in-game (yields vegetable-olive). Dry-tolerant (worldgen prefers low rainfall 0.3 to 0.5). Long ripe window 24d.',
  },
  orange: {
    key: 'orange', name: 'Orange',
    cycleType: 'Evergreen',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-orange',
    fruitSatietyRaw: 80, fruitSatietyInMeal: 120,
    avgFruitsPerHarvest: 5,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 60,
    ripeDays: 12,
    growthStepDays: 5,
    blossomAtYearRel: 0.5,
    looseLeavesBelowTemp: 3,
    dieBelowTemp: 6,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: 25, max: 30 },
    worldgenRain: { min: 0.45, max: 1.0 },
    notes: 'Slowest fruiting (60 days). Mid-year blossoms (year fraction 0.5).',
  },
  breadfruit: {
    key: 'breadfruit', name: 'Breadfruit',
    cycleType: 'Evergreen',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-breadfruit',
    fruitSatietyRaw: 200, fruitSatietyInMeal: 250,
    avgFruitsPerHarvest: 3,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 50,
    ripeDays: 10,
    growthStepDays: 5,
    blossomAtYearRel: 0.3,
    looseLeavesBelowTemp: 12,
    dieBelowTemp: 10,
    rootingChance: 0.4,
    graftChance: 0.6,
    blossomParticles: false,
    worldgenTemp: { min: 28, max: 50 },
    worldgenRain: { min: 0.6, max: 1.0 },
    notes: 'Highest satiety per fruit of any tree (200 raw / 250 in meal). Fewer fruits per harvest (3 avg). Tropical only.',
  },
  lychee: {
    key: 'lychee', name: 'Lychee',
    cycleType: 'Evergreen',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-lychee',
    fruitSatietyRaw: 40, fruitSatietyInMeal: 60,
    avgFruitsPerHarvest: 8,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 50,
    ripeDays: 10,
    growthStepDays: 5,
    blossomAtYearRel: 0.3,
    looseLeavesBelowTemp: 12,
    dieBelowTemp: 10,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: 28, max: 50 },
    worldgenRain: { min: 0.6, max: 1.0 },
    notes: 'Tropical, big harvests (8 fruits) but small per-fruit satiety (40).',
  },
  pomegranate: {
    key: 'pomegranate', name: 'Pomegranate',
    cycleType: 'Evergreen',
    foodCategory: 'Fruit',
    fruitItem: 'fruit-pomegranate',
    fruitSatietyRaw: 80, fruitSatietyInMeal: 120,
    avgFruitsPerHarvest: 5,
    fruitsPerHarvestVar: 4,
    floweringDays: 4.5,
    fruitingDays: 50,
    ripeDays: 10,
    growthStepDays: 5,
    blossomAtYearRel: 0.3,
    looseLeavesBelowTemp: 12,
    dieBelowTemp: 10,
    rootingChance: 0.4,
    graftChance: 0.6,
    worldgenTemp: { min: 22, max: 50 },
    worldgenRain: { min: 0.45, max: 1.0 },
    notes: 'Tropical evergreen (10°C kill, same as mango/lychee/breadfruit). Blossoms ~30% into year.',
  },
};

export const TREES_LIST = [
  'pinkapple', 'redapple', 'yellowapple', 'cherry', 'pear', 'peach',
  'mango', 'olive', 'orange', 'breadfruit', 'lychee', 'pomegranate',
].map(k => TREE_TYPES[k]);

// Cycle to seasonality on the user's calendar.
// Total time from "active" to "ripe" for a fully mature, vernalized deciduous
// tree: floweringDays + fruitingDays + (you wait through ripeDays for harvest
// before fruit drops). For evergreens add blossomAtYearRel × yearLength.
export function activeCycleDays(tree) {
  return (tree.floweringDays || 0) + (tree.fruitingDays || 0) + (tree.ripeDays || 0);
}

// Whether two trees can graft: cycleType must match.
// Source: BlockFruitTreeBranch.cs:118-125.
export function canGraft(scionType, rootstockType) {
  const a = TREE_TYPES[scionType];
  const b = TREE_TYPES[rootstockType];
  if (!a || !b) return false;
  return a.cycleType === b.cycleType;
}

// Given the climate array (108 days, one entry per day), check whether a
// deciduous tree can vernalize in this biome. We need vernalizationHours
// (avg 250) of accumulated time at temperatures below vernalizationTemp.
// Returns { vernalizes: bool, hoursAvailable: number, needed: number }
//
// For evergreens: returns { vernalizes: true, hoursAvailable: Infinity }
// because they don't need cold. The bigger filter for evergreens is
// dieBelowTemp -- handled by climateSurvivable below.
// `greenhouseBonus` shifts every climate entry's avg/min temps upward by the
// given amount (typically +5 for a sealed glass-roof room with a tile above
// the tree per FruitTreeRootBH.cs). Default 0 = outdoor.
export function vernalizationCheck(tree, climate, hoursPerDay = 24, greenhouseBonus = 0) {
  if (tree.cycleType !== 'Deciduous') return { vernalizes: true, hoursAvailable: Infinity };
  if (!Array.isArray(climate) || climate.length === 0) return { vernalizes: true, hoursAvailable: 0 };

  const need = tree.vernalizationHours;
  let acc = 0;
  for (const c of climate) {
    const avg = c.avg + greenhouseBonus;
    const min = (c.min ?? c.avg) + greenhouseBonus;
    if (avg <= tree.vernalizationTemp) acc += hoursPerDay;
    else if (min <= tree.vernalizationTemp) acc += hoursPerDay / 2;
  }
  return { vernalizes: acc >= need, hoursAvailable: acc, needed: need };
}

// Whether the climate ever drops below the variety's dieBelowTemp. Returns
// { survives: bool, dangerDays: number } where dangerDays is the count of
// days where average temperature falls under dieBelowTemp.
//
// For evergreens (mango, lychee, breadfruit), dieBelowTemp is positive
// (5-10°C), so any cold winter will kill them. For deciduous, dieBelowTemp
// is deep negative (-20 to -28°C), which most temperate climates won't hit.
export function climateSurvivable(tree, climate, greenhouseBonus = 0) {
  if (!tree || !Array.isArray(climate) || climate.length === 0) {
    return { survives: true, dangerDays: 0 };
  }
  let dangerDays = 0;
  for (const c of climate) {
    if ((c.avg + greenhouseBonus) <= tree.dieBelowTemp) dangerDays++;
  }
  return { survives: dangerDays === 0, dangerDays };
}

// Given today (game day) and the climate, find the next day where the tree
// will be in each lifecycle phase. Returns { plantBy, vernalized, flowers, fruits, ripe }
// in game-day numbers. plantBy is "the latest you should plant a cutting and
// expect first fruit during the season" (heuristic: must finish before the
// last day where temperature will support flowering).
//
// This is a planning-grade estimate, not a tick simulation. The actual game
// tracks vernalizationHours hour-by-hour against climate. We assume:
//   - vernalization will be satisfied during winter for any deciduous tree
//     that exists in this climate (verified by vernalizationCheck)
//   - dormancy break happens on the first day after winter where avg temp >=
//     leaveDormancyTemp (~19°C for most varieties)
//   - flower → fruit → ripe takes floweringDays + fruitingDays days from
//     dormancy break (ripe day is when harvest opens)
//
// For evergreens, dormancyBreak = blossomAtYearRel × yearLength.
export function treeTimeline(tree, climate, today, daysPerMonth = 9, greenhouseBonus = 0) {
  if (!tree || !Array.isArray(climate) || climate.length === 0) return null;
  const yearLen = climate.length;

  let dormancyBreakDayOfYear;
  if (tree.cycleType === 'Evergreen') {
    dormancyBreakDayOfYear = Math.round((tree.blossomAtYearRel ?? 0.3) * yearLen);
  } else {
    // Find the first day each year where avg temp >= leaveDormancyTemp.
    // Walk forward from day 0 up to yearLen and find the first crossing.
    let firstWarm = null;
    for (let d = 0; d < yearLen; d++) {
      if ((climate[d].avg + greenhouseBonus) >= tree.leaveDormancyTemp) { firstWarm = d + 1; break; }
    }
    dormancyBreakDayOfYear = firstWarm;
  }

  if (dormancyBreakDayOfYear == null) {
    return { fruitInClimate: false, reason: `Daily average temperature never reaches ${tree.leaveDormancyTemp}°C, so the tree won't break dormancy.` };
  }

  // Compute when fruit ripens this year (or year after, if dormancy break has passed)
  const todayDayOfYear = ((today - 1) % yearLen) + 1;
  const todayYearStart = today - todayDayOfYear + 1;

  function flowerCycle(startDay) {
    return {
      flowers: Math.round(startDay),
      fruits:  Math.round(startDay + tree.floweringDays),
      ripe:    Math.round(startDay + tree.floweringDays + tree.fruitingDays),
      ripeEnd: Math.round(startDay + tree.floweringDays + tree.fruitingDays + tree.ripeDays),
    };
  }

  // First-year fruiting (if a fully-grown tree planted today already)
  let dormancyBreakAbs = todayYearStart + dormancyBreakDayOfYear - 1;
  let cycle = flowerCycle(dormancyBreakAbs);
  // If this year's window has already passed, push to next year.
  if (cycle.ripe < today) {
    dormancyBreakAbs += yearLen;
    cycle = flowerCycle(dormancyBreakAbs);
  }

  // For deciduous: check vernalization possible at all.
  // For evergreens: check climate doesn't drop under dieBelowTemp.
  const vCheck = vernalizationCheck(tree, climate, 24, greenhouseBonus);
  const sCheck = climateSurvivable(tree, climate, greenhouseBonus);
  const fruitInClimate = tree.cycleType === 'Deciduous'
    ? (vCheck.vernalizes && sCheck.survives)
    : sCheck.survives;

  return {
    fruitInClimate,
    vernalization: vCheck,
    survival: sCheck,
    dormancyBreak: dormancyBreakAbs,
    flowers: cycle.flowers,
    fruits: cycle.fruits,
    ripe: cycle.ripe,
    ripeEnd: cycle.ripeEnd,
  };
}

// "When to plant a cutting": we want the cutting to root, mature, and survive
// at least one winter for vernalization (deciduous). Best window is right
// after the last frost so it has the full warm season to grow.
//
// Returns { earliestDay, latestDay } where:
//   earliest = first day where avg temp > 5°C (warm enough for active growth)
//   latest   = last day where avg temp > 5°C (still in active growth)
// 5°C is the conventional baseline for active plant growth (growing-degree-day
// base). It also corresponds to the vernalization temperature for most apples
// and cherries.
//
// For evergreens, this still returns the warm window (greater context for the
// player); the actual blossom-time check is enforced by treeTimeline().
export function plantingWindow(tree, climate, greenhouseBonus = 0) {
  if (!tree || !Array.isArray(climate) || climate.length === 0) return null;
  const yearLen = climate.length;

  let earliest = null, latest = null;
  for (let d = 0; d < yearLen; d++) {
    const avg = climate[d].avg + greenhouseBonus;
    if (avg > 5 && earliest === null) earliest = d + 1; // first warm day
    if (avg > 5) latest = d + 1; // last warm day
  }
  return { earliestDay: earliest, latestDay: latest };
}

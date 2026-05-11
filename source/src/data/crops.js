// Crops reference. All 18 crops with parameters from the JSONs (post 1.20).
//
// Crop block params: vssurvivalmod /survival/blocktypes/plant/crop/*.json
// Satiety: vssurvivalmod /survival/itemtypes/food/{vegetable,grain,fruit,legume,
//          pickledlegume,rawcassava,bread,pickledvegetable}.json
// Slicing recipes: vssurvivalmod /survival/recipes/grid/{pumpkin,pineapple}slice.json
// Meal bonus: BlockMeal.cs line 648, 1.3x per ingredient
//
// Yields are NatFloat distributions in the JSON: { avg, var } pairs. The
// per-crop "yield" / "yieldVar" below is the avg / var at the FULLY RIPE
// stage. Most distributions are normal (default); pumpkin uses invexp
// (right-skewed: most rolls near low end, occasional big rolls).
// Harvesting one stage early (yieldEarly) returns about half.
//
// Every crop also drops a small number of seeds: at full ripe, avg 1.2
// seeds; at one-stage-early, avg 0.99; at any earlier stage, avg 0.7.
// The SEEDS_AT_RIPE constant captures the universal pattern.
//
// Satiety per ONE drop unit (base game numbers):
//   satietyRaw       : eat unprocessed. 0 if not directly edible (grains, soybean,
//                      pumpkin block, pineapple block, cassava, licorice).
//   satietyProcessed : after the simplest non-cooking processing step. Vegetable:
//                      same as raw. Pumpkin/pineapple: per-slice × slice count.
//                      Soybean: pickled (150). Cassava: 0 (still meal-only after
//                      soaking per current JSON). Grain: 0 (must bake to be food).
//   satietyInMeal    : as a stew/meal ingredient. Uses nutritionPropsWhenInMeal
//                      if defined, otherwise raw × 1.3 per BlockMeal.cs.
//   satietyAsBread   : grains only. Per-grain bread-perfect from bread.json.
//   foodCategory     : Vegetable / Grain / Fruit / Protein / Spice.
//   secondaryUses    : non-food uses. ['fiber'] for flax, ['bait'] for licorice
//                      and fennel (Farmhand-only via SC mod ps-fishing.json).
//   extras           : additional drops per harvest beyond the main yield. Used
//                      for flax fiber.

// Universal seed yield at full-ripe harvest. Same across all 18 crops.
// Source: every crop JSON has "seeds-{name}: { avg: 1.2 }" at the ripe stage.
export const SEEDS_AT_RIPE = 1.2;
// One-stage-early harvest: full crop yield is reduced (varies per crop;
// generally drops to ~25-50% of the ripe yield). Seeds drop to ~0.99.
export const SEEDS_ONE_EARLY = 0.99;
// Earlier than that, seeds-only drops at avg 0.7.
export const SEEDS_PRE_RIPE = 0.7;


export const CROPS = {
  rye: {
    key: 'rye', name: 'Rye',
    nutrient: 'N', cons: 35, stages: 9, months: 1.78,
    cold: -12, heat: 27, ripeMul: 0.5, stuntMul: 0.75,
    yield: 5.5, yieldVar: 1, hardy: true,
    foodCategory: 'Grain',
    satietyRaw: 0, satietyProcessed: 0, satietyInMeal: 240, satietyAsBread: 300,
    satietyNote: 'Grain JSON default *: in-meal 240. Bread perfect: 300.',
    secondaryUses: [],
  },
  carrot: {
    key: 'carrot', name: 'Carrot',
    nutrient: 'K', cons: 34.3, stages: 7, months: 1.03,
    cold: -10, heat: 32, ripeMul: 0.5, stuntMul: 0.75,
    yield: 11, yieldVar: 2, hardy: true,
    foodCategory: 'Vegetable',
    satietyRaw: 100, satietyProcessed: 100, satietyInMeal: 150, satietyAsBread: 0,
    satietyNote: 'Vegetable JSON: raw 100, in-meal 150.',
    secondaryUses: [],
  },
  parsnip: {
    key: 'parsnip', name: 'Parsnip',
    nutrient: 'P', cons: 17.5, stages: 8, months: 1.75,
    cold: -10, heat: 32, ripeMul: 0.5, stuntMul: 0.75,
    yield: 12, yieldVar: 2, hardy: true,
    foodCategory: 'Vegetable',
    satietyRaw: 100, satietyProcessed: 100, satietyInMeal: 150, satietyAsBread: 0,
    satietyNote: 'Vegetable JSON default *: raw 100, in-meal 150.',
    secondaryUses: [],
  },
  fennel: {
    key: 'fennel', name: 'Fennel',
    nutrient: 'N', cons: 35, stages: 9, months: 2.67,
    cold: -8, heat: 35, ripeMul: 0.5, stuntMul: 0.75,
    yield: 11, yieldVar: 2, hardy: true, isNew: true,
    foodCategory: 'Vegetable',
    satietyRaw: 50, satietyProcessed: 50, satietyInMeal: 60, satietyAsBread: 0,
    satietyNote: 'Vegetable JSON: raw 50, in-meal 60. Pickled 40.',
    secondaryUses: ['bait'],
  },
  licorice: {
    key: 'licorice', name: 'Licorice',
    nutrient: 'P', cons: 35, stages: 9, months: 2.67,
    cold: -8, heat: 35, ripeMul: 0.5, stuntMul: 0.75,
    yield: 11, yieldVar: 2, hardy: true, isNew: true,
    foodCategory: 'Spice',
    satietyRaw: 0, satietyProcessed: 0, satietyInMeal: 0, satietyAsBread: 0,
    satietyNote: 'Spice. No satiety. Vanilla fishingbait recipe (recipes/cooking/fishingbait.json) accepts licorice OR fennel as the stinky-herb component: water + licorice + dough or meat in a cooking pot makes 3 to 4 fishingbait. Farmhand has an SC-mod-exclusive shortcut: mortar + licorice + dough or meat (no water, no pot) yields 6 to 8 baits per craft. Also a flavoring in cooked meals.',
    secondaryUses: ['bait', 'spice'],
  },
  onion: {
    key: 'onion', name: 'Onion',
    nutrient: 'P', cons: 30, stages: 7, months: 1.54,
    cold: -1, heat: 40, ripeMul: 0.5, stuntMul: 0.5,
    yield: 12, yieldVar: 2, hardy: false,
    foodCategory: 'Vegetable',
    satietyRaw: 100, satietyProcessed: 100, satietyInMeal: 150, satietyAsBread: 0,
    satietyNote: 'Vegetable JSON: raw 100, in-meal 150.',
    secondaryUses: [],
  },
  turnip: {
    key: 'turnip', name: 'Turnip',
    nutrient: 'N', cons: 24, stages: 5, months: 0.80,
    cold: -5, heat: 27, ripeMul: 0.5, stuntMul: 0.5,
    yield: 7, yieldVar: 1, hardy: false,
    foodCategory: 'Vegetable',
    satietyRaw: 100, satietyProcessed: 100, satietyInMeal: 150, satietyAsBread: 0,
    satietyNote: 'Vegetable JSON default *: raw 100, in-meal 150.',
    secondaryUses: [],
  },
  cabbage: {
    key: 'cabbage', name: 'Cabbage',
    nutrient: 'N', cons: 36.67, stages: 12, months: 1.375,
    cold: -5, heat: 35, ripeMul: 0.5, stuntMul: 0.5,
    yield: 2, yieldVar: 0, hardy: false,
    foodCategory: 'Vegetable',
    satietyRaw: 300, satietyProcessed: 300, satietyInMeal: 450, satietyAsBread: 0,
    satietyNote: 'Vegetable JSON: raw 300, in-meal 450.',
    secondaryUses: [],
  },
  spelt: {
    key: 'spelt', name: 'Spelt',
    nutrient: 'N', cons: 35, stages: 9, months: 1.78,
    cold: -5, heat: 40, ripeMul: 0.5, stuntMul: 0.5,
    yield: 6, yieldVar: 1, hardy: false,
    foodCategory: 'Grain',
    satietyRaw: 0, satietyProcessed: 0, satietyInMeal: 240, satietyAsBread: 300,
    satietyNote: 'Grain JSON default *: in-meal 240. Bread perfect: 300.',
    secondaryUses: [],
  },
  flax: {
    key: 'flax', name: 'Flax',
    nutrient: 'K', cons: 44.4, stages: 9, months: 1.78,
    cold: -5, heat: 40, ripeMul: 0.5, stuntMul: 0.5,
    yield: 3, yieldVar: 0.5, hardy: false,
    foodCategory: 'Grain',
    satietyRaw: 0, satietyProcessed: 0, satietyInMeal: 120, satietyAsBread: 160,
    satietyNote: 'Grain JSON: raw 30, in-meal 120. Bread perfect: 160. yield is GRAIN drop count (3); plus 4 fiber/harvest scaled by Tailor flaxFiberDropRate.',
    secondaryUses: ['fiber'],
    extras: [{ key: 'flaxFiber', name: 'Flax fiber', baseYield: 4, varYield: 0.5, scaledBy: 'flaxFiberDropRate' }],
  },
  sunflower: {
    key: 'sunflower', name: 'Sunflower',
    nutrient: 'N', cons: 36, stages: 12, months: 1.70,
    cold: -5, heat: 40, ripeMul: 0.5, stuntMul: 0.5,
    yield: 6.5, yieldVar: 1, hardy: false,
    foodCategory: 'Grain',
    satietyRaw: 0, satietyProcessed: 0, satietyInMeal: 240, satietyAsBread: 300,
    satietyNote: 'Grain JSON default *: in-meal 240. Bread perfect: 300. Also pressable to oil (separate system, not modeled).',
    secondaryUses: ['oil'],
  },
  soybean: {
    key: 'soybean', name: 'Soybean',
    nutrient: 'K', cons: 32, stages: 11, months: 1.14,
    cold: -5, heat: 40, ripeMul: 0.5, stuntMul: 0.5,
    yield: 6, yieldVar: 1, hardy: false,
    foodCategory: 'Protein',
    satietyRaw: 0, satietyProcessed: 150, satietyInMeal: 240, satietyAsBread: 0,
    satietyNote: 'Cannot be eaten raw. Pickled in barrel = 150 (pickledlegume.json *-soybean). In meal = 240.',
    secondaryUses: [],
  },
  pumpkin: {
    key: 'pumpkin', name: 'Pumpkin',
    nutrient: 'P', cons: 30, stages: 8, months: 1.70,
    cold: -5, heat: 40, ripeMul: 0.5, stuntMul: 0.5,
    yield: 2, yieldVar: 3, yieldDist: 'invexp', hardy: false,
    foodCategory: 'Vegetable',
    satietyRaw: 0, satietyProcessed: 560, satietyInMeal: 720, satietyAsBread: 0,
    satietyNote: 'Pumpkin block. pumpkinslice.json: 4 slices/block. Per slice: raw 140 / in-meal 180. Block totals: raw 560 / in-meal 720. Mother plant spawns 1-5 fruit blocks per cycle (invexp dist, avg 2).',
    secondaryUses: [],
  },
  amaranth: {
    key: 'amaranth', name: 'Amaranth',
    nutrient: 'N', cons: 13.33, stages: 9, months: 1.78,
    cold: 6, heat: 42, ripeMul: 0.5, stuntMul: 0.5,
    yield: 3, yieldVar: 0.5, hardy: false,
    foodCategory: 'Grain',
    satietyRaw: 0, satietyProcessed: 0, satietyInMeal: 240, satietyAsBread: 300,
    satietyNote: 'Grain JSON default *: in-meal 240. Bread perfect: 300.',
    secondaryUses: [],
  },
  cassava: {
    key: 'cassava', name: 'Cassava',
    nutrient: 'K', cons: 22.2, stages: 9, months: 4.40,
    cold: 4, heat: 44, ripeMul: 0.5, stuntMul: 0.5,
    yield: 16, yieldVar: 2, hardy: false,
    foodCategory: 'Vegetable',
    satietyRaw: 0, satietyProcessed: 0, satietyInMeal: 120, satietyAsBread: 300,
    satietyNote: 'Drops rawcassava-raw. Per current rawcassava.json only nutritionPropsWhenInMeal = 120; no direct-eat satiety. Wiki claims soaked = 100 raw; JSON disagrees. Soak then dry then mill = flour for bread (300 per cassava worth).',
    secondaryUses: [],
  },
  peanut: {
    key: 'peanut', name: 'Peanut',
    nutrient: 'P', cons: 40, stages: 9, months: 2.20,
    cold: 10, heat: 42, ripeMul: 0.5, stuntMul: 0.5,
    yield: 10, yieldVar: 2, hardy: false,
    foodCategory: 'Protein',
    satietyRaw: 160, satietyProcessed: 160, satietyInMeal: 210, satietyAsBread: 0,
    satietyNote: 'Eat raw. 160 per peanut. In-meal 210.',
    secondaryUses: [],
  },
  rice: {
    key: 'rice', name: 'Rice',
    nutrient: 'K', cons: 45, stages: 10, months: 2.00,
    cold: 8, heat: 46, ripeMul: 0.5, stuntMul: 0.5,
    yield: 6.5, yieldVar: 1, hardy: false,
    foodCategory: 'Grain',
    satietyRaw: 0, satietyProcessed: 0, satietyInMeal: 280, satietyAsBread: 330,
    satietyNote: 'Grain JSON: raw 75, in-meal 280. Bread perfect: 330.',
    secondaryUses: [],
  },
  pineapple: {
    key: 'pineapple', name: 'Pineapple',
    nutrient: 'N', cons: 14, stages: 16, months: 5.60,
    cold: 6, heat: 48, ripeMul: 0.5, stuntMul: 0.5,
    yield: 1, yieldVar: 0, hardy: false,
    foodCategory: 'Fruit',
    satietyRaw: 0, satietyProcessed: 960, satietyInMeal: 1440, satietyAsBread: 0,
    satietyNote: 'Pineapple block. pineappleslice.json: 12 slices/block. Per slice (fruit JSON default *): raw 80 / in-meal 120. Block totals: raw 960 / in-meal 1440.',
    secondaryUses: [],
  },
};

export const CROPS_LIST = [
  'rye', 'carrot', 'parsnip', 'fennel', 'licorice', 'onion', 'turnip', 'cabbage',
  'spelt', 'flax', 'sunflower', 'soybean', 'pumpkin', 'amaranth',
  'cassava', 'peanut', 'rice', 'pineapple',
].map(k => CROPS[k]);

export const CROPS_BY_NUTRIENT = {
  N: CROPS_LIST.filter(c => c.nutrient === 'N'),
  P: CROPS_LIST.filter(c => c.nutrient === 'P'),
  K: CROPS_LIST.filter(c => c.nutrient === 'K'),
};

// Total days for a crop to fully mature, given the server's days-per-month
// and the worldconfig cropGrowthRateMul. The vanilla formula multiplies stage
// time by 1/GetGrowthRate, where GetGrowthRate is influenced by player class,
// nutrients, and moisture. cropGrowthRateMul is a flat multiplier at the
// world level: a 2.0x server halves all crop grow times. Default 1.0.
export function growDays(crop, daysPerMonth = 9, cropGrowthRateMul = 1.0) {
  const baseDays = crop.months * daysPerMonth;
  const mul = cropGrowthRateMul > 0 ? cropGrowthRateMul : 1.0;
  return baseDays / mul;
}

export function drainPerStage(crop) {
  return crop.cons / Math.max(1, crop.stages - 1);
}

export function drainPerDay(crop, daysPerMonth = 9, cropGrowthRateMul = 1.0) {
  return crop.cons / growDays(crop, daysPerMonth, cropGrowthRateMul);
}

// Resolve a crop's satiety per drop unit under one of four modes.
//   raw       : straight off the plant. Many crops are 0.
//   processed : after the simplest non-cooking step (slice, pickle, soak).
//   meal      : as a meal ingredient. Uses nutritionPropsWhenInMeal if the
//               JSON defines one, otherwise raw × 1.3 per BlockMeal.cs.
//   bread     : grains baked perfect. 0 for non-grains.
// Best practical satiety value for a crop, no matter what its category is.
// For grains: bread (the only way they're food). For everything else: the
// 'processed' value (what you get after chopping/peeling without cooking).
// This is the right default for "ranks crops by their actual food potential."
function cropBestSatiety(crop) {
  if (!crop) return 0;
  // Grains have 0 raw and 0 processed but real value as bread.
  if ((crop.satietyAsBread || 0) > 0 && (crop.satietyProcessed || 0) === 0) {
    return crop.satietyAsBread;
  }
  return crop.satietyProcessed || crop.satietyRaw || 0;
}

export function cropSatiety(crop, mode = 'auto') {
  if (!crop) return 0;
  switch (mode) {
    case 'raw':       return crop.satietyRaw || 0;
    case 'processed': return crop.satietyProcessed || 0;
    case 'meal':      return crop.satietyInMeal || 0;
    case 'bread':     return crop.satietyAsBread || 0;
    case 'auto':      return cropBestSatiety(crop);
    default:          return cropBestSatiety(crop);
  }
}

export const SATIETY_MODES = [
  { key: 'auto',      label: 'Best practical (auto)', hint: 'Picks the right valuation per crop. Grains = bread. Everything else = the simplest non-cooking processing step. Default.' },
  { key: 'raw',       label: 'Raw',                   hint: 'Eat unprocessed. Grains, pumpkin, cassava, soybean and pineapple show 0.' },
  { key: 'processed', label: 'Best non-cooking',      hint: 'Slice, pickle, soak (no cooking). Grains show 0.' },
  { key: 'meal',      label: 'In meal / pie / pot',   hint: 'As an ingredient in a stew, pie, soup, or porridge. Uses nutritionPropsWhenInMeal from each crop\'s JSON.' },
  { key: 'bread',     label: 'Bread (grains only)',   hint: 'Grains baked perfect. 0 for non-grains.' },
];

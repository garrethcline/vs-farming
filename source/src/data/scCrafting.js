// Specialized Classes mod recipes that affect farming.
// Source: assets/specializedclasses/recipes/grid/{class}/*.json
//
// All recipes have a `requiresTrait` so only the matching class can craft them.
// Numbers are verbatim from the recipe JSONs.

export const SC_RECIPES = {
  // ---- FARMHAND ----
  // Tier-up soil. Chain in player names: Very Low → Low → Medium → High → Terra Preta.
  // (Internal codes are: verylow → low → medium → compost → high.)
  // Each craft consumes 2 compost + 1 bonemeal + 1 powder-charcoal regardless
  // of batch size, so the per-output cost shrinks at lower tiers.
  farmhand_soil_low: {
    trait: 'farmhand', category: 'soil',
    in: { 'soil-verylow-none': 64, compost: 2, bonemeal: 1, 'powder-charcoal': 1 },
    out: { 'soil-low-none': 64 },
    note: 'Hoe required (in hand). Per-block cost is tiny because of the 64x batch.',
  },
  farmhand_soil_medium: {
    trait: 'farmhand', category: 'soil',
    in: { 'soil-low-none': 16, compost: 2, bonemeal: 1, 'powder-charcoal': 1 },
    out: { 'soil-medium-none': 16 },
    note: 'Hoe required.',
  },
  farmhand_soil_composttier: {
    trait: 'farmhand', category: 'soil',
    in: { 'soil-medium-none': 4, compost: 2, bonemeal: 1, 'powder-charcoal': 1 },
    out: { 'soil-compost-none': 4 },
    note: 'Hoe required. Output is High-tier soil (+65 base NPK per axis, the wiki name "High Fertility").',
  },
  farmhand_soil_high: {
    trait: 'farmhand', category: 'soil',
    in: { 'soil-compost-none': 1, compost: 2, bonemeal: 1, 'powder-charcoal': 1 },
    out: { 'soil-high-none': 1 },
    note: 'Hoe required. Output is Terra Preta (+80 base NPK per axis, the rare top tier). 1:1 ratio is brutal: 1 High-tier soil + 2 compost + 1 bonemeal + 1 powder-charcoal yields just 1 Terra Preta block.',
  },
  farmhand_potash: {
    trait: 'farmhand', category: 'fertilizer',
    in: { 'ore-sylvite': 1, 'mortar-pestle': 'tool' },
    out: { potash: 4 },
    note: 'Vanilla recipe gives 1 potash per sylvite ore via the quern. Farmhand gives 4x.',
  },
  farmhand_bonemeal: {
    trait: 'farmhand', category: 'fertilizer',
    in: { bone: 1, 'mortar-pestle': 'tool' },
    out: { bonemeal: 2 },
    note: 'Vanilla quern recipe gives 1 bonemeal per bone. Farmhand gives 2x.',
  },
  farmhand_powder_charcoal: {
    trait: 'farmhand', category: 'fertilizer',
    in: { charcoal: 1, 'mortar-pestle': 'tool' },
    out: { 'powder-charcoal': 2 },
    note: '2x charcoal powder. Vanilla has no quern recipe at all.',
  },
  farmhand_compost: {
    trait: 'farmhand', category: 'fertilizer',
    in: { rot: 4, 'soil-*-none': 1, 'mortar-pestle': 'tool' },
    out: { compost: 2 },
    note: 'Bypass the slow compost barrel entirely. 4 rot + 1 soil block = 2 compost. Soil block returned? Not from the recipe; it gets consumed.',
  },
  farmhand_rot_vegetable: {
    trait: 'farmhand', category: 'rot',
    in: { rot: 1, 'vegetable-*': 1, 'mortar-pestle': 'tool' },
    out: { rot: 2 },
    note: 'Doubles rot using any harvested veg. Cheapest rot expansion when crops are running.',
  },
  farmhand_rot_fruit: {
    trait: 'farmhand', category: 'rot',
    in: { rot: 1, 'fruit-*': 1, 'mortar-pestle': 'tool' },
    out: { rot: 2 },
  },
  farmhand_rot_grain: {
    trait: 'farmhand', category: 'rot',
    in: { rot: 1, 'grain-*': 1, 'mortar-pestle': 'tool' },
    out: { rot: 2 },
  },
  farmhand_rot_mushroom: {
    trait: 'farmhand', category: 'rot',
    in: { rot: 1, 'mushroom-*': 1, 'mortar-pestle': 'tool' },
    out: { rot: 2 },
  },
  farmhand_rot_seeds: {
    trait: 'farmhand', category: 'rot',
    in: { rot: 1, 'seeds-*': 1, 'mortar-pestle': 'tool' },
    out: { rot: 2 },
    note: 'Hardy crops drop ~1.2 seeds at full ripe; converting one extra seed per harvest into rot is essentially free.',
  },

  // ---- SPELUNKER ----
  spelunker_lime: {
    trait: 'spelunker', category: 'mining',
    in: { 'stone-{chalk/limestone/marble}': 1, 'mortar-pestle': 'tool' },
    out: { lime: 2 },
    note: 'Vanilla quern recipe gives 1 lime per stone. Spelunker doubles it. Lime is the input for saltpeter.',
  },
  spelunker_salt: {
    trait: 'spelunker', category: 'mining',
    in: { 'stone-halite': 1, 'mortar-pestle': 'tool' },
    out: { salt: 4 },
    note: 'Halite stone is rare and only spawns underground. 4x salt is huge for food preservation.',
  },
  spelunker_powder_ore: {
    trait: 'spelunker', category: 'mining',
    in: { 'ore-{any}': 1, 'mortar-pestle': 'tool' },
    out: { 'powder-{ore}': 4 },
    note: '4x ore powder for any ore type. Affects pigments and metalworking, not farming directly.',
  },
  spelunker_saltpeter: {
    trait: 'spelunker', category: 'fertilizer',
    in: { compost: 4, lime: 16, 'mortar-pestle': 'tool' },
    out: { saltpeter: 8 },
    note: '8 saltpeter from 4 compost + 16 lime via grid (mortar+pestle in hand). NOTE: the Compounding Vat workstation has the SAME recipe with no trait required - see no-trait section below.',
  },

  // ---- VINTNER ----
  vintner_bushcutting: {
    trait: 'vintner', category: 'propagation',
    in: { 'fruit-{berry}': 8, 'soil-compost-none': 1 },
    out: { 'fruitingbushcutting-{berry}-free': 1 },
    note: 'Grid recipe, Vintner only. Costs 8 berries + 1 High-tier soil per cutting. Compare to the no-trait Sprouting Table version below: 1 fruit + 1 compost. The Vintner version is much more expensive and probably never the right choice once you have a sprouting table.',
  },

  // ---- TAILOR ----
  tailor_papyrustops: {
    trait: 'tailor', category: 'wildprocessing',
    in: { drygrass: 6, spindle: 'tool' },
    out: { papyrustops: 1 },
    note: 'Tailor-only. Vanilla papyrus only spawns in specific biomes; this lets you make papyrus from drygrass anywhere.',
  },
  tailor_flaxfibers: {
    trait: 'tailor', category: 'wildprocessing',
    in: { drygrass: 16, spindle: 'tool' },
    out: { flaxfibers: 1 },
    note: 'Tailor-only. Lets you make flax fibers without growing flax. 16 drygrass per fiber is steep but useful early game or in biomes flax cannot survive.',
  },
  tailor_flaxtwine: {
    trait: 'tailor', category: 'wildprocessing',
    in: { flaxfibers: 3, spindle: 'tool' },
    out: { flaxtwine: 1 },
    note: 'Tailor-only. Vanilla twine takes 4 fibers; this saves 1 per twine.',
  },
  tailor_rope_reed: {
    trait: 'tailor', category: 'wildprocessing',
    in: { 'reedtops': 3, spindle: 'tool' },
    out: { rope: 1 },
    note: 'Tailor-only. Make rope from reed/papyrus tops.',
  },
  tailor_rope_vine: {
    trait: 'tailor', category: 'wildprocessing',
    in: { 'wildvine-*': 3, spindle: 'tool' },
    out: { rope: 2 },
    note: 'Tailor-only. Wild vines make 2 rope per craft, the cheapest rope path.',
  },

  // ---- FARMHAND fishing.json (uses farmed crops) ----
  farmhand_bait_dough: {
    trait: 'farmhand', category: 'baiting',
    in: { 'spice-licorice OR vegetable-fennel': 1, 'dough-*': 1, 'mortar-pestle': 'tool' },
    out: { 'fishingbait-dough': 6 },
    note: 'Doubles as a sink for excess licorice/fennel harvest into 6 fishing bait per craft.',
  },
  farmhand_bait_bushmeat: {
    trait: 'farmhand', category: 'baiting',
    in: { 'spice-licorice OR vegetable-fennel': 1, 'bushmeat-raw': 1, 'mortar-pestle': 'tool' },
    out: { 'fishingbait-bushmeat': 6 },
  },
  farmhand_bait_fishmeat: {
    trait: 'farmhand', category: 'baiting',
    in: { 'spice-licorice OR vegetable-fennel': 1, 'fish-raw': 1, 'mortar-pestle': 'tool' },
    out: { 'fishingbait-fishmeat': 6 },
  },
  farmhand_bait_poultry: {
    trait: 'farmhand', category: 'baiting',
    in: { 'spice-licorice OR vegetable-fennel': 1, 'poultry-raw': 1, 'mortar-pestle': 'tool' },
    out: { 'fishingbait-poultry': 8 },
    note: 'Best yield when paired with poultry from your own chickens.',
  },
  farmhand_bait_redmeat: {
    trait: 'farmhand', category: 'baiting',
    in: { 'spice-licorice OR vegetable-fennel': 1, 'redmeat-raw': 1, 'mortar-pestle': 'tool' },
    out: { 'fishingbait-redmeat': 8 },
  },

  // ---- NO-TRAIT (Sprouting Table workstation) ----
  // These are crucial farming recipes that DO NOT need any class trait.
  // Anyone with a sprouting table can do them. Most players miss these.
  sprout_seed_grain: {
    trait: 'none', category: 'sprouting',
    in: { 'grain-*': 1, compost: 1, 'sprouting-table': 'workstation' },
    out: { 'seeds-{grain}': 1 },
    note: 'Sprouting table workstation, NO trait required. Convert grain back into a seed for replanting.',
  },
  sprout_seed_vegetable: {
    trait: 'none', category: 'sprouting',
    in: { 'vegetable-*': 1, compost: 1, 'sprouting-table': 'workstation' },
    out: { 'seeds-{vegetable}': 1 },
    note: 'No trait. Vegetables that drop seeds rarely (cabbage, pumpkin) become much easier to scale.',
  },
  sprout_seed_cassava: {
    trait: 'none', category: 'sprouting',
    in: { 'rawcassava-raw': 1, compost: 1, 'sprouting-table': 'workstation' },
    out: { 'seeds-cassava': 1 },
    note: 'No trait. Cassava propagation.',
  },
  sprout_seed_licorice: {
    trait: 'none', category: 'sprouting',
    in: { 'spice-licorice-raw': 1, compost: 1, 'sprouting-table': 'workstation' },
    out: { 'seeds-licorice': 1 },
    note: 'No trait.',
  },
  sprout_seed_fruit: {
    trait: 'none', category: 'sprouting',
    in: { 'fruit-*': 2, compost: 1, 'sprouting-table': 'workstation' },
    out: { 'seeds-{fruit}': 1 },
    note: 'No trait. Get fruit seeds from harvested fruit. 2 fruit per seed.',
  },
  sprout_seed_legume: {
    trait: 'none', category: 'sprouting',
    in: { 'legume-*': 1, compost: 1, 'sprouting-table': 'workstation' },
    out: { 'seeds-{legume}': 1 },
    note: 'No trait. Soybean and peanut propagation.',
  },
  sprout_fruittree_cutting: {
    trait: 'none', category: 'sprouting',
    in: { 'fruit-*': 1, compost: 1, 'sprouting-table': 'workstation' },
    out: { 'fruittree-cutting': 1 },
    note: 'No trait. Make a fruit-tree cutting from any fruit. Cheapest way to start an orchard. Cutting plants on farmland and grows into a tree.',
  },
  sprout_bushcutting: {
    trait: 'none', category: 'sprouting',
    in: { 'fruit-{berry}': 1, compost: 1, 'sprouting-table': 'workstation' },
    out: { 'fruitingbushcutting-{berry}-free': 1 },
    note: 'No trait. WAY cheaper than the Vintner grid recipe (1 berry + 1 compost vs 8 berries + 1 High soil).',
  },

  // ---- NO-TRAIT (Compounding Vat workstation) ----
  vat_compost: {
    trait: 'none', category: 'vat',
    in: { rot: 4, 'soil-*-none': 1, 'compounding-vat': 'workstation' },
    out: { compost: 2 },
    note: 'No trait at the Compounding Vat. Same recipe as the Farmhand grid version - having a vat lets ANY player make compost this fast.',
  },
  vat_saltpeter: {
    trait: 'none', category: 'vat',
    in: { compost: 4, lime: 16, 'compounding-vat': 'workstation' },
    out: { saltpeter: 8 },
    note: 'No trait at the Compounding Vat. You do NOT need a Spelunker to craft saltpeter, despite what the Spelunker recipe might imply. Spelunker advantage: gets 2x lime from chalk/limestone/marble, which feeds this recipe faster.',
  },
};

// Per-output cost rolled back to base ingredients. Used by the soil tier-up
// efficiency calculator on the Fertilizers tab.
//
// Returns { compost, bonemeal, powder } needed per ONE output block of the
// final tier, walking the chain from the requested base tier upward.
//
// inputTier: 'verylow' | 'low' | 'medium' | 'compost'
// outputTier: 'low' | 'medium' | 'compost' | 'high'
//
// The chain is fixed; we walk one step at a time and accumulate the cost.
// Each craft uses 2 compost + 1 bonemeal + 1 powder for a batch of N outputs:
//   verylow -> 64 low
//   low     -> 16 medium
//   medium  -> 4 compost-tier
//   compost -> 1 high
const TIER_ORDER = ['verylow', 'low', 'medium', 'compost', 'high'];
const BATCH_PER_STEP = { 'verylow->low': 64, 'low->medium': 16, 'medium->compost': 4, 'compost->high': 1 };

export function soilCraftCost(inputTier, outputTier) {
  const startIdx = TIER_ORDER.indexOf(inputTier);
  const endIdx = TIER_ORDER.indexOf(outputTier);
  if (startIdx < 0 || endIdx <= startIdx) return null;

  let costPerOutput = { compost: 0, bonemeal: 0, powder: 0, soilUsed: 0 };
  // Walk top-down: 1 output of `outputTier` requires 1/batchOfFinalStep crafts,
  // each consuming `batchSize` of the previous tier as input. The previous-tier
  // input is itself a mix of "already-have-it" base soil and additional crafts
  // upstream, we accumulate the additional crafts.
  let blocksOfThisTier = 1;  // we want 1 output of outputTier
  for (let i = endIdx; i > startIdx; i--) {
    const step = `${TIER_ORDER[i-1]}->${TIER_ORDER[i]}`;
    const batch = BATCH_PER_STEP[step];
    const crafts = blocksOfThisTier / batch;
    costPerOutput.compost += 2 * crafts;
    costPerOutput.bonemeal += 1 * crafts;
    costPerOutput.powder += 1 * crafts;
    // Each craft consumes `batch` of the previous tier as input. Total previous-tier
    // blocks needed = crafts × batch = blocksOfThisTier.
    blocksOfThisTier = crafts * batch;
  }
  // After the loop, blocksOfThisTier = number of input-tier blocks consumed
  costPerOutput.soilUsed = blocksOfThisTier;
  return costPerOutput;
}

// Compare: 1 medium-tier soil block upgraded to high via crafting vs
// fertilizing in-place with the Farmhand perk.
//
// Crafting cost: see soilCraftCost('medium', 'high').
// Direct cost: enough compost applications to bridge the fertility gap.
//
// Source for direct: the SC mod adds fertilizerPermanencePercentage = 0.25.
// Each application: originalFertility[axis] += INT(ROUND(propsNPK * 0.25, 1)).
// Compost = (40, 8, 8). Per application: +10 N, +2 P, +2 K (after rounding).
// Soil base values: medium=50, high=80. Gap = +30 to all axes (fertility tier
// is the floor of (avg original NPK / X), but the simpler view is N target).
// So 3 compost applications close the N gap. P and K need many more.
//
// Returns:
//   craft: { compost, bonemeal, powder, soilUsed }
//   direct: { perAxis: 'N': { compost, gain }, 'P', 'K' }
//   verdict: short text recommending one or the other
export function compareSoilUpgrade(fromTier, toTier, hasFarmhand) {
  const SOIL_FERTILITY = { verylow: 5, low: 25, medium: 50, compost: 65, high: 80 };
  const fromVal = SOIL_FERTILITY[fromTier];
  const toVal = SOIL_FERTILITY[toTier];
  const gap = toVal - fromVal;
  if (gap <= 0) return { error: 'Target tier must be higher than source tier' };

  const craft = soilCraftCost(fromTier, toTier);
  if (!craft) return { error: 'No crafting path between these tiers' };

  // Direct fertilizing math (Farmhand perk only):
  // Each compost application: +10 N (base 40 × 0.25 rounded), +2 P, +2 K
  const composts_to_close_N = Math.ceil(gap / 10);
  const composts_to_close_P = Math.ceil(gap / 2);
  const composts_to_close_K = Math.ceil(gap / 2);

  const directWithoutPerk = 'no permanent boost; per-application N/P/K decays normally';

  return {
    fromTier, toTier, gap,
    craft: {
      ...craft,
      // Total raw cost summed
      total: craft.compost + craft.bonemeal + craft.powder,
    },
    direct: {
      hasFarmhand,
      composts_to_close_N,
      composts_to_close_P,
      composts_to_close_K,
      // To close ALL axes you'd use the max
      composts_for_all_axes: composts_to_close_P,  // P/K are the bottleneck
      perApplicationGain: { n: 10, p: 2, k: 2 },
      directWithoutPerk,
    },
  };
}

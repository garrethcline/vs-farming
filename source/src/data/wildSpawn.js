// Wild spawn data for crops, berry bushes, fruit trees, and forest trees.
//
// Source files (game data):
//   crops:        survival/worldgen/blockpatches/crop.json
//   berry bushes: survival/worldgen/blockpatches/berrybush.json
//   fruit trees:  survival/blocktypes/plant/fruittreebranch.json (worldgen attribute)
//   forest trees: survival/worldgen/treengenproperties.json (treegens + shrubgens)
//
// SCALES:
//   Crops/bushes: temp in degrees C, rain 0-1, fertility 0-1.
//   Trees/shrubs: temp in degrees C, rain 0-255, fertility 0-255, forest 0-255.
//                 We keep the raw 0-255 values for trees and convert the player's
//                 climate (which is on 0-1 rain) at compare time.
//
// SPAWN MATH (verified against game source):
//   Crops/bushes: per-chunk patch chance = chance × ChanceMultiplier(2.5 avg)
//                 × quantity.avg (blocks per patch). Climate range is hard cutoff.
//   Forest trees: 70 trees per chunk gaussian-distributed. For each tree variant,
//                 compute distance from climate-mid normalized by half-range:
//                   d = |player - variantMid| / variantRange    (per axis)
//                 Skip if any 1.2*d^2 > 1 (variant culled). Score per variant:
//                   score = clamp(1 - sum(d_axes)/5, 0, 1) * weight/100
//                 Final per-chunk count = 70 × (score / sum_of_all_scores).
//   Shrubs: same as trees but 90 per chunk.
//   Fruit trees: spawn ON existing forest trees with worldgen-time roll. Density
//                depends on local forest mix. We don't compute density; just
//                show the climate range and "in range / not in range".

export const CHANCE_MULTIPLIER = 2.5;  // blockpatches.json -> chanceMultiplier.avg
export const CHUNK_SIZE = 32;
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;  // 1024 m^2
export const TREES_PER_CHUNK = 70;
export const SHRUBS_PER_CHUNK = 90;

export const WILD_CROPS = [
  { name: 'Spelt', code: 'spelt', minTemp: 3, maxTemp: 26, minRain: 0.38, maxRain: 0.75, maxForest: 0.5, qtyAvg: 13.3, chance: 0.036 },
  { name: 'Rye', code: 'rye', minTemp: -10, maxTemp: 14, minRain: 0.35, maxRain: 0.75, maxForest: 0.5, qtyAvg: 13.3, chance: 0.036 },
  { name: 'Flax', code: 'flax', minTemp: 3, maxTemp: 31, minRain: 0.35, maxRain: 0.75, maxForest: 0.5, qtyAvg: 13.3, chance: 0.09 },
  { name: 'Soybean', code: 'soybean', minTemp: 20, maxTemp: 40, minRain: 0.35, maxRain: 0.75, maxForest: 1.0, qtyAvg: 5, chance: 0.0335 },
  { name: 'Carrot', code: 'carrot', minTemp: 5, maxTemp: 24, minRain: 0.35, maxRain: 0.75, maxForest: 0.6, qtyAvg: 5, chance: 0.04 },
  { name: 'Onion', code: 'onion', minTemp: 3, maxTemp: 29, minRain: 0.38, maxRain: 0.75, maxForest: 0.6, qtyAvg: 5, chance: 0.03 },
  { name: 'Parsnip', code: 'parsnip', minTemp: 1, maxTemp: 22, minRain: 0.38, maxRain: 0.75, maxForest: 0.65, qtyAvg: 5, chance: 0.015 },
  { name: 'Turnip', code: 'turnip', minTemp: 1, maxTemp: 26, minRain: 0.38, maxRain: 0.75, maxForest: 0.65, qtyAvg: 5, chance: 0.03 },
  { name: 'Rice', code: 'rice', minTemp: 22, maxTemp: 40, minRain: 0.5, maxRain: 1.0, maxForest: 0.5, qtyAvg: 13.3, chance: 0.036 },
  { name: 'Cassava', code: 'cassava', minTemp: 23, maxTemp: 48, minRain: 0.28, maxRain: 0.6, minForest: 0.1, maxForest: 0.4, qtyAvg: 4, chance: 0.07 },
  { name: 'Amaranth', code: 'amaranth', minTemp: 17, maxTemp: 42, minRain: 0.35, maxRain: 0.8, minForest: 0.1, maxForest: 0.4, qtyAvg: 16, chance: 0.07 },
  { name: 'Pineapple', code: 'pineapple', minTemp: 26, maxTemp: 45, minRain: 0.7, maxRain: 1.0, minForest: 0.6, maxForest: 1.0, qtyAvg: 3, chance: 0.09 },
  { name: 'Peanut', code: 'peanut', minTemp: 25, maxTemp: 40, minRain: 0.5, maxRain: 1.0, maxForest: 0.7, qtyAvg: 5, chance: 0.02 },
  { name: 'Sunflower', code: 'sunflower', minTemp: 15, maxTemp: 36, minRain: 0.3, maxRain: 0.65, maxForest: 0.3, qtyAvg: 13.3, chance: 0.06 },
  { name: 'Fennel', code: 'fennel', minTemp: -10, maxTemp: 18, minRain: 0.3, maxRain: 0.8, maxForest: 0.3, qtyAvg: 5, chance: 0.02 },
  { name: 'Licorice', code: 'licorice', minTemp: 18, maxTemp: 36, minRain: 0.3, maxRain: 0.6, maxForest: 0.25, qtyAvg: 5, chance: 0.02 },
];

export const WILD_BUSHES = [
  { name: 'Blackcurrant', code: 'blackcurrant', minTemp: -2, maxTemp: 23, minRain: 0.3, maxRain: 0.7, minFert: 0.25, maxFert: 0.6, maxForest: 0.5, qtyAvg: 2, chance: 0.12 },
  { name: 'Redcurrant', code: 'redcurrant', minTemp: -3, maxTemp: 22, minRain: 0.3, maxRain: 0.7, minFert: 0.25, maxFert: 0.6, maxForest: 0.4, qtyAvg: 2, chance: 0.12 },
  { name: 'Whitecurrant', code: 'whitecurrant', minTemp: 0, maxTemp: 24, minRain: 0.3, maxRain: 0.7, minFert: 0.25, maxFert: 0.6, maxForest: 0.4, qtyAvg: 2, chance: 0.03 },
  { name: 'Blueberry', code: 'blueberry', minTemp: -2, maxTemp: 18, minRain: 0.3, maxRain: 0.7, maxFert: 0.5, minForest: 0.5, qtyAvg: 5, chance: 0.10 },
  { name: 'Cranberry', code: 'cranberry', minTemp: -2, maxTemp: 18, minRain: 0.45, maxRain: 1.0, maxFert: 1.0, maxForest: 0.7, qtyAvg: 5, chance: 0.08 },
  { name: 'Strawberry', code: 'strawberry', minTemp: -2, maxTemp: 18, minRain: 0.45, maxRain: 1.0, maxFert: 1.0, minForest: 0.6, qtyAvg: 10, chance: 0.08 },
  { name: 'Beautyberry', code: 'beautyberry', minTemp: 10, maxTemp: 22, minRain: 0.45, maxRain: 1.0, maxFert: 1.0, maxForest: 0.4, qtyAvg: 5, chance: 0.08 },
  { name: 'Cloudberry', code: 'cloudberry', minTemp: -20, maxTemp: -3, minRain: 0.5, maxRain: 1.0, maxFert: 0.5, maxForest: 0.7, qtyAvg: 10, chance: 0.02 },
  { name: 'Blackberry', code: 'blackberry', minTemp: -2, maxTemp: 23, minRain: 0.35, maxRain: 1.0, maxFert: 0.8, minForest: 0.5, qtyAvg: 7, chance: 0.08 },
  { name: 'Raspberry', code: 'raspberry', minTemp: -15, maxTemp: 10, minRain: 0.3, maxRain: 1.0, minFert: 0.6, maxFert: 1.0, maxForest: 0.4, qtyAvg: 4, chance: 0.08 },
];

export const WILD_FRUIT_TREES = [
  { name: 'Pink apple', code: 'pinkapple', minTemp: -5, maxTemp: 18, minRain: 0.5, maxRain: 1.0 },
  { name: 'Red apple', code: 'redapple', minTemp: -9, maxTemp: 18, minRain: 0.5, maxRain: 0.9 },
  { name: 'Yellow apple', code: 'yellowapple', minTemp: 0, maxTemp: 22, minRain: 0.6, maxRain: 1.0 },
  { name: 'Cherry', code: 'cherry', minTemp: 0, maxTemp: 24, minRain: 0.6, maxRain: 1.0 },
  { name: 'Mango', code: 'mango', minTemp: 28, maxTemp: 50, minRain: 0.6, maxRain: 1.0 },
  { name: 'Olive', code: 'olive', minTemp: 22, maxTemp: 50, minRain: 0.3, maxRain: 0.5 },
  { name: 'Orange', code: 'orange', minTemp: 25, maxTemp: 30, minRain: 0.45, maxRain: 1.0 },
  { name: 'Peach', code: 'peach', minTemp: 10, maxTemp: 17, minRain: 0.55, maxRain: 1.0 },
  { name: 'Pear', code: 'pear', minTemp: -10, maxTemp: 19, minRain: 0.5, maxRain: 1.0 },
  { name: 'Breadfruit', code: 'breadfruit', minTemp: 28, maxTemp: 50, minRain: 0.6, maxRain: 1.0 },
  { name: 'Lychee', code: 'lychee', minTemp: 22, maxTemp: 50, minRain: 0.6, maxRain: 1.0 },
  { name: 'Pomegranate', code: 'pomegranate', minTemp: 22, maxTemp: 50, minRain: 0.3, maxRain: 0.7 },
];

// Forest trees from treengenproperties.json (treegens + shrubgens).
// Auto-generated, all 35 trees + 5 shrubs included.
// NB: temp is degrees C; rain/fert/forest are raw 0-255 per the game source.
// Some trees appear twice with different climate ranges (silver birch, old
// English oak); both variants are kept since the game treats them as separate
// candidates.
export const WILD_TREES = [
  { name: 'Fern tree', code: 'ferntree-normal-trunk', kind: 'tree', weight: 90, minTemp: 26, maxTemp: 40, minRain255: 185, maxRain255: 255, minFert255: 0, maxFert255: 255, minForest255: 0, maxForest255: 255, minHeight: 0, maxHeight: 1 },
  { name: 'Green bamboo', code: 'bamboo-grown-green', kind: 'tree', weight: 100, minTemp: 34, maxTemp: 40, minRain255: 170, maxRain255: 235, minFert255: 0, maxFert255: 255, minForest255: 0, maxForest255: 255, minHeight: 0, maxHeight: 1 },
  { name: 'Brown bamboo', code: 'bamboo-grown-brown', kind: 'tree', weight: 100, minTemp: 25, maxTemp: 35, minRain255: 170, maxRain255: 235, minFert255: 0, maxFert255: 255, minForest255: 0, maxForest255: 255, minHeight: 0, maxHeight: 1 },
  { name: 'Silver birch (lowland)', code: 'silverbirch-low', kind: 'tree', weight: 120, minTemp: 3, maxTemp: 16, minRain255: 95, maxRain255: 255, minFert255: 10, maxFert255: 100, minForest255: 10, maxForest255: 255, minHeight: 0.0, maxHeight: 0.65 },
  { name: 'Silver birch (small)', code: 'silverbirch-small', kind: 'tree', weight: 70, minTemp: 0, maxTemp: 12, minRain255: 65, maxRain255: 180, minFert255: 10, maxFert255: 100, minForest255: 10, maxForest255: 180, minHeight: 0.0, maxHeight: 0.75 },
  { name: 'River birch', code: 'riverbirch', kind: 'tree', weight: 100, minTemp: 6, maxTemp: 22, minRain255: 180, maxRain255: 255, minFert255: 100, maxFert255: 255, minForest255: 0, maxForest255: 255, minHeight: 0.0, maxHeight: 0.4 },
  { name: 'Himalayan birch', code: 'himalayanbirch', kind: 'tree', weight: 25, minTemp: 3, maxTemp: 12, minRain255: 95, maxRain255: 220, minFert255: 10, maxFert255: 100, minForest255: 0, maxForest255: 255, minHeight: 0.65, maxHeight: 1 },
  { name: 'English oak', code: 'englishoak', kind: 'tree', weight: 35, minTemp: 2, maxTemp: 22, minRain255: 95, maxRain255: 170, minFert255: 90, maxFert255: 255, minForest255: 90, maxForest255: 200, minHeight: 0.0, maxHeight: 0.7 },
  { name: 'Walnut', code: 'walnut', kind: 'tree', weight: 2, minTemp: 6, maxTemp: 22, minRain255: 95, maxRain255: 170, minFert255: 90, maxFert255: 255, minForest255: 20, maxForest255: 100, minHeight: 0.0, maxHeight: 0.7 },
  { name: 'Old English oak', code: 'oldenglishoak', kind: 'tree', weight: 0.5, minTemp: 2, maxTemp: 22, minRain255: 95, maxRain255: 170, minFert255: 90, maxFert255: 255, minForest255: 90, maxForest255: 200, minHeight: 0.0, maxHeight: 0.7 },
  { name: 'Crimson king maple', code: 'crimsonkingmaple', kind: 'tree', weight: 30, minTemp: 8, maxTemp: 9, minRain255: 110, maxRain255: 130, minFert255: 90, maxFert255: 200, minForest255: 90, maxForest255: 250, minHeight: 0.15, maxHeight: 0.5 },
  { name: 'Sugar maple', code: 'sugarmaple', kind: 'tree', weight: 70, minTemp: 0, maxTemp: 20, minRain255: 95, maxRain255: 180, minFert255: 90, maxFert255: 200, minForest255: 90, maxForest255: 250, minHeight: 0.0, maxHeight: 0.7 },
  { name: 'Japanese maple', code: 'japanesemaple', kind: 'tree', weight: 7, minTemp: 10, maxTemp: 18, minRain255: 150, maxRain255: 180, minFert255: 90, maxFert255: 200, minForest255: 60, maxForest255: 100, minHeight: 0.0, maxHeight: 1 },
  { name: 'Norway maple', code: 'norwaymaple', kind: 'tree', weight: 80, minTemp: 3, maxTemp: 23, minRain255: 110, maxRain255: 190, minFert255: 80, maxFert255: 200, minForest255: 90, maxForest255: 200, minHeight: 0.0, maxHeight: 0.4 },
  { name: 'Mountain maple', code: 'mountainmaple', kind: 'tree', weight: 30, minTemp: 4, maxTemp: 20, minRain255: 85, maxRain255: 190, minFert255: 80, maxFert255: 220, minForest255: 0, maxForest255: 250, minHeight: 0.5, maxHeight: 1 },
  { name: 'Scots pine', code: 'scotspine', kind: 'tree', weight: 80, minTemp: -14, maxTemp: 12, minRain255: 50, maxRain255: 150, minFert255: 30, maxFert255: 255, minForest255: 0, maxForest255: 255, minHeight: 0, maxHeight: 0.92 },
  { name: 'Larch', code: 'larch', kind: 'tree', weight: 25, minTemp: -17, maxTemp: -3, minRain255: 100, maxRain255: 255, minFert255: 30, maxFert255: 255, minForest255: 0, maxForest255: 255, minHeight: 0, maxHeight: 0.92 },
  { name: 'Deep forest larch', code: 'deepforestlarch', kind: 'tree', weight: 120, minTemp: -17, maxTemp: -4, minRain255: 100, maxRain255: 255, minFert255: 30, maxFert255: 255, minForest255: 220, maxForest255: 255, minHeight: 0, maxHeight: 0.92 },
  { name: 'Bristlecone pine', code: 'bristleconepine', kind: 'tree', weight: 8, minTemp: 20, maxTemp: 40, minRain255: 40, maxRain255: 80, minFert255: 20, maxFert255: 255, minForest255: 150, maxForest255: 180, minHeight: 0, maxHeight: 1 },
  { name: 'Mountain pine', code: 'mountainpine', kind: 'tree', weight: 60, minTemp: -18, maxTemp: 12, minRain255: 50, maxRain255: 150, minFert255: 30, maxFert255: 255, minForest255: 0, maxForest255: 255, minHeight: 0.4, maxHeight: 1 },
  { name: 'Redwood pine', code: 'redwoodpine', kind: 'tree', weight: 100, minTemp: 14, maxTemp: 18, minRain255: 180, maxRain255: 255, minFert255: 30, maxFert255: 255, minForest255: 50, maxForest255: 255, minHeight: 0.4, maxHeight: 1 },
  { name: 'Fir', code: 'fir', kind: 'tree', weight: 100, minTemp: -10, maxTemp: 15, minRain255: 75, maxRain255: 150, minFert255: 30, maxFert255: 255, minForest255: 0, maxForest255: 255, minHeight: 0, maxHeight: 0.88 },
  { name: 'Greenspire cypress', code: 'greenspirecypress', kind: 'tree', weight: 120, minTemp: 8, maxTemp: 22, minRain255: 30, maxRain255: 90, minFert255: 72, maxFert255: 130, minForest255: 28, maxForest255: 72, minHeight: 0, maxHeight: 0.8 },
  { name: 'Bald cypress (swamp)', code: 'baldcypressswamp', kind: 'tree', weight: 60, minTemp: 15, maxTemp: 24, minRain255: 180, maxRain255: 255, minFert255: 100, maxFert255: 255, minForest255: 120, maxForest255: 255, minHeight: 0.3, maxHeight: 1 },
  { name: 'Bald cypress', code: 'baldcypress', kind: 'tree', weight: 20, minTemp: 15, maxTemp: 24, minRain255: 180, maxRain255: 255, minFert255: 100, maxFert255: 255, minForest255: 120, maxForest255: 255, minHeight: 0.3, maxHeight: 1 },
  { name: 'Acacia', code: 'acacia', kind: 'tree', weight: 100, minTemp: 28, maxTemp: 40, minRain255: 80, maxRain255: 140, minFert255: 50, maxFert255: 200, minForest255: 50, maxForest255: 255, minHeight: 0.0, maxHeight: 0.8 },
  { name: 'Dead acacia', code: 'deadacacia', kind: 'tree', weight: 1, minTemp: 28, maxTemp: 40, minRain255: 80, maxRain255: 140, minFert255: 50, maxFert255: 200, minForest255: 50, maxForest255: 255, minHeight: 0.0, maxHeight: 0.8 },
  { name: 'Purpleheart', code: 'purpleheart', kind: 'tree', weight: 1, minTemp: 27, maxTemp: 40, minRain255: 185, maxRain255: 255, minFert255: 160, maxFert255: 255, minForest255: 120, maxForest255: 255, minHeight: 0.0, maxHeight: 0.9 },
  { name: 'Ebony', code: 'ebony', kind: 'tree', weight: 1, minTemp: 28, maxTemp: 40, minRain255: 100, maxRain255: 140, minFert255: 50, maxFert255: 200, minForest255: 50, maxForest255: 255, minHeight: 0.0, maxHeight: 0.8 },
  { name: 'Dead kapok', code: 'deadkapok', kind: 'tree', weight: 1.5, minTemp: 27, maxTemp: 40, minRain255: 185, maxRain255: 255, minFert255: 160, maxFert255: 255, minForest255: 120, maxForest255: 255, minHeight: 0.0, maxHeight: 0.9 },
  { name: 'Kapok', code: 'kapok', kind: 'tree', weight: 90, minTemp: 27, maxTemp: 40, minRain255: 185, maxRain255: 255, minFert255: 160, maxFert255: 255, minForest255: 120, maxForest255: 255, minHeight: 0.0, maxHeight: 0.9 },
  { name: 'Vine-covered kapok', code: 'vineykapok', kind: 'tree', weight: 30, minTemp: 27, maxTemp: 40, minRain255: 185, maxRain255: 255, minFert255: 160, maxFert255: 255, minForest255: 120, maxForest255: 190, minHeight: 0.0, maxHeight: 0.9 },
  { name: 'Large kapok', code: 'largekapok', kind: 'tree', weight: 0.1, minTemp: 27, maxTemp: 40, minRain255: 185, maxRain255: 255, minFert255: 160, maxFert255: 255, minForest255: 160, maxForest255: 255, minHeight: 0.0, maxHeight: 0.9 },
  { name: 'Large kapok (variant)', code: 'largekapok2', kind: 'tree', weight: 0.12, minTemp: 27, maxTemp: 40, minRain255: 185, maxRain255: 255, minFert255: 160, maxFert255: 255, minForest255: 160, maxForest255: 255, minHeight: 0.0, maxHeight: 0.9 },
  { name: 'Prickly moses (shrub)', code: 'pricklymoses', kind: 'shrub', weight: 100, minTemp: 22, maxTemp: 40, minRain255: 60, maxRain255: 140, minFert255: 30, maxFert255: 150, minForest255: 50, maxForest255: 255, minHeight: 0.0, maxHeight: 0.93 },
  { name: 'English oak (small)', code: 'englishoak-shrub', kind: 'shrub', weight: 35, minTemp: 2, maxTemp: 22, minRain255: 95, maxRain255: 170, minFert255: 90, maxFert255: 255, minForest255: 90, maxForest255: 200, minHeight: 0.0, maxHeight: 0.7 },
  { name: 'Sugar maple (small)', code: 'sugarmaplesmall', kind: 'shrub', weight: 70, minTemp: 0, maxTemp: 22, minRain255: 95, maxRain255: 180, minFert255: 90, maxFert255: 200, minForest255: 90, maxForest255: 250, minHeight: 0.0, maxHeight: 0.7 },
  { name: 'Kapok (small)', code: 'kapok-shrub', kind: 'shrub', weight: 100, minTemp: 25, maxTemp: 40, minRain255: 185, maxRain255: 255, minFert255: 160, maxFert255: 255, minForest255: 160, maxForest255: 255, minHeight: 0.0, maxHeight: 0.9 },
  { name: 'Dwarf birch', code: 'dwarfbirch', kind: 'shrub', weight: 100, minTemp: -15, maxTemp: 12, minRain255: 30, maxRain255: 255, minFert255: 0, maxFert255: 180, minForest255: 0, maxForest255: 255, minHeight: 0.0, maxHeight: 1.0 },
];

// ----------------------------------------------------------------------------
// Estimator math
// ----------------------------------------------------------------------------

// For crops/bushes/fruit-trees: simple inRange + linear distance to range
// For trees/shrubs: weighted competition with all variants
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Compute the suitability score the game uses for a tree variant.
// Returns 0 if any axis is too far out (1.2*d^2 > 1 means d > ~0.913).
// Otherwise: weight/100 * clamp(1 - sumDist/5, 0, 1).
//
// Inputs use the same scale the game uses internally:
//   tempC: degrees C
//   rain255, fert255, forest255: 0-255 ints
//   heightRel: 0-1 (sea-level relative)
function variantSuitability(v, tempC, rain255, fert255, forest255, heightRel) {
  const tempMid = (v.minTemp + v.maxTemp) / 2;
  const tempRange = Math.max(1, (v.maxTemp - v.minTemp) / 2);
  const rainMid = (v.minRain255 + v.maxRain255) / 2;
  const rainRange = Math.max(1, (v.maxRain255 - v.minRain255) / 2);
  const fertMid = (v.minFert255 + v.maxFert255) / 2;
  const fertRange = Math.max(1, (v.maxFert255 - v.minFert255) / 2);
  const forestMid = (v.minForest255 + v.maxForest255) / 2;
  const forestRange = Math.max(1, (v.maxForest255 - v.minForest255) / 2);
  const heightMid = (v.minHeight + v.maxHeight) / 2;
  const heightRange = Math.max(0.001, (v.maxHeight - v.minHeight) / 2);

  const tempD = Math.abs(tempC - tempMid) / tempRange;
  const rainD = Math.abs(rain255 - rainMid) / rainRange;
  const fertD = Math.abs(fert255 - fertMid) / fertRange;
  const forestD = Math.abs(forest255 - forestMid) / forestRange;
  const heightD = Math.abs(heightRel - heightMid) / heightRange;

  // Game does `if (rnd.NextDouble() < distSq) continue;` per attempt. So a
  // variant with distSq=0.5 survives 50% of attempts. For expected per-chunk
  // count we multiply the score by survival probability = max(0, 1 - distSq).
  const distSq =
    Math.max(0, 1.2 * tempD * tempD - 1) +
    Math.max(0, 1.2 * rainD * rainD - 1) +
    Math.max(0, 1.2 * fertD * fertD - 1) +
    Math.max(0, 1.2 * forestD * forestD - 1) +
    Math.max(0, 1.2 * heightD * heightD - 1);
  const survivalProb = Math.max(0, 1 - distSq);
  if (survivalProb <= 0) return 0;

  const linearScore = clamp(1 - (tempD + rainD + fertD + forestD + heightD) / 5, 0, 1) * (v.weight / 100);
  return linearScore * survivalProb;
}

// Estimate per-chunk count for a specific tree variant given the player's
// climate. Walks all variants of the same kind (tree or shrub) to compute
// the total denominator.
//
// playerRain is on 0-1; we convert to 0-255 internally.
// playerFert is on 0-1 also (or estimated from rain+temp if not supplied);
// we convert to 0-255 too.
export function treeDensityAtClimate(targetVariant, { playerTemp, playerRain, playerFert = null, forestHint = 128, heightRel = 0.5 }) {
  const rain255 = Math.round(clamp(playerRain, 0, 1) * 255);
  // If no fertility supplied, approximate from rain like the game does.
  // GetFertility(rain, temp, height) is roughly: rain * (1-tempBias). We use
  // a simpler approximation: fertility scales with rainfall, drops with extreme
  // temperatures. For our estimator-grade math we just use rain * 200 + 30.
  const fertEstimate = playerFert !== null
    ? clamp(playerFert, 0, 1) * 255
    : clamp(rain255 * 0.7 + 30, 0, 255);

  const sameKind = WILD_TREES.filter(t => t.kind === targetVariant.kind);
  let totalScore = 0;
  let targetScore = 0;
  for (const v of sameKind) {
    const s = variantSuitability(v, playerTemp, rain255, fertEstimate, forestHint, heightRel);
    totalScore += s;
    if (v.code === targetVariant.code) targetScore = s;
  }
  if (totalScore === 0 || targetScore === 0) {
    return { perChunk: 0, score: targetScore, totalScore };
  }
  const perChunkAll = targetVariant.kind === 'shrub' ? SHRUBS_PER_CHUNK : TREES_PER_CHUNK;
  const perChunk = perChunkAll * (targetScore / totalScore);
  return { perChunk, score: targetScore, totalScore };
}

// For crops/bushes
export function patchDensityAtClimate(entry, { playerTemp, playerRain, playerFert = 0.5 }) {
  const tempOK = playerTemp >= entry.minTemp && playerTemp <= entry.maxTemp;
  const rainOK = playerRain >= (entry.minRain ?? 0) && playerRain <= (entry.maxRain ?? 1);
  const fertOK = entry.minFert !== undefined || entry.maxFert !== undefined
    ? playerFert >= (entry.minFert ?? 0) && playerFert <= (entry.maxFert ?? 1)
    : true;
  if (!tempOK || !rainOK || !fertOK) return { perChunk: 0, inRange: false };
  const perChunk = (entry.chance ?? 0) * CHANCE_MULTIPLIER * (entry.qtyAvg ?? 1);
  return { perChunk, inRange: true };
}

// Distance estimate. Combines climate-distance (how far you walk N/S to reach
// the temperature range) and density-distance (nearest-neighbor in the biome).
//
// Inputs:
//   playerTemp/Rain/Fert: current climate (temp °C, rain 0-1, fert 0-1)
//   polarEqDist: server's polarEquatorDistance (default 50000)
//
// Returns:
//   inRange: boolean (player's spot satisfies the spawn conditions)
//   perChunk: blocks-per-chunk if you ARE in the matching biome
//   tempDirection: 'north' | 'south' | 'here' (which way to walk for temp)
//   climateDistanceBlocks: blocks to walk for the temp shift
//   nearestInBiomeBlocks: expected nearest-neighbor distance once in biome
export function spawnEstimate(entry, { playerTemp, playerRain, playerFert = 0.5, polarEqDist = 50000, worldLength = Infinity, kind = 'crop', forestHint = 128 }) {
  // 1) Density and in-range check at the player's climate
  let perChunkHere = 0;
  let inRange = false;
  if (kind === 'tree' || kind === 'shrub') {
    const result = treeDensityAtClimate(entry, { playerTemp, playerRain, playerFert, forestHint });
    perChunkHere = result.perChunk;
    inRange = perChunkHere > 0.01;
  } else if (kind === 'fruittree') {
    inRange = playerTemp >= entry.minTemp && playerTemp <= entry.maxTemp
           && playerRain >= entry.minRain && playerRain <= entry.maxRain;
    perChunkHere = inRange ? null : 0;  // null = density-not-applicable
  } else {
    const r = patchDensityAtClimate(entry, { playerTemp, playerRain, playerFert });
    perChunkHere = r.perChunk;
    inRange = r.inRange;
  }

  // 2) Climate distance.
  //
  // The world's temperature follows a triangular wave on the z axis with
  // period (2 × polarEquatorDistance):
  //   temp(z) = base × (1 − |((|z| mod 2P) − P) / P|)   plus seasonal noise
  // So the world has multiple equators (z = 0, ±2P, ±4P, ...) and multiple
  // poles (z = ±P, ±3P, ±5P, ...). On a finite world (worldLength), z wraps
  // at the world edges. We don't know the player's absolute z position, so
  // we compute relative distance: how many blocks until temperature first
  // enters the variant's [minTemp, maxTemp] range walking either direction.
  //
  // Approach: simulate stepping in 100-block increments toward warmer or
  // cooler. The temperature delta per step is +/-(65/P × 100) BUT the sign
  // flips at every pole and every equator, so we cap the search to one
  // half-period (P blocks) since after P blocks you've crossed a pole or
  // equator and the trend reverses. If the variant's temp range can't be
  // reached within P blocks of travel, the variant is unreachable on this
  // axis (the "warmest the world ever gets" or "coldest" never matches).
  //
  // We also bound by worldLength/2 since beyond that you've wrapped around.
  const tempMin = entry.minTemp;
  const tempMax = entry.maxTemp;
  let tempDelta = 0;
  let tempDirection = 'here';
  let climateDistanceBlocks = 0;
  let unreachable = false;

  if (playerTemp < tempMin) {
    tempDelta = tempMin - playerTemp;
    tempDirection = 'warmer';
  } else if (playerTemp > tempMax) {
    tempDelta = tempMax - playerTemp;
    tempDirection = 'cooler';
  }

  if (tempDirection !== 'here') {
    const blocksPerDegC = polarEqDist / 65;
    const linearDist = Math.abs(tempDelta) * blocksPerDegC;
    const halfWorld = (worldLength / 2) || Infinity;
    const halfPeriod = polarEqDist;  // P; one pole-to-equator distance

    // Cap by world wrap and by the half-period (after which trend reverses).
    // If the linear estimate exceeds either, climate is unreachable in that
    // direction (you'd need to come at it from the wrap-around side, but the
    // total-travel ends up being roughly the same since the wave repeats).
    if (linearDist > Math.min(halfWorld, halfPeriod)) {
      // Could try the wrap-around path: walk the OTHER direction, cross a
      // pole/equator, and reach the variant range from the back side. The
      // extreme point in the OTHER direction is also bounded by halfPeriod;
      // beyond a pole, temp starts coming back. So if the variant needs
      // hotter temps than the equator allows, or colder than the pole, it's
      // simply unreachable on this server.
      // For the common case, the wrap-around distance to a "next equator"
      // is (2P − linearDist), which can be shorter on small servers.
      const wrapDist = 2 * polarEqDist - linearDist;
      if (wrapDist < halfWorld && wrapDist < linearDist) {
        // Wrap path is shorter. Direction flips since we'd be going around.
        climateDistanceBlocks = wrapDist;
        tempDirection = tempDirection === 'warmer' ? 'cooler' : 'warmer';
      } else {
        unreachable = true;
        climateDistanceBlocks = Infinity;
      }
    } else {
      climateDistanceBlocks = linearDist;
    }
  }

  // 3) Nearest-neighbor in-biome.
  // For trees: assume that once the climate enters this tree's range, this tree
  // becomes the dominant species (score / total ratio close to 1). Use the same
  // perChunkAll as the cap.
  // For crops/bushes: chance-driven.
  let nearestInBiomeBlocks = null;
  if (kind === 'fruittree') {
    nearestInBiomeBlocks = null;  // can't estimate; depends on host trees
  } else {
    let perChunkInBiome;
    if (kind === 'tree' || kind === 'shrub') {
      // If player is in range here, just use the local density.
      // If not, estimate density at the variant's IDEAL spot: temperature at
      // its tempMid, rainfall at its rainMid (converted back from 0-255 to 0-1),
      // fertility/forest at the variant's mid. This gives a real per-chunk
      // count for that ideal climate using the same suitability formula.
      if (inRange) {
        perChunkInBiome = perChunkHere;
      } else {
        const idealTemp = (entry.minTemp + entry.maxTemp) / 2;
        const idealRain = ((entry.minRain255 + entry.maxRain255) / 2) / 255;
        const idealFert = ((entry.minFert255 + entry.maxFert255) / 2) / 255;
        const result = treeDensityAtClimate(entry, {
          playerTemp: idealTemp,
          playerRain: idealRain,
          playerFert: idealFert,
          forestHint: (entry.minForest255 + entry.maxForest255) / 2,
          heightRel: (entry.minHeight + entry.maxHeight) / 2,
        });
        perChunkInBiome = result.perChunk;
      }
    } else {
      // Crops / bushes: density doesn't depend on player vs biome here, since
      // chance is the same in any matching climate. Use the entry's intrinsic.
      perChunkInBiome = (entry.chance ?? 0) * CHANCE_MULTIPLIER * (entry.qtyAvg ?? 1);
    }
    if (perChunkInBiome > 0) {
      const blocksPerM2 = perChunkInBiome / CHUNK_AREA;
      nearestInBiomeBlocks = 0.5 / Math.sqrt(blocksPerM2);
    }
  }

  return {
    inRange,
    perChunkHere,
    tempDelta,
    tempDirection,
    unreachable,
    climateDistanceBlocks: isFinite(climateDistanceBlocks) ? Math.round(climateDistanceBlocks) : Infinity,
    nearestInBiomeBlocks: nearestInBiomeBlocks !== null ? Math.round(nearestInBiomeBlocks) : null,
    totalDistance: isFinite(climateDistanceBlocks)
      ? Math.round(climateDistanceBlocks + (nearestInBiomeBlocks ?? 0))
      : Infinity,
  };
}

// Format a block distance for display
export function formatDistance(blocks) {
  if (blocks === null) return 'n/a';
  if (!isFinite(blocks)) return 'unreachable';
  if (blocks <= 0) return 'within sight';
  if (blocks < 50) return 'within sight';
  if (blocks < 500) return `~${Math.round(blocks / 10) * 10} blocks`;
  if (blocks < 5000) return `~${Math.round(blocks / 100) * 100} blocks`;
  return `~${(blocks / 1000).toFixed(1)}k blocks`;
}

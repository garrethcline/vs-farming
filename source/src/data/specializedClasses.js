// Specialized Classes mod (v2.2.2) per-class farming/yield modifiers.
// Source of truth: assets/specializedclasses/config/{characterclasses,traits}.json
// from specializedclasses_2_2_2_1_.zip.
//
// How VS reads these stats: Entity.Stats.GetBlended(stat) ?? 1, defaulting to
// 1.0. Trait deltas add to that base. So harvester (cropProduceDropRate +0.5)
// gives 1.5x base produce, uncultured (cropProduceDropRate -0.25) gives 0.75x,
// commoner gives 1.0x.
//
// Confirmed in BlockCrop.cs line 167 for wildCropDropRate. Other drop-rate
// stats follow the same pattern in BEFarmland.GetDrops which isn't in the
// source files I have, but the trait names match the stat names used by
// vssurvivalmod's farming code one-to-one.

export const COMMONER = {
  key: 'commoner',
  name: 'Commoner',
  description: 'No class. Vanilla baseline. All multipliers = 1.0.',
  modifiers: {},
};

// Each entry: code, display name, the trait codes (for reference), and the
// SUMMED effective deltas across all the class's traits. Stats outside the
// farming/yield set are filtered out (combat speed, durability, etc.) since
// they don't affect the planner. See traitSourcesByStat() if you need to
// trace a number back to the trait that produced it.
export const PLAYER_CLASSES = [
  COMMONER,
  {
    key: 'archivist',
    name: 'Archivist',
    description: 'Custodian of paper and clutter. Costs farm yield.',
    traits: ['custodian','archivist','curator','clutterer','steward','unphased','uncultured'],
    modifiers: {
      cropProduceDropRate: -0.25,
      cropSeedDropRate: -0.25,
      flaxFiberDropRate: -0.25,
      fruitTreeDropRate: -0.25,
    },
  },
  {
    key: 'blackguard',
    name: 'Blackguard',
    description: 'Smith and warlord. Worst at farming, full -25% across food and fiber.',
    traits: ['warlord','blackguard','merciless','blacksmith','heatproof','uncultured','sheltered'],
    modifiers: {
      animalLootDropRate: -0.1,
      cropProduceDropRate: -0.25,
      cropSeedDropRate: -0.25,
      flaxFiberDropRate: -0.25,
      forageDropRate: -0.25,
      fruitTreeDropRate: -0.25,
      wildCropDropRate: -0.25,
    },
  },
  {
    key: 'brickmaker',
    name: 'Brickmaker',
    description: 'Ceramist and kilnhand. No crop penalty but loses on wild forage.',
    traits: ['bruiser','brickmaker','improviser','delver','ceramist','kilnhand','sheltered'],
    modifiers: {
      animalLootDropRate: -0.1,
      forageDropRate: -0.25,
      wildCropDropRate: -0.25,
    },
  },
  {
    key: 'butcher',
    name: 'Butcher',
    description: 'Doubles meat. Costs crop and flax yield.',
    traits: ['reaver','butcher','preserver','thorough','rancher','uncultured','uneducated'],
    modifiers: {
      animalLootDropRate: 1.0,
      cropProduceDropRate: -0.25,
      cropSeedDropRate: -0.25,
      flaxFiberDropRate: -0.25,
      fruitTreeDropRate: -0.25,
    },
  },
  {
    key: 'clockmaker',
    name: 'Clockmaker',
    description: 'Tinkerer and engineer. Same crop penalty as Archivist.',
    traits: ['lancer','clockmaker','tinkerer','technical','dismantler','engineer','attuned','crafter','uncultured'],
    modifiers: {
      cropProduceDropRate: -0.25,
      cropSeedDropRate: -0.25,
      flaxFiberDropRate: -0.25,
      fruitTreeDropRate: -0.25,
    },
  },
  {
    key: 'farmhand',
    name: 'Farmhand',
    description: 'The crop class. +50% produce on every crop, doubles seeds (cropSeedDropRate +1.0), doubles wild crops, and breaking an unripe crop always drops 1 seed (youngseeddropchance +1.0). Plus +25% fertilizer permanence (Farmhand-only).',
    traits: ['militia','farmhand','fisherman','harvester','tiller','fertilizer','delicate'],
    modifiers: {
      cropProduceDropRate: 0.5,
      cropSeedDropRate: 1.0,
      wildCropDropRate: 1.0,
      youngseeddropchance: 1.0,
      fertilizerPermanencePercentage: 0.25,
    },
  },
  {
    key: 'florist',
    name: 'Florist',
    description: 'Flowers and herbs. No crop yield change. Niche horsetail/cattail bonuses.',
    traits: ['wanderer','florist','herbalist','plucker','delicate'],
    modifiers: {
      horsetailRareDropChance: 0.2,
      cattailRareDropChance: 0.2,
    },
  },
  {
    key: 'forester',
    name: 'Forester',
    description: 'Trees and saplings. +300% tree seeds (best of any class).',
    traits: ['berserker','forester','collier','lumberjack','nurseryworker','delicate'],
    modifiers: {
      treeSeedDropRate: 3.0,
    },
  },
  {
    key: 'hunter',
    name: 'Hunter',
    description: 'Animals and butchering speed. +25% animal loot, faster harvesting. No crop effect.',
    traits: ['ranger','hunter','bowyer','carver','delicate'],
    modifiers: {
      animalLootDropRate: 0.25,
      animalHarvestingTime: -0.5,
    },
  },
  {
    key: 'malefactor',
    name: 'Malefactor',
    description: 'Rogue and thief. Same crop penalty as Archivist.',
    traits: ['rogue','malefactor','improviser','smuggler','sneak','thief','restrained','uncultured'],
    modifiers: {
      cropProduceDropRate: -0.25,
      cropSeedDropRate: -0.25,
      flaxFiberDropRate: -0.25,
      fruitTreeDropRate: -0.25,
    },
  },
  {
    key: 'messenger',
    name: 'Messenger',
    description: 'Roads and speed. -25% wild and forage but no crop penalty.',
    traits: ['harrier','messenger','roadlayer','swift','sheltered'],
    modifiers: {
      animalLootDropRate: -0.1,
      forageDropRate: -0.25,
      wildCropDropRate: -0.25,
    },
  },
  {
    key: 'quarrier',
    name: 'Quarrier',
    description: 'Stone work. Same wild/forage penalty as Brickmaker.',
    traits: ['laborer','quarrier','ascetic','stonecutter','tunneler','sheltered'],
    modifiers: {
      animalLootDropRate: -0.1,
      forageDropRate: -0.25,
      wildCropDropRate: -0.25,
    },
  },
  {
    key: 'spelunker',
    name: 'Spelunker',
    description: 'Caves and prospecting. Worst farming alongside Blackguard, full -25% spread.',
    traits: ['sapper','spelunker','panner','prospector','uncultured','sheltered'],
    modifiers: {
      animalLootDropRate: -0.1,
      cropProduceDropRate: -0.25,
      cropSeedDropRate: -0.25,
      flaxFiberDropRate: -0.25,
      forageDropRate: -0.25,
      fruitTreeDropRate: -0.25,
      wildCropDropRate: -0.25,
    },
  },
  {
    key: 'tailor',
    name: 'Tailor',
    description: 'The flax class. +100% flax fiber when harvesting flax crops. Plus rare-drop bonuses when cutting tallgrass: +10% to find flax fiber, +10% to find papyrus tops (reeds).',
    traits: ['fencer','tailor','clothier','bespoke','thresher','weaver','delicate'],
    modifiers: {
      flaxFiberDropRate: 1.0,
      flaxFiberRareDropChance: 0.1,
      reedsRareDropChance: 0.1,
    },
  },
  {
    key: 'vintner',
    name: 'Vintner',
    description: 'Fruit, foraging, grafting. +100% forage (covers wild berries), fruit trees, tree seeds.',
    traits: ['yeoman','vintner','gatherer','grafter','picker','delicate'],
    modifiers: {
      forageDropRate: 1.0,
      fruitTreeDropRate: 1.0,
      treeSeedDropRate: 1.0,
    },
  },
];

export const PLAYER_CLASSES_BY_KEY = Object.fromEntries(PLAYER_CLASSES.map(c => [c.key, c]));

export function getPlayerClass(key) {
  return PLAYER_CLASSES_BY_KEY[key] || COMMONER;
}

// Resolved stat value: base 1.0 + sum of trait deltas, like VS's
// Entity.Stats.GetBlended(stat) ?? 1.
export function classStat(classKey, stat) {
  const cls = getPlayerClass(classKey);
  const delta = cls.modifiers?.[stat] ?? 0;
  return 1.0 + delta;
}

// Crop produce yield multiplier for the Decision Helper / Plots scoring.
// Flax is NOT special-cased here, despite an earlier bug. Flax's yield in
// crops.js (3) is the GRAIN drop count, which the game scales by the same
// cropProduceDropRate stat as every other crop. Flax fiber is a separate
// drop and is scaled by flaxFiberDropRate; use classFlaxFiberMul() for that.
export function classProduceYieldMul(classKey, crop) {
  return classStat(classKey, 'cropProduceDropRate');
}

// Flax fiber multiplier (Tailor's perk). Only used for the fiber side of
// flax, since the grain side rides on cropProduceDropRate.
export function classFlaxFiberMul(classKey) {
  return classStat(classKey, 'flaxFiberDropRate');
}

// Seed yield multiplier (for future "harvest also gives seeds" displays).
export function classSeedYieldMul(classKey) {
  return classStat(classKey, 'cropSeedDropRate');
}

// Wild crop multiplier (foraged/uncultivated, not farmland).
export function classWildCropMul(classKey) {
  return classStat(classKey, 'wildCropDropRate');
}

// Probability that an immature (pre-ripe) crop drops one seed when broken.
// Base 0, harvester adds +1 (=> 100%). No other class affects this.
export function classImmatureSeedChance(classKey) {
  const cls = getPlayerClass(classKey);
  return cls.modifiers?.youngseeddropchance ?? 0;
}

// Fertilizer permanence bonus (Farmhand "fertilizer" trait, +0.25 = 25%).
// This is the old SC perk the previous app exposed as a global toggle.
export function classFertilizerPermanenceBonus(classKey) {
  const cls = getPlayerClass(classKey);
  return cls.modifiers?.fertilizerPermanencePercentage ?? 0;
}

// All farming/yield stats this app considers, in display order.
export const TRACKED_STATS = [
  { key: 'cropProduceDropRate',           label: 'Crop produce',         note: 'Carrot, cabbage, rye, and all 17 non-flax crops at harvest. Also scales the GRAIN side of flax (the fiber side uses flaxFiberDropRate).' },
  { key: 'cropSeedDropRate',              label: 'Crop seeds',           note: 'Seeds dropped at harvest from any farmed crop.' },
  { key: 'youngseeddropchance',           label: 'Immature seed chance', note: 'Chance an unripe crop drops 1 seed when broken. Base 0. Harvester gets +1.0 (always).' },
  { key: 'flaxFiberDropRate',             label: 'Flax fiber',           note: 'The fiber drop from harvesting RIPE flax (separate drop from grain). Base 4 fibers/harvest. Tailor +1.0 = 8 fibers; uncultured -0.25 = 3.' },
  { key: 'flaxFiberRareDropChance',       label: 'Tallgrass→flax fiber', note: 'Chance to drop 1 flax fiber when CUTTING TALLGRASS with knife/scythe (NOT from flax crop). Base 0. Tailor +0.1 = 10%.' },
  { key: 'reedsRareDropChance',           label: 'Tallgrass→papyrus',    note: 'Chance to drop 1 papyrus tops (reeds) when cutting tallgrass. Base 0. Tailor +0.1 = 10%.' },
  { key: 'wildCropDropRate',              label: 'Wild crops',           note: 'Foraged uncultivated crops, not farmland.' },
  { key: 'forageDropRate',                label: 'Forage',               note: 'Generic foraging. Wild berries fall under this.' },
  { key: 'fruitTreeDropRate',             label: 'Fruit trees',          note: 'Fruit dropped from trees.' },
  { key: 'treeSeedDropRate',              label: 'Tree seeds',           note: 'Tree seeds (saplings) at chop or harvest.' },
  { key: 'horsetailRareDropChance',       label: 'Horsetail rare drop',  note: 'Bonus rare drop. Base 0.' },
  { key: 'cattailRareDropChance',         label: 'Cattail rare drop',    note: 'Bonus rare drop. Base 0.' },
  { key: 'animalLootDropRate',            label: 'Animal loot',          note: 'Drops when killing animals.' },
  { key: 'animalHarvestingTime',          label: 'Butcher speed',        note: 'Negative = faster. Hunter is -50%.' },
  { key: 'fertilizerPermanencePercentage',label: 'Fertilizer permanence',note: 'On apply, originalFertility[axis] += round(NPK × pct).' },
];

// Returns { classKey: stat, ... } for a given stat, useful if you want
// "who's best at flax fiber" comparisons. Includes Commoner for context.
export function classRankingForStat(stat) {
  return PLAYER_CLASSES
    .map(c => ({ classKey: c.key, name: c.name, value: classStat(c.key, stat) }))
    .sort((a, b) => b.value - a.value);
}

// Mod identification (used by the Settings UI banner).
export const SC_MOD_INFO = {
  name: 'Specialized Classes',
  url: 'https://mods.vintagestory.at/specializedclasses',
  version: '2.2.2',
  identifier: 'specializedclasses',
};

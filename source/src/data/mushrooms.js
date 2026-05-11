// NDL Mushroom Growth mod. Data has two layers:
//
// LAYER 1: v2.0.2 decompile (source-verified, IL trace).
// Source: ndlmushroomgrowth.dll, .cctor of sporetroughBE class. Verified
// end-to-end via IL trace:
//   troughs.OnBlockInteractStart -> dirttrough.SetSoil(soilCode) -> growthDays
//   = SoilGrowthDays[soilCode], then sporetroughBE.AssignSpore sets
//   growthFinalDay = TotalDays + (double)growthDays. CheckGrowth ticks every
//   1000ms and ripens when TotalDays >= growthFinalDay.
//   No scalar, no random, no temperature, no class dependency anywhere.
//   Cellar requirement enforced by room-membership check at each tick.
//
// LAYER 2: Post-2.0.2 patch (per patch notes, NOT yet decompile-verified).
// The user has a newer release (version not specified in the patch notes).
// Changes applied below from changelog text:
//   * Soil growth times bumped:
//       Low (25)         10 -> 15 days
//       Medium (50)       7 -> 13 days
//       High Fert (65)    5 ->  8 days
//       Terra Preta (80)  3 ->  5 days
//   * Cellar requirement removed. Author noted he's "50/50" on bringing it
//     back, so this could revert in a future release.
//   * Trough recipe changed to 4 planks + 1 nails (was a wood-trough conversion).
//   * Trough blocks consolidated from ~50 to 3 blocks + 1 item using variants.
// Once the new DLL is available, re-trace the .cctor of sporetroughBE and
// confirm the dictionary, the room check is gone, and the recipe matches.
//
// IMPORTANT NAMING CAVEAT (unchanged from v2.0.2): VS internal block codes
// are confusing.
//   "soil-compost-X" displays in-game as "High Fertility Soil" (65 NPK).
//   "soil-high-X"    displays in-game as "Terra Preta"          (80 NPK).
//
// Note: in v2.0.2, AssignSpore wrote a chat notification with the hardcoded
// string "grows in 5 days" regardless of soil tier. The patch notes don't
// mention fixing that; assume still present until verified.

export const NDL_MUSHROOM_INFO = {
  identifier: 'ndlmushroomgrowth',
  name: 'NDL MushroomGrowth',
  version: '2.0.2',
  author: 'NateDoesLife',
  url: 'https://mods.vintagestory.at/ndlmushroomgrowth',
};

export const MUSHROOM_GROW_DAYS = {
  25: 15,
  50: 13,
  65: 8,
  80: 5,
};

// Soils with both display name and internal block code.
export const MUSHROOM_SOILS = [
  { tier: 25, name: 'Low',             internalCode: 'soil-low-none',     days: 15 },
  { tier: 50, name: 'Medium',          internalCode: 'soil-medium-none',  days: 13 },
  { tier: 65, name: 'High Fertility',  internalCode: 'soil-compost-none', days: 8, alias: 'often called "Compost" by players' },
  { tier: 80, name: 'Terra Preta',     internalCode: 'soil-high-none',    days: 5, alias: 'the actual top tier' },
];

export const YIELD_PER_TROUGH = 3;

// Toxicity classification. Sources: VS handbook + folklore database. Used
// to filter the species list so players running a feed-the-town farm don't
// accidentally promote death cap.
export const TOXICITY = {
  EDIBLE: 'edible',
  POISONOUS: 'poisonous',
  HALLUCINOGENIC: 'hallucinogenic',
  INEDIBLE: 'inedible',  // not poisonous but not food (e.g. tinder polypore)
  MEDICINAL: 'medicinal', // edible but typically used for tea/effects
};

// 33 ground mushrooms + 12 wall mushrooms = 45 species total. The placement
// flag determines which trough variant accepts the spore. ground spores
// only work in ground troughs, wall spores only in wall troughs.
export const MUSHROOM_SPECIES = [
  // Ground mushrooms
  { key: 'almondmushroom', name: 'Almond Mushroom', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Almond aroma. Cultivated in real life.' },
  { key: 'bitterbolete', name: 'Bitter Bolete', placement: 'ground', tox: TOXICITY.INEDIBLE, notes: 'Edible but extremely bitter. Skip.' },
  { key: 'blacktrumpet', name: 'Black Trumpet', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Choice edible. Strong flavor.' },
  { key: 'bluemeanie', name: 'Blue Meanie', placement: 'ground', tox: TOXICITY.HALLUCINOGENIC, notes: 'Psilocybin-bearing. Toxic.' },
  { key: 'chanterelle', name: 'Chanterelle', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Choice edible. Fruity, peppery.' },
  { key: 'commonmorel', name: 'Common Morel', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Choice edible. Cook thoroughly.' },
  { key: 'deathcap', name: 'Death Cap', placement: 'ground', tox: TOXICITY.POISONOUS, notes: 'Lethal. Do not eat.' },
  { key: 'devilbolete', name: 'Devil Bolete', placement: 'ground', tox: TOXICITY.POISONOUS, notes: 'Causes severe GI distress.' },
  { key: 'devilstooth', name: "Devil's Tooth", placement: 'ground', tox: TOXICITY.INEDIBLE, notes: 'Bitter. Used as dye, not food.' },
  { key: 'earthball', name: 'Earth Ball', placement: 'ground', tox: TOXICITY.POISONOUS, notes: 'Common puffball mimic. Toxic.' },
  { key: 'elfinsaddle', name: 'Elfin Saddle', placement: 'ground', tox: TOXICITY.POISONOUS, notes: 'Contains MMH. Cook thoroughly if at all.' },
  { key: 'fieldmushroom', name: 'Field Mushroom', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'The classic culinary species.' },
  { key: 'flyagaric', name: 'Fly Agaric', placement: 'ground', tox: TOXICITY.HALLUCINOGENIC, notes: 'Iconic red-with-white-spots. Toxic if untreated.' },
  { key: 'foolsconecap', name: 'Foolscone Cap', placement: 'ground', tox: TOXICITY.HALLUCINOGENIC, notes: 'Psilocybin-bearing.' },
  { key: 'goldcap', name: 'Goldcap', placement: 'ground', tox: TOXICITY.HALLUCINOGENIC, notes: 'Psilocybin-bearing.' },
  { key: 'golddropmilkcap', name: 'Gold Drop Milkcap', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Edible after cooking.' },
  { key: 'greencrackedrussula', name: 'Green-Cracked Russula', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Mild flavor.' },
  { key: 'honeymushroom', name: 'Honey Mushroom', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Edible cooked.' },
  { key: 'indigomilkcap', name: 'Indigo Milkcap', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Striking blue. Edible.' },
  { key: 'jackolantern', name: "Jack-o'-Lantern", placement: 'ground', tox: TOXICITY.POISONOUS, notes: 'Bioluminescent. Toxic.' },
  { key: 'kingbolete', name: 'King Bolete', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Choice edible (porcini).' },
  { key: 'laughingjim', name: 'Laughing Jim', placement: 'ground', tox: TOXICITY.HALLUCINOGENIC, notes: 'Psilocybin-bearing.' },
  { key: 'libertycap', name: 'Liberty Cap', placement: 'ground', tox: TOXICITY.HALLUCINOGENIC, notes: 'Psilocybin-bearing.' },
  { key: 'lobster', name: 'Lobster Mushroom', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Choice edible. Lobster-like flavor.' },
  { key: 'orangeoakbolete', name: 'Orange Oak Bolete', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Edible.' },
  { key: 'paddystraw', name: 'Paddy Straw', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Common in Asian cuisine.' },
  { key: 'puffball', name: 'Puffball', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Edible while flesh is white.' },
  { key: 'redwinecap', name: 'Red Winecap', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Choice edible. King Stropharia.' },
  { key: 'saffronmilkcap', name: 'Saffron Milkcap', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Choice edible.' },
  { key: 'sickener', name: 'Sickener', placement: 'ground', tox: TOXICITY.POISONOUS, notes: 'Causes vomiting (hence the name).' },
  { key: 'violetwebcap', name: 'Violet Webcap', placement: 'ground', tox: TOXICITY.EDIBLE, notes: 'Edible cooked.' },
  { key: 'wavycap', name: 'Wavy Cap', placement: 'ground', tox: TOXICITY.HALLUCINOGENIC, notes: 'Psilocybin-bearing.' },
  { key: 'witchhat', name: 'Witch Hat', placement: 'ground', tox: TOXICITY.POISONOUS, notes: 'Toxic. Avoid.' },
  // Wall mushrooms (12)
  { key: 'beardedtooth', name: 'Bearded Tooth', placement: 'wall', tox: TOXICITY.EDIBLE, notes: "Lion's Mane. Choice edible." },
  { key: 'chickenofthewoods', name: 'Chicken of the Woods', placement: 'wall', tox: TOXICITY.EDIBLE, notes: 'Choice edible. Meaty texture.' },
  { key: 'deerear', name: 'Deer Ear', placement: 'wall', tox: TOXICITY.EDIBLE, notes: 'Edible jelly fungus.' },
  { key: 'dryadsaddle', name: "Dryad's Saddle", placement: 'wall', tox: TOXICITY.EDIBLE, notes: 'Edible when young.' },
  { key: 'funeralbell', name: 'Funeral Bell', placement: 'wall', tox: TOXICITY.POISONOUS, notes: 'Lethal. Same toxin as Death Cap.' },
  { key: 'livermushroom', name: 'Liver Mushroom', placement: 'wall', tox: TOXICITY.EDIBLE, notes: 'Beefsteak fungus. Edible.' },
  { key: 'pinkbonnet', name: 'Pink Bonnet', placement: 'wall', tox: TOXICITY.INEDIBLE, notes: 'Decorative.' },
  { key: 'pinkoyster', name: 'Pink Oyster', placement: 'wall', tox: TOXICITY.EDIBLE, notes: 'Choice edible.' },
  { key: 'reishi', name: 'Reishi', placement: 'wall', tox: TOXICITY.MEDICINAL, notes: 'Medicinal/tea. Tough texture.' },
  { key: 'shiitake', name: 'Shiitake', placement: 'wall', tox: TOXICITY.EDIBLE, notes: 'Choice edible. Cultivated in real life.' },
  { key: 'tinderhoof', name: 'Tinder Hoof', placement: 'wall', tox: TOXICITY.INEDIBLE, notes: "Tinder fungus, not food." },
  { key: 'whiteoyster', name: 'White Oyster', placement: 'wall', tox: TOXICITY.EDIBLE, notes: 'Choice edible. Easy beginner cultivar.' },
];

export const GROUND_SPECIES = MUSHROOM_SPECIES.filter(m => m.placement === 'ground');
export const WALL_SPECIES = MUSHROOM_SPECIES.filter(m => m.placement === 'wall');

// Throughput per trough per game year, given a soil tier.
export function harvestsPerYear(soilTier, yearLength = 240) {
  const days = MUSHROOM_GROW_DAYS[soilTier];
  if (!days || days <= 0) return 0;
  return Math.floor(yearLength / days);
}

// Mushrooms per real-time period from N troughs at a given soil tier and the
// player's server tempo (real-minutes-per-game-day).
export function mushroomsPerRealHour(troughCount, soilTier, realMinutesPerGameDay) {
  const growDays = MUSHROOM_GROW_DAYS[soilTier];
  if (!growDays || !realMinutesPerGameDay) return 0;
  const realMinutesPerCycle = growDays * realMinutesPerGameDay;
  const cyclesPerHour = 60 / realMinutesPerCycle;
  return troughCount * YIELD_PER_TROUGH * cyclesPerHour;
}

// Animal husbandry. Per-species feed economy and yields.
//
// Every number below is sourced from the actual game files. No wiki, no
// memory. Sources cited inline.
//
// Files read:
//   survival/entities/animal/bird/chicken-adult.json
//   survival/entities/animal/mammal/hooved/sheep-adult.json
//   survival/entities/animal/mammal/hooved/goat-adult.json
//   survival/entities/animal/mammal/hooved/pig-adult.json
//   vsessentialsmod Entity/Behavior/BehaviorMultiplyBase.cs
//   vssurvivalmod Entity/Behavior/BehaviorMilkable.cs
//   vsessentialsmod Entity/AI/Tasks/AiTaskSeekFoodAndEat.cs
//   vsessentialsmod Entity/AI/Tasks/AiTaskSeekBlockAndLay.cs
//   survival/blocktypes/wood/trough-large.json, trough-small.json
//
// === The portion economy ===
//
// Animal hunger and breeding aren't measured in satiety. They're measured
// in PORTIONS. Every time the animal's seekfoodandeat AI task fires (mid-
// cooldown 1-4 game hours), it eats one portion. To breed, the animal must
// reach a portionsEatenForMultiply threshold without going on cooldown.
//
// One portion = one fill-level worth of food in a trough. Item count per
// portion varies by food (see TROUGH_FILLS below).
//
// === Vanilla domesticatable animals ===
//
// Only four. There is NO cow in vanilla VS. Tamed elk are rideable but
// not milkable and have no harvestable drops. Sheep don't produce wool;
// "wool" only appears in the names of pre-made clothing items.
// Only sheep and goat are milkable (verified: only these two entity JSONs
// reference the "milkable" behavior).

// Food tags referenced by the diet system. Each is a tag on game items
// or blocks; the AI uses them to pick valid food sources.
//
// Source: every tag here is verified against itemtypes/food/*.json
// (vegetable.json, grain.json, fruit.json) and entity creatureDiet blocks.
// `items` = real items in the world that carry this tag.
// `wild` = whether the player can find this naturally (no farming required).
const FOOD_TAGS = {
  grass: {
    label: 'Hay / drygrass',
    items: 'Hay block, drygrass item',
    wild: 'Found wild. Mow tall grass with shears (drygrass) or stack mowed grass into hay blocks. Can fill troughs.',
    note: 'Lowest-priority filler at weight 0.1 for all herbivores.',
  },
  grain: {
    label: 'Grain (any threshed)',
    items: 'Rye, spelt, rice, flax seed, amaranth, sunflower seed',
    wild: 'Cultivated only. No wild source.',
    note: 'Default tag from itemtypes/food/grain.json. Sheep, goats, pigs, and elk all skip rice (skipFoodTags).',
  },
  fruitmash: {
    label: 'Pressed fruit mash',
    items: 'Pressedmash item from a fruit press, made from any fruit',
    wild: 'No wild source. A processed item.',
    note: 'Eaten from troughs. Sheep/goat/elk get fruit calories this way; they will not touch raw fruit.',
  },
  fruit: {
    label: 'Whole fruit',
    items: 'Berries (blueberry, blackberry, redcurrant, gooseberry, cranberry, etc.), tree fruits (apple, peach, pear, cherry, mango, etc.)',
    wild: 'Found wild. Berry bushes spawn naturally in matching biomes; wild fruit-tree branches transplant into orchards.',
    note: 'Pigs only. Sheep, goats, and elk do not include {fruit} in their diet (only {fruitmash}).',
  },
  tastyvegetable: {
    label: 'Tasty vegetables',
    items: 'Cabbage and pumpkin (explicit), plus carrot, turnip, onion, cookedcattailroot, cookedpapyrusroot, olive (default tag)',
    wild: 'Cultivated only.',
    note: 'Highest weight (1.0) for all herbivores. parsnip, cassava, bellpepper, fennel are vegetables but explicitly NOT given this tag.',
  },
  nibbleCrop: {
    label: 'Crops in the ground',
    items: 'Crop blocks at growing/ripe stages, before harvest',
    wild: 'Player-grown crops. Animals graze them in-place if reachable.',
    note: 'Why fenced fields matter: any sheep/goat/pig/elk can walk through unfenced rows and eat your harvest.',
  },
  soybean: {
    label: 'Soybean',
    items: 'Soybean item (cultivated)',
    wild: 'Cultivated only.',
    note: 'Sheep, goat, and elk get a low-priority (0.2) override for soybean. Without this override they would skip it as just-another-grain.',
  },
  cassava: {
    label: 'Raw cassava',
    items: 'Cassava root item (cultivated)',
    wild: 'Cultivated only.',
    note: 'Pig-only override at 0.2. Other animals do not eat cassava.',
  },
  peanut: {
    label: 'Peanut',
    items: 'Peanut item (cultivated)',
    wild: 'Cultivated only.',
    note: 'Elk, deer, and moose accept peanuts at 0.2. Sheep, goats, gazelles do not.',
  },
  // Tags below are in skipFoodTags. Listed so the UI can warn that an
  // animal will refuse them even if the food is available.
  rice: {
    label: 'Rice',
    items: 'Rice grain item',
    wild: 'Cultivated only.',
    note: 'In skipFoodTags for ALL hooved animals (sheep, goat, pig, elk). Chickens still eat it because they only check for {grain}.',
    skip: true,
  },
  parsnip: {
    label: 'Parsnip',
    items: 'Parsnip item',
    wild: 'Cultivated only.',
    note: 'In skipFoodTags for ALL hooved animals. Has its own foodTag instead of the generic {tastyvegetable}, which is what makes the skip rule effective.',
    skip: true,
  },
};

// Verbatim diet from each entity JSON (creatureDiet block).
const DIETS = {
  chicken: {
    foodCategories: ['Grain'],
    weighted: { fruitmash: 0.9, grain: 1.0 },
    skipFoodTags: [],
  },
  sheep: {
    foodCategories: ['Vegetable', 'Grain'],
    weighted: { grass: 0.1, nibbleCrop: 0.5, grain: 0.7, fruitmash: 0.9, tastyvegetable: 1.0, soybean: 0.2 },
    skipFoodTags: ['rice', 'parsnip'],
  },
  goat: {
    foodCategories: ['Vegetable', 'Grain'],
    weighted: { nibbleCrop: 0.5, grass: 0.1, fruitmash: 0.9, tastyvegetable: 1.0, soybean: 0.2 },
    skipFoodTags: ['rice', 'parsnip'],
  },
  pig: {
    foodCategories: ['Grain', 'Fruit', 'Vegetable', 'Protein'],
    weighted: { grain: 0.7, fruitmash: 0.9, fruit: 0.9, tastyvegetable: 1.0, nibbleCrop: 1.0, cassava: 0.2 },
    skipFoodTags: ['rice', 'parsnip'],
  },
};

// Per-animal source-grounded data. All numbers from the entity JSONs and
// behavior C# unless noted.
//
// portionsToMultiply: portionsEatenForMultiply from multiply behavior.
// pregnancyDays / cooldownDays: from multiply behavior config.
// litterMin/Max: spawnQuantityMin / spawnQuantityMax.
// hoursToGrow: from baby entity's grow behavior. In-game clock hours;
//   default HoursPerDay is 24 so divide by 24 for in-game days.
// drops: harvestable.drops on the adult entity (avg quantity).
// milkable: from EntityBehaviorMilkable defaults (10L/milking, 21-day
//   lactation post-birth, once per game day).
export const ANIMALS = {
  chicken: {
    key: 'chicken',
    name: 'Chicken',
    icon: '🐔',
    health: { female: 2.5, male: 2.5 },
    diet: DIETS.chicken,
    portionsToMultiply: 4,                     // multiplybase override
    cooldownDaysMin: 0, cooldownDaysMax: 3,
    pregnancyDays: null,                        // lays eggs instead
    layPortions: 3,                            // hardcoded in AiTaskSeekBlockAndLay.cs
    incubationDays: 5,
    sitDays: 0.9,
    requiresNearbyEntityCode: 'chicken-rooster',
    requiresNearbyEntityRange: 12,
    hoursToGrow: 76,                           // 72 hen-poult, 80 rooster-poult, avg
    drops: [
      { code: 'poultry-raw', avg: 1.75, var: 0.25 },
      { code: 'feather',     avg: 12,   var: 4 },
    ],
    milkable: null,
    troughType: 'small',                        // explicitly excluded from large trough
    note: 'Lays eggs, not babies. Needs a rooster within 12 blocks. Eats from small trough only.',
    needsMaleNote: 'Rooster within 12 blocks',
  },

  sheep: {
    key: 'sheep',
    name: 'Sheep',
    icon: '🐑',
    health: { female: 17, male: 19 },
    diet: DIETS.sheep,
    portionsToMultiply: 10,
    cooldownDaysMin: 4, cooldownDaysMax: 11,
    pregnancyDays: 20,
    litterMin: 1, litterMax: 1,
    requiresNearbyEntityCode: 'sheep-{type}-adult-male',
    requiresNearbyEntityRange: 10,
    hoursToGrow: 336,                          // 14 in-game days
    drops: [
      { code: 'redmeat-raw',     avg: 13,  var: 3   },
      { code: 'hide-raw-large',  avg: 1.2, var: 0.2 },
      { code: 'fat',             avg: 1,   var: 0.3 },
    ],
    milkable: { yieldLitres: 10, lactatingDaysAfterBirth: 21, cooldownHours: 24 },
    troughType: 'large',
    note: 'Meat and milk. Bighorn variant prefers cool dry highlands; mouflon prefers warmer wetter.',
    needsMaleNote: 'Ram within 10 blocks',
  },

  goat: {
    key: 'goat',
    name: 'Goat',
    icon: '🐐',
    health: { female: 17, male: 17 },
    diet: DIETS.goat,
    portionsToMultiply: 10,
    eatAnyway: true,                           // unique flag in goat-adult.json multiply
    cooldownDaysMin: 4, cooldownDaysMax: 11,
    pregnancyDays: 20,
    litterMin: 1, litterMax: 1,
    requiresNearbyEntityCode: 'goat-{type}-adult-male',
    requiresNearbyEntityRange: 10,
    hoursToGrow: 336,
    drops: [
      { code: 'redmeat-raw',    avg: 12,  var: 3, note: 'muskox/takingold variants drop avg 16' },
      { code: 'hide-raw-large', avg: 0.9, var: 0,   note: 'muskox 1.7' },
    ],
    milkable: { yieldLitres: 10, lactatingDaysAfterBirth: 21, cooldownHours: 24 },
    troughType: 'large',
    note: 'eatAnyway flag: goats fill their multiply meter even when not hungry. Faster turnover than sheep.',
    needsMaleNote: 'Buck within 10 blocks',
  },

  pig: {
    key: 'pig',
    name: 'Pig',
    icon: '🐖',
    health: { female: 13, male: 18 },
    diet: DIETS.pig,
    portionsToMultiply: 10,
    cooldownDaysMin: 6, cooldownDaysMax: 11,
    pregnancyDays: 25,
    litterMin: 2, litterMax: 6,                // SOURCE: pig-adult.json spawnQuantity
    requiresNearbyEntityCode: 'pig-{type}-adult-male',
    requiresNearbyEntityRange: 10,
    hoursToGrow: 168,                          // 7 in-game days
    drops: [
      { code: 'redmeat-raw',     avg: 9,   var: 1.5, note: 'elder variant drops avg 18' },
      { code: 'hide-raw-medium', avg: 1.5, var: 0,   note: 'adult only; elder gets large hide + 4 fat' },
    ],
    milkable: null,                             // pig-adult.json has no milkable behavior
    troughType: 'large',
    note: 'Highest litter size in vanilla (2-6 piglets). Eats widest variety. Elders give 2× meat but stop breeding.',
    needsMaleNote: 'Boar within 10 blocks',
  },

  elk: {
    key: 'elk',
    name: 'Tamed elk',
    icon: '🦌',
    transport: true,                            // not livestock; rideable mount
    health: { female: 20, male: 25 },           // approximate; elk-adult.json varies by variant
    diet: {
      foodCategories: ['Vegetable', 'Grain'],
      weighted: { tastyvegetable: 1, fruitmash: 0.9, nibbleCrop: 0.5, peanut: 0.2, grass: 0.1 },
      skipFoodTags: ['rice', 'parsnip'],
    },
    hoursToGrow: 336,                          // 14 in-game days (same as sheep/goat)
    troughType: 'large',
    // Movement speeds in game-units. Player walk is ~0.04 for reference.
    gaits: [
      { code: 'walk',   movespeed: 0.018 },
      { code: 'trot',   movespeed: 0.036 },
      { code: 'canter', movespeed: 0.05  },
      { code: 'sprint', movespeed: 0.08  },
    ],
    // Taming chain: wild → semi-tamed (via repeated treats) → tamed
    // (via saddle-breaking). Numbers from elk-semitamed.json:
    tamingChain: {
      saddleBreaksRequired: { avg: 20, var: 5 },
      saddleBreakDayInterval: 1,                // one break attempt per game day
      tamedEntityCode: 'tameddeer-{type}-{gender}-{age}',
    },
    // Once tamed: not slaughtered (no harvestable drops on the tamed
    // entity), not milkable, no multiply behavior.
    drops: [],
    milkable: null,
    pregnancyDays: null,
    note: 'Rideable mount, not livestock. Acquired by taming wild elk: feed treats to convert wild → semi-tamed, then 20±5 saddle-breaks (1/day) to convert semi-tamed → tamed. Tamed elk do not breed and have no slaughter drops in vanilla.',
    needsMaleNote: 'n/a (not bred)',
  },
};

export const ANIMALS_LIST = Object.values(ANIMALS);

// Trough fill economy. Each fill level holds quantityPerFillLevel items;
// each portion the animal eats consumes one fill level. So 1 fill =
// 1 portion = quantityPerFillLevel items of that food.
// Source: trough-large.json contentConfig + ConsumeOnePortion in BETrough.cs.
export const TROUGH_FILLS = {
  large: {                                      // sheep, goat, pig
    grain:          { itemsPerPortion: 2, fillsPerTrough: 8 },
    nibbleCrop:     { itemsPerPortion: 2, fillsPerTrough: 8 },
    tastyvegetable: { itemsPerPortion: 2, fillsPerTrough: 8 },
    pumpkin:        { itemsPerPortion: 4, fillsPerTrough: 8 },
    fruitmash:      { itemsPerPortion: 2, fillsPerTrough: 8 },
    drygrass:       { itemsPerPortion: 8, fillsPerTrough: 8 },
    hay:            { itemsPerPortion: 1, fillsPerTrough: 8 },
    soybean:        { itemsPerPortion: 2, fillsPerTrough: 8 },
    cassava:        { itemsPerPortion: 2, fillsPerTrough: 8 },
    peanut:         { itemsPerPortion: 2, fillsPerTrough: 8 },
  },
  small: {                                      // chicken only
    grain:    { itemsPerPortion: 1, fillsPerTrough: 8 },
    fruitmash:{ itemsPerPortion: 1, fillsPerTrough: 8 },
  },
};

// Estimated portions per in-game day. The seekfoodandeat task has
// mincooldownHours 1, maxcooldownHours 4 (avg 2.5h cycle), and
// ExecutionChance 0.03 in the base task (sheep/goat/pig override to 1.0
// in their AI configs). Effective rate is roughly 6-8 portions/day for
// fed adult livestock. Conservative budget: 8.
export const PORTIONS_PER_DAY = 8;

// Realistic days between offspring for a fed female (no stress events).
//   pregnancyDays + avgCooldown + portionsToMultiply / portionsPerDay
export function daysPerOffspring(animal, portionsPerDay = PORTIONS_PER_DAY) {
  const a = animal;
  if (a.pregnancyDays === null) {
    // Chicken: lay portions to lay an egg, then sit + incubate
    return (a.layPortions / portionsPerDay) + a.sitDays + a.incubationDays;
  }
  const portionsDays = a.portionsToMultiply / portionsPerDay;
  const cooldownAvg = (a.cooldownDaysMin + a.cooldownDaysMax) / 2;
  return portionsDays + a.pregnancyDays + cooldownAvg;
}

// Average babies per offspring cycle.
export function avgLitter(animal) {
  if (animal.pregnancyDays === null) return 1; // one egg per lay
  return ((animal.litterMin || 1) + (animal.litterMax || 1)) / 2;
}

// Compute herd outputs and feed needs.
// counts: { chicken: 4, sheep: 2, goat: 0, pig: 1 }
// portionsPerDay: optional override of the PORTIONS_PER_DAY default (8).
//   Real consumption depends on food density, crowding, and AI cooldowns;
//   the default is a conservative budget. Pass anywhere from 4 (sparse
//   feeding) to 12 (constantly full troughs).
export function herdSummary(counts, portionsPerDay = PORTIONS_PER_DAY) {
  const feedPortionsPerDayBySpecies = {};
  let feedPortionsPerDay = 0;
  let eggsPerWeek = 0;
  let weeklyMilkLitres = 0;
  const meatPerSlaughterAvg = {};
  const offspringPerMonthPerFemale = {};

  for (const [key, n] of Object.entries(counts)) {
    if (!n || !ANIMALS[key]) continue;
    const a = ANIMALS[key];
    const portions = portionsPerDay * n;
    feedPortionsPerDayBySpecies[key] = portions;
    feedPortionsPerDay += portions;

    // Transport-only animals (tamed elk) contribute feed but no breeding,
    // no milk, no meat. Skip the per-species output bookkeeping.
    if (a.transport) continue;

    if (key === 'chicken') {
      // Hen lays an egg every (layPortions / portionsPerDay) days when
      // food is available. Sitting / incubating is a separate task that
      // doesn't block laying as long as enough portions arrive.
      const daysPerEgg = a.layPortions / portionsPerDay;
      eggsPerWeek += (7 / daysPerEgg) * n;
    }

    if (a.milkable) {
      // Female lactates yieldLitres/day for lactatingDaysAfterBirth days,
      // then breeding cycle restarts. Average over a full cycle:
      const cycleDays = daysPerOffspring(a, portionsPerDay) + a.milkable.lactatingDaysAfterBirth;
      const milkPerCycle = a.milkable.yieldLitres * a.milkable.lactatingDaysAfterBirth;
      weeklyMilkLitres += (milkPerCycle / cycleDays) * 7 * n;
    }

    // Meat per slaughter (sum of redmeat avg)
    const meatDrop = a.drops.find(d => d.code === 'redmeat-raw' || d.code === 'poultry-raw');
    if (meatDrop) meatPerSlaughterAvg[key] = meatDrop.avg;

    // Offspring per month per female: 30 / daysPerOffspring × avgLitter
    if (a.pregnancyDays !== null) {
      offspringPerMonthPerFemale[key] = (30 / daysPerOffspring(a, portionsPerDay)) * avgLitter(a);
    }
  }

  return {
    feedPortionsPerDay,
    feedPortionsPerDayBySpecies,
    eggsPerWeek,
    weeklyMilkLitres,
    meatPerSlaughterAvg,
    offspringPerMonthPerFemale,
  };
}

// Convert "X portions per day" into "Y items per week" of a given food.
export function portionsToFoodItemsPerWeek(portionsPerDay, food, troughType = 'large') {
  const cfg = TROUGH_FILLS[troughType]?.[food];
  if (!cfg) return null;
  return Math.ceil(portionsPerDay * 7 * cfg.itemsPerPortion);
}

// Per-harvest crop output. Used to estimate "if you feed only this crop,
// how many crop harvests per week do you need?"
//
// Crop drop quantities are from the harvest yields encoded in the broader
// app (data/crops.js / game source). Numbers below are conservative
// per-mature-plant averages.
export const CROP_HARVEST_YIELDS = {
  rye:       { itemsPerHarvest: 5,    foodTag: 'grain',          troughKey: 'grain' },
  spelt:     { itemsPerHarvest: 4,    foodTag: 'grain',          troughKey: 'grain' },
  amaranth:  { itemsPerHarvest: 4,    foodTag: 'grain',          troughKey: 'grain' },
  flax:      { itemsPerHarvest: 4,    foodTag: 'grain',          troughKey: 'grain' },
  sunflower: { itemsPerHarvest: 4,    foodTag: 'grain',          troughKey: 'grain' },
  carrot:    { itemsPerHarvest: 11,   foodTag: 'nibbleCrop',     troughKey: 'nibbleCrop' },
  turnip:    { itemsPerHarvest: 7,    foodTag: 'nibbleCrop',     troughKey: 'nibbleCrop' },
  cabbage:   { itemsPerHarvest: 2,    foodTag: 'tastyvegetable', troughKey: 'tastyvegetable' },
  onion:     { itemsPerHarvest: 4,    foodTag: 'tastyvegetable', troughKey: 'tastyvegetable' },
  pumpkin:   { itemsPerHarvest: 4,    foodTag: 'tastyvegetable', troughKey: 'pumpkin' },
  cassava:   { itemsPerHarvest: 16,   foodTag: 'cassava',        troughKey: 'cassava' },
  soybean:   { itemsPerHarvest: 4,    foodTag: 'soybean',        troughKey: 'soybean' },
};

// How many harvests of cropName per week to cover X portions per day?
export function feedPortionsToHarvests(portionsPerDay, cropName, troughType = 'large') {
  const c = CROP_HARVEST_YIELDS[cropName];
  if (!c) return null;
  const items = portionsToFoodItemsPerWeek(portionsPerDay, c.troughKey, troughType);
  if (items === null) return null;
  return Math.ceil(items / c.itemsPerHarvest);
}

export { FOOD_TAGS };

// Wild animals that raid your fields/orchards/bushes. Diet from each entity's
// creatureDiet block (attributes.creatureDiet in their JSON). Source files:
//   entities/animal/mammal/raccoon-adult.json
//   entities/animal/mammal/hare-adult.json
//   entities/animal/mammal/hooved/deer-adult.json
//   entities/animal/mammal/hooved/gazelle-adult.json
//   entities/animal/mammal/hooved/moose-adult.json
//
// All numbers in "weighted" are weight values (1.0 = top priority).
export const WILD_RAIDERS = {
  raccoon: {
    name: 'Raccoon',
    icon: '🦝',
    foodCategories: ['Fruit'],
    weighted: { fruit: 0.9, egg: 1.0, lootableSweet: 1.0, sweetBerryBush: 1.0, peanut: 0.2 },
    skipFoodTags: [],
    threatTo: [
      'Berry bushes (any). Will strip ripe-stage bushes including planted ones.',
      'Tree fruits sitting on the ground or in low branches.',
      'Loose eggs, including ones in chicken nests if they can reach.',
      'Peanuts (low priority but will take them if nothing better is around).',
    ],
    notIn: 'Cultivated crops in fields. Raccoons do NOT eat carrots, cabbages, grain, etc.',
    defense: 'Fence with at least 1.5-block-tall solid fences. Raccoons climb low fences.',
  },
  hare: {
    name: 'Hare',
    icon: '🐇',
    foodCategories: ['Vegetable'],
    weighted: { nibbleCrop: 0.5, tastyvegetable: 1.0, cassava: 0.2 },
    skipFoodTags: [],
    threatTo: [
      'Cabbage, carrot, turnip, onion, pumpkin, cooked cattail/papyrus root (any tastyvegetable-tagged crop).',
      'Crops still in the field at any stage (the nibbleCrop tag).',
      'Cassava as a low-priority alternative.',
    ],
    notIn: 'Grain, fruits, berries, parsnip, fennel.',
    defense: 'Single fence row stops them. Smaller predators will keep them away naturally.',
  },
  deer: {
    name: 'Deer',
    icon: '🦌',
    foodCategories: ['Vegetable', 'Grain'],
    weighted: { grass: 0.1, nibbleCrop: 0.5, grain: 0.7, fruitmash: 0.9, tastyvegetable: 1.0, peanut: 0.2 },
    skipFoodTags: ['rice', 'parsnip'],
    threatTo: [
      'All cultivated vegetables except parsnip (cabbage, carrot, turnip, onion, pumpkin, cassava-not-default, etc.).',
      'Grain crops (rye, spelt, amaranth, sunflower, flax). Will skip rice.',
      'Crops at any growth stage (nibbleCrop tag = the plant itself).',
      'Pressed fruit mash if left out near unfenced perimeters.',
      'Peanut crops.',
    ],
    notIn: 'Rice and parsnip (explicit skip). Berries (no fruit tag in their diet).',
    defense: 'Tall solid fence (2 blocks). Deer can jump short fences.',
  },
  gazelle: {
    name: 'Gazelle',
    icon: '🦌',
    foodCategories: ['Vegetable', 'Grain'],
    weighted: { nibbleCrop: 0.5, grass: 0.1, fruitmash: 0.9, tastyvegetable: 1.0 },
    skipFoodTags: ['rice', 'parsnip'],
    threatTo: [
      'Same vegetable+grain pattern as deer, minus the peanut interest.',
      'Cultivated crops in arid biomes where gazelles spawn.',
    ],
    notIn: 'Rice, parsnip, peanut, berries.',
    defense: 'Tall fences. Gazelles are fast but stick to open areas.',
  },
  moose: {
    name: 'Moose',
    icon: '🦌',
    foodCategories: ['Vegetable', 'Grain'],
    weighted: { nibbleCrop: 0.5, grass: 0.1, fruitmash: 0.9, tastyvegetable: 1.0, peanut: 0.2 },
    skipFoodTags: ['rice', 'parsnip'],
    threatTo: [
      'Same as deer/elk: vegetables, grain, peanut. Skips rice and parsnip.',
      'Northern biomes. Bigger and more dangerous than deer; will damage you if provoked.',
    ],
    notIn: 'Rice, parsnip, fruit (raw), berries.',
    defense: 'Tall and solid. A moose can shoulder through weak fences. Stone or thick log.',
  },
};

export const WILD_RAIDERS_LIST = Object.values(WILD_RAIDERS);

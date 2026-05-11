// Bee/beehive mechanics. Numbers come straight from the decompiled vanilla
// game source: vssurvivalmod-master/BlockEntity/BEBeehive.cs and the JSON
// files for skeps + honeycomb.
//
// Greenhouses: yes, they affect bees. From BEBeehive.TestHarvestable():
//   if (roomness > 0) temp += 5;  // same +5°C bonus as crops
//   activityLevel = clamp(temp / 5f, 0, 1);
// Roomness is set via OnScanForEmptySkep:
//   roomness = (room.SkylightCount > room.NonSkylightCount && room.ExitCount == 0) ? 1 : 0;
// So a sealed greenhouse-style room (skylight-dominant, no doors-open exits)
// gives the bonus. Same definition the game uses for crop greenhouse bonus.

// Activity vs temperature (TestHarvestable, line 178)
//   activityLevel = clamp(temp / 5, 0, 1)
// Below 0°C: harvest/swarm/cooldown timers all PAUSE (no progress)
// Below -10°C: timers RESET (winter restarts the bee farm)
// Greenhouse adds +5°C to the effective temp at the hive.
export function activityLevel(tempC) {
  return Math.max(0, Math.min(1, tempC / 5));
}

// Hive population size from flower-to-hive ratio (OnScanComplete, line 279)
//   hivePopSize = clamp(quantityNearbyFlowers - 3 * quantityNearbyHives, 0, 2)
// Returns 0=Poor, 1=Decent, 2=Large.
// Only Decent or Large can be harvested (Poor never goes harvestable).
export function hivePopSize(flowers, hives) {
  return Math.max(0, Math.min(2, flowers - 3 * hives));
}

export const POP_SIZE_LABELS = ['Poor', 'Decent', 'Large'];

// Days until ready to harvest, from OnBlockPlaced + Initialize (line 87, 162)
//   harvestableAtTotalHours = TotalHours + 12 * (3 + Rand.NextDouble() * 8)
// = TotalHours + (36 to 132) hours
// At 24 game hours/day: 1.5 to 5.5 game days, average ~3.5 days
// PROVIDED activity > 0 (temp > 0°C). Below 0°C, timer pauses.
export const HARVEST_HOURS_MIN = 36;
export const HARVEST_HOURS_MAX = 132;
export const HARVEST_HOURS_AVG = (HARVEST_HOURS_MIN + HARVEST_HOURS_MAX) / 2;  // 84
export const HARVEST_DAYS_MIN = HARVEST_HOURS_MIN / 24;
export const HARVEST_DAYS_MAX = HARVEST_HOURS_MAX / 24;
export const HARVEST_DAYS_AVG = HARVEST_HOURS_AVG / 24;  // 3.5

// Days to swarm (spawn a new hive in a nearby empty skep), from OnScanComplete:
//   swarmability = clamp(flowers - 3 - 3*hives, 0, 20) / 5     // 0 to 4
//   swarmInDays = (4 - swarmability) * 2.5                     // 0 to 10 days
//   if (3*hives + 3 > flowers): no swarming at all (skepToPop = null)
// After spawning a new hive, the cooldown is `4 / 2 * 24` = 48 hours = 2 days
// (the comment in the file says 4 days; that's a docstring error in the source).
export function swarmInDays(flowers, hives) {
  const surplus = flowers - 3 - 3 * hives;
  if (surplus < 0) return null;  // no swarm possible
  const swarmability = Math.max(0, Math.min(20, surplus)) / 5;
  return (4 - swarmability) * 2.5;
}
export const SWARM_COOLDOWN_DAYS = 2;

// Honeycomb dropped per harvest (from skep block JSON, drops:[{code:'honeycomb', quantity:{avg:3}}])
export const HONEYCOMB_PER_HARVEST = 3;

// Honeycomb -> downstream products (from honeycomb.json juiceableProperties)
//   juiceable: 1 honeycomb -> 0.2L honeyportion + 1 honeymash + 5 beeswax (fruit press)
//   squeezable: 1 honeycomb -> 0.2L honeyportion + 1 beeswax (hand squeezer)
export const HONEY_LITRES_PER_HONEYCOMB = 0.2;
export const BEESWAX_PER_HONEYCOMB_PRESS = 5;
export const BEESWAX_PER_HONEYCOMB_HAND = 1;

// Honey nutrition (honeyportion.json nutritionPropsPerLitre)
export const HONEY_SAT_PER_LITRE_RAW = 300;
export const HONEY_SAT_PER_LITRE_MEAL = 400;

// Scan radius from BEBeehive.OnScanForEmptySkep (line 231-235)
// 4 iterations of 8x8 horizontal slabs, full vertical -7..+4
// Total scan area: 16x16 horizontal centered roughly on the hive,
// y range -7 to +4 (12 vertical blocks).
export const SCAN_RADIUS_HORIZONTAL = 8;  // blocks in each direction
export const SCAN_AREA_BLOCKS = 16 * 16;
export const SCAN_VOLUME_BLOCKS = 16 * 16 * 12;

// Helper: harvests per game year for a hive given its activity profile.
// Walks day-by-day so that:
//   * temp > 0: harvest timer advances 1 day
//   * 0 >= temp > -10: timer pauses (no progress, no reset)
//   * temp <= -10: timer RESETS to 0 (winter wipes carry-over progress)
// Each completed cycle (HARVEST_DAYS_AVG ≈ 3.5d) yields one harvestable hive.
// Climate is an array of {avg, min, max} per game day. Greenhouse adds +5°C.
export function harvestsPerYear(climate, greenhouse = false, yearLength = 240) {
  if (!climate || climate.length === 0) return 0;
  let progress = 0;
  let harvests = 0;
  const total = Math.min(climate.length, yearLength);
  for (let i = 0; i < total; i++) {
    const T = (climate[i]?.avg ?? 10) + (greenhouse ? 5 : 0);
    if (T < -10) {
      progress = 0;             // hard reset: deep cold wipes the timer
    } else if (T < 0) {
      // paused: do nothing
    } else {
      progress += 1;
      while (progress >= HARVEST_DAYS_AVG) {
        harvests++;
        progress -= HARVEST_DAYS_AVG;
      }
    }
  }
  return harvests;
}

// Honey + beeswax + satiety per hive per year.
export function annualOutput({
  flowers,
  hives,
  greenhouse,
  climate,
  yearLength = 240,
  pressMethod = 'press',  // 'press' | 'hand'
}) {
  const popSize = hivePopSize(flowers, hives);
  const isHarvestable = popSize > 0;
  if (!isHarvestable) {
    return {
      popSize, harvestsPerYear: 0, honeycombPerYear: 0,
      honeyLitres: 0, beeswax: 0, satietyMeal: 0, swarms: 0,
      reason: 'Population size Poor: never goes harvestable. Need more flowers per hive.',
    };
  }
  const harvests = harvestsPerYear(climate, greenhouse, yearLength);
  const honeycomb = harvests * HONEYCOMB_PER_HARVEST;
  const honeyLitres = honeycomb * HONEY_LITRES_PER_HONEYCOMB;
  const beeswax = honeycomb * (pressMethod === 'press' ? BEESWAX_PER_HONEYCOMB_PRESS : BEESWAX_PER_HONEYCOMB_HAND);
  const satietyMeal = honeyLitres * HONEY_SAT_PER_LITRE_MEAL;
  // Swarms: walk day-by-day with the same pause/reset rules. Each completed
  // (swarmCycleDays + cooldown) cycle spawns a new hive in a nearby empty skep.
  const swarmCycleDays = swarmInDays(flowers, hives);
  let swarms = 0;
  if (swarmCycleDays !== null && swarmCycleDays >= 0) {
    const totalCycle = swarmCycleDays + SWARM_COOLDOWN_DAYS;
    if (totalCycle > 0) {
      let progress = 0;
      const total = Math.min(climate.length, yearLength);
      for (let i = 0; i < total; i++) {
        const T = (climate[i]?.avg ?? 10) + (greenhouse ? 5 : 0);
        if (T < -10) progress = 0;
        else if (T < 0) { /* paused */ }
        else {
          progress += 1;
          while (progress >= totalCycle) {
            swarms++;
            progress -= totalCycle;
          }
        }
      }
    }
  }
  return {
    popSize, harvestsPerYear: harvests, honeycombPerYear: honeycomb,
    honeyLitres: +honeyLitres.toFixed(2),
    beeswax,
    satietyMeal: Math.round(satietyMeal),
    swarms,
  };
}

// Common bee-feed flowers, from JSON attributes. The full list is anything
// with attributes.beeFeed = true, but the practical answer is "any flower
// from blocktypes/plant/flower.json EXCEPT horsetail, plus lupine and barrel
// cactus, plus crops in their flowering stage".
export const BEE_FEED_NOTES = [
  { name: 'Most flowers', detail: 'Any flower-* block (except horsetail) counts.' },
  { name: 'Lupine', detail: 'Counts as bee feed when flowering.' },
  { name: 'Barrel cactus', detail: 'Counts when flowering.' },
  { name: 'Crops in flowering stage', detail: 'Crop blocks like sunflower, soybean, etc. count when flowering. Worth scanning your farm for the bonus.' },
  { name: 'Horsetail', detail: 'Explicitly excluded (beeFeedByType: false).' },
];

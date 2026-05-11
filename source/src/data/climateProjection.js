// Climate projection: take the user's bundled climate data (one year of daily
// avg/min/max for their actual location) and project what it would look like
// at a different latitude. Used by the Scouting beta page.
//
// EXPERIMENTAL. The math is honest within ±0.2 latitude shift; further than
// that, world generation noise and altitude effects dominate and a single-
// sample projection can't account for them.
//
// === Source-grounded formula (Temperature.cs lines 63-121) ===
//
// VS computes daily temperature as:
//
//   seasonalAmp = abs(latitude) × 65            // °C, pole-to-equator spread
//   T(yr) = WGT - seasonalAmp/2 + seasonalAmp × smootherstep(distanceToJan(yr))
//
// where:
//   - WGT (WorldGenTemperature) is the position's worldgen baseline; this is
//     approximately the yearly mean temperature at that spot.
//   - distanceToJan goes from 0 at January (cold) to 1 at July (hot).
//   - smootherstep is the cubic ease-in-out that VS uses for season blending.
//
// Diurnal modulation:
//   diurnalAmp = 18 - rainfall × 13              // higher in dry areas
//   T(hour) += (distanceTo4am - 0.5) × diurnalAmp
//
// === The projection assumption ===
//
// We keep WGT roughly constant within small latitude shifts. In reality WGT
// varies with latitude through the worldgen triangle-wave (NoiseClimateRealistic),
// adding ~30°C per full latitude shift toward the equator, plus ±35°C of
// noise, plus altitude adjustments. So:
//
//   - Within ±0.2 latitude: yearly mean drift estimated at ±6°C (we use 30°C
//     per latitude unit toward equator). Seasonal amplitude is deterministic.
//   - Beyond ±0.2: noise and altitude effects swamp the projection. We refuse
//     to project (return null) and ask the user to take a real /wgen pos
//     reading at the new spot.
//
// All of this assumes vanilla worldgen. Mods that change the climate model
// (Wilderness, BetterClimate, etc.) will produce wrong predictions.

const MAX_LATITUDE_SHIFT = 0.20;
const TEMP_PER_LATITUDE_TOWARD_EQUATOR = 30; // °C per full latitude unit
const SEASONAL_AMP_FACTOR = 65;              // °C per abs(latitude) unit

// Approximate smootherstep: 6t^5 - 15t^4 + 10t^3
function smootherstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// Cyclic distance from `target` to `value`, with period `period`.
// For yr*12 in [0, 12), distance to month 0.5 (January center).
function cyclicDistance(target, value, period) {
  const halfPeriod = period / 2;
  let d = Math.abs(value - target) % period;
  if (d > halfPeriod) d = period - d;
  return d;
}

// distanceToJanuary returns 0 at January (yearRel=0), 1 at July (yearRel=0.5).
// Replicates GameMath.Smootherstep(abs(CyclicValueDistance(0.5, yearRel*12, 12) / 6))
function distanceToJanuary(yearRel) {
  const d = cyclicDistance(0.5, yearRel * 12, 12) / 6;
  return smootherstep(d);
}

// Fit yearly mean and seasonal amplitude from a climate array. Used to back
// out the WGT baseline at the user's actual location.
export function fitClimate(climate) {
  if (!Array.isArray(climate) || climate.length === 0) return null;
  const avgs = climate.map(c => c.avg);
  const yearlyMean = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  const peakSummer = Math.max(...avgs);
  const peakWinter = Math.min(...avgs);
  const seasonalAmp = peakSummer - peakWinter;     // total swing
  const diurnalAvg = climate.reduce((s, c) =>
    s + ((c.max ?? c.avg) - (c.min ?? c.avg)), 0) / climate.length;

  // Estimate latitude from seasonal amplitude. seasonalAmp = abs(L) × 65
  // since the season spans the full amp from winter min to summer max.
  // The amplitude in the formula is "peak to base" which is the half-swing,
  // but here we measure peak-to-trough (full swing). So inferred latitude:
  const inferredLatitude = seasonalAmp / SEASONAL_AMP_FACTOR;

  // Estimated rainfall from diurnal amplitude: diurnalAvg = 18 - R × 13
  // → R = (18 - diurnalAvg) / 13. Bounded 0..1.
  const inferredRainfall = Math.max(0, Math.min(1, (18 - diurnalAvg) / 13));

  return {
    yearlyMean,
    peakSummer,
    peakWinter,
    seasonalAmp,
    diurnalAvg,
    inferredLatitude,
    inferredRainfall,
    yearLength: climate.length,
  };
}

// Project the climate curve to a new latitude. Returns either:
//   { climate, fit, ... }   on success
//   { unsupported: true, reason }   if the world config disables our model
//   null                            if the latitude shift exceeds the cap
//
// targetLatitude: signed latitude in [-1, 1] (positive = north hemisphere).
// fitOptions: { sourceLatitude, rainfall } overrides for what to fit FROM.
// worldConfig: optional object with polarEquatorDistance, worldClimate,
//   globalTemperature. Vanilla defaults applied for missing keys.
export function projectClimate(climate, targetLatitude, fitOptions = {}, worldConfig = null) {
  const fit = fitClimate(climate);
  if (!fit) return null;

  // World config knobs (with vanilla fallbacks)
  const cfg = worldConfig || {};
  const polarEq = cfg.polarEquatorDistance || 50000;
  const worldClimate = cfg.worldClimate || 'realistic';
  const globalTemp = cfg.globalTemperature ?? 1.0;

  // The projection only models the realistic climate generator. Patchy and
  // locked modes don't have a smooth latitude->temperature gradient, so
  // back-fitting and re-projecting will give nonsense.
  if (worldClimate !== 'realistic') {
    return {
      unsupported: true,
      reason: `World is using "${worldClimate}" climate. Projection assumes "realistic"; the latitude→temperature gradient doesn't exist in this mode.`,
    };
  }

  const sourceLat = fitOptions.sourceLatitude ?? fit.inferredLatitude;
  const rainfall = fitOptions.rainfall ?? fit.inferredRainfall;
  const shift = targetLatitude - sourceLat;

  if (Math.abs(shift) > MAX_LATITUDE_SHIFT) return null;

  // Slope scales with polarEquatorDistance: vanilla 50000 gives 30°C/unit;
  // a server with 100000 (gentler gradient) gives 15°C/unit; 25000 (steeper)
  // gives 60°C/unit. Source: NoiseClimateRealistic.cs halfRange formula.
  const tempPerLatitude = TEMP_PER_LATITUDE_TOWARD_EQUATOR * (50000 / polarEq);

  // New seasonal amplitude (deterministic from |latitude|; not affected by
  // polarEquatorDistance, the seasonal swing is in Temperature.cs, which
  // doesn't read that key).
  const newSeasonalAmp = Math.abs(targetLatitude) * SEASONAL_AMP_FACTOR;

  // Yearly mean shifts as latitude moves. Toward equator (smaller |latitude|)
  // → warmer baseline. globalTemperature scales the whole mean: a server with
  // globalTemperature=1.05 has a yearly mean ~5% further from -20°C (the
  // worldgen baseline floor in DescaleTemperature).
  const sourceAbs = Math.abs(sourceLat);
  const targetAbs = Math.abs(targetLatitude);
  const yearlyMeanShift = -(targetAbs - sourceAbs) * tempPerLatitude;
  // Apply globalTemperature as a scaling around the -20°C floor used by the
  // worldgen DescaleTemperature function (Climate.cs line 27).
  const FLOOR = -20;
  const baseMean = fit.yearlyMean + yearlyMeanShift;
  const newYearlyMean = globalTemp === 1.0
    ? baseMean
    : FLOOR + (baseMean - FLOOR) * globalTemp;

  // New diurnal amplitude (rainfall stays the same in this projection).
  // globalPrecipitation could shift this, but it also shifts moisture for
  // farming, so we leave it for the user to apply manually if needed.
  const newDiurnalAmp = 18 - rainfall * 13;

  // Build the projected curve
  const projected = [];
  const len = climate.length;
  for (let i = 0; i < len; i++) {
    const yearRel = i / len;
    const dToJan = distanceToJanuary(yearRel);
    // For southern hemisphere (latitude < 0), seasons flip
    const seasonalT = targetLatitude >= 0
      ? newSeasonalAmp * dToJan
      : newSeasonalAmp * (1 - dToJan);

    const avg = newYearlyMean - newSeasonalAmp / 2 + seasonalT;
    const min = avg - newDiurnalAmp / 2;
    const max = avg + newDiurnalAmp / 2;
    projected.push({ d: i + 1, avg, min, max });
  }

  return {
    climate: projected,
    fit,
    targetLatitude,
    sourceLatitude: sourceLat,
    yearlyMeanShift,
    newSeasonalAmp,
    newDiurnalAmp,
    tempPerLatitude,
    worldConfigApplied: { polarEq, globalTemp },
  };
}

export const CLIMATE_PROJECTION_LIMITS = {
  maxLatitudeShift: MAX_LATITUDE_SHIFT,
  tempPerLatitude: TEMP_PER_LATITUDE_TOWARD_EQUATOR,
  seasonalAmpFactor: SEASONAL_AMP_FACTOR,
};

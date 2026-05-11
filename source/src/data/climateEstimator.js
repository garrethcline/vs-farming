// Climate estimator.
//
// What the player can see in-game (Character panel C, F3 debug, thermometer block):
//   - their current X, Y, Z coordinates
//   - the current temperature
//   - the current date and time
//   - a qualitative rainfall description ("rare", "often", "almost all the time")
//
// What this module produces: a full-year estimated climate at the new spot,
// derived by reshaping the currently-loaded climate to match what the player
// reports. Three independent adjustments are applied in order:
//
//   1. Reshape seasonal swing if the player has moved north or south (Z axis).
//      Game formula: seasonal amp = |latitude| × 65, latitude in [-1, +1].
//      Latitude is a sawtooth function of Z scaled by polarEquatorDistance.
//      Slope: d(latitude)/d(z) ≈ 2 / polarEquatorDistance (linear regime).
//      Source: vsessentialsmod GenMaps.cs:316-326.
//
//   2. Reshape day-night swing if the rainfall description is different.
//      Game formula: diurnal amp = 18 - 13 × rainfall, rainfall in [0, 1].
//      Source: vssurvivalmod Temperature.cs.
//
//   3. Shift the whole curve up or down so its predicted temperature at the
//      player's reported date+hour matches the player's reading. This single
//      shift captures the combined effect of:
//        * different WorldGenTemperature at the new spot
//        * altitude (game subtracts (y - sealevel) / 1.5°C from the base)
//        * any leftover latitude offset that the amp rescale didn't catch
//      Source: vssurvivalmod Temperature.cs, Climate.cs (GetScaledAdjustedTemperatureFloat).
//
// Altitude (Y) is NOT a separate input. It's already inside the temperature
// reading, so the shift in step 3 picks it up automatically. X has no effect.

// Qualitative rainfall buckets. Centers chosen to match the wiki's verbal
// scale ("very rare" .. "almost all the time"). The player picks the bucket
// that matches what their world-gen description or Environment HUD says.
export const RAINFALL_LABELS = [
  { key: 'almost_always', name: 'Almost all the time', value: 0.90 },
  { key: 'often',         name: 'Often',                value: 0.70 },
  { key: 'sometimes',     name: 'Sometimes',            value: 0.50 },
  { key: 'rare',          name: 'Rare',                 value: 0.30 },
  { key: 'very_rare',     name: 'Very rare',            value: 0.10 },
];

export function rainfallLabelToValue(key) {
  const found = RAINFALL_LABELS.find(r => r.key === key);
  return found ? found.value : null;
}

// Best-fit qualitative bucket for a numeric rainfall, used to label the
// currently loaded climate's rainfall.
export function rainfallValueToLabel(value) {
  if (!isFinite(value)) return RAINFALL_LABELS[2]; // sometimes
  let best = RAINFALL_LABELS[0];
  let bestDist = Math.abs(value - best.value);
  for (const r of RAINFALL_LABELS) {
    const d = Math.abs(value - r.value);
    if (d < bestDist) { best = r; bestDist = d; }
  }
  return best;
}

// Yearly average of a daily climate array.
export function computeYearAvg(climate) {
  if (!climate || climate.length === 0) return null;
  return climate.reduce((s, d) => s + d.avg, 0) / climate.length;
}

// Seasonal amplitude as the 5th-to-95th percentile span of daily averages.
// More stable than max - min when there's noise.
export function computeSeasonalAmp(climate) {
  if (!climate || climate.length < 30) return null;
  const sorted = climate.map(d => d.avg).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.floor(sorted.length * 0.95)];
  return hi - lo;
}

// Average daily (max - min) across the year. Implies rainfall via the game
// formula diurnal = 18 - 13 × rainfall.
export function computeDiurnalAvg(climate) {
  if (!climate || climate.length === 0) return null;
  return climate.reduce((s, d) => s + (d.max - d.min), 0) / climate.length;
}

// Back out the rainfall that produced a given diurnal swing. Inverse of
// the game formula. Clamped to [0, 1].
export function diurnalToRainfall(diurnal) {
  if (!Number.isFinite(diurnal)) return null;
  return Math.max(0, Math.min(1, (18 - diurnal) / 13));
}

// Predict what temperature the daily record would show at a given hour.
// Mirrors Temperature.cs hour-of-day math: 4 AM coldest, 4 PM hottest,
// smoothstep ramp between. The day's (max - min) acts as the diurnal amp.
export function predictTempAtHour(day, hourOfDay) {
  const dist = cyclicValueDistance(4, hourOfDay, 24) / 12;
  const distanceTo6Am = smoothStep(Math.abs(dist));
  const dayAmp = day.max - day.min;
  return day.avg + (distanceTo6Am - 0.5) * dayAmp;
}

function smoothStep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function cyclicValueDistance(target, value, cycle) {
  let diff = value - target;
  diff = ((diff % cycle) + cycle) % cycle;
  if (diff > cycle / 2) diff -= cycle;
  return diff;
}

// Main entry point. Takes everything the player can observe in-game and
// produces an estimated climate.
//
// observations = {
//   newZ:             number (required, player's current Z from F3)
//   observedTemp:     number (required, °C reading)
//   dayOfYear:        number (required, 1..daysPerYear)
//   hourOfDay:        number (required, 0..23)
//   newRainfallKey:   string (required, one of RAINFALL_LABELS keys)
//   oldZ:             number (optional, Z where the loaded climate was captured)
//   loadedRainfallKey: string (optional, override for what the loaded climate's rainfall should be)
// }
// worldConfig = { polarEquatorDistance: number }
//
// Returns {
//   climate, baseOffset, ampScale, diurnalRatio,
//   oldYearAvg, newYearAvg, oldAmp, newAmp,
//   oldRainfall, newRainfall, oldLat, newLat,
//   predictedAtMoment, observedAtMoment, latitudeShifted,
// } or { error }.
export function estimateFromObservations(prevClimate, observations, worldConfig = {}) {
  if (!Array.isArray(prevClimate) || prevClimate.length === 0) {
    return { error: 'No previous climate to base on.' };
  }
  const {
    newZ, observedTemp, dayOfYear, hourOfDay,
    newRainfallKey, oldZ = null, loadedRainfallKey = null,
  } = observations;

  if (!Number.isFinite(observedTemp)) return { error: 'Temperature reading required.' };
  if (!Number.isFinite(dayOfYear) || dayOfYear < 1 || dayOfYear > prevClimate.length) {
    return { error: `Day must be between 1 and ${prevClimate.length}.` };
  }
  if (!Number.isFinite(hourOfDay) || hourOfDay < 0 || hourOfDay >= 24) {
    return { error: 'Hour must be 0 to 23.' };
  }

  // 1. Loaded climate's properties.
  const oldYearAvg = computeYearAvg(prevClimate);
  const oldAmp = computeSeasonalAmp(prevClimate) || 0;
  const oldDiurnal = computeDiurnalAvg(prevClimate) || 0;
  const oldRainfallFromCurve = diurnalToRainfall(oldDiurnal);
  // Player can override the "what the loaded climate's rainfall should be" if
  // they know the answer better than the curve's average swing implies.
  const oldRainfall = loadedRainfallKey
    ? rainfallLabelToValue(loadedRainfallKey)
    : oldRainfallFromCurve;
  const oldLat = oldAmp / 65; // magnitude; assume same hemisphere

  // 2. New rainfall from the label dropdown.
  const newRainfall = rainfallLabelToValue(newRainfallKey);
  if (newRainfall === null) return { error: 'Pick a rainfall description.' };

  // 3. Latitude / seasonal amp at the new spot. If the loaded-climate origin
  // Z is provided, use the linear-regime slope to step latitude. If not,
  // assume no latitude change.
  let newLat = oldLat;
  let newAmp = oldAmp;
  let latitudeShifted = false;
  const polarEqDist = worldConfig.polarEquatorDistance || 50000;
  if (oldZ !== null && oldZ !== undefined &&
      Number.isFinite(oldZ) && Number.isFinite(newZ) &&
      Math.abs(newZ - oldZ) >= 1) {
    const dZ = newZ - oldZ;
    const dLat = (dZ * 2) / polarEqDist;
    newLat = Math.max(-1, Math.min(1, oldLat + dLat));
    newAmp = Math.abs(newLat) * 65;
    latitudeShifted = true;
  }

  // 4. Compute scale factors. Guard against divide-by-zero and absurd ratios.
  const ampScale = (oldAmp > 0.1) ? (newAmp / oldAmp) : 1;
  const newDiurnal = 18 - 13 * newRainfall;
  const oldDiurnalFromRain = 18 - 13 * (oldRainfall ?? 0.5);
  const diurnalRatio = (oldDiurnalFromRain > 0.1) ? (newDiurnal / oldDiurnalFromRain) : 1;

  // 5. First pass: reshape the curve to the new amp and diurnal swing while
  // keeping the old yearly mean. This rescales seasonal swing and day-night
  // gap but doesn't shift the mean yet.
  const reshaped = prevClimate.map(d => {
    const newDayAvg = oldYearAvg + (d.avg - oldYearAvg) * ampScale;
    return {
      day: d.day,
      avg: newDayAvg,
      min: newDayAvg - (d.avg - d.min) * diurnalRatio,
      max: newDayAvg + (d.max - d.avg) * diurnalRatio,
    };
  });

  // 6. Predict what the reshaped curve says for (dayOfYear, hourOfDay), then
  // shift everything so the prediction matches the player's reading. This
  // single offset captures WorldGenTemperature change, altitude, and any
  // residual latitude effect.
  const reshapedDay = reshaped[Math.floor(dayOfYear) - 1];
  const predicted = predictTempAtHour(reshapedDay, hourOfDay);
  const baseOffset = observedTemp - predicted;

  const climate = reshaped.map(d => ({
    day: d.day,
    avg: d.avg + baseOffset,
    min: d.min + baseOffset,
    max: d.max + baseOffset,
  }));

  return {
    climate,
    baseOffset,
    ampScale,
    diurnalRatio,
    oldYearAvg,
    newYearAvg: computeYearAvg(climate),
    oldAmp,
    newAmp,
    oldRainfall,
    newRainfall,
    oldLat,
    newLat,
    predictedAtMoment: predicted,
    observedAtMoment: observedTemp,
    latitudeShifted,
  };
}

// Format an estimated climate as a CSV string with metadata in headers.
export function climateToCsvString(days, params = {}) {
  const lines = [
    '# Estimated climate from the Vintage Story Farming Dashboard.',
    '# Built by reshaping a loaded climate to match player observations.',
    '#',
  ];
  if (params.source) lines.push(`# Source: ${params.source}`);
  if (typeof params.oldYearAvg === 'number') lines.push(`# Previous year avg: ${params.oldYearAvg.toFixed(2)}°C`);
  if (typeof params.newYearAvg === 'number') lines.push(`# New year avg: ${params.newYearAvg.toFixed(2)}°C`);
  if (typeof params.baseOffset === 'number') {
    const sign = params.baseOffset >= 0 ? '+' : '';
    lines.push(`# Mean offset applied: ${sign}${params.baseOffset.toFixed(2)}°C`);
  }
  if (typeof params.ampScale === 'number' && Math.abs(params.ampScale - 1) > 0.01) {
    lines.push(`# Seasonal amplitude rescale: ×${params.ampScale.toFixed(2)}`);
  }
  if (typeof params.diurnalRatio === 'number' && Math.abs(params.diurnalRatio - 1) > 0.01) {
    lines.push(`# Day-night swing rescale: ×${params.diurnalRatio.toFixed(2)}`);
  }
  if (params.position) lines.push(`# Reading taken at X=${params.position.x}, Y=${params.position.y}, Z=${params.position.z}`);
  if (params.origin) lines.push(`# Loaded climate origin: X=${params.origin.x}, Y=${params.origin.y}, Z=${params.origin.z}`);
  lines.push('day,avg,min,max');
  for (const d of days) {
    lines.push(`${d.day},${d.avg.toFixed(2)},${d.min.toFixed(2)},${d.max.toFixed(2)}`);
  }
  return lines.join('\n');
}

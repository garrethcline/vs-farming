// Climate estimator (experimental).
//
// USE CASE: you've already loaded a climate (bundled, or from /debug
// exptempplot upload). You move to a new spot in the world. The HUD
// shows a different yearly average there, but you don't want to run
// /debug again every time you move. This module estimates the new
// climate by taking the previously loaded curve as a template and
// adjusting it to match the new average.
//
// Three things can change between spots:
//   1. yearAvg shifts (different latitude or globalTemperature)
//   2. seasonal amplitude shifts (different latitude only)
//   3. diurnal amplitude shifts (different rainfall)
//
// MODE A. Mean shift only (simplest).
//   Take previous curve, add (newYearAvg - oldYearAvg) to every day.
//   Preserves shape, noise, seasonal amplitude. Wrong if latitude changed.
//
// MODE B. Mean + amplitude rescale.
//   Decompose the previous curve into (mean) + (deviation from mean).
//   Scale the deviation by (newAmp / oldAmp), then re-center on newYearAvg.
//   Use when you have BOTH new yearAvg AND new seasonal amplitude.
//
// MODE C. Mean shift + diurnal rescale.
//   Same as A, plus shrink/expand each day's (max - avg) and (avg - min)
//   by the new rainfall's implied diurnal ratio.

const HOURS_PER_DAY = 24;
const MONTHS_PER_YEAR = 12;

// Compute the yearly average of a climate array.
export function computeYearAvg(climate) {
  if (!climate || climate.length === 0) return null;
  return climate.reduce((s, d) => s + d.avg, 0) / climate.length;
}

// Compute the seasonal amplitude (5th-95th percentile of daily averages,
// robust against single-day noise spikes).
export function computeSeasonalAmp(climate) {
  if (!climate || climate.length < 30) return null;
  const sorted = climate.map(d => d.avg).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.05)];
  const hi = sorted[Math.floor(sorted.length * 0.95)];
  return hi - lo;
}

// Compute the average diurnal swing.
export function computeDiurnalAvg(climate) {
  if (!climate || climate.length === 0) return null;
  return climate.reduce((s, d) => s + (d.max - d.min), 0) / climate.length;
}

// MODE A: shift the entire curve by a constant offset.
// Returns { climate, offset, oldYearAvg, newYearAvg }.
export function shiftToYearAvg(prevClimate, newYearAvg) {
  const oldAvg = computeYearAvg(prevClimate);
  if (oldAvg === null) return { error: 'No previous climate to base on' };
  const offset = newYearAvg - oldAvg;
  const climate = prevClimate.map(d => ({
    day: d.day,
    avg: d.avg + offset,
    min: d.min + offset,
    max: d.max + offset,
  }));
  return { climate, offset, oldYearAvg: oldAvg, newYearAvg };
}

// MODE B: shift mean AND rescale seasonal amplitude.
// scaleFactor is the new amplitude divided by the old amplitude.
// Decomposes each day into (mean) + (deviation), scales the deviation,
// recenters on newYearAvg.
export function rescaleAmpAndShift(prevClimate, newYearAvg, newAmp) {
  const oldAvg = computeYearAvg(prevClimate);
  const oldAmp = computeSeasonalAmp(prevClimate);
  if (oldAvg === null || oldAmp === null) return { error: 'Insufficient previous climate data' };
  if (oldAmp < 0.1) return { error: 'Previous climate has near-zero seasonal amplitude; cannot rescale' };
  const ampScale = newAmp / oldAmp;
  const climate = prevClimate.map(d => ({
    day: d.day,
    avg: newYearAvg + (d.avg - oldAvg) * ampScale,
    min: newYearAvg + (d.min - oldAvg) * ampScale,
    max: newYearAvg + (d.max - oldAvg) * ampScale,
  }));
  return { climate, ampScale, oldYearAvg: oldAvg, oldAmp, newYearAvg, newAmp };
}

// MODE C: shift mean AND adjust diurnal swing per day.
// For each day, compute its deviation from its own daily-avg (the diurnal
// half-swing toward min and max). Scale those deviations by the new
// rainfall's implied ratio, then offset by mean shift.
//
// Source formula: diurnal = 18 - 13 × rainfall.
// So oldDiurnal = 18 - 13 × oldRain, newDiurnal = 18 - 13 × newRain.
// Ratio = newDiurnal / oldDiurnal.
export function shiftAndRetuneRainfall(prevClimate, newYearAvg, oldRainfall, newRainfall) {
  const oldAvg = computeYearAvg(prevClimate);
  if (oldAvg === null) return { error: 'No previous climate to base on' };
  const oldDiurnal = 18 - 13 * oldRainfall;
  const newDiurnal = 18 - 13 * newRainfall;
  if (oldDiurnal <= 0) return { error: 'Old rainfall produces non-positive diurnal swing; check input' };
  const ratio = newDiurnal / oldDiurnal;
  const offset = newYearAvg - oldAvg;
  const climate = prevClimate.map(d => {
    const newDayAvg = d.avg + offset;
    return {
      day: d.day,
      avg: newDayAvg,
      min: newDayAvg + (d.min - d.avg) * ratio,
      max: newDayAvg + (d.max - d.avg) * ratio,
    };
  });
  return { climate, offset, ratio, oldYearAvg: oldAvg, newYearAvg, oldDiurnal, newDiurnal };
}

// Combined mode: apply all three adjustments at once. Used when the user
// has new yearAvg, new seasonal amp, and new rainfall.
export function shiftAmpAndRainfall(prevClimate, opts) {
  const { newYearAvg, newAmp = null, oldRainfall = null, newRainfall = null } = opts;
  const oldAvg = computeYearAvg(prevClimate);
  const oldAmp = computeSeasonalAmp(prevClimate);
  if (oldAvg === null || oldAmp === null) return { error: 'Insufficient previous climate data' };

  // Resolve effective scales
  const ampScale = (newAmp !== null && newAmp > 0 && oldAmp > 0.1) ? newAmp / oldAmp : 1;
  let diurnalRatio = 1;
  if (oldRainfall !== null && newRainfall !== null) {
    const oldD = 18 - 13 * oldRainfall;
    const newD = 18 - 13 * newRainfall;
    if (oldD > 0) diurnalRatio = newD / oldD;
  }

  const climate = prevClimate.map(d => {
    const newDayAvg = newYearAvg + (d.avg - oldAvg) * ampScale;
    return {
      day: d.day,
      avg: newDayAvg,
      min: newDayAvg + (d.min - d.avg) * diurnalRatio,
      max: newDayAvg + (d.max - d.avg) * diurnalRatio,
    };
  });
  return { climate, ampScale, diurnalRatio, oldYearAvg: oldAvg, newYearAvg, oldAmp };
}

// Source: Temperature.cs.updateTemperature. The game uses a hardcoded
// 4 AM as the coldest hour (and 4 PM as the hottest). The hour-of-day
// offset is `(distanceTo6Am - 0.5) * diurnalAmplitude`, where
// distanceTo6Am = SmoothStep(abs(CyclicValueDistance(4, hour, 24)) / 12).
// This helper mirrors that for any (loaded daily climate, hour) pair.
//
// Returns the predicted temperature at the given hour-of-day, given a
// daily record with avg/min/max. The (max - min) acts as the day's
// effective diurnal amplitude. At hour=4 the result equals min; at
// hour=16 it equals max; at avg the temp is roughly (min + max)/2.
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

// SINGLE-READING ESTIMATOR (the realistic case).
//
// What the player actually has: their character is standing at some spot,
// they pulled up F3 / clock / thermometer, and they wrote down:
//   - the in-game date (month, day-of-month)
//   - the in-game time (hour, 0-23)
//   - the temperature shown at the block they're standing on
//
// They DO NOT have a year average, a seasonal amplitude, or a rainfall %.
// Those are only available by exporting the full year via
// /debug exptempplot, which is what the bundled climate already is.
//
// Approach: from the loaded climate, find what temperature WOULD be
// predicted on (date, hour). The difference between the user's reading
// and the predicted value is the offset to apply to the whole curve.
//
// dayOfYear is 1-based. hourOfDay is 0-23 game hours.
// Returns { climate, offset, predictedReading, observedReading } or { error }.
export function shiftFromSingleReading(prevClimate, dayOfYear, hourOfDay, observedTemp) {
  if (!Array.isArray(prevClimate) || prevClimate.length === 0) {
    return { error: 'No previous climate to base on' };
  }
  if (!isFinite(dayOfYear) || dayOfYear < 1 || dayOfYear > prevClimate.length) {
    return { error: `Day must be between 1 and ${prevClimate.length}` };
  }
  if (!isFinite(hourOfDay) || hourOfDay < 0 || hourOfDay >= 24) {
    return { error: 'Hour must be 0-23' };
  }
  if (!isFinite(observedTemp)) {
    return { error: 'Temperature reading required' };
  }

  const day = prevClimate[Math.floor(dayOfYear) - 1];
  if (!day) return { error: 'Day not found in loaded climate' };

  const predicted = predictTempAtHour(day, hourOfDay);
  const offset = observedTemp - predicted;

  const climate = prevClimate.map(d => ({
    day: d.day,
    avg: d.avg + offset,
    min: d.min + offset,
    max: d.max + offset,
  }));

  return {
    climate,
    offset,
    predictedReading: predicted,
    observedReading: observedTemp,
    oldYearAvg: computeYearAvg(prevClimate),
    newYearAvg: computeYearAvg(prevClimate) + offset,
  };
}

// Format an estimated climate as a CSV string.
export function climateToCsvString(days, params = {}) {
  const lines = [
    '# Estimated climate from the Vintage Story Farming Dashboard.',
    '# Built by adjusting a previously loaded climate to a new yearly average.',
    '#',
  ];
  if (params.source) lines.push(`# Source: ${params.source}`);
  if (typeof params.oldYearAvg === 'number') lines.push(`# Previous yearAvg: ${params.oldYearAvg.toFixed(2)}°C`);
  if (typeof params.newYearAvg === 'number') lines.push(`# New yearAvg: ${params.newYearAvg.toFixed(2)}°C`);
  if (typeof params.offset === 'number') lines.push(`# Mean offset: ${params.offset >= 0 ? '+' : ''}${params.offset.toFixed(2)}°C`);
  if (typeof params.ampScale === 'number' && Math.abs(params.ampScale - 1) > 0.01) {
    lines.push(`# Amplitude rescale: ×${params.ampScale.toFixed(2)}`);
  }
  if (typeof params.diurnalRatio === 'number' && Math.abs(params.diurnalRatio - 1) > 0.01) {
    lines.push(`# Diurnal rescale: ×${params.diurnalRatio.toFixed(2)}`);
  }
  lines.push('day,avg,min,max');
  for (const d of days) {
    lines.push(`${d.day},${d.avg.toFixed(2)},${d.min.toFixed(2)},${d.max.toFixed(2)}`);
  }
  return lines.join('\n');
}

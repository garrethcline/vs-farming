// Climate data + helpers.
//
// DEFAULT_CLIMATE is the bundled climate.csv, parsed at build time. This is
// the same data the runtime would fetch via ./climate.csv on a hosted deploy,
// but having it as a module constant means standalone single-file builds
// (where there's no HTTP server to serve a sibling CSV) still get the full
// year of data instead of falling back to a stub. The runtime fetch is kept
// as a refinement path for deployments that ship a different CSV next to the
// HTML; users can also upload a custom CSV via the Settings tab.
//
// Helpers (climateAt, climateWindow) read from the current climate via
// getCurrentClimate(). Components that need reactive access should use
// useClimate() from lib/useClimate.js so they re-render on climate changes.

import bundledClimateCsv from '../../public/climate.csv?raw';

// Inline parser used only for the build-time default. Mirrors parseDailyCSV
// below but doesn't depend on this module's mutable _daysPerMonth (which
// isn't set yet at import time). Daily CSV format only; the bundled file is
// daily, and any custom uploads still flow through parseClimateCSV.
function parseDefaultClimate(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || /^(day|d)\s*,/i.test(t)) continue;
    const cells = t.split(',').map(c => c.trim());
    if (cells.length < 4) continue;
    const d = parseInt(cells[0], 10);
    const avg = parseFloat(cells[1]);
    const min = parseFloat(cells[2]);
    const max = parseFloat(cells[3]);
    if (Number.isFinite(d) && Number.isFinite(avg) && Number.isFinite(min) && Number.isFinite(max)) {
      out.push({ d, avg, min, max });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

export const DEFAULT_CLIMATE = parseDefaultClimate(bundledClimateCsv);

export const MONTHS_PER_YEAR = 12;
export const HOURS_PER_DAY = 24;
export const TICKS_PER_DAY = 24 / 3.5; // ~6.857

// === Dynamic daysPerMonth / daysPerYear ===
//
// These USED to be hardcoded constants (DAYS_PER_MONTH = 9, DAYS_PER_YEAR = 108)
// but the user's server can run any value (e.g. 20 d/m → 240 d/yr). So:
//
//   daysPerMonth() reads from settings (set via setDaysPerMonth from React)
//   daysPerYear()  returns climate array length (since climate IS the year), or
//                    daysPerMonth × 12 if climate matches that, or fallback
//
// React components: pass settings.daysPerMonth into helper functions OR call
// setDaysPerMonth(settings.daysPerMonth) once at the App root and the module
// state stays in sync.

let _daysPerMonth = 9;

export function daysPerMonth() { return _daysPerMonth; }
export function daysPerYear() { return _daysPerMonth * MONTHS_PER_YEAR; }
export function climateLength() { return _climate.length; }

export function setDaysPerMonth(n) {
  const clamped = Math.max(1, Math.min(60, parseInt(n) || 9));
  if (clamped !== _daysPerMonth) {
    _daysPerMonth = clamped;
    _listeners.forEach(fn => { try { fn(_climate); } catch (e) { console.error(e); } });
  }
}

// Legacy compat exports - deprecated, prefer the functions above.
// Kept so any third-party / older imports don't crash, but they reflect
// only the *current* values at module-load time and won't update.
export const DAYS_PER_MONTH = 9;
export const DAYS_PER_YEAR = 108;

// From CSV analysis of the bundled climate. These are recomputed when
// a custom CSV is loaded (see recomputeSeasonBounds below).
export let SEASON_END_DAY = 84;
export let SEASON_START_DAY = 34;
export let YEARLY_AVG_TEMP = -2.13;
export const GH_BONUS = 5; // greenhouse adds +5C

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// === Mutable state ===

let _climate = DEFAULT_CLIMATE;
const _listeners = new Set();

export function getCurrentClimate() {
  return _climate;
}

// Update the active climate. Triggers all subscribers (e.g. useClimate hooks)
// to re-render. Also recomputes SEASON_START_DAY / SEASON_END_DAY based on
// the new data's frost dates.
//
// Note: this does NOT modify _daysPerMonth even if the array length suggests
// a different value. The user's settings.daysPerMonth is the source of truth.
// If climate.length and daysPerMonth × 12 disagree, daysPerYear() reports
// climate.length (since the climate array IS the year being displayed) but
// crop math still uses settings.daysPerMonth. The Settings tab shows both
// so the user can spot mismatches.
export function setCurrentClimate(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return;
  _climate = arr;
  recomputeSeasonBounds();
  _listeners.forEach(fn => { try { fn(arr); } catch (e) { console.error(e); } });
}

export function subscribeClimate(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// Find first/last days where daily *average* temp is >= 0C (frost-free).
// Matches the original SPEC criterion. The first frost day = the day after.
function recomputeSeasonBounds() {
  let firstWarm = null;
  let lastWarm = null;
  for (const c of _climate) {
    if (c.avg >= 0) {
      if (firstWarm === null) firstWarm = c.d;
      lastWarm = c.d;
    }
  }
  if (firstWarm !== null && lastWarm !== null) {
    SEASON_START_DAY = firstWarm;
    SEASON_END_DAY = lastWarm + 1; // first frost = day after last warm
  } else {
    // No frost-free days found, so set season as the whole year (greenhouse-only)
    SEASON_START_DAY = 1;
    SEASON_END_DAY = _climate.length;
  }
  if (_climate.length > 0) {
    YEARLY_AVG_TEMP = _climate.reduce((a, c) => a + c.avg, 0) / _climate.length;
  }
}

// Initialize SEASON_START_DAY / SEASON_END_DAY / YEARLY_AVG_TEMP from the
// bundled DEFAULT_CLIMATE on module load. Without this, the placeholder values
// declared at the top of the file would govern the first frame of render
// before setCurrentClimate fires via bootstrapClimate. The placeholders
// happened to correspond to the OLD 108-day stub, so the Calendar's first
// paint showed "every crop fails" until the async fetch resolved.
recomputeSeasonBounds();

// === Helpers ===

// dayLabel: a long human-friendly day reference.
//   Year 1, day within year: "5 Jun, Year 1"
//   Multi-year (d > one year):  "5 Jun, Year 2"
//
// dateLabel: the short human-friendly form, no year:
//   "5 Jun"
//
// Both accept an optional daysPerMonth override; default to the module's
// current value. Pass settings.daysPerMonth from React for accuracy.
//
// Both fall back to "Day N" if the inputs are bad (NaN, < 1, etc).

export function dateParts(d, dpm) {
  if (!isFinite(d) || d < 1) return null;
  const dpMonth = dpm || _daysPerMonth;
  const yearLen = dpMonth * MONTHS_PER_YEAR;
  const year = Math.floor((d - 1) / yearLen);
  const dayInYear = ((d - 1) % yearLen) + 1;
  const m = Math.floor((dayInYear - 1) / dpMonth);
  const dayOfMonth = ((dayInYear - 1) % dpMonth) + 1;
  return { year, dayInYear, monthIdx: m % MONTHS_PER_YEAR, dayOfMonth, monthName: MONTH_NAMES[m % MONTHS_PER_YEAR] };
}

export function dateLabel(d, dpm) {
  const p = dateParts(d, dpm);
  if (!p) return `Day ${d}`;
  return `${p.dayOfMonth} ${p.monthName}`;
}

export function dayLabel(d, dpm) {
  const p = dateParts(d, dpm);
  if (!p) return `Day ${d}`;
  return `${p.dayOfMonth} ${p.monthName}, Year ${p.year}`;
}

// Inverse of dateParts: given a month (1-12) and day-of-month, return the
// game day of year. VS uses 0-indexed years (Year 0, Year 1, ...) so this
// matches the in-game date readout.
export function dayFromDate(monthOneBased, dayOfMonth, year, dpm) {
  const dpMonth = dpm || _daysPerMonth;
  const yearLen = dpMonth * MONTHS_PER_YEAR;
  const m = Math.max(0, Math.min(11, (monthOneBased | 0) - 1));
  const dom = Math.max(1, Math.min(dpMonth, dayOfMonth | 0));
  const y = Math.max(0, year | 0);
  return y * yearLen + m * dpMonth + dom;
}

export function climateAt(day, greenhouse = false) {
  const arr = _climate;
  if (arr.length === 0) return { d: 0, avg: 0, min: 0, max: 0 };
  // Wrap around the cyclic climate so day 241 (or year-1 day 1) returns the
  // same data as day 1 of year 0. Clamping breaks long-grow simulations and
  // any usage past Year 0.
  const idx = ((Math.floor(day) - 1) % arr.length + arr.length) % arr.length;
  const c = arr[idx];
  if (!greenhouse) return c;
  return {
    d: c.d,
    avg: c.avg + GH_BONUS,
    min: c.min + GH_BONUS,
    max: c.max + GH_BONUS,
  };
}

// Window analysis: avg/min/max temps from plant to harvest.
// Wraps around the climate cycle so a late planting that finishes in the
// next game year sees the full window, not a truncated one.
export function climateWindow(plantDay, growDays, greenhouse = false) {
  const yearLen = _climate.length;
  if (yearLen === 0) return { min: 0, max: 0, avg: 0 };
  let minT = Infinity, maxT = -Infinity, avgSum = 0, n = 0;
  for (let d = plantDay; d <= plantDay + growDays; d++) {
    // Wrap: day 241 of a 240-day year is day 1 of next year, same climate.
    const idx = ((Math.floor(d) - 1) % yearLen + yearLen) % yearLen;
    const c = _climate[idx];
    const offset = greenhouse ? GH_BONUS : 0;
    minT = Math.min(minT, c.min + offset);
    maxT = Math.max(maxT, c.max + offset);
    avgSum += c.avg + offset;
    n++;
  }
  return {
    min: minT === Infinity ? 0 : minT,
    max: maxT === -Infinity ? 0 : maxT,
    avg: n ? avgSum / n : 0,
  };
}

// === CSV parser ===

// Detects two formats:
// 1. Daily aggregated CSV with header `day,avg,min,max` (or `d,avg,min,max`).
//    Comma-delimited. 108 rows. Easy to author/edit by hand.
// 2. Hourly raw export from /debug exptempplot:
//    `D.M.YYYY H:MM;TEMPERATURE`, semicolon-delimited, no header.
//    Auto-aggregated to daily min/avg/max.
// If `daysPerMonth` isn't passed, uses the module's current value (set via
// setDaysPerMonth from main.jsx + App.jsx). This avoids the trap of parsing
// the CSV at the default 9-dpm when the user's server is on a different cycle,
// which would shift every date interpretation by months.
export function parseClimateCSV(text, daysPerMonth = _daysPerMonth) {
  const lines = text.replace(/\r/g, '').split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) throw new Error('Empty CSV');

  const first = lines[0];

  // Detect hourly format: starts with D.M.YYYY H:MM;
  if (/^\d+\.\d+\.\d+\s+\d+:\d+\s*;/.test(first)) {
    return aggregateHourly(lines, daysPerMonth);
  }

  // Detect daily format with header
  if (/^(day|d)\s*,\s*(avg|min|max)/i.test(first)) {
    return parseDailyCSV(lines);
  }

  // Detect daily format without header (just numbers)
  if (/^\d+\s*,\s*-?\d+(\.\d+)?/.test(first)) {
    return parseDailyCSV(['day,avg,min,max', ...lines]);
  }

  throw new Error('Unrecognized CSV format. Expected either daily (day,avg,min,max) or hourly (D.M.YYYY H:MM;TEMP).');
}

function parseDailyCSV(lines) {
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const dIdx = header.findIndex(h => h === 'day' || h === 'd');
  const avgIdx = header.findIndex(h => h === 'avg' || h === 'mean' || h === 'temp');
  const minIdx = header.findIndex(h => h === 'min');
  const maxIdx = header.findIndex(h => h === 'max');
  if (dIdx < 0 || avgIdx < 0 || minIdx < 0 || maxIdx < 0) {
    throw new Error('Daily CSV must have columns: day,avg,min,max');
  }
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim());
    const d = parseInt(cells[dIdx]);
    const avg = parseFloat(cells[avgIdx]);
    const min = parseFloat(cells[minIdx]);
    const max = parseFloat(cells[maxIdx]);
    if (!isFinite(d) || !isFinite(avg) || !isFinite(min) || !isFinite(max)) continue;
    out.push({ d, avg, min, max });
  }
  if (out.length === 0) throw new Error('Daily CSV had no valid rows');
  // Sort by day to be safe
  out.sort((a, b) => a.d - b.d);
  return out;
}

function aggregateHourly(lines, daysPerMonth) {
  // Each line: "D.M.YYYY H:MM;TEMP"
  // Aggregate by day-of-year (assuming `daysPerMonth` per month, 12 months).
  const byDay = new Map();
  for (const line of lines) {
    const semi = line.indexOf(';');
    if (semi < 0) continue;
    const datePart = line.substring(0, semi).trim();
    const tempPart = line.substring(semi + 1).trim();
    const m = datePart.match(/^(\d+)\.(\d+)\.\d+\s+(\d+):(\d+)/);
    if (!m) continue;
    const dayOfMonth = parseInt(m[1]);
    const month = parseInt(m[2]);
    const dayOfYear = (month - 1) * daysPerMonth + dayOfMonth;
    const temp = parseFloat(tempPart);
    if (!isFinite(temp)) continue;
    if (!byDay.has(dayOfYear)) byDay.set(dayOfYear, []);
    byDay.get(dayOfYear).push(temp);
  }
  if (byDay.size === 0) throw new Error('Hourly CSV had no valid rows');
  const totalDays = daysPerMonth * 12;
  const result = [];
  for (let d = 1; d <= totalDays; d++) {
    const temps = byDay.get(d);
    if (!temps || temps.length === 0) continue;
    const sum = temps.reduce((a, b) => a + b, 0);
    let mn = temps[0], mx = temps[0];
    for (const t of temps) { if (t < mn) mn = t; if (t > mx) mx = t; }
    result.push({
      d,
      avg: Math.round(sum / temps.length * 100) / 100,
      min: Math.round(mn * 100) / 100,
      max: Math.round(mx * 100) / 100,
    });
  }
  return result;
}

// Serialize the current climate to a daily CSV (for download/export).
export function serializeClimateCSV(climate = _climate) {
  const lines = ['day,avg,min,max'];
  for (const c of climate) {
    lines.push(`${c.d},${c.avg},${c.min},${c.max}`);
  }
  return lines.join('\n') + '\n';
}

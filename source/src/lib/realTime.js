// Convert in-game time to wall-clock time using the user's server config.
//
// VS server config: "Days per month: 20 (16 real life hours)" means one
// in-game month takes 16 real hours when someone is online. So:
//   realMinutesPerGameDay = (realHoursPerMonth × 60) / daysPerMonth
//   realMinutesPerGameHour = realMinutesPerGameDay / hoursPerDay (24)
//
// Note: time only advances when someone is on the server. The real-world
// number is the wall-clock time IF you (or someone) is online continuously.
// Idle servers freeze game time.

const HOURS_PER_GAME_DAY = 24;

export function realMinutesPerGameDay(daysPerMonth, realHoursPerMonth) {
  if (!daysPerMonth || daysPerMonth <= 0) return null;
  return (realHoursPerMonth * 60) / daysPerMonth;
}

export function gameDaysToRealMinutes(gameDays, daysPerMonth, realHoursPerMonth) {
  const rmpd = realMinutesPerGameDay(daysPerMonth, realHoursPerMonth);
  if (rmpd == null) return null;
  return gameDays * rmpd;
}

export function gameHoursToRealMinutes(gameHours, daysPerMonth, realHoursPerMonth) {
  return gameDaysToRealMinutes(gameHours / HOURS_PER_GAME_DAY, daysPerMonth, realHoursPerMonth);
}

// Format a wall-clock duration in human-readable form. Picks units that fit:
//   < 60 min → "45 min"
//   < 24 hr → "3h 20m" or "5h"
//   ≥ 24 hr → "2d 4h" or "3 days"
export function formatRealDuration(minutes) {
  if (minutes == null || !isFinite(minutes)) return '...';
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round(minutes - h * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const days = hours / 24;
  if (days < 10) {
    const d = Math.floor(days);
    const h = Math.round(hours - d * 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }
  return `${Math.round(days)} days`;
}

// Convenience: takes game days, returns the formatted real-world string.
export function gameDaysToRealString(gameDays, daysPerMonth, realHoursPerMonth) {
  const m = gameDaysToRealMinutes(gameDays, daysPerMonth, realHoursPerMonth);
  return formatRealDuration(m);
}

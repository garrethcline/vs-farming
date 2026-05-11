// First-frost indicator. Drop into any tab where season-end timing matters.
// Reads SEASON_END_DAY (last frost-free day + 1) from current climate.

import { SEASON_END_DAY, dateLabel } from '../data/climate.js';
import { useSettings } from '../lib/storage.js';

export default function FrostBanner({ compact = false }) {
  const [settings] = useSettings();
  const dpm = settings.daysPerMonth || 9;
  const today = settings.today || 1;
  const yearLen = dpm * 12;

  // SEASON_END_DAY is in year-0 absolute day. Today might be in year 1+.
  // Compute the upcoming first-frost date relative to today.
  const todayDayOfYear = ((today - 1) % yearLen) + 1;
  const yearStart = today - todayDayOfYear + 1;
  let nextFrostAbs = yearStart + SEASON_END_DAY - 1;
  if (nextFrostAbs < today) nextFrostAbs += yearLen;
  const daysUntil = nextFrostAbs - today;

  // Color tier
  let tone, label;
  if (daysUntil <= 0) {
    tone = 'text-terra-700';
    label = 'Past first frost';
  } else if (daysUntil <= 14) {
    tone = 'text-terra-700';
    label = 'First frost';
  } else if (daysUntil <= 35) {
    tone = 'text-amber-800';
    label = 'First frost';
  } else {
    tone = 'text-forest-800';
    label = 'First frost';
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-parchment-200/40 border border-parchment-300/60 text-sm">
        <span className="text-ink-500 text-xs uppercase tracking-wider">{label}</span>
        <span className={`font-medium tabular ${tone}`}>{dateLabel(nextFrostAbs, dpm)}</span>
        <span className="text-ink-500 text-xs tabular">
          {daysUntil > 0 ? `(${daysUntil}d away)` : '(passed)'}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col px-3 py-2 rounded-md bg-parchment-200/40 border border-parchment-300/60">
      <span className="text-ink-500 text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`font-display text-base tabular ${tone}`}>{dateLabel(nextFrostAbs, dpm)}</span>
      <span className="text-ink-500 text-xs tabular">
        {daysUntil > 0 ? `${daysUntil} days away` : 'passed for this year'}
      </span>
    </div>
  );
}

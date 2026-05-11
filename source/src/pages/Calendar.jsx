// Calendar. Plantability heatmap. Each row is a crop. The 12-month grid
// shows quick "is this month any good" status; click a row to expand it
// inline and see day-by-day plantability for that crop. Useful when months
// are long (the user's server runs 20 d/m, so per-month resolution loses
// "early May good, late May too late" detail).
import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Toggle, NutrientChip, Flourish,
} from '../components/ui/Primitives.jsx';
import { CROPS_LIST, growDays as cropGrowDays } from '../data/crops.js';
import { climateWindow, MONTH_NAMES, MONTHS_PER_YEAR, SEASON_END_DAY, dayLabel, dateLabel } from '../data/climate.js';
import { useClimate } from '../lib/useClimate.js';
import { useSettings } from '../lib/storage.js';
import { damageRisk, effectiveGrowDays, rainfallGrowRange } from '../lib/mechanics.js';
import { GAME, SOILS_PLANTABLE } from '../data/game.js';
import LocationPicker from '../components/LocationPicker.jsx';
import FrostBanner from '../components/FrostBanner.jsx';

// Compute one cell of plantability for (crop, plantDay), given the simulated
// effective grow days at the chosen soil tier.
function evalPlantDay(crop, plantDay, effGrowDays, stalled, climate, greenhouse, seasonEndDay) {
  const harvest = plantDay + effGrowDays;
  const window = climateWindow(plantDay, effGrowDays, greenhouse);
  // Leaky-bucket damage sim: tracks accumulated hours below cold (or above
  // heat) day by day, mirroring BEFarmland.cs:108-160. 'fatal' means the
  // crop would die mid-grow per the 48h death threshold.
  const risk = damageRisk(crop, window.min, window.max, {
    climate, plantDay, growDays: effGrowDays, greenhouse,
  });
  const willFinish = greenhouse || harvest <= seasonEndDay;
  // Carry effGrowDays in every cell so estimateHarvestsPerYear can use the
  // actual per-day climate-aware grow time, not a fixed median.
  const base = { plantDay, harvest, effGrowDays };
  if (stalled) return { ...base, status: 'stalled' };
  if (!willFinish) return { ...base, status: 'late' };
  if (risk.willDie || risk.riskLevel === 'fatal') return { ...base, status: 'cold' };
  if (risk.riskLevel === 'severe') return { ...base, status: 'cold' };
  if (risk.riskLevel === 'risk') return { ...base, status: 'risky' };
  return { ...base, status: 'ok' };
}

// Roll a row of per-day cells into a per-month summary cell. Status priority
// is best-of: if any day in the month is 'ok', the month is 'ok' (so a quick
// glance at the grid still surfaces "this month is at least partly viable").
const STATUS_RANK = { ok: 4, risky: 3, cold: 2, late: 1, stalled: 0 };
function bestStatus(cells) {
  let best = cells[0];
  for (const c of cells) {
    if (STATUS_RANK[c.status] > STATUS_RANK[best.status]) best = c;
  }
  return best.status;
}

// Estimate how many harvests of this crop you could chain in one year.
// Walks through the day strip greedily: plant on the first plantable day,
// advance by effGrowDays, repeat until a planting wouldn't finish in time.
//
// `acceptStatuses` is the set of plantable statuses to accept. Default
// counts only 'ok' days (no heat/cold risk, no stalling, finishes in season).
// Setting it to also accept 'risky' gives a more optimistic upper bound.
//
// Returns {count, plantDays, lastHarvest} where:
//   count: number of harvests that fit in one year of climate
//   plantDays: list of plant days for each cycle (1-based)
//   lastHarvest: day-of-year of the final harvest
// Walk the calendar greedily: plant on the next acceptable day, harvest
// `effGrowDays_at_that_day` later, repeat. The `dayMeta` entries already
// carry the per-day effective grow time computed under the actual climate
// at that plant day, so this captures the full curve (slow autumn plantings
// stretch out, midsummer ones don't).
function estimateHarvestsPerYear(days, acceptStatuses = new Set(['ok'])) {
  if (!Array.isArray(days) || days.length === 0) {
    return { count: 0, plantDays: [], lastHarvest: 0 };
  }
  const yearLen = days.length;
  const plantDays = [];
  let cursor = 0;  // 0-based day index; the next day available for planting
  let lastHarvest = 0;
  while (cursor < yearLen) {
    let planted = -1;
    for (let d = cursor; d < yearLen; d++) {
      if (acceptStatuses.has(days[d].status)) { planted = d; break; }
    }
    if (planted === -1) break;
    plantDays.push(planted + 1);
    const eff = days[planted].effGrowDays || 0;
    if (eff <= 0) break;
    lastHarvest = planted + 1 + eff;
    // Next plantable index = harvest day (1-based) - 1 (back to 0-based array)
    // = planted + Math.ceil(eff). Same logic as before but uses per-day eff.
    cursor = planted + Math.ceil(eff);
    if (cursor >= yearLen) break;
  }
  return { count: plantDays.length, plantDays, lastHarvest: Math.round(lastHarvest) };
}

export default function CalendarPage() {
  const [greenhouse, setGreenhouse] = useState(false);
  const [expandedKey, setExpandedKey] = useState(null);
  const { climate } = useClimate();
  const [settings] = useSettings();
  const [soilTier, setSoilTier] = useState(settings.defaultSoil ?? 50);
  const dpm = settings.daysPerMonth;
  const yearLen = climate.length;
  // Number of month columns to render = how many months the climate data
  // actually covers at this dpm setting. Capped at MONTHS_PER_YEAR (12)
  // because VS calendars don't go beyond that.
  const monthCount = Math.min(MONTHS_PER_YEAR, Math.ceil(yearLen / dpm));

  // Build a per-day plantability strip per crop, then derive monthly summaries
  // from it. Doing per-day first means click-to-expand is just slicing the
  // strip, no extra computation.
  const matrix = useMemo(() => {
    // Use the user's rainfall + waterDistance settings (matches what the
    // Decision/Dashboard tabs use) so the Calendar's grow-time prediction
    // agrees with theirs. Greenhouse: shift climate +5C and skip light penalty.
    const moistRange = rainfallGrowRange(
      settings.rainfallFrequency || 'common',
      1,        // assume nearby water (within 1 block) for matrix display
      greenhouse,
    );
    const moistF = moistRange.expected;
    const lightF = 1.0;  // matrix display assumes outdoor or greenhouse, both full light

    return CROPS_LIST.map(crop => {
      const baseGrowDays = cropGrowDays(crop, dpm, settings.worldConfig?.cropGrowthRateMul ?? 1.0);
      // Apply +5C greenhouse bonus to climate before passing to grow sim
      const climateForSim = greenhouse
        ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
        : climate;
      const growSpeedMul = moistF * lightF;

      const days = [];
      for (let d = 1; d <= yearLen; d++) {
        // Per-day temperature-aware grow time. A late-summer planting whose
        // tail falls into autumn cooling correctly extends past nominal.
        const sim = effectiveGrowDays(crop, baseGrowDays, soilTier, 0, growSpeedMul, d, climateForSim);
        const effGrowDays = sim.stalled ? baseGrowDays * 5 : sim.effectiveDays;
        days.push(evalPlantDay(crop, d, effGrowDays, sim.stalled, climate, greenhouse, SEASON_END_DAY));
      }

      // Pick a representative effGrowDays (the median across viable days) so
      // the sub-card text and harvest-per-year math have a stable number.
      const okDays = days.filter(d => d.status === 'ok');
      const repPlantDay = okDays.length > 0 ? okDays[Math.floor(okDays.length / 2)].plantDay : 1;
      const repSim = effectiveGrowDays(crop, baseGrowDays, soilTier, 0, growSpeedMul, repPlantDay, climateForSim);
      const effGrowDays = repSim.stalled ? baseGrowDays * 5 : repSim.effectiveDays;
      const sim = repSim;

      const months = [];
      for (let m = 0; m < monthCount; m++) {
        const start = m * dpm;
        const end = Math.min(yearLen, start + dpm);
        const monthDays = days.slice(start, end);
        if (monthDays.length === 0) {
          months.push({ month: m, status: 'late', plantDay: start + 1, harvest: start + 1 + effGrowDays, okCount: 0, totalDays: 0 });
        } else {
          const okCount = monthDays.filter(d => d.status === 'ok').length;
          const riskyCount = monthDays.filter(d => d.status === 'risky').length;
          const status = bestStatus(monthDays);
          // Demote "ok" to "marginal" when only a small fraction of the month
          // is actually plantable. Uses both an absolute floor (< 4 days) and
          // a relative check (< 25% of the month) so short truncated months
          // where every day is ok don't get falsely demoted.
          const monthSize = monthDays.length;
          const okFraction = okCount / monthSize;
          const demote = status === 'ok'
            && okCount < 4
            && okFraction < 0.5;
          const displayStatus = demote ? 'marginal' : status;
          // Find the first ok day for the cell's plant-day metadata
          const firstOk = monthDays.find(d => d.status === 'ok');
          months.push({
            month: m,
            status: displayStatus,
            actualStatus: status,
            okCount,
            riskyCount,
            totalDays: monthSize,
            plantDay: firstOk?.plantDay ?? monthDays[0].plantDay,
            harvest: firstOk?.harvest ?? monthDays[0].harvest,
          });
        }
      }

      return { crop, months, days, baseGrowDays, effGrowDays, stalled: sim.stalled,
        harvestsPerYear: estimateHarvestsPerYear(days, new Set(['ok'])),
        harvestsPerYearOptimistic: estimateHarvestsPerYear(days, new Set(['ok', 'risky'])),
      };
    });
  }, [greenhouse, climate, soilTier, dpm, yearLen, monthCount, settings.rainfallFrequency, settings.worldConfig?.cropGrowthRateMul]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="section-eyebrow text-forest-700">§4 · Calendar</div>
            <h2 className="heading-display text-4xl md:text-5xl mt-2">
              Crop <span className="heading-italic">plantability</span> by day
            </h2>
            <p className="mt-3 text-ink-600 max-w-2xl">
              Each row is a crop. The month grid shows the best status of any day in that month, so you can see at a glance which months are at least partly viable. Click any crop's row to expand a per-day strip below it.
            </p>
            {monthCount < MONTHS_PER_YEAR && (
              <p className="mt-2 text-xs text-amber-700 max-w-2xl">
                Heads up: at {dpm} days/month, your loaded climate ({yearLen} days) only covers {monthCount} months. The matrix below shows what we have. To see all 12 months, either set days/month to {Math.floor(yearLen / MONTHS_PER_YEAR)} or load a {dpm * MONTHS_PER_YEAR}-day climate CSV.
              </p>
            )}
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <LocationPicker />
            <FrostBanner />
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Soil tier</label>
              <select
                className="select-field"
                value={soilTier}
                onChange={(e) => setSoilTier(parseInt(e.target.value))}
              >
                {SOILS_PLANTABLE.map(s => (
                  <option key={s.val} value={s.val}>{s.name} ({s.val})</option>
                ))}
              </select>
            </div>
            <Toggle
              checked={greenhouse}
              onChange={setGreenhouse}
              label={greenhouse ? 'Greenhouse on (+5°C)' : 'Outdoor (no greenhouse)'}
            />
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card elevated>
          <CardHeader title="Plantability matrix" subtitle="Numbers in cells = the day-of-year you'd plant on. Click a row for the day-by-day breakdown." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment-300/60 bg-parchment-200/30">
                  <th className="px-4 py-3 text-left font-display text-forest-800 sticky left-0 bg-parchment-200/40 backdrop-blur-sm">Crop</th>
                  <th className="px-2 py-3 section-eyebrow w-20 text-center" title="Maximum number of back-to-back harvests of just this crop, in one year, on this soil tier and greenhouse setting. Greedy: plant on the first 'ok' day, advance by grow time, repeat until no more time. Optimistic count in parens accepts borderline-temperature plantings.">
                    Harvests<br/>per year
                  </th>
                  {MONTH_NAMES.slice(0, monthCount).map((m, i) => (
                    <th key={m} className="px-2 py-3 section-eyebrow w-16 text-center">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map(({ crop, months, days, effGrowDays, baseGrowDays, stalled, harvestsPerYear, harvestsPerYearOptimistic }) => {
                  const isExpanded = expandedKey === crop.key;
                  return (
                    <Row
                      key={crop.key}
                      crop={crop}
                      months={months}
                      days={days}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedKey(isExpanded ? null : crop.key)}
                      effGrowDays={effGrowDays}
                      baseGrowDays={baseGrowDays}
                      stalled={stalled}
                      dpm={dpm}
                      yearLen={yearLen}
                      monthCount={monthCount}
                      harvestsPerYear={harvestsPerYear}
                      harvestsPerYearOptimistic={harvestsPerYearOptimistic}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          <CardBody className="!pt-3 !pb-4">
            <div className="flex flex-wrap gap-4 text-xs text-ink-600">
              <Legend color="bg-forest-300/80" label="Fine. Clean grow window" />
              <Legend color="bg-forest-200/60 ring-1 ring-amber-400/40" label="Marginal. Few clean days in the month" />
              <Legend color="bg-amber-300/60" label="Lower yield. Borderline temps damage growth, hardy plants tolerate" />
              <Legend color="bg-terra-300/60" label="May die. Temps cross threshold hard enough to kill the crop" />
              <Legend color="bg-parchment-300/40" label="Frost cutoff. Won't ripen before first frost" />
              <Legend color="bg-terra-700/40" label="Stalls. Nutrients run out before harvest" />
            </div>
            <div className="mt-3 text-xs text-ink-500 italic max-w-3xl">
              <strong className="not-italic text-ink-700">Numbers in viable cells</strong> are the day-of-year you'd plant on (the earliest clean day of that month). Multiply day-of-year by month length to convert; e.g., day 63 with 20-day months = month 4, day 3 = Apr 3. The "lower yield" cells produce food, just less. The game accumulates cold/heat damage hour-by-hour; a few bad nights drop yield, but the crop only dies when accumulated damage passes 48 hours, which is what the "may die" tier represents.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function Row({ crop, months, days, isExpanded, onToggle, effGrowDays, baseGrowDays, stalled, dpm, yearLen, monthCount, harvestsPerYear, harvestsPerYearOptimistic }) {
  // Display: "3" if both same, "3 (5)" if optimistic count is higher
  const okCount = harvestsPerYear?.count ?? 0;
  const optCount = harvestsPerYearOptimistic?.count ?? 0;
  const harvestText = optCount > okCount ? `${okCount} (${optCount})` : `${okCount}`;
  const harvestTooltip = okCount > 0
    ? `${okCount} clean harvest${okCount === 1 ? '' : 's'}` +
      (optCount > okCount ? `, up to ${optCount} if you accept borderline temps. ` : '. ') +
      `Plant days: ${(harvestsPerYear.plantDays || []).map(d => `day ${d}`).join(', ')}.`
    : 'No clean harvest fits in one year at this soil and greenhouse setting.';
  return (
    <>
      <tr
        className={`border-b border-parchment-300/30 cursor-pointer transition-colors ${isExpanded ? 'bg-forest-50/60' : 'hover:bg-parchment-200/20'}`}
        onClick={onToggle}
      >
        <td className="px-4 py-2 sticky left-0 bg-parchment-100/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className={`text-ink-400 text-xs w-3 inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
            <span className="font-display text-base text-forest-900">{crop.name}</span>
            <NutrientChip axis={crop.nutrient} />
          </div>
        </td>
        <td className="px-2 py-2 text-center tabular text-sm" title={harvestTooltip}>
          {okCount === 0 ? (
            <span className="text-ink-400">0</span>
          ) : (
            <span className={okCount >= 2 ? 'text-forest-800 font-medium' : 'text-ink-700'}>
              {harvestText}
            </span>
          )}
        </td>
        {months.map((c, i) => (
          <td key={i} className="p-1 text-center">
            <CalCell
              status={c.status}
              crop={crop}
              plantDay={c.plantDay}
              harvest={c.harvest}
              effGrowDays={effGrowDays}
              baseGrowDays={baseGrowDays}
              stalled={stalled}
              dpm={dpm}
              okCount={c.okCount}
              totalDays={c.totalDays}
            />
          </td>
        ))}
      </tr>
      {isExpanded && (
        <tr className="bg-forest-50/40 border-b border-parchment-300/30">
          <td colSpan={2 + monthCount} className="px-4 py-3">
            <DayStrip
              crop={crop}
              days={days}
              dpm={dpm}
              yearLen={yearLen}
              effGrowDays={effGrowDays}
              baseGrowDays={baseGrowDays}
              stalled={stalled}
              harvestsPerYear={harvestsPerYear}
              harvestsPerYearOptimistic={harvestsPerYearOptimistic}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// Per-day strip rendered as one column per month, dpm cells per column. CSS
// grid handles the layout so it scales when daysPerMonth changes.
function DayStrip({ crop, days, dpm, yearLen, effGrowDays, baseGrowDays, stalled, harvestsPerYear, harvestsPerYearOptimistic }) {
  // Find the "ok" run for a callout below the strip.
  const okDays = days.filter(d => d.status === 'ok');
  const earliestOk = okDays[0]?.plantDay;
  const latestOk = okDays[okDays.length - 1]?.plantDay;

  const monthCount = Math.min(MONTHS_PER_YEAR, Math.ceil(yearLen / dpm));
  const monthBlocks = [];
  for (let m = 0; m < monthCount; m++) {
    const start = m * dpm;
    const end = Math.min(yearLen, start + dpm);
    monthBlocks.push({ month: m, days: days.slice(start, end) });
  }

  const okCount = harvestsPerYear?.count ?? 0;
  const optCount = harvestsPerYearOptimistic?.count ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="text-xs text-ink-600">
          Per-day plantability for <strong className="text-forest-900">{crop.name}</strong>{' '}
          (grow window <span className="tabular">{effGrowDays.toFixed(1)}d</span>{stalled ? ', stalled at this soil' : effGrowDays > baseGrowDays * 1.05 ? ` vs ${baseGrowDays.toFixed(1)}d base` : ''})
        </div>
        {earliestOk && latestOk && (
          <div className="text-xs text-ink-600">
            Best window: <strong className="tabular">{dateLabel(earliestOk, dpm)}</strong> to <strong className="tabular">{dateLabel(latestOk, dpm)}</strong>{' '}
            (<span className="tabular">{okDays.length}</span> ok days)
          </div>
        )}
      </div>
      {okCount > 0 && (
        <div className="mb-3 text-xs text-ink-700 bg-forest-50/40 border border-forest-200/40 rounded p-2">
          <strong className="text-forest-800">{okCount} clean harvest{okCount === 1 ? '' : 's'} per year</strong>
          {optCount > okCount && <> (up to <strong className="tabular">{optCount}</strong> if you accept borderline temps)</>}
          : plant on{' '}
          {(harvestsPerYear.plantDays || []).map((d, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <strong className="tabular">{dateLabel(d, dpm)}</strong>
              {' → harvest '}
              <span className="tabular text-ink-600">{dateLabel(Math.round(d + effGrowDays), dpm)}</span>
            </span>
          ))}
          .
          <span className="block text-[11px] text-ink-500 italic mt-1">
            Assumes you re-fertilize between cycles. Without re-fertilizing the next cycle stalls.
          </span>
        </div>
      )}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${monthCount}, minmax(0, 1fr))` }}>
        {monthBlocks.map(({ month, days: blockDays }) => {
          // Compute month's day range for frost marker placement
          const monthStartDay = month * dpm + 1;
          const monthEndDay = Math.min(yearLen, (month + 1) * dpm);
          const frostInThisMonth = SEASON_END_DAY >= monthStartDay && SEASON_END_DAY <= monthEndDay;
          return (
            <div key={month} className="space-y-1 relative">
              <div className="text-[11px] text-ink-600 uppercase tracking-wider text-center leading-tight">
                <span>{MONTH_NAMES[month]}</span>
                <span className="ml-1.5 text-ink-400 normal-case tabular tracking-normal">{monthStartDay}</span>
                {frostInThisMonth && (
                  <span className="ml-1 text-terra-700 font-semibold" title={`First frost: day ${SEASON_END_DAY} (${dateLabel(SEASON_END_DAY, dpm)})`}>
                    ❄
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-px justify-center relative" style={{ minHeight: 18 }}>
                {blockDays.map((d, i) => {
                  const isFrostDay = (monthStartDay + i) === SEASON_END_DAY;
                  return (
                    <div key={i} className="relative">
                      {isFrostDay && (
                        <div
                          className="absolute -top-1 -bottom-1 left-0 w-px bg-terra-600 pointer-events-none"
                          style={{ zIndex: 10 }}
                          title={`First frost: ${dateLabel(SEASON_END_DAY, dpm)}`}
                        />
                      )}
                      <DayCell day={d} dayOfMonth={i + 1} crop={crop} dpm={dpm} />
                    </div>
                  );
                })}
              </div>
              {/* End-of-month day-of-year, right-aligned */}
              <div className="text-[10px] text-ink-400 tabular text-right pr-0.5 leading-none">
                {monthEndDay}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-ink-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-px h-3 bg-terra-600" />
          <span>First frost line ({dateLabel(SEASON_END_DAY, dpm)}). Plantings whose harvest crosses this fail.</span>
        </span>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  ok: 'bg-forest-400/85',
  marginal: 'bg-forest-300/50',
  risky: 'bg-amber-300/70',
  cold: 'bg-terra-300/70',
  late: 'bg-parchment-300/50',
  stalled: 'bg-terra-700/50',
};

function DayCell({ day, dayOfMonth, crop, dpm }) {
  const monthIdx = Math.floor((day.plantDay - 1) / dpm) % MONTHS_PER_YEAR;
  const statusLabel = {
    ok: 'fine',
    risky: 'lower yield (borderline temps)',
    cold: 'may die (temps cross threshold hard)',
    late: "won't finish before frost",
    stalled: 'stalls (nutrients fail)',
  }[day.status] || day.status;
  const tooltip = `${crop.name} planted day ${day.plantDay} (${dateLabel(day.plantDay, dpm)}) → harvest day ${Math.round(day.harvest)} (${dateLabel(Math.round(day.harvest), dpm)}). Status: ${statusLabel}`;
  return (
    <span
      className={`inline-block ${STATUS_COLORS[day.status]} rounded-sm`}
      style={{ width: 8, height: 16 }}
      title={tooltip}
    />
  );
}

function CalCell({ status, crop, plantDay, harvest, effGrowDays, baseGrowDays, stalled, dpm, okCount = 0, totalDays = 0 }) {
  const colors = {
    ok: 'bg-forest-300/80 text-forest-900',
    marginal: 'bg-forest-200/60 text-forest-800 ring-1 ring-amber-400/40',
    risky: 'bg-amber-300/60 text-amber-900',
    cold: 'bg-terra-300/60 text-terra-900',
    late: 'bg-parchment-300/40 text-ink-400',
    stalled: 'bg-terra-700/40 text-terra-900',
  };
  // For viable statuses (ok/marginal/risky), show the plant day-of-year so users
  // can read planting dates at a glance without hovering. Symbols only for
  // unplantable cells where there's no useful date.
  const symbols = { cold: '!', late: '·', stalled: 'X' };
  const showDay = status === 'ok' || status === 'marginal' || status === 'risky';
  const display = showDay ? plantDay : (symbols[status] || '');
  const slowdownPct = baseGrowDays > 0 ? Math.round((effGrowDays / baseGrowDays - 1) * 100) : 0;
  let tooltip;
  if (stalled) {
    tooltip = `${crop.name} stalls on this soil. Nutrients run out before harvest.`;
  } else if (status === 'marginal') {
    tooltip = `${crop.name}: only ${okCount} of ${totalDays} days this month grow cleanly. The rest will die, lose yield, or miss frost. Earliest clean: day ${plantDay} (${dateLabel(plantDay, dpm)}) → harvest day ${Math.round(harvest)}.`;
  } else if (status === 'risky') {
    tooltip = `${crop.name}: borderline temps. Hardy plants tough it out at lower yield, less hardy ones may die. Earliest plant: day ${plantDay} (${dateLabel(plantDay, dpm)}) → harvest day ${Math.round(harvest)}.`;
  } else if (status === 'cold') {
    tooltip = `${crop.name}: temps cross the cold or heat threshold by 5+ degrees in the grow window. Damage accumulates fast enough to kill the crop. Earliest plant: day ${plantDay} (${dateLabel(plantDay, dpm)}) → harvest day ${Math.round(harvest)}.`;
  } else if (status === 'late') {
    tooltip = `${crop.name}: planting day ${plantDay} would harvest day ${Math.round(harvest)}, after first frost. Won't ripen in time.`;
  } else {
    tooltip = `${crop.name} planted day ${plantDay} (${dateLabel(plantDay, dpm)}) → harvest day ${Math.round(harvest)} (${dateLabel(Math.round(harvest), dpm)}). ${effGrowDays.toFixed(1)} days; ${slowdownPct === 0 ? 'matches base' : slowdownPct > 0 ? `${slowdownPct}% slower than ${baseGrowDays.toFixed(1)}d base` : `${Math.abs(slowdownPct)}% faster than nominal`}`;
    if (status === 'ok' && okCount > 0 && okCount < totalDays) {
      tooltip += ` (${okCount} of ${totalDays} days clean)`;
    }
  }
  return (
    <div
      className={`mx-auto w-10 h-10 rounded flex items-center justify-center text-xs font-mono font-medium tabular ${colors[status]}`}
      title={tooltip}
    >
      {display}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`inline-block w-4 h-4 rounded ${color}`}></span>
      {label}
    </span>
  );
}

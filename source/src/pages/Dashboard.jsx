// Dashboard. At-a-glance overview.
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, BarChart, Bar, Cell,
} from 'recharts';
import {
  Card, CardHeader, CardBody, Reveal, Stat, Flourish, NutrientChip, StatusBadge,
} from '../components/ui/Primitives.jsx';
import { useSettings, usePlots } from '../lib/storage.js';
import { CROPS_LIST, growDays, drainPerDay } from '../data/crops.js';
import { effectiveGrowDays, latestPlantDay, rainfallGrowRange, lightGrowthFactor } from '../lib/mechanics.js';
import { SOILS_PLANTABLE } from '../data/game.js';
import { dayLabel, dateLabel, dateParts, dayFromDate, daysPerYear, MONTH_NAMES, SEASON_END_DAY, SEASON_START_DAY, YEARLY_AVG_TEMP } from '../data/climate.js';
import { useClimate } from '../lib/useClimate.js';
import { useChartColors } from '../lib/useTheme.js';
import { rankCrops } from '../lib/decisionScore.js';

export default function DashboardPage() {
  const [settings, updateSettings] = useSettings();
  const { plots } = usePlots();
  const { climate: CLIMATE } = useClimate();
  const cc = useChartColors();
  const yearLen = daysPerYear();
  const dpm = settings.daysPerMonth || 9;

  // Normalize "today" to day-of-year so multi-year settings.today values
  // (e.g. Year 2 day 5 = absolute 245 with 240-day years) compare correctly
  // against season bounds. Without this, anything past Year 0 reads as
  // "winter, wait" even mid-spring of Year 2.
  const todayInYear = ((settings.today - 1) % yearLen + yearLen) % yearLen + 1;
  const seasonDays = SEASON_END_DAY - SEASON_START_DAY;
  const todayInSeason = todayInYear >= SEASON_START_DAY && todayInYear < SEASON_END_DAY;
  const daysUntilFrost = todayInSeason ? SEASON_END_DAY - todayInYear : 0;

  // Plot status counts
  const plotStats = useMemo(() => {
    const empty = plots.filter(p => !p.crop).length;
    const growing = plots.filter(p => p.crop && p.plantDay !== null).length;
    const total = plots.length;
    return { empty, growing, total };
  }, [plots]);

  // Compute all crops scored for today, then bucket into plant/skip groups.
  // Local soil/greenhouse pickers below let you flip scenarios without leaving
  // the dashboard. Defaults to settings.defaultSoil (Medium 50 by default).
  const [soilTier, setSoilTier] = useState(settings.defaultSoil ?? 50);
  const [greenhouse, setGreenhouse] = useState(false);

  const allRanked = useMemo(() => rankCrops({
    today: settings.today,
    daysPerMonth: dpm,
    soilTier,
    greenhouse,
    playerClass: settings.playerClass || 'commoner',
    satietyMode: settings.satietyMode,
    willFert: false,
    fertKey: 'none',
    curN: soilTier, curP: soilTier, curK: soilTier,
    poolN: 0, poolP: 0, poolK: 0,
    prevNutrient: '',
    seasonEndDay: SEASON_END_DAY,
    rainfallFrequency: settings.rainfallFrequency || 'common',
    waterDistance: 1,
    underground: false,
    lightLevel: 22,
    depthBelowSea: 0,
    allowUndergroundFarming: !!settings.allowUndergroundFarming,
    cropGrowthRateMul: settings.worldConfig?.cropGrowthRateMul ?? 1.0,
    weights: settings.weights,
    categoryBoosts: settings.categoryBoosts,
  }), [
    // CLIMATE is included so the memo recomputes after the bundled climate
    // loads (which updates SEASON_END_DAY via setCurrentClimate).
    CLIMATE,
    settings.today, dpm, soilTier, greenhouse,
    settings.playerClass, settings.satietyMode,
    settings.rainfallFrequency, settings.allowUndergroundFarming,
    settings.worldConfig?.cropGrowthRateMul,
    settings.weights, settings.categoryBoosts,
  ]);

  // Bucket every crop. Anything with a warning verdict goes on the right;
  // Skip column = won't actually produce food. Plant column = will produce
  // something, even if not optimal. "Risky" (borderline temps, lower yield)
  // stays in the plant column as a tagged entry. Hardy crops like rye are
  // worth planting even at reduced yield because food is food.
  const HARD_FAIL_VERDICTS = new Set([
    "won't finish",     // misses frost cutoff, no harvest
    'stalls (nutrients)', // nutrient depletes before ripe
    'too dark to grow',  // light gates growth entirely
    'too dry to grow',   // moisture gates growth entirely
    'no food value',     // edge case (Spice category, no satiety mode)
    'crop will die',     // leaky-bucket damage exceeds 48h death threshold
  ]);

  const plantToday = allRanked
    .filter(r => !HARD_FAIL_VERDICTS.has(r.verdict))
    .sort((a, b) => b.score - a.score)
    .map(r => {
      // Walk backward from frost day; first day where this crop still finishes
      // is the latest plant date. Climate-aware AND uses the user's actual
      // rainfall + water-distance moisture factor (not the hardcoded 1.0
      // baseline) so good rainfall correctly extends the plantable window.
      // Also threads light: cellars and below-sea-level outdoor farms see
      // shorter plantable windows because growth speed itself drops.
      const baseGrow = growDays(r.crop, dpm, settings.worldConfig?.cropGrowthRateMul ?? 1.0);
      const moistF = rainfallGrowRange(settings.rainfallFrequency || 'common', 1, greenhouse).expected;
      const lightF = greenhouse ? 1.0 : lightGrowthFactor({
        underground: !!settings.underground,
        lightLevel: settings.lightLevel ?? 22,
        depthBelowSea: settings.depthBelowSea ?? 0,
        allowUnderground: !!settings.allowUndergroundFarming,
      });
      const latest = latestPlantDay({
        crop: r.crop,
        baseGrowDays: baseGrow,
        soilTier,
        seasonStartDay: Math.max(SEASON_START_DAY, todayInYear),
        seasonEndDay: SEASON_END_DAY,
        climate: CLIMATE,
        greenhouse,
        moistF,
        lightF,
      });
      return { ...r, latestPlantDay: latest?.day ?? null, latestHarvestDay: latest?.harvestDay ?? null };
    });

  const skipToday = allRanked
    .filter(r => HARD_FAIL_VERDICTS.has(r.verdict))
    .sort((a, b) => {
      const rank = {
        "won't finish": 0,
        'stalls (nutrients)': 1,
        'too dark to grow': 2,
        'too dry to grow': 3,
        'no food value': 4,
      };
      return (rank[a.verdict] ?? 99) - (rank[b.verdict] ?? 99);
    });

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§2 · Dashboard</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            <span className="heading-italic">At a glance</span>
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl">
            A quick read on where the season is and what to plant next. <strong>Set the day below to match your in-game time</strong> (run <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">/time</code> in chat to check).
          </p>
        </div>
      </Reveal>

      {/* Top metrics. The "Today" tile is editable so users immediately
          see the day is something they set, not authoritative server state. */}
      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="ring-1 ring-forest-700/20">
            <CardBody>
              <div className="section-eyebrow mb-1">Today  ·  edit me</div>
              {(() => {
                const dpm = settings.daysPerMonth || 9;
                const parts = dateParts(settings.today, dpm) || { monthIdx: 0, dayOfMonth: 1, year: 1 };
                return (
                  <>
                    <div className="flex items-baseline gap-2 mt-1">
                      <input
                        type="number" min={1} max={dpm}
                        value={parts.dayOfMonth}
                        aria-label="Day of month"
                        onChange={(e) => {
                          const dom = Math.max(1, Math.min(dpm, parseInt(e.target.value) || 1));
                          updateSettings({ today: dayFromDate(parts.monthIdx + 1, dom, parts.year, dpm) });
                        }}
                        className="w-12 font-display text-3xl text-forest-900 bg-transparent border-b-2 border-forest-700/40 focus:border-forest-700 focus:outline-none tabular text-left px-1 py-0"
                      />
                      <select
                        value={parts.monthIdx + 1}
                        aria-label="Month"
                        onChange={(e) => {
                          const month = parseInt(e.target.value);
                          updateSettings({ today: dayFromDate(month, parts.dayOfMonth, parts.year, dpm) });
                        }}
                        className="font-display text-3xl text-forest-900 bg-transparent border-b-2 border-forest-700/40 focus:border-forest-700 focus:outline-none px-1 py-0"
                      >
                        {MONTH_NAMES.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                      </select>
                    </div>
                    <div className="text-xs text-ink-500 mt-2">
                      Year {parts.year} · day {settings.today} · type to update everywhere
                    </div>
                  </>
                );
              })()}
            </CardBody>
          </Card>
          <Card><CardBody>
            <Stat
              label="Growing season"
              value={`${seasonDays}d`}
              sub={`first frost ${dateLabel(SEASON_END_DAY, dpm)}`}
            />
          </CardBody></Card>
          <Card><CardBody>
            <Stat
              label="In season?"
              value={todayInSeason ? 'Yes' : 'No'}
              accent={todayInSeason ? 'text-forest-900' : 'text-terra-700'}
              sub={todayInSeason ? `${daysUntilFrost} days until frost` : 'wait, or build a greenhouse'}
            />
          </CardBody></Card>
          <Card><CardBody>
            <Stat label="Plots" value={`${plotStats.growing}/${plotStats.total}`} sub={`${plotStats.empty} empty`} />
          </CardBody></Card>
        </div>
      </Reveal>

      {/* Yearly climate curve */}
      <Reveal delay={0.1}>
        <Card>
          <CardHeader
            eyebrow="Climate"
            title="Annual temperature curve"
            subtitle={`One year, ${yearLen} days. The line is the daily average. The shaded band shows how cold the night gets and how warm the day gets.`}
          />
          <CardBody>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={CLIMATE} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#BC4749" stopOpacity={0.18} />
                      <stop offset="50%" stopColor="#DDA15E" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="#52796F" stopOpacity={0.18} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={cc.grid} />
                  <XAxis dataKey="d" tick={{ fontSize: 11, fill: cc.axisText }} />
                  <YAxis tick={{ fontSize: 11, fill: cc.axisText }} unit="°" domain={[-32, 30]} />
                  <Tooltip
                    formatter={(v, n) => [`${v.toFixed(1)}°C`, n]}
                    labelFormatter={(d) => dayLabel(d, settings.daysPerMonth)}
                  />
                  <ReferenceLine y={0} stroke={cc.referenceLine} strokeDasharray="2 2" label={{ value: 'frost', fontSize: 10, fill: cc.referenceLine, position: 'right' }} />
                  <ReferenceLine x={settings.today} stroke={cc.today} strokeWidth={1.5} label={{ value: 'today', fontSize: 11, fill: cc.today, position: 'top' }} />
                  <Area type="monotone" dataKey="max" stroke="none" fill="url(#rangeGrad)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="min" stroke="none" fill={cc.bandKnockout} fillOpacity={1} isAnimationActive={false} />
                  <Area type="monotone" dataKey="avg" stroke={cc.avgLine} strokeWidth={2} fill="none" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* What to plant / what to skip today */}
      <Reveal delay={0.15}>
        <Card>
          <CardHeader
            eyebrow="Today's call"
            title={`What to plant on ${dateLabel(settings.today, dpm)}`}
            subtitle='Every crop bucketed by whether it will produce ANY food today. Lower-yield picks (borderline temps) stay in the plant column with a warning tag because food is food. The skip column is reserved for crops that genuinely will not produce: misses frost cutoff, stalls on nutrients, or has no food value.'
          />
          <CardBody>
            <div className="flex flex-wrap items-end gap-4 mb-5 pb-4 border-b border-parchment-300/40">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Soil tier</label>
                <select
                  className="select-field"
                  value={soilTier}
                  onChange={e => setSoilTier(parseInt(e.target.value))}
                >
                  {SOILS_PLANTABLE.map(s => (
                    <option key={s.val} value={s.val}>{s.name} ({s.val})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Conditions</label>
                <button
                  onClick={() => setGreenhouse(g => !g)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    greenhouse
                      ? 'bg-forest-600 text-parchment-50 border-forest-700 hover:bg-forest-700'
                      : 'bg-parchment-200/40 text-ink-700 border-parchment-300/60 hover:bg-parchment-200/70'
                  }`}
                >
                  {greenhouse ? 'Greenhouse on (+5°C)' : 'Outdoor (no greenhouse)'}
                </button>
              </div>
              <div className="text-xs text-ink-500 ml-auto italic max-w-xs">
                Nutrients balanced at the soil cap, no fertilizer, no special plot conditions. For your actual plot, use the Decision tab.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Plant today */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-display text-lg text-forest-800">✓ Plant today</span>
                  <span className="text-xs text-ink-500">({plantToday.length})</span>
                </div>
                {plantToday.length === 0 ? (
                  <div className="text-sm text-ink-500 italic bg-parchment-200/30 border border-parchment-300/40 rounded p-3">
                    Nothing scores well enough today. Either you're too late in the season, too early in spring, or the climate doesn't fit common crops. Try a greenhouse, scout a different latitude, or wait.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {plantToday.map(r => (
                      <PlantRow key={r.crop.key} r={r} good dpm={dpm} today={todayInYear} greenhouse={greenhouse} />
                    ))}
                  </div>
                )}
              </div>

              {/* Skip today */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-display text-lg text-terra-800">✗ Don't plant today</span>
                  <span className="text-xs text-ink-500">({skipToday.length})</span>
                </div>
                {skipToday.length === 0 ? (
                  <div className="text-sm text-ink-500 italic bg-parchment-200/30 border border-parchment-300/40 rounded p-3">
                    No clearly bad picks today. Most crops will at least produce something.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {skipToday.map(r => (
                      <PlantRow key={r.crop.key} r={r} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Crop drain rates */}
      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="Reference"
            title="Crop drain rates per day"
            subtitle="Bars that stretch past the red line drain soil faster than slow-release fertilizer can refill it. Those crops need a head start: compost up front, or topping up mid-season."
          />
          <CardBody>
            <div style={{ width: '100%', height: 380 }}>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart
                  data={CROPS_LIST.map(c => ({
                    name: c.name,
                    drain: drainPerDay(c, 9),
                    nutrient: c.nutrient,
                  })).sort((a, b) => b.drain - a.drain)}
                  layout="vertical"
                  margin={{ top: 5, right: 50, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke={cc.grid} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: cc.axisText }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: cc.axisText }} width={80} />
                  <Tooltip formatter={(v) => [`${v.toFixed(2)}/day`, 'drain']} />
                  <ReferenceLine x={1.71} stroke={cc.today} strokeDasharray="3 3" label={{ value: 'slow-release rate', fontSize: 10, fill: cc.today, position: 'right' }} />
                  <Bar dataKey="drain" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {CROPS_LIST.sort((a, b) => drainPerDay(b) - drainPerDay(a)).map((c, i) => (
                      <Cell key={i} fill={
                        c.nutrient === 'N' ? '#0F5132' :
                        c.nutrient === 'P' ? '#7F77DD' : '#DDA15E'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function PlantRow({ r, good = false, dpm = 9, today = 0, greenhouse = false }) {
  // Build a one-liner reason. Plant column shows score-tier or yield warning;
  // skip column shows the hard-fail verdict.
  let reason;
  let warning = null;  // amber tag inline for plant-column entries with damage/risky verdicts

  if (good) {
    if (r.verdict === 'cold/heat damage') {
      reason = `Will produce, lower yield (score ${r.score})`;
      warning = 'temps may damage';
    } else if (r.verdict === 'risky') {
      reason = `Will produce, lower yield (score ${r.score})`;
      warning = 'borderline temps';
    } else if (r.verdict === 'leading') {
      reason = `Top tier (score ${r.score})`;
    } else if (r.verdict === 'viable') {
      reason = `Solid choice (score ${r.score})`;
    } else {
      reason = `Will grow (score ${r.score})`;
    }
  } else {
    if (r.verdict === "won't finish") {
      reason = `Won't finish before frost (needs ${r.growDays} days)`;
    } else if (r.verdict === 'stalls (nutrients)') {
      reason = `Nutrients run out before harvest`;
    } else if (r.verdict === 'too dark to grow') {
      reason = `Too dark (need light)`;
    } else if (r.verdict === 'too dry to grow') {
      reason = `Too dry (need water)`;
    } else if (r.verdict === 'no food value') {
      reason = `No food output`;
    } else {
      reason = r.verdict;
    }
  }

  const tone = good ? 'border-forest-300/40 bg-forest-50/40' : 'border-terra-300/40 bg-terra-50/40';

  // For the plant column: compute "plant by day X" hint. If today === latest,
  // it's the last day. If far ahead, show as info. If null, the crop won't fit.
  // In greenhouse mode the crop has no real frost deadline, so show that
  // explicitly instead of an artificial day-of-year.
  const showPlantBy = good && r.latestPlantDay != null;
  const daysLeftToPlant = showPlantBy ? r.latestPlantDay - today : 0;
  let plantByText = null;
  let plantByTone = 'text-ink-500';
  if (showPlantBy) {
    if (greenhouse) {
      plantByText = `Greenhouse: plant any day (no frost cutoff)`;
      plantByTone = 'text-ink-500 italic';
    } else if (daysLeftToPlant <= 0) {
      plantByText = `Plant today (last viable day)`;
      plantByTone = 'text-terra-700 font-medium';
    } else if (daysLeftToPlant <= 5) {
      plantByText = `Plant by day ${r.latestPlantDay} (${dateLabel(r.latestPlantDay, dpm)}), ${daysLeftToPlant}d left`;
      plantByTone = 'text-amber-800 font-medium';
    } else {
      plantByText = `Plant by day ${r.latestPlantDay} (${dateLabel(r.latestPlantDay, dpm)})`;
      plantByTone = 'text-ink-500';
    }
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded border ${tone}`}>
      <NutrientChip axis={r.crop.nutrient} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-base text-forest-900 truncate flex items-center gap-2">
          <span className="truncate">{r.crop.name}</span>
          {warning && (
            <span className="text-[10px] uppercase tracking-wider text-amber-800 bg-amber-100/60 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
              {warning}
            </span>
          )}
        </div>
        <div className="text-xs text-ink-600 truncate">
          {reason}
          {plantByText && (
            <> &middot; <span className={`tabular ${plantByTone}`}>{plantByText}</span></>
          )}
        </div>
      </div>
      <div className="text-xs text-ink-500 tabular whitespace-nowrap">
        {r.growDays}d
      </div>
    </div>
  );
}

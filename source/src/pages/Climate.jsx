// Climate page. Detailed annual temperature curve + season analysis.
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import {
  Card, CardHeader, CardBody, Reveal, Stat, Flourish, Toggle,
} from '../components/ui/Primitives.jsx';
import { useState, useMemo } from 'react';
import {
  dayLabel, dateLabel, MONTH_NAMES, daysPerYear,
  SEASON_END_DAY, SEASON_START_DAY, YEARLY_AVG_TEMP, GH_BONUS,
} from '../data/climate.js';
import { useClimate } from '../lib/useClimate.js';
import { useChartColors } from '../lib/useTheme.js';
import { useSettings } from '../lib/storage.js';
import { CROPS_LIST, CROPS, growDays as cropGrowDays } from '../data/crops.js';
import { GAME } from '../data/game.js';
import { effectiveGrowDays, rainfallGrowRange, simulateCropDamage } from '../lib/mechanics.js';
import LocationPicker from '../components/LocationPicker.jsx';

// Compute the latest day a crop can be planted such that:
//   - the entire grow window stays at or above coldDamageBelow (daily min)
//   - the entire grow window stays at or below heatDamageAbove (daily max)
//   - harvest finishes by frost (or any day with greenhouse on)
// AND the earliest day. Returns null if there's no safe window.
//
// Uses per-day temperature-aware grow time (matches Calendar/Decision/Plots).
// Without that, a Rye Aug 6 planting would falsely show "safe" because base
// grow time (35d) fits before frost while the actual climate-aware grow time
// (172d) won't finish before winter.
function safePlantingWindow(crop, climate, baseGrowDays, soilTier, greenhouse, seasonEndDay, moistF = 1.0) {
  const yearLen = climate.length;
  const climateForSim = greenhouse
    ? climate.map(c => ({ ...c, avg: c.avg + GH_BONUS, min: c.min + GH_BONUS, max: c.max + GH_BONUS }))
    : climate;

  let earliest = null, latest = null, damagedEarliest = null, damagedLatest = null;
  for (let d = 1; d <= yearLen; d++) {
    const sim = effectiveGrowDays(crop, baseGrowDays, soilTier, 0, moistF, d, climateForSim);
    if (sim.stalled) continue;
    const effGrow = sim.effectiveDays;
    const harvest = d + effGrow;
    if (!greenhouse && harvest > seasonEndDay) continue;
    if (harvest > yearLen) continue;

    // Use the game's leaky-bucket model. A brief overnight dip below the
    // cold threshold sets the damaged flag but doesn't kill the crop.
    // Sustained 48h+ accumulated past threshold = death (handled by sim).
    const damage = simulateCropDamage(crop, d, effGrow, climateForSim, greenhouse);
    if (damage.willDie) continue;

    if (damage.flagged) {
      if (damagedEarliest === null) damagedEarliest = d;
      damagedLatest = d;
    } else {
      if (earliest === null) earliest = d;
      latest = d;
    }
  }
  if (earliest === null && damagedEarliest === null) return null;
  return {
    earliest: earliest ?? damagedEarliest,
    latest: latest ?? damagedLatest,
    safeEarliest: earliest,
    safeLatest: latest,
    damagedEarliest, damagedLatest,
  };
}

export default function ClimatePage() {
  const [settings] = useSettings();
  const { climate: CLIMATE } = useClimate();
  const cc = useChartColors();
  const [showGreenhouse, setShowGreenhouse] = useState(false);
  const [overlayCropKey, setOverlayCropKey] = useState('');
  const yearLen = CLIMATE.length || daysPerYear();

  const data = useMemo(() => CLIMATE.map(c => ({
    ...c,
    avgGh: c.avg + GH_BONUS,
    minGh: c.min + GH_BONUS,
    maxGh: c.max + GH_BONUS,
  })), [CLIMATE]);

  const stats = useMemo(() => {
    const vals = CLIMATE.map(c => c.avg);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, avg };
  }, [CLIMATE]);

  const overlayCrop = overlayCropKey ? CROPS[overlayCropKey] : null;
  const overlay = useMemo(() => {
    if (!overlayCrop) return null;
    const baseGrowDays = cropGrowDays(overlayCrop, settings.daysPerMonth);
    const cold = overlayCrop.cold ?? GAME.defaultCold;
    const heat = (overlayCrop.heat === undefined || overlayCrop.heat >= 9999) ? null : overlayCrop.heat;
    // Use the user's defaultSoil so the planting-window estimate matches what
    // the Calendar/Decision tabs would predict for an average plot.
    const soilTier = settings.defaultSoil ?? 50;
    const moistF = rainfallGrowRange(settings.rainfallFrequency || 'common', 1, showGreenhouse).expected;
    const window = safePlantingWindow(overlayCrop, CLIMATE, baseGrowDays, soilTier, showGreenhouse, SEASON_END_DAY, moistF);
    return { crop: overlayCrop, growDays: baseGrowDays, cold, heat, window };
  }, [overlayCrop, CLIMATE, settings.daysPerMonth, settings.defaultSoil, settings.rainfallFrequency, showGreenhouse]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="section-eyebrow text-forest-700">§7 · Climate</div>
            <h2 className="heading-display text-4xl md:text-5xl mt-2">
              The <span className="heading-italic">annual cycle</span>
            </h2>
            <p className="mt-3 text-ink-600 max-w-2xl">
              Pulled from <code className="font-mono text-xs bg-parchment-200/50 px-1.5 py-0.5 rounded">/debug exptempplot</code> on
              the live server. {yearLen}-day game year. Yearly mean {stats.avg.toFixed(1)}°C, summer peak {stats.max.toFixed(1)}°C, winter low {stats.min.toFixed(1)}°C. Switch locations from the picker above, or upload a different CSV.
            </p>
          </div>
          <LocationPicker />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardBody>
            <Stat label="Yearly avg" value={`${stats.avg.toFixed(1)}°C`} sub={`from ${yearLen} days`} />
          </CardBody></Card>
          <Card><CardBody>
            <Stat label="Coldest" value={`${stats.min.toFixed(1)}°C`} sub="midwinter" accent="text-terra-700" />
          </CardBody></Card>
          <Card><CardBody>
            <Stat label="Warmest" value={`${stats.max.toFixed(1)}°C`} sub="midsummer" accent="text-amber-700" />
          </CardBody></Card>
          <Card><CardBody>
            <Stat label="Growing season" value={`${SEASON_END_DAY - SEASON_START_DAY}d`} sub={`days ${SEASON_START_DAY} to ${SEASON_END_DAY}`} />
          </CardBody></Card>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card elevated>
          <CardHeader
            eyebrow="Annual curve"
            title="Temperature over one game year"
            subtitle="Shaded band = daily min/max range. The growing season (frost-free zone) is highlighted. Pick a crop to overlay its damage thresholds and the safe planting window."
            accessory={
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  className="select-field !py-1 !text-sm"
                  value={overlayCropKey}
                  onChange={(e) => setOverlayCropKey(e.target.value)}
                  aria-label="Crop overlay"
                >
                  <option value="">No crop overlay</option>
                  {CROPS_LIST.map(c => (
                    <option key={c.key} value={c.key}>{c.name}</option>
                  ))}
                </select>
                <Toggle
                  checked={showGreenhouse}
                  onChange={setShowGreenhouse}
                  label="Greenhouse overlay"
                />
              </div>
            }
          />
          <CardBody>
            {overlay && (
              <div className="mb-4 px-4 py-3 rounded-md border border-parchment-300/60 bg-parchment-100/60 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span><strong>{overlay.crop.name}</strong> overlay</span>
                  <span className="text-ink-600">
                    cold damage below <strong className="text-terra-700 tabular">{overlay.cold}°C</strong>
                  </span>
                  {overlay.heat !== null && (
                    <span className="text-ink-600">
                      heat damage above <strong className="text-amber-700 tabular">{overlay.heat}°C</strong>
                    </span>
                  )}
                  <span className="text-ink-600">
                    grow window <strong className="tabular">{overlay.growDays.toFixed(1)}d</strong>
                  </span>
                </div>
                <div className="mt-2 text-xs text-ink-600">
                  {overlay.window ? (
                    <>
                      Plantable window (won't die from cold or heat): <strong className="tabular">day {overlay.window.earliest}</strong> through <strong className="tabular">day {overlay.window.latest}</strong>{' '}
                      ({overlay.window.latest - overlay.window.earliest + 1} days wide).
                      {overlay.window.safeEarliest != null && overlay.window.safeLatest != null ? (
                        <> Days <strong className="tabular">{overlay.window.safeEarliest}</strong> to <strong className="tabular">{overlay.window.safeLatest}</strong> are damage-free; outside that range temps cross the threshold during grow and yields drop to half.</>
                      ) : (
                        <> Every viable day in this window crosses the cold or heat threshold at some point, halving drops on harvest.</>
                      )}
                    </>
                  ) : (
                    <>
                      No plantable window in this climate. Every plant day either dies from sustained cold/heat or harvest lands after frost. Try greenhouse on, or pick a hardier crop.
                    </>
                  )}
                </div>
              </div>
            )}
            <div style={{ width: '100%', height: 420 }}>
              <ResponsiveContainer width="100%" height={420}>
                <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="climGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#BC4749" stopOpacity={0.20} />
                      <stop offset="50%" stopColor="#DDA15E" stopOpacity={0.14} />
                      <stop offset="100%" stopColor="#52796F" stopOpacity={0.20} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={cc.grid} />
                  <XAxis dataKey="d" tick={{ fontSize: 11, fill: cc.axisText }} />
                  <YAxis tick={{ fontSize: 11, fill: cc.axisText }} unit="°" domain={[-32, 30]} />
                  <Tooltip
                    formatter={(v, n) => [`${v.toFixed(1)}°C`, n]}
                    labelFormatter={(d) => dayLabel(d, settings.daysPerMonth)}
                  />
                  <ReferenceArea x1={SEASON_START_DAY} x2={SEASON_END_DAY} y1={-32} y2={30} fill="#52796F" fillOpacity={0.06} label={{ value: 'growing season', position: 'insideTop', fontSize: 11, fill: cc.avgLine }} />
                  {overlay && overlay.window && (
                    <ReferenceArea x1={overlay.window.earliest} x2={overlay.window.latest} y1={-32} y2={-28} fill="#52796F" fillOpacity={0.55} label={{ value: `${overlay.crop.name} survives planted here`, position: 'insideBottom', fontSize: 10, fill: '#fff' }} />
                  )}
                  {overlay && overlay.window && overlay.window.safeEarliest != null && overlay.window.safeLatest != null && (
                    <ReferenceArea x1={overlay.window.safeEarliest} x2={overlay.window.safeLatest} y1={-32} y2={-28} fill="#84A98C" fillOpacity={0.85} label={{ value: 'damage-free', position: 'insideTop', fontSize: 9, fill: '#fff' }} />
                  )}
                  <ReferenceLine y={0} stroke={cc.referenceLine} strokeDasharray="2 2" />
                  {overlay && (
                    <ReferenceLine y={overlay.cold} stroke="#BC4749" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: `${overlay.crop.name} cold threshold (${overlay.cold}°C)`, fontSize: 10, fill: '#BC4749', position: 'insideBottomLeft' }} />
                  )}
                  {overlay && overlay.heat !== null && (
                    <ReferenceLine y={overlay.heat} stroke="#DDA15E" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: `${overlay.crop.name} heat threshold (${overlay.heat}°C)`, fontSize: 10, fill: '#B8860B', position: 'insideTopLeft' }} />
                  )}
                  <ReferenceLine x={((settings.today - 1) % CLIMATE.length + CLIMATE.length) % CLIMATE.length + 1} stroke={cc.today} strokeWidth={1.5} label={{ value: 'today', fontSize: 11, fill: cc.today, position: 'top' }} />
                  <Area type="monotone" dataKey="max" stroke="none" fill="url(#climGrad)" isAnimationActive={false}/>
                  <Area type="monotone" dataKey="min" stroke="none" fill={cc.bandKnockout} fillOpacity={1} isAnimationActive={false}/>
                  <Line type="monotone" dataKey="avg" stroke={cc.avgLine} strokeWidth={2.5} dot={false} isAnimationActive={false}/>
                  {showGreenhouse && (
                    <Line type="monotone" dataKey="avgGh" stroke="#A03A28" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false}/>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card>
          <CardHeader
            eyebrow="Frost analysis"
            title="When the season opens and closes"
            subtitle="Days where the daily average temperature crosses 0°C."
          />
          <CardBody>
            {SEASON_START_DAY <= 1 && SEASON_END_DAY > CLIMATE.length ? (
              <div className="border border-forest-200 rounded-md p-4 bg-forest-50/50">
                <div className="section-eyebrow mb-2">No frost season</div>
                <p className="text-sm text-ink-700">
                  Every day of this climate has a daily-average above 0°C. The whole year is plantable
                  (subject to per-crop cold/heat thresholds, which the Decision tab still enforces). No
                  hard freeze separates spring from autumn.
                </p>
                <p className="text-xs text-ink-500 mt-2 italic">
                  Tropical or greenhouse-equivalent climates skip the season-end pressure that drives
                  most of the planning math. Frost-safety becomes a non-factor.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-parchment-300/40 rounded-md p-4 bg-parchment-50/50">
                  <div className="section-eyebrow mb-2">Spring thaw</div>
                  <p className="text-sm text-ink-700">
                    {SEASON_START_DAY > 1 ? (
                      <>
                        Last hard frost: <strong>day {SEASON_START_DAY - 1}</strong> ({dateLabel(SEASON_START_DAY - 1, settings.daysPerMonth)}).
                        {' '}First plantable day: <strong>day {SEASON_START_DAY}</strong> ({dateLabel(SEASON_START_DAY, settings.daysPerMonth)}).
                      </>
                    ) : (
                      <>
                        Spring already underway from <strong>day 1</strong>. No winter frost period in this climate.
                      </>
                    )}
                  </p>
                  <p className="text-xs text-ink-500 mt-2 italic">
                    Hardy crops (Carrot, Parsnip, Rye) tolerate -8 to -12°C and can be planted slightly earlier with a greenhouse.
                  </p>
                </div>
                <div className="border border-parchment-300/40 rounded-md p-4 bg-parchment-50/50">
                  <div className="section-eyebrow mb-2">Autumn freeze</div>
                  <p className="text-sm text-ink-700">
                    {SEASON_END_DAY <= CLIMATE.length ? (
                      <>
                        First hard frost: <strong>day {SEASON_END_DAY}</strong> ({dateLabel(SEASON_END_DAY, settings.daysPerMonth)}).
                        {' '}Crops mid-growth on this day will take cold damage; ripe crops are safer (their <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">ripeMul</code> is 0.5).
                      </>
                    ) : (
                      <>
                        Season runs through the end of the year. The next hard frost is in the following spring.
                      </>
                    )}
                  </p>
                  <p className="text-xs text-ink-500 mt-2 italic">
                    Plan for harvest 5+ days before this to be comfortable.
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

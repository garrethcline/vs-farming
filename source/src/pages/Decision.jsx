// Decision Helper. The primary tool. Inputs at top, ranked crops below.
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Card, CardHeader, CardBody, Reveal, ModPill, Toggle, Stat, Flourish,
  StatusBadge, NutrientChip,
} from '../components/ui/Primitives.jsx';
import { useDecisionState, useSettings, usePlots } from '../lib/storage.js';
import { useClimate } from '../lib/useClimate.js';
import { CROPS_LIST } from '../data/crops.js';
import { FERTILIZERS_LIST, FERTILIZERS } from '../data/game.js';
import { SOILS_PLANTABLE } from '../data/game.js';
import { dayLabel, dateLabel, climateAt, SEASON_END_DAY, SEASON_START_DAY, daysPerYear, dateParts, dayFromDate, MONTH_NAMES } from '../data/climate.js';
import { rankCrops, bestChains, generateWarnings, scoreCrop } from '../lib/decisionScore.js';
import { rainfallGrowRange, lightGrowthFactor } from '../lib/mechanics.js';
import { planSeparateGroups, planSharedGroup, planStaggeredGroups, planFertilizerBuffered, simulateRotationCycle, suggestRotationPartners, planSeasonAutoFill } from '../lib/rotationPlanner.js';
import LocationPicker from '../components/LocationPicker.jsx';
import FrostBanner from '../components/FrostBanner.jsx';

export default function DecisionPage() {
  const [decision, updateDecision] = useDecisionState();
  const [settings, updateSettings] = useSettings();
  const { plots } = usePlots();
  const { climate: _climateArr } = useClimate();

  // The "today" from settings is absolute days since game start (Year 0 day 1).
  // Normalize to day-of-year so multi-year scenarios compare correctly against
  // season bounds; the climate, season start/end, etc. are all expressed in
  // day-of-year terms.
  const yearLen = daysPerYear();
  const todayAbs = settings.today;
  const today = ((todayAbs - 1) % yearLen + yearLen) % yearLen + 1;

  // Resolve soil/greenhouse based on mode
  const linked = decision.mode === 'linked';
  const linkedPlot = linked ? plots.find(p => p.id === decision.plotId) : null;
  const soil = linked && linkedPlot ? linkedPlot.soil : decision.soil;
  const greenhouse = linked && linkedPlot ? linkedPlot.greenhouse : decision.greenhouse;
  const curN = linked && linkedPlot ? linkedPlot.n : decision.curN;
  const curP = linked && linkedPlot ? linkedPlot.p : decision.curP;
  const curK = linked && linkedPlot ? linkedPlot.k : decision.curK;
  const poolN = linked && linkedPlot ? linkedPlot.poolN : decision.poolN;
  const poolP = linked && linkedPlot ? linkedPlot.poolP : decision.poolP;
  const poolK = linked && linkedPlot ? linkedPlot.poolK : decision.poolK;

  const ctx = {
    today, soilTier: soil, greenhouse, playerClass: settings.playerClass,
    satietyMode: settings.satietyMode || 'auto',
    willFert: decision.willFert, fertKey: decision.fertKey,
    curN, curP, curK, poolN, poolP, poolK,
    prevNutrient: decision.prevNutrient,
    daysPerMonth: settings.daysPerMonth || 9,
    seasonEndDay: SEASON_END_DAY,
    rainfallFrequency: settings.rainfallFrequency || 'common',
    waterDistance: linked && linkedPlot ? (linkedPlot.waterDistance ?? 1) : 1,
    underground: linked && linkedPlot ? !!linkedPlot.underground : false,
    lightLevel: linked && linkedPlot ? (linkedPlot.lightLevel ?? 22) : 22,
    depthBelowSea: linked && linkedPlot ? (linkedPlot.depthBelowSea ?? 0) : 0,
    allowUndergroundFarming: !!settings.allowUndergroundFarming,
    cropGrowthRateMul: settings.worldConfig?.cropGrowthRateMul ?? 1.0,
    weights: settings.weights,
    categoryBoosts: settings.categoryBoosts,
    _climateVersion: _climateArr,
  };

  const ranking = useMemo(() => rankCrops(ctx), [ctx]);
  const chains = useMemo(() => bestChains(ctx), [ctx]);
  const warnings = useMemo(() => generateWarnings(ctx, ranking), [ctx, ranking]);

  const climate = climateAt(today, greenhouse);
  const daysLeft = Math.max(0, SEASON_END_DAY - today);
  const fert = FERTILIZERS[decision.fertKey] || FERTILIZERS.none;

  // Top pick projection
  const topPick = ranking[0];
  const topProjection = topPick && topPick.frost > 0 ? topPick.nutrientProjection : null;

  return (
    <div className="space-y-8">
      {/* Eyebrow + page title */}
      <Reveal>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="section-eyebrow text-forest-700">§1 · The Decision Helper</div>
            <h2 className="heading-display text-4xl md:text-5xl mt-2">
              Just harvested? <span className="heading-italic">Pick wisely.</span>
            </h2>
            <p className="mt-3 text-ink-600 text-base max-w-2xl">
              Tell the planner about your plot below; you'll get all 18 crops scored for your
              situation. Score is satiety-per-day: total food value of one harvest divided by
              how long it takes to grow, with multipliers for damage risk, frost margin, rotation,
              and follow-up viability. It's a model, not gospel; your own feel for what's
              worked on the server should override any close call.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <LocationPicker />
            <FrostBanner />
          </div>
        </div>
      </Reveal>

      {/* Inputs */}
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            eyebrow="Inputs"
            title="Plot conditions"
            subtitle="Read these from F3/blockinfo, or edit manually for what-ifs."
          />
          <CardBody>
            {/* Mode + Plot */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <FormField label="Mode" hint="Linked pulls from a tracked plot">
                <select
                  className="select-field"
                  value={decision.mode}
                  onChange={(e) => updateDecision({ mode: e.target.value })}
                >
                  <option value="standalone">Standalone (manual entry)</option>
                  <option value="linked">Linked to plot</option>
                </select>
              </FormField>
              {decision.mode === 'linked' && (
                <FormField label="Plot ID">
                  <select
                    className="select-field"
                    value={decision.plotId}
                    onChange={(e) => updateDecision({ plotId: e.target.value })}
                  >
                    {plots.map(p => (
                      <option key={p.id} value={p.id}>{p.id} {p.owner ? `(${p.owner})` : ''}</option>
                    ))}
                  </select>
                </FormField>
              )}
              <FormField label="Today" hint={`day ${today} of ${daysPerYear()}`}>
                <DateInput
                  today={today}
                  dpm={settings.daysPerMonth}
                  onChange={(newDay) => updateSettings({ today: clamp(newDay, 1, daysPerYear()) })}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField label="Soil tier" hint="Barren=5, Low=25, Medium=50, High=65, Terra Preta=80">
                <select
                  className="select-field"
                  value={soil}
                  disabled={linked}
                  onChange={(e) => updateDecision({ soil: parseInt(e.target.value) })}
                >
                  {SOILS_PLANTABLE.map(s => (
                    <option key={s.key} value={s.val}>{s.name} ({s.val})</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Greenhouse" hint="Adds +5°C to all temperatures">
                <Toggle
                  checked={greenhouse}
                  onChange={(v) => updateDecision({ greenhouse: v })}
                  label={greenhouse ? 'Greenhouse on (+5°C)' : 'Outdoor (no greenhouse)'}
                />
              </FormField>
              <FormField label="Previous crop's axis" hint="For rotation factor">
                <select
                  className="select-field"
                  value={decision.prevNutrient}
                  onChange={(e) => updateDecision({ prevNutrient: e.target.value })}
                >
                  <option value="">(none / first crop)</option>
                  <option value="N">N. Last crop drained nitrogen</option>
                  <option value="P">P. Last crop drained phosphorus</option>
                  <option value="K">K. Last crop drained potassium</option>
                </select>
              </FormField>
              <FormField label="Will fertilize at planting?" hint="Adds chosen NPK to slow-release pool">
                <Toggle
                  checked={decision.willFert}
                  onChange={(v) => updateDecision({ willFert: v })}
                  label={decision.willFert ? 'Yes' : 'No'}
                />
              </FormField>
            </div>

            {/* Fertilizer selector (only matters if willFert) */}
            {decision.willFert && (
              <div className="mt-4">
                <FormField
                  label="Fertilizer to apply"
                  hint={`+${fert.n}N · +${fert.p}P · +${fert.k}K to slow-release pool`}
                >
                  <select
                    className="select-field max-w-md"
                    value={decision.fertKey}
                    onChange={(e) => updateDecision({ fertKey: e.target.value })}
                  >
                    {FERTILIZERS_LIST.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.name} (+{f.n}N · +{f.p}P · +{f.k}K)
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            )}

            {/* Current N/P/K + slow-release pool */}
            <div className="mt-6 pt-6 border-t border-parchment-300/40">
              <div className="section-eyebrow mb-3">Nutrient state (post-harvest)</div>
              <div className="grid grid-cols-3 gap-4">
                {['N', 'P', 'K'].map((axis) => {
                  const curKey = `cur${axis}`;
                  const poolKey = `pool${axis}`;
                  const cur = decision[curKey];
                  const pool = decision[poolKey];
                  return (
                    <div key={axis} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <NutrientChip axis={axis} />
                        <span className="text-sm font-medium text-ink-700">{axis === 'N' ? 'Nitrogen' : axis === 'P' ? 'Phosphorus' : 'Potassium'}</span>
                      </div>
                      <FormField label="Current (0 to 100)">
                        <input
                          type="number" min="0" max="100"
                          className="input-field tabular"
                          value={linked ? (axis === 'N' ? curN : axis === 'P' ? curP : curK) : cur}
                          disabled={linked}
                          onChange={(e) => updateDecision({ [curKey]: clamp(parseInt(e.target.value) || 0, 0, 100) })}
                        />
                      </FormField>
                      <FormField label="Slow-release pool (0 to 150)">
                        <input
                          type="number" min="0" max="150"
                          className="input-field tabular"
                          value={linked ? (axis === 'N' ? poolN : axis === 'P' ? poolP : poolK) : pool}
                          disabled={linked}
                          onChange={(e) => updateDecision({ [poolKey]: clamp(parseInt(e.target.value) || 0, 0, 150) })}
                        />
                      </FormField>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Today's conditions strip */}
      <Reveal delay={0.1}>
        <Card>
          <CardBody className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
              <Stat label="Today" value={dateLabel(today, settings.daysPerMonth)} sub={`Day ${today}`} />
              <Stat label="Temperature" value={`${climate.avg.toFixed(1)}°C`} sub={`${climate.min.toFixed(1)} / ${climate.max.toFixed(1)} min/max`} />
              <Stat label="Days left" value={`${daysLeft}`} sub={`season ends ${dateLabel(SEASON_END_DAY, settings.daysPerMonth)}`} accent={daysLeft < 14 ? 'text-terra-700' : daysLeft < 25 ? 'text-amber-700' : 'text-forest-900'} />
              <Stat label="Lowest nutrient" value={lowestNutrient(curN, curP, curK)} sub="rotate away from this" />
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Reveal delay={0.15}>
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-md border ${
                w.level === 'severe' ? 'bg-terra-300/15 border-terra-300 text-terra-900' :
                w.level === 'warn' ? 'bg-amber-300/15 border-amber-300 text-amber-900' :
                'bg-parchment-200/50 border-parchment-300 text-ink-700'
              }`}>
                <span className="text-lg leading-none mt-0.5">
                  {w.level === 'severe' ? '⚠' : w.level === 'warn' ? '!' : 'ℹ'}
                </span>
                <div>
                  <div className="font-medium text-sm">{w.title}</div>
                  <div className="text-xs mt-0.5 opacity-90">{w.message}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {/* Score factors transparency panel. Lists every input that goes into a
          crop's final score so the user can see what they're trading off. */}
      <Reveal delay={0.15}>
        <Card>
          <details className="group">
            <summary className="cursor-pointer list-none px-6 py-4 flex items-center justify-between hover:bg-parchment-200/30">
              <div>
                <div className="section-eyebrow text-forest-700">Score formula</div>
                <div className="font-display text-lg text-forest-900">All factors that build the score</div>
                <div className="text-xs text-ink-500 mt-1">Click to expand. Shows the math behind every number in the table below.</div>
              </div>
              <span className="font-display text-xl text-forest-700 group-open:rotate-90 transition-transform">›</span>
            </summary>
            <CardBody className="border-t border-parchment-300/40">
              <div className="text-sm text-ink-700 mb-4">
                <strong>score</strong> = <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">baseProductivity × frostSafety × damageMul × rotationFactor × followUpFactor</code>
                {' '}where <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">baseProductivity = totalSatiety / effGrowDays</code>.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FactorBox
                  title="totalSatiety"
                  rule="effectiveYield × satietyPerUnit (using current valuation mode)"
                  detail="Drops per harvest × satiety per drop. Mode switches the per-drop value: raw / non-cooking / in meal / bread / auto. Auto picks bread for grains, processed for everything else."
                />
                <FactorBox
                  title="effGrowDays"
                  rule="stage-by-stage sim. Each stage takes baseDays/stages × 1/(nutF × moistF × lightF)"
                  detail="Slow soil, dry biome, dim light, all extend grow time. Stalls (factor < 0.05) make the crop never finish."
                />
                <FactorBox
                  title="frostSafety"
                  rule="1.0 if harvest ≥ 5 days before season-end, 0.6 if cutting it close, 0 if past"
                  detail="Greenhouse plants are immune (set to 1.0)."
                />
                <FactorBox
                  title="damageMul"
                  rule="1.0 if temperature stays in window. Otherwise crop's stuntMul (0.0-0.7)."
                  detail="Looks at min/max temperature across the grow window. Stunting hits both ripe-day and yield."
                />
                <FactorBox
                  title="rotationFactor"
                  rule="1.0 default. 1.2 if previous crop drained a different N/P/K axis. 0.7 if same."
                  detail="Encourages alternating N → P → K → N to let nutrients recover."
                />
                <FactorBox
                  title="followUpFactor"
                  rule="1.3 if 7+ days remain after harvest, 1.1 if 3-6, 1.0 otherwise"
                  detail="Rewards short crops planted early so a second crop fits."
                />
                <FactorBox
                  title="effectiveYield (inside totalSatiety)"
                  rule="crop.yield × class produce mul"
                  detail="Commoner = 1.0. Specialized Classes mod can adjust per-crop (Farmhand cropProduceDropRate +0.5)."
                />
                <FactorBox
                  title="nutF (inside effGrowDays)"
                  rule="averageNutrient → factor table: 1.10 / 1.00 / 0.90 / 0.60 / 0.30 / 0.10"
                  detail="Slow-release pool drips into the consumed axis to keep it above the next breakpoint."
                />
                <FactorBox
                  title="moistF (inside effGrowDays)"
                  rule="lookup by rainfall × waterDistance, 200k-hour Monte Carlo of game noise"
                  detail="Greenhouses are flat 0.97. Touching water = floor 0.75. 4+ blocks away = rainfall-only."
                />
                <FactorBox
                  title="lightF (inside effGrowDays)"
                  rule="clamp(1 - (19 - (sunlight - depth)) × 0.1, 0, 1)"
                  detail="Outdoor at sea level = 1.0. Below sea level subtracts. Underground reads MaxLight (torches count) only when allowUndergroundFarming is on."
                />
              </div>
              <div className="mt-4 px-4 py-3 rounded-md border-l-4 border-l-forest-500 bg-forest-100/30 text-xs text-ink-700">
                <strong>Each row's tooltip</strong> shows the actual factor values used for that crop. Hover the score column. Hover the harvest column for the lucky/unlucky range.
              </div>
            </CardBody>
          </details>
        </Card>
      </Reveal>

      {/* Ranking */}
      <Reveal delay={0.2}>
        <Card elevated>
          <CardHeader
            eyebrow="Crop ranking"
            title="All 18 crops, scored for your situation"
            subtitle='Score is satiety per day with weighted penalties. Verdicts are RELATIVE to the best viable crop in this context: "leading" = within 10% of the top score, "viable" = within 50%. They are sort buckets, not endorsements. Hover any row for the formula breakdown.'
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-parchment-300/60 bg-parchment-200/30">
                  <th className="px-6 py-3 font-display text-forest-800 text-base">Crop</th>
                  <th className="px-3 py-3 section-eyebrow">Axis</th>
                  <th className="px-3 py-3 section-eyebrow">Grow days</th>
                  <th className="px-3 py-3 section-eyebrow">Plant→Harvest</th>
                  <th className="px-3 py-3 section-eyebrow">Output</th>
                  <th className="px-3 py-3 section-eyebrow">Risk</th>
                  <th className="px-3 py-3 section-eyebrow">Score</th>
                  <th className="px-3 py-3 section-eyebrow">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <RankingRow key={r.crop.key} entry={r} index={i} today={today} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      {/* Top 3 chains */}
      <Reveal delay={0.25}>
        <Card>
          <CardHeader
            eyebrow="Crop chains"
            title="Top 3 two-crop sequences"
            subtitle="Pairs ranked by combined score (first crop + follow-up that fits before season ends). The same caveats from the main ranking apply: chains are scored, not endorsed."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {chains.length === 0 && (
                <div className="text-sm text-ink-500 italic md:col-span-3 py-4 text-center">
                  No viable crop chains. Too late in the season or too cold.
                </div>
              )}
              {chains.map((c, i) => (
                <ChainCard key={i} chain={c} rank={i + 1} today={today} />
              ))}
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Top pick projection */}
      {topPick && topProjection && (
        <Reveal delay={0.3}>
          <Card>
            <CardHeader
              eyebrow="Nutrient outlook"
              title={`Highest scorer: ${topPick.crop.name}`}
              subtitle={`Drains ${topPick.crop.nutrient} over ${topPick.growDays} days. Slow-release pool buffers the drain.`}
            />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <Stat label={`Starting ${topPick.crop.nutrient}`} value={topProjection.start} accent="text-forest-900" />
                <Stat label="Pool offset" value={`-${topProjection.poolRelease.toFixed(0)}`} accent="text-amber-700" sub="from slow-release" />
                <Stat label="Net drain" value={topProjection.netDrain.toFixed(0)} accent="text-terra-700" sub={`vs ${topPick.crop.cons} raw`} />
                <Stat label={`Ending ${topPick.crop.nutrient}`} value={topProjection.end.toFixed(0)} accent={topProjection.end > 50 ? 'text-forest-900' : topProjection.end > 35 ? 'text-amber-700' : 'text-terra-700'} sub={endingVerdict(topProjection.end)} />
              </div>
              {decision.willFert ? (
                <p className="text-sm text-ink-600 italic">
                  Applying <strong className="text-forest-800 not-italic">{fert.name}</strong> contributes
                  +{fert.n}N · +{fert.p}P · +{fert.k}K to the pool. The score above already includes this.
                </p>
              ) : (
                <p className="text-sm text-ink-600 italic">
                  Not applying fertilizer. If this crop's pool is low, consider toggling
                  "Will fertilize at planting" above to see if a fertilizer would change the ranking.
                </p>
              )}
            </CardBody>
          </Card>
        </Reveal>
      )}

      <Reveal delay={0.25}>
        <RotationPlannerCard />
      </Reveal>

      <Reveal delay={0.27}>
        <RotationCycleCard />
      </Reveal>

      <Reveal delay={0.29}>
        <YearPlannerCard />
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

// === Sub-components ===

function FormField({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-ink-500 mt-1 italic">{hint}</p>}
    </div>
  );
}

function DateInput({ today, dpm, onChange }) {
  const parts = dateParts(today, dpm) || { year: 0, monthIdx: 0, dayOfMonth: 1 };
  const yearLen = dpm * 12;
  const setField = (field, raw) => {
    const v = parseInt(raw, 10);
    let { year, monthIdx, dayOfMonth } = parts;
    if (field === 'year') year = isFinite(v) && v >= 0 ? v : 0;
    if (field === 'month') monthIdx = isFinite(v) ? Math.max(0, Math.min(11, v - 1)) : monthIdx;
    if (field === 'day') dayOfMonth = isFinite(v) ? Math.max(1, Math.min(dpm, v)) : dayOfMonth;
    const newDay = dayFromDate(monthIdx + 1, dayOfMonth, year, dpm);
    onChange(newDay);
  };
  return (
    <div className="flex items-end gap-1.5">
      <div className="flex-shrink-0">
        <span className="block text-[10px] uppercase tracking-wider text-ink-500 mb-0.5">Day</span>
        <input
          type="number" min="1" max={dpm}
          className="input-field tabular w-14"
          value={parts.dayOfMonth}
          onChange={(e) => setField('day', e.target.value)}
        />
      </div>
      <div className="flex-shrink-0 min-w-0">
        <span className="block text-[10px] uppercase tracking-wider text-ink-500 mb-0.5">Month</span>
        <select
          className="select-field w-20"
          value={parts.monthIdx + 1}
          onChange={(e) => setField('month', e.target.value)}
        >
          {MONTH_NAMES.map((nm, i) => (
            <option key={i} value={i + 1}>{nm}</option>
          ))}
        </select>
      </div>
      <div className="flex-shrink-0">
        <span className="block text-[10px] uppercase tracking-wider text-ink-500 mb-0.5">Year</span>
        <input
          type="number" min="0"
          className="input-field tabular w-14"
          value={parts.year}
          onChange={(e) => setField('year', e.target.value)}
        />
      </div>
    </div>
  );
}

function RankingRow({ entry, index, today }) {
  const r = entry;
  const top3 = index < 3;
  const won = r.frost === 0;
  return (
    <tr className={`border-b border-parchment-300/30 transition-colors ${
      won ? 'opacity-50 hover:bg-parchment-200/20' :
      top3 ? 'bg-forest-50/30 hover:bg-forest-100/30' :
      'hover:bg-parchment-200/30'
    }`}>
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          {top3 && !won && <span className="text-amber-500 text-xs">★</span>}
          <span className="font-display text-base text-forest-900">{r.crop.name}</span>
          {r.crop.isNew && <span className="pill-mod text-[8px] !bg-forest-100 !border-forest-200 !text-forest-800">new</span>}
          {r.crop.hardy && <span className="text-[10px] uppercase tracking-wider text-forest-700/60">hardy</span>}
        </div>
      </td>
      <td className="px-3 py-3"><NutrientChip axis={r.crop.nutrient} /></td>
      <td className="px-3 py-3 tabular text-ink-700">
        {r.stalled ? (
          <span className="text-terra-700">stalls</span>
        ) : r.growDays > r.baseGrowDays + 0.5 ? (
          <span>
            {r.growDays}
            <span className="text-ink-400 text-xs ml-1">/ {r.baseGrowDays} base</span>
          </span>
        ) : (
          r.growDays
        )}
      </td>
      <td className="px-3 py-3 tabular text-ink-700">
        {r.stalled ? (
          <span className="text-ink-400 italic">won't finish</span>
        ) : r.harvestRange && r.harvestRange.minDay !== r.harvestRange.maxDay ? (
          <span title={`Best case (lucky moisture): ${r.harvestRange.minDay}. Expected: ${r.harvestRange.expectedDay}. Worst case (unlucky): ${r.harvestRange.maxDay}.`}>
            {today}→{r.harvestRange.minDay}
            <span className="text-ink-400">…{r.harvestRange.maxDay}</span>
          </span>
        ) : (
          `${today}→${r.harvestDay}`
        )}
      </td>
      <td className="px-3 py-3 tabular text-ink-700">
        {r.totalSatiety > 0 ? (
          <span title={`${r.effectiveYield.toFixed(1)} drops × ${r.crop.satietyProcessed || r.crop.satietyInMeal || r.crop.satietyAsBread || 0} sat at base mode = ${r.totalSatiety} per harvest. Window ${r.window.min.toFixed(1)}° to ${r.window.max.toFixed(1)}°.`}>
            <span className="text-forest-900 font-medium">{r.totalSatiety}</span>
            <span className="text-ink-400 text-xs ml-1">sat</span>
            <div className="text-[10px] text-ink-500">{r.effectiveYield.toFixed(1)} {r.crop.foodCategory === 'Grain' ? 'grain' : r.crop.foodCategory === 'Protein' ? 'pods' : 'units'}</div>
            {r.extras && r.extras.length > 0 && r.extras.map(ex => (
              <div key={ex.key} className="text-[10px] text-forest-700" title={`Side drop, scaled by ${ex.scaledBy} (×${ex.classMul.toFixed(2)})`}>
                + {ex.effectiveYield.toFixed(1)} {ex.name.toLowerCase()}
              </div>
            ))}
          </span>
        ) : r.extras && r.extras.length > 0 ? (
          <span title={r.crop.satietyNote || 'no food value but has side drops'}>
            <span className="text-ink-400 italic">no food</span>
            {r.extras.map(ex => (
              <div key={ex.key} className="text-[10px] text-forest-700" title={`Side drop, scaled by ${ex.scaledBy} (×${ex.classMul.toFixed(2)})`}>
                + {ex.effectiveYield.toFixed(1)} {ex.name.toLowerCase()}
              </div>
            ))}
          </span>
        ) : (
          <span className="text-ink-400 italic" title={r.crop.satietyNote || 'no food value'}>none</span>
        )}
      </td>
      <td className="px-3 py-3">
        <StatusBadge level={r.risk.riskLevel === 'ok' ? 'ok' : r.risk.riskLevel === 'risk' ? 'warn' : 'severe'}>
          {r.risk.riskLevel === 'ok' ? '✓ ok' : r.risk.riskLevel === 'risk' ? 'risky' : 'cold/heat'}
        </StatusBadge>
      </td>
      <td className="px-3 py-3 font-display text-lg tabular text-forest-900" title={`${r.satietyPerDay} satiety per day. Moisture grow factor: ${r.moistF != null ? r.moistF.toFixed(2) : '1.00'}x (range ${r.moistRange?.min?.toFixed(2) ?? '?'} to ${r.moistRange?.max?.toFixed(2) ?? '?'}).`}>{r.score.toFixed(1)}</td>
      <td className="px-3 py-3"><StatusBadge level={r.verdict}>{r.verdict}</StatusBadge></td>
    </tr>
  );
}

function ChainCard({ chain, rank, today }) {
  const { first, second, score, margin } = chain;
  return (
    <div className="border border-parchment-300/60 rounded-lg p-4 bg-parchment-50/50">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-amber-700 font-display text-xl">#{rank}</span>
        <span className="font-display text-2xl text-forest-900">{score.toFixed(1)}</span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="section-eyebrow text-[9px] mb-1">first</div>
          <div className="font-display text-base text-forest-900">
            {first.crop.name} <span className="text-ink-500 text-sm font-sans">→ day {first.harvestDay}</span>
          </div>
        </div>
        {second ? (
          <div>
            <div className="section-eyebrow text-[9px] mb-1">then</div>
            <div className="font-display text-base text-forest-900">
              {second.crop.name} <span className="text-ink-500 text-sm font-sans">→ day {second.harvestDay}</span>
            </div>
          </div>
        ) : (
          <div className="italic text-xs text-ink-500">Single crop only. No follow-up fits.</div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-parchment-300/40 text-xs text-ink-600">
        {margin >= 5 ? '✓ comfortable margin' : margin >= 0 ? `tight: ${margin}d to spare` : 'overshoots season'}
      </div>
    </div>
  );
}

// === Helpers ===

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function lowestNutrient(n, p, k) {
  const min = Math.min(n, p, k);
  const axis = n <= p && n <= k ? 'N' : p <= k ? 'P' : 'K';
  return `${axis} (${min})`;
}

function endingVerdict(end) {
  if (end > 75) return 'top tier. 1.10× growth';
  if (end > 50) return 'comfortable. 1.00×';
  if (end > 35) return 'slowing. 0.90×';
  if (end > 20) return 'struggling. 0.60×';
  if (end > 5)  return 'crawling. 0.30×';
  return 'nearly halted';
}

// Compact factor card used inside the "All factors that build the score" panel.
function FactorBox({ title, rule, detail }) {
  return (
    <div className="p-3 rounded-md bg-parchment-200/30 border border-parchment-300/50">
      <div className="font-mono text-sm text-forest-800">{title}</div>
      <div className="text-xs text-ink-700 mt-1">{rule}</div>
      <div className="text-xs text-ink-500 mt-1 italic">{detail}</div>
    </div>
  );
}

// Rotation planner: given 1-3 crops you must keep planting, compare two
// strategies (separate tile groups in parallel, single group rotating) and
// surface the trade-off. The motivating case: same-axis required crops like
// flax + soybean (both K) on Medium 50 soil, where naive back-to-back
// planting would constantly stall on K depletion.
function RotationPlannerCard() {
  const [settings] = useSettings();
  const { climate: CLIMATE } = useClimate();
  const dpm = settings.daysPerMonth || 9;

  const [selectedKeys, setSelectedKeys] = useState(['flax', 'soybean']);
  const [soilTier, setSoilTier] = useState(settings.defaultSoil ?? 50);
  const [greenhouse, setGreenhouse] = useState(false);

  const selectedCrops = selectedKeys
    .map(k => CROPS_LIST.find(c => c.key === k))
    .filter(Boolean);

  const moistF = useMemo(() =>
    rainfallGrowRange(settings.rainfallFrequency || 'common', 1, greenhouse).expected,
    [settings.rainfallFrequency, greenhouse]
  );

  // Light factor from current Decision context. For above-sea outdoor users
  // this is 1.0; for cellars or sub-sea-level farms it gates growth speed.
  const lightF = greenhouse ? 1.0 : lightGrowthFactor({
    underground: !!settings.underground,
    lightLevel: settings.lightLevel ?? 22,
    depthBelowSea: settings.depthBelowSea ?? 0,
    allowUnderground: !!settings.allowUndergroundFarming,
  });

  const planArgs = {
    crops: selectedCrops,
    soilTier,
    daysPerMonth: dpm,
    climate: CLIMATE,
    seasonStartDay: SEASON_START_DAY,
    seasonEndDay: SEASON_END_DAY,
    greenhouse,
    cropGrowthRateMul: settings.worldConfig?.cropGrowthRateMul ?? 1.0,
    moistF,
    lightF,
  };

  const separate = useMemo(() => selectedCrops.length > 0
    ? planSeparateGroups(planArgs)
    : null,
    [CLIMATE, selectedCrops, soilTier, dpm, greenhouse, moistF, lightF]);

  const staggered = useMemo(() => selectedCrops.length > 0
    ? planStaggeredGroups(planArgs)
    : null,
    [CLIMATE, selectedCrops, soilTier, dpm, greenhouse, moistF, lightF]);

  const shared = useMemo(() => selectedCrops.length > 0
    ? planSharedGroup(planArgs)
    : null,
    [CLIMATE, selectedCrops, soilTier, dpm, greenhouse, moistF, lightF]);

  const fertilized = useMemo(() => selectedCrops.length > 0
    ? planFertilizerBuffered(planArgs)
    : null,
    [CLIMATE, selectedCrops, soilTier, dpm, greenhouse, moistF, lightF]);

  const allSameAxis = selectedCrops.length > 1 && selectedCrops.every(c => c.nutrient === selectedCrops[0].nutrient);

  function toggleCrop(key) {
    setSelectedKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= 3) return [prev[1], prev[2], key];  // shift
      return [...prev, key];
    });
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Rotation planner"
        title="Crops you can't go without: how to fit them"
        subtitle="If your town needs flax AND soybean every season (both K), planting them on the same tile back-to-back drains K below the regen threshold. This card compares four strategies, ranging from raw efficiency to steady supply to tile-frugal-but-fertilizer-hungry. Pick 1-3 crops you must keep planting and see the trade-off each way."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 pb-4 border-b border-parchment-300/40">
          <div>
            <div className="text-xs font-medium text-ink-700 mb-1.5">Required crops (pick 1-3)</div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {CROPS_LIST.map(c => {
                const on = selectedKeys.includes(c.key);
                return (
                  <button
                    key={c.key}
                    onClick={() => toggleCrop(c.key)}
                    className={`px-2 py-1 rounded text-xs flex items-center gap-1 border ${on ? 'border-forest-700 bg-forest-50 text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40 text-ink-700'}`}
                  >
                    <NutrientChip axis={c.nutrient} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
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
            <label className="block text-xs font-medium text-ink-700 mb-1 mt-3">Conditions</label>
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
          <div className="text-xs text-ink-600 italic">
            All numbers below are per tile. Multiply by your tile count for total food output. The "separate groups" option assumes each crop gets equal space; "single rotating group" assumes one tile cycles through every crop in the order picked.
            {allSameAxis && (
              <span className="block mt-2 text-amber-800">
                <strong>Heads up:</strong> all your selected crops drain the same {selectedCrops[0]?.nutrient} axis. Same-axis rotation is the worst case for soil regen, so the trade-off below will be sharp.
              </span>
            )}
          </div>
        </div>

        {selectedCrops.length === 0 ? (
          <div className="text-sm text-ink-500 italic py-4">
            Pick at least one crop above to see plan options.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strategy 1: Separate parallel */}
            {separate && (
              <StrategyCard
                accent="forest"
                title="Separate tile groups (parallel)"
                tagline="One tile group per crop. Each runs independently. Best raw throughput when you have land to spare."
                totalHarvests={separate.totalHarvests}
                tilesUsed={separate.requiresTiles}
                tileLabel={separate.requiresTiles === 1 ? 'group' : 'groups'}
              >
                <div className="space-y-1.5">
                  {separate.groups.map(g => (
                    <div key={g.crop.key} className="px-2 py-1.5 rounded bg-parchment-100/50 border border-parchment-300/40 text-sm">
                      <div className="flex items-center gap-2">
                        <NutrientChip axis={g.crop.nutrient} />
                        <span className="font-display text-base text-forest-900">{g.crop.name}</span>
                        <span className="ml-auto tabular text-xs text-ink-700">
                          <strong>{g.harvests}</strong>/yr/tile
                        </span>
                      </div>
                      {g.stalled ? (
                        <div className="text-xs text-terra-700 mt-0.5">stalls (won't finish in season)</div>
                      ) : g.wouldDie ? (
                        <div className="text-xs text-terra-700 mt-0.5">would die from cold/heat</div>
                      ) : (
                        <>
                          <div className="text-[11px] text-ink-600 mt-0.5 tabular">
                            cycle {Math.round(g.growDays)}d grow + {Math.round(g.regenDays)}d regen
                          </div>
                          {g.plantDays.length > 0 && (
                            <div className="text-[10px] text-ink-500 mt-0.5 tabular">
                              plant day {g.plantDays.join(', ')}
                              {g.damagedDays && g.damagedDays.length > 0 && (
                                <span className="text-amber-700"> ({g.damagedDays.length} damaged)</span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </StrategyCard>
            )}

            {/* Strategy 2: Staggered parallel */}
            {staggered && (
              <StrategyCard
                accent="forest"
                title="Staggered parallel (steady supply)"
                tagline="Same as parallel, but split each crop's tiles into two sub-groups planted half-cycle apart. Same total throughput; harvests come in waves instead of all at once."
                totalHarvests={staggered.totalHarvests}
                tilesUsed={staggered.requiresTiles}
                tileLabel={staggered.requiresTiles === 1 ? 'group' : 'groups'}
              >
                <div className="space-y-1.5">
                  {staggered.groups.map(g => (
                    <div key={g.crop.key} className="px-2 py-1.5 rounded bg-parchment-100/50 border border-parchment-300/40 text-sm">
                      <div className="flex items-center gap-2">
                        <NutrientChip axis={g.crop.nutrient} />
                        <span className="font-display text-base text-forest-900">{g.crop.name}</span>
                        <span className="ml-auto tabular text-xs text-ink-700">
                          <strong>{g.totalHarvests}</strong>/yr (across 2 sub-groups)
                        </span>
                      </div>
                      {g.stalled ? (
                        <div className="text-xs text-terra-700 mt-0.5">stalls</div>
                      ) : (
                        <div className="text-[10px] text-ink-500 mt-0.5 tabular space-y-0.5">
                          {g.subgroups.map(sg => (
                            <div key={sg.label}>
                              <span className="text-forest-700/80">Group {sg.label}</span>
                              {sg.offset > 0 && <span className="text-ink-400"> (+{sg.offset}d offset)</span>}
                              {sg.plantDays.length > 0 && <span> plant day {sg.plantDays.join(', ')}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </StrategyCard>
            )}

            {/* Strategy 3: Fertilizer-buffered shared */}
            {fertilized && (
              <StrategyCard
                accent="amber"
                title="Fertilizer-buffered shared tile"
                tagline="One tile group, all crops alternate, apply fertilizer between each harvest to skip the regen window. Trades fertilizer cost for tile efficiency."
                totalHarvests={fertilized.totalHarvests}
                tilesUsed={fertilized.requiresTiles}
                tileLabel="group"
              >
                {fertilized.sequence.length === 0 ? (
                  <div className="text-sm text-terra-700">No cycle fits in this season.</div>
                ) : (
                  <>
                    <div className="space-y-1 mb-2">
                      {fertilized.sequence.map((s, i) => (
                        <div key={i} className="px-2 py-1 rounded bg-parchment-100/50 border border-parchment-300/40 text-xs flex items-center gap-2">
                          <span className="text-forest-700/60 font-display tabular w-4">#{i + 1}</span>
                          <NutrientChip axis={s.crop.nutrient} />
                          <span className="font-display text-sm text-forest-900">{s.crop.name}</span>
                          {s.damaged && <span className="text-amber-700 text-[10px] uppercase tracking-wider">damaged</span>}
                          <span className="ml-auto tabular text-ink-700">
                            day {s.plantDay} → {s.harvestDay} <span className="text-amber-800">+ {s.fertilizerName}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-ink-600 italic">
                      Cost per cycle on this tile: {Object.entries(fertilized.fertilizerByCrop).map(([k, v]) => `${v}× ${k}`).join(', ')}
                    </div>
                  </>
                )}
              </StrategyCard>
            )}

            {/* Strategy 4: Single rotating group (no fertilizer) */}
            {shared && (
              <StrategyCard
                accent="terra"
                title="Single rotating group (no fertilizer)"
                tagline="One tile group, crops alternate in order, wait for K to regen naturally between same-axis cycles. Cheapest setup but lowest output when crops share an axis."
                totalHarvests={shared.totalHarvests}
                tilesUsed={shared.requiresTiles}
                tileLabel="group"
              >
                {shared.sequence.length === 0 ? (
                  <div className="text-sm text-terra-700">No room in season for a full cycle.</div>
                ) : (
                  <div className="space-y-1">
                    {shared.sequence.map((s, i) => (
                      <div key={i} className="px-2 py-1 rounded bg-parchment-100/50 border border-parchment-300/40 text-xs flex items-center gap-2">
                        <span className="text-forest-700/60 font-display tabular w-4">#{i + 1}</span>
                        <NutrientChip axis={s.crop.nutrient} />
                        <span className="font-display text-sm text-forest-900">{s.crop.name}</span>
                        {s.damaged && <span className="text-amber-700 text-[10px] uppercase tracking-wider">damaged</span>}
                        <span className="ml-auto tabular text-ink-700">
                          day {s.plantDay} → {s.harvestDay}
                          {s.regenAfter > 0 && <span className="text-amber-800"> +{s.regenAfter}d wait</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </StrategyCard>
            )}
          </div>
        )}

        {/* Verdict */}
        {separate && shared && fertilized && staggered && separate.totalHarvests > 0 && (
          <div className="mt-5 px-4 py-3 rounded border-l-4 border-l-forest-500 bg-forest-50/40 text-sm leading-relaxed">
            <div className="font-medium text-forest-900 mb-1">Verdict for your selection</div>
            <RotationVerdict separate={separate} staggered={staggered} fertilized={fertilized} shared={shared} crops={selectedCrops} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// Compact card wrapper for the four rotation strategies.
function StrategyCard({ accent = 'forest', title, tagline, totalHarvests, tilesUsed, tileLabel, children }) {
  const accentMap = {
    forest: { border: 'border-forest-300/60', bg: 'bg-forest-50/30', heading: 'text-forest-900' },
    amber:  { border: 'border-amber-300/60',  bg: 'bg-amber-50/30',  heading: 'text-amber-900' },
    terra:  { border: 'border-terra-300/60',  bg: 'bg-terra-50/30',  heading: 'text-terra-800' },
  };
  const a = accentMap[accent] || accentMap.forest;
  return (
    <div className={`border-2 ${a.border} rounded p-4 ${a.bg}`}>
      <div className={`font-display text-base ${a.heading} mb-1`}>{title}</div>
      <div className="text-[11px] text-ink-600 italic mb-3 leading-snug">{tagline}</div>
      <div className="mb-3">{children}</div>
      <div className="text-sm pt-2 border-t border-parchment-300/40">
        <strong className="text-forest-900">{totalHarvests} harvest{totalHarvests === 1 ? '' : 's'}/year</strong>
        <span className="text-ink-600"> on {tilesUsed} tile {tileLabel}</span>
      </div>
    </div>
  );
}

// Verdict that compares all four strategies and picks a winner per priority.
// "Best raw throughput" = max total harvests divided by tile count (per-tile rate).
// "Best total volume" = max total harvests regardless of tiles.
// "Best for steady supply" = staggered if it keeps up with parallel.
function RotationVerdict({ separate, staggered, fertilized, shared, crops }) {
  // Per-tile efficiency: harvests per tile group
  const perTile = {
    separate: separate.requiresTiles ? separate.totalHarvests / separate.requiresTiles : 0,
    staggered: staggered.requiresTiles ? staggered.totalHarvests / staggered.requiresTiles : 0,
    fertilized: fertilized.totalHarvests,  // 1 tile
    shared: shared.totalHarvests,  // 1 tile
  };
  const totals = {
    separate: separate.totalHarvests,
    staggered: staggered.totalHarvests,
    fertilized: fertilized.totalHarvests,
    shared: shared.totalHarvests,
  };
  const allSameAxis = crops.length > 1 && crops.every(c => c.nutrient === crops[0].nutrient);

  // Pick best on total volume
  const bestVolume = Object.entries(totals).reduce((b, [k, v]) => v > b.v ? { k, v } : b, { k: 'separate', v: 0 });
  // Best per-tile
  const bestPerTile = Object.entries(perTile).reduce((b, [k, v]) => v > b.v ? { k, v } : b, { k: 'separate', v: 0 });

  const fertilizerHelps = fertilized.totalHarvests > shared.totalHarvests;
  const staggeredMatchesParallel = staggered.totalHarvests >= separate.totalHarvests;

  return (
    <div className="text-ink-700 space-y-2">
      <p>
        <strong className="text-forest-900">If you have land to spare, lean parallel.</strong>
        {' '}Separate tile groups gives <strong>{separate.totalHarvests}</strong> harvests/year on {separate.requiresTiles} groups, which is the highest total volume here. Each crop runs its own clock with no fertilizer needed and no waiting on a shared regen window.
      </p>

      {staggeredMatchesParallel && (
        <p>
          <strong className="text-forest-900">Want steady food supply instead of harvest spikes?</strong>
          {' '}Use the staggered version: same {staggered.totalHarvests} harvests/year on {staggered.requiresTiles} smaller sub-groups, but harvests come in waves throughout the season instead of all at once. Useful if your storage/cooking pipeline can't absorb a big simultaneous haul.
        </p>
      )}

      {fertilizerHelps ? (
        <p>
          <strong className="text-forest-900">Tight on land?</strong>
          {' '}Fertilizer-buffered shared tile gets you {fertilized.totalHarvests} harvests/year on just 1 tile group, beating the no-fertilizer rotation's {shared.totalHarvests}. Cost: {Object.entries(fertilized.fertilizerByCrop).map(([k, v]) => `${v}× ${k}`).join(' + ')} per cycle. Worth it if K fertilizer is cheap on your server.
        </p>
      ) : (
        <p className="text-ink-600">
          <strong className="text-ink-700">Fertilizer doesn't help here.</strong>
          {' '}With {crops.map(c => c.name).join(' + ')} on this soil and your season length, the bottleneck is grow time, not regen. Fertilizer-buffered hits {fertilized.totalHarvests} harvests vs the no-fertilizer rotation's {shared.totalHarvests}. Save the potash for crops with shorter cycles.
        </p>
      )}

      {allSameAxis && separate.totalHarvests > shared.totalHarvests * 1.5 && (
        <p className="text-ink-600 italic">
          Same-axis required crops ({crops[0].nutrient}) really hurt single-tile setups. The 50% premium parallel pays in tiles is bought back by avoiding the regen wait on every crop transition.
        </p>
      )}
    </div>
  );
}

// Rotation cycle builder: pick crops in sequence, simulate same-tile rotation
// over multiple cycles, surface the steady-state NPK and yield verdict.
// Different from the parallel/staggered/etc. planner above: this is the
// classical "plant A then B then A then B on the same tile" model where each
// crop's drained axis recovers while the OTHER crop is growing.
function RotationCycleCard() {
  const [settings] = useSettings();
  const { climate: CLIMATE } = useClimate();
  const dpm = settings.daysPerMonth || 9;

  const [sequence, setSequence] = useState(['soybean', 'cabbage']);
  const [soilTier, setSoilTier] = useState(settings.defaultSoil ?? 50);
  const [greenhouse, setGreenhouse] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);

  const sequenceCrops = sequence
    .map(k => CROPS_LIST.find(c => c.key === k))
    .filter(Boolean);

  // The user's actual rainfall + water-distance moisture factor. Defaulting to
  // 1.0 baseline (as the planner used to) gives wrong predictions for users
  // with good rainfall, since the game multiplies growth speed by the moisture
  // factor (~1.09 at full saturation).
  const moistF = useMemo(() =>
    rainfallGrowRange(settings.rainfallFrequency || 'common', 1, greenhouse).expected,
    [settings.rainfallFrequency, greenhouse]
  );

  // Light factor for the simulator. Greenhouse is sky-exposed = 1.0; outdoor
  // above-sea farms typically run 1.0; cellars / below-sea-level outdoor see
  // a real reduction.
  const lightF = useMemo(() => greenhouse ? 1.0 : lightGrowthFactor({
    underground: !!settings.underground,
    lightLevel: settings.lightLevel ?? 22,
    depthBelowSea: settings.depthBelowSea ?? 0,
    allowUnderground: !!settings.allowUndergroundFarming,
  }), [greenhouse, settings.underground, settings.lightLevel, settings.depthBelowSea, settings.allowUndergroundFarming]);

  const sim = useMemo(() => {
    if (sequenceCrops.length === 0) return null;
    return simulateRotationCycle({
      crops: sequenceCrops,
      soilTier,
      daysPerMonth: dpm,
      climate: CLIMATE,
      seasonStartDay: SEASON_START_DAY,
      greenhouse,
      cropGrowthRateMul: settings.worldConfig?.cropGrowthRateMul ?? 1.0,
      moistF,
      lightF,
      cycles: 4,
    });
  }, [CLIMATE, sequenceCrops, soilTier, dpm, greenhouse, moistF, lightF]);

  // Run the same rotation across every soil tier so the user can see whether
  // a higher-cap soil would unlock viability without trial-and-error.
  const tierComparison = useMemo(() => {
    if (sequenceCrops.length === 0) return null;
    return SOILS_PLANTABLE.map(s => {
      const r = simulateRotationCycle({
        crops: sequenceCrops,
        soilTier: s.val,
        daysPerMonth: dpm,
        climate: CLIMATE,
        seasonStartDay: SEASON_START_DAY,
        greenhouse,
        cropGrowthRateMul: settings.worldConfig?.cropGrowthRateMul ?? 1.0,
        moistF,
        lightF,
        cycles: 4,
      });
      return { tier: s, sim: r };
    });
  }, [CLIMATE, sequenceCrops, dpm, greenhouse, moistF, lightF]);

  // Check whether the picked sequence is actually a rotation. Single-crop
  // selection isn't a rotation, it's continuous mono-cropping. Multi-crop
  // with all the same axis is also effectively mono-cropping (every crop
  // drains the same axis, so no axis ever recovers).
  const axes = new Set(sequenceCrops.map(c => c.nutrient));
  const isMonoCrop = sequenceCrops.length === 1;
  const isMonoAxis = !isMonoCrop && sequenceCrops.length > 1 && axes.size === 1;

  const partners = useMemo(() => {
    if (sequenceCrops.length === 0) return [];
    const requiredCrop = sequenceCrops[0];
    return suggestRotationPartners({
      requiredCrop,
      candidateCrops: CROPS_LIST,
      soilTier,
      daysPerMonth: dpm,
      climate: CLIMATE,
      seasonStartDay: SEASON_START_DAY,
      seasonEndDay: SEASON_END_DAY,
      greenhouse,
      cropGrowthRateMul: settings.worldConfig?.cropGrowthRateMul ?? 1.0,
      moistF,
      lightF,
    });
  }, [CLIMATE, sequenceCrops[0]?.key, soilTier, dpm, greenhouse, moistF, lightF]);

  function addCrop(key) {
    if (sequence.includes(key)) return;
    if (sequence.length >= 4) return;
    setSequence([...sequence, key]);
  }
  function removeAt(idx) {
    setSequence(sequence.filter((_, i) => i !== idx));
  }
  function moveUp(idx) {
    if (idx === 0) return;
    const next = [...sequence];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setSequence(next);
  }

  const verdictColor = sim?.yieldVerdict === 'full+' ? 'forest-700'
    : sim?.yieldVerdict === 'full' ? 'forest-700'
    : sim?.yieldVerdict === 'lower' ? 'amber-800'
    : sim?.yieldVerdict === 'poor' ? 'terra-700'
    : 'terra-800';

  const visibleSteps = sim?.steps && !showAllSteps
    ? sim.steps.slice(0, sequenceCrops.length * 2)  // show 2 cycles
    : sim?.steps;

  return (
    <Card>
      <CardHeader
        eyebrow="Rotation cycle builder"
        title="Same tile, crop A then B then A again"
        subtitle="The classical rotation: crops drain different axes (e.g. soybean K, then cabbage N) so each axis recovers while the OTHER crop is growing. Pick 2-4 crops in order; we simulate 4 full cycles and report whether each axis stabilizes at viable levels (>= 35 = lower yield, >= 50 = full yield)."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 pb-4 border-b border-parchment-300/40">
          <div>
            <div className="text-xs font-medium text-ink-700 mb-1.5">Rotation sequence (in order)</div>
            {sequenceCrops.length === 0 ? (
              <div className="text-xs text-ink-500 italic mb-2">Pick crops below to build a sequence.</div>
            ) : (
              <div className="space-y-1 mb-2">
                {sequenceCrops.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-2 text-xs bg-parchment-100/60 border border-parchment-300/40 rounded px-2 py-1">
                    <span className="font-display tabular text-forest-700/70 w-4">{i + 1}.</span>
                    <NutrientChip axis={c.nutrient} />
                    <span className="font-display text-sm text-forest-900">{c.name}</span>
                    <span className="text-[10px] text-ink-500">drains {c.cons.toFixed(0)}</span>
                    <span className="ml-auto flex gap-1">
                      {i > 0 && <button onClick={() => moveUp(i)} className="text-ink-500 hover:text-forest-700 px-1">↑</button>}
                      <button onClick={() => removeAt(i)} className="text-terra-700 hover:text-terra-900 px-1">×</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="text-[10px] text-ink-500 mb-1">Add a crop:</div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {CROPS_LIST.filter(c => !sequence.includes(c.key)).map(c => (
                <button
                  key={c.key}
                  onClick={() => addCrop(c.key)}
                  className="px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 border border-parchment-300/60 hover:bg-forest-50 text-ink-700"
                >
                  <NutrientChip axis={c.nutrient} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Soil tier</label>
            <select className="select-field" value={soilTier} onChange={e => setSoilTier(parseInt(e.target.value))}>
              {SOILS_PLANTABLE.map(s => (
                <option key={s.val} value={s.val}>{s.name} ({s.val})</option>
              ))}
            </select>
            <label className="block text-xs font-medium text-ink-700 mb-1 mt-3">Conditions</label>
            <button onClick={() => setGreenhouse(g => !g)}
              className={`px-3 py-2 rounded-md border text-sm ${greenhouse ? 'bg-forest-600 text-parchment-50 border-forest-700' : 'bg-parchment-200/40 text-ink-700 border-parchment-300/60'}`}>
              {greenhouse ? 'Greenhouse on (+5°C)' : 'Outdoor (no greenhouse)'}
            </button>
          </div>
          <div className="text-xs text-ink-600 italic">
            The simulation runs 4 full cycles starting from {dateLabel(SEASON_START_DAY, dpm)}. After harvest, the crop's drained axis loses {`{cons}`} immediately; during the next crop's grow, that axis regens passively (other axes regen even faster since they're not the active drain).
            <p className="mt-2 not-italic"><strong className="text-forest-900">Yield meaning:</strong> NPK below 35 = 60% yield, below 20 = 30%, below 5 = 10%.</p>
          </div>
        </div>

        {sim ? (
          <>
            {/* Steady-state result */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className={`px-4 py-3 rounded border-l-4 border-l-${verdictColor.split('-')[0]}-${verdictColor.split('-')[1]} bg-parchment-100/40`}>
                <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">Steady-state growth speed</div>
                <div className={`font-display text-xl text-${verdictColor}`}>
                  {sim.yieldVerdict === 'full+' ? 'Boosted (1.1×)' :
                   sim.yieldVerdict === 'full' ? 'Full (1.0×)' :
                   sim.yieldVerdict === 'lower' ? 'Slightly slow (0.9×)' :
                   sim.yieldVerdict === 'poor' ? 'Slow (0.6×)' :
                   sim.yieldVerdict === 'failing' ? 'Stalls (≤0.3×)' : 'Unknown'}
                </div>
                <div className="text-xs text-ink-600 mt-1">
                  {sim.yieldVerdict === 'full+' && 'Every crop plants at level >75 → 1.10× growth speed. Faster cycles than a fully-fed plot.'}
                  {sim.yieldVerdict === 'full' && 'Every crop plants at level 51-75 → 1.00× full growth speed. The rotation works.'}
                  {sim.yieldVerdict === 'lower' && 'Every crop plants at level 36-50 → 0.90× speed. Sustainable, just slightly slowed.'}
                  {sim.yieldVerdict === 'poor' && 'Some crops plant at level 21-35 → 0.60× speed. Half-speed cycles, lots of food per real-time lost.'}
                  {sim.yieldVerdict === 'failing' && 'Some crops plant at level ≤20 → 0.30× speed or worse. Cycles stretch out so much they may not finish.'}
                </div>
              </div>
              {sim.plantTimeYields && (
                <div className="md:col-span-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(3, sim.plantTimeYields.length)}, minmax(0, 1fr))` }}>
                  {sim.plantTimeYields.map((p, i) => {
                    const lvl = p.plantLevel;
                    const status = lvl > 75 ? 'forest-700'
                      : lvl > 50 ? 'forest-700'
                      : lvl > 35 ? 'amber-800'
                      : lvl > 20 ? 'terra-700'
                      : 'terra-800';
                    const speedLabel = lvl > 75 ? '1.10× speed'
                      : lvl > 50 ? '1.00× speed'
                      : lvl > 35 ? '0.90× speed'
                      : lvl > 20 ? '0.60× speed'
                      : lvl > 5 ? '0.30× speed'
                      : '0.10× speed';
                    return (
                      <div key={i} className="bg-parchment-100/40 border border-parchment-300/40 rounded px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-ink-500 truncate">
                          {p.crop.name} ({p.axis})
                        </div>
                        <div className={`font-display text-2xl tabular text-${status}`}>{lvl.toFixed(0)}</div>
                        <div className="text-[10px] text-ink-500">at plant time · {speedLabel}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step-by-step trace */}
            {visibleSteps && visibleSteps.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-ink-700">Step-by-step (first 2 of {sim.cycles} cycles shown)</div>
                  {sim.steps.length > sequenceCrops.length * 2 && (
                    <button onClick={() => setShowAllSteps(s => !s)} className="text-xs text-forest-700 underline">
                      {showAllSteps ? 'Show first 2 cycles' : `Show all ${sim.cycles} cycles`}
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-ink-500 border-b border-parchment-300/40">
                        <th className="py-1.5 px-2">Cyc</th>
                        <th className="py-1.5 px-2">Crop</th>
                        <th className="py-1.5 px-2">Plant→Harvest</th>
                        <th className="py-1.5 px-2 text-right">Plant N/P/K</th>
                        <th className="py-1.5 px-2 text-right">End N/P/K</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSteps.map((s, i) => (
                        <tr key={i} className="border-b border-parchment-300/20 hover:bg-parchment-100/30">
                          <td className="py-1.5 px-2 tabular text-ink-500">#{s.cycle}</td>
                          <td className="py-1.5 px-2">
                            <span className="inline-flex items-center gap-1.5">
                              <NutrientChip axis={s.crop.nutrient} />
                              <span className="font-display text-sm text-forest-900">{s.crop.name}</span>
                            </span>
                          </td>
                          <td className="py-1.5 px-2 tabular text-ink-700">day {s.plantDay} → {s.harvestDay}</td>
                          <td className="py-1.5 px-2 tabular text-right text-ink-500">{s.plantN}/{s.plantP}/{s.plantK}</td>
                          <td className="py-1.5 px-2 tabular text-right">
                            <NPKEnd n={s.endN} p={s.endP} k={s.endK} drained={s.crop.nutrient} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {sim.stalledStep && (
              <div className={`mt-3 px-3 py-2 rounded border-l-4 text-xs ${sim.sustainabilityReason === 'one-cycle-per-year' ? 'border-l-forest-500 bg-forest-50/30' : 'border-l-terra-500 bg-terra-50/30'}`}>
                <strong className={sim.sustainabilityReason === 'one-cycle-per-year' ? 'text-forest-800' : 'text-terra-800'}>
                  {sim.sustainabilityReason === 'one-cycle-per-year'
                    ? 'Sustainable as one cycle per year:'
                    : sim.stalledStep.reason === 'died' ? 'Crop died:' : 'Stalls:'}
                </strong>{' '}
                {sim.sustainabilityReason === 'one-cycle-per-year' ? (
                  <>Cycle 1 completes fine. Cycle 2's {sim.stalledStep.crop.name} {sim.stalledStep.reason === 'died' ? 'dies in autumn cold' : 'stalls'} because the rotation runs into late-season weather. Plant once per year and winter resets the soil; the rotation is fine year over year.</>
                ) : sim.stalledStep.reason === 'died' ? (
                  <>{sim.stalledStep.crop.name} died from cold/heat damage on cycle {sim.stalledStep.cycle}{sim.stalledStep.deathDay ? ` (day ${sim.stalledStep.deathDay})` : ''}. The leaky-bucket damage accumulator crossed 48h while the crop was below its cold threshold or above its heat threshold.</>
                ) : (
                  <>{sim.stalledStep.crop.name} couldn't finish growing on cycle {sim.stalledStep.cycle}. {greenhouse ? 'Greenhouse cycles run year-round; the soil never resets, so this rotation drains itself without recovery.' : 'On a real server the rotation would also need to fit inside the frost-free window.'}</>
                )}
              </div>
            )}

            {/* Mono-crop / mono-axis warnings: these explain why the result
                looks bleak before the user gets to the math. */}
            {(isMonoCrop || isMonoAxis) && (
              <div className="mt-3 px-3 py-2 rounded border-l-4 border-l-amber-500 bg-amber-50/40 text-xs leading-relaxed">
                <strong className="text-amber-900">
                  {isMonoCrop ? "This isn't a rotation, it's mono-cropping" : "All your crops drain the same axis"}
                </strong>
                <p className="text-ink-700 mt-1">
                  {isMonoCrop
                    ? <>You only picked {sequenceCrops[0].name} ({sequenceCrops[0].nutrient}). On a single tile, planting it back-to-back means the {sequenceCrops[0].nutrient} axis only regens at 1/3 rate (because the same crop is always actively draining it). It will hit the floor and stay there. To make this a real rotation, add at least one crop with a different axis.</>
                    : <>Every crop you picked drains the {[...axes][0]} axis. The non-drained axes (like {['N','P','K'].filter(a => !axes.has(a)).join(' and ')}) regen perfectly fine, but {[...axes][0]} keeps getting drained with no recovery window. Add a different-axis crop to break the chain.</>
                  }
                </p>
                {/* Always show partner suggestions in this case */}
                {partners.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-300/30">
                    <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">Add one of these to fix it:</div>
                    <div className="flex flex-wrap gap-1">
                      {partners.slice(0, 5).map(p => (
                        <button
                          key={p.partner.key}
                          onClick={() => addCrop(p.partner.key)}
                          className="px-2 py-0.5 rounded text-[11px] flex items-center gap-1 border border-parchment-300/60 hover:bg-forest-50 text-ink-700"
                        >
                          <NutrientChip axis={p.partner.nutrient} />
                          {p.partner.name}
                          <span className="text-[9px] text-ink-500 tabular">(K floor {p.minSteady.toFixed(0)})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verdict */}
            <div className={`mt-5 px-4 py-3 rounded border-l-4 border-l-${verdictColor.split('-')[0]}-500 bg-parchment-100/40 text-sm leading-relaxed`}>
              <div className="font-medium text-forest-900 mb-1">Verdict</div>
              <p className="text-ink-700">
                <RotationCycleVerdict sim={sim} crops={sequenceCrops} soilTier={soilTier} isMonoCrop={isMonoCrop} isMonoAxis={isMonoAxis} />
              </p>
            </div>

            {/* Soil-tier comparison: same rotation across all 5 tiers */}
            {tierComparison && !isMonoCrop && (
              <div className="mt-5 pt-4 border-t border-parchment-300/40">
                <div className="text-xs font-medium text-ink-700 mb-2">Same rotation across every soil tier:</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {tierComparison.map(({ tier, sim: tierSim }) => {
                    if (!tierSim || !tierSim.steadyState) {
                      return (
                        <div key={tier.val} className={`px-3 py-2 rounded border ${tier.val === soilTier ? 'border-forest-500 bg-forest-50/40' : 'border-parchment-300/60 bg-parchment-100/40'}`}>
                          <div className="text-[10px] uppercase tracking-wider text-ink-500">{tier.name}</div>
                          <div className="text-xs text-terra-700">No data</div>
                        </div>
                      );
                    }
                    const minSteady = tierSim.minPlantLevel ?? tierSim.minSteady;
                    const tone = tierSim.yieldVerdict === 'full+' ? 'forest-700'
                      : tierSim.yieldVerdict === 'full' ? 'forest-700'
                      : tierSim.yieldVerdict === 'lower' ? 'amber-800'
                      : tierSim.yieldVerdict === 'poor' ? 'terra-700'
                      : 'terra-800';
                    const label = tierSim.yieldVerdict === 'full+' ? '1.10× speed'
                      : tierSim.yieldVerdict === 'full' ? '1.00× speed'
                      : tierSim.yieldVerdict === 'lower' ? '0.90× speed'
                      : tierSim.yieldVerdict === 'poor' ? '0.60× speed'
                      : 'Stalls';
                    return (
                      <button
                        key={tier.val}
                        onClick={() => setSoilTier(tier.val)}
                        className={`px-3 py-2 rounded border text-left transition-colors ${
                          tier.val === soilTier
                            ? 'border-forest-500 bg-forest-50/60'
                            : 'border-parchment-300/60 bg-parchment-100/40 hover:bg-parchment-200/40'
                        }`}
                      >
                        <div className="flex items-baseline gap-1">
                          <div className="text-[10px] uppercase tracking-wider text-ink-500">{tier.name}</div>
                          <div className="text-[9px] text-ink-400 tabular">({tier.val})</div>
                        </div>
                        <div className={`font-display text-sm text-${tone} mt-0.5`}>{label}</div>
                        <div className="text-[10px] text-ink-500 tabular">
                          floor {minSteady.toFixed(0)}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-ink-500 italic mt-2">
                  Shows the steady-state yield class on each soil tier for the same rotation. Click any tier to switch the simulation. If even Terra Preta shows "Failing", the only fix is fertilizer between cycles or splitting onto separate tile groups (Rotation Planner card above).
                </div>
              </div>
            )}

            {/* Partner suggestions */}
            {sequenceCrops.length === 1 && partners.length > 0 && (
              <div className="mt-5 pt-4 border-t border-parchment-300/40">
                <div className="text-xs font-medium text-ink-700 mb-2">Top partners for {sequenceCrops[0].name} on {SOILS_PLANTABLE.find(s => s.val === soilTier)?.name} soil:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {partners.slice(0, 4).map(p => (
                    <button
                      key={p.partner.key}
                      onClick={() => addCrop(p.partner.key)}
                      className="px-3 py-2 rounded border border-parchment-300/60 bg-parchment-100/40 hover:bg-forest-50 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <NutrientChip axis={p.partner.nutrient} />
                        <span className="font-display text-sm text-forest-900">{p.partner.name}</span>
                        <span className="ml-auto text-[10px] tabular">
                          steady min: <strong className={p.minSteady >= 35 ? 'text-forest-700' : 'text-terra-700'}>{p.minSteady.toFixed(0)}</strong>
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-500 mt-0.5">
                        {p.harvestsInSeason} harvests/season &middot; {
                          !p.isSustainable ? 'depletes soil'
                            : p.sim?.sustainabilityReason === 'one-cycle-per-year' ? 'viable, once per year'
                            : 'viable'
                        }
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-ink-500 italic">Pick a crop above to start.</div>
        )}
      </CardBody>
    </Card>
  );
}

function NPKEnd({ n, p, k, drained }) {
  function tone(v, isDrained) {
    if (!isDrained) return 'text-ink-600';
    return v >= 50 ? 'text-forest-700' : v >= 35 ? 'text-amber-800' : v >= 20 ? 'text-terra-700' : 'text-terra-800';
  }
  return (
    <span className="tabular">
      <span className={tone(n, drained === 'N')}>{n}</span>/
      <span className={tone(p, drained === 'P')}>{p}</span>/
      <span className={tone(k, drained === 'K')}>{k}</span>
    </span>
  );
}

function RotationCycleVerdict({ sim, crops, soilTier, isMonoCrop, isMonoAxis }) {
  if (!sim || !sim.steadyState) return null;
  const min = sim.minPlantLevel ?? sim.minSteady;
  // Drained axis = the axis of the crop in the LAST cycle that had the lowest plant-level
  const lowestStep = sim.plantTimeYields ? sim.plantTimeYields.reduce((lo, p) => p.plantLevel < lo.plantLevel ? p : lo) : null;
  const drainedAxis = lowestStep?.axis || 'N';
  const cropList = crops.map(c => c.name).join(' → ');

  if (isMonoCrop) {
    return (
      <>
        Just one crop selected. The simulator is showing what continuous mono-cropping does on a single tile, which is unavoidable depletion. The math: every cycle drains the {drainedAxis} axis by {crops[0].cons}, and since the same crop is always actively growing, that axis only regens at 1/3 rate during its own grow window. <strong>{drainedAxis} at plant time ends at {min.toFixed(0)}</strong>, which means growth crawls (≤0.3× speed). Add a different-axis partner above to turn this into an actual rotation.
      </>
    );
  }
  if (isMonoAxis) {
    return (
      <>
        All your crops drain {drainedAxis}. That's mono-cropping in disguise: even though you're alternating between crops, none of them give the {drainedAxis} axis a recovery window. <strong>{drainedAxis} at plant time stabilizes at {min.toFixed(0)}</strong>. Replace one with a {['N','P','K'].filter(a => a !== drainedAxis).join(' or ')} crop and the math flips.
      </>
    );
  }

  if (sim.yieldVerdict === 'full+') {
    return <>This rotation runs at <strong>1.10× growth speed</strong> on {SOILS_PLANTABLE.find(s => s.val === soilTier)?.name}. Each crop plants at its drained axis above 75. You get faster cycles than a normal plot. Plant <strong>{cropList}</strong> on a single tile and keep cycling.</>;
  }
  if (sim.yieldVerdict === 'full') {
    return <>This rotation runs at <strong>full 1.00× growth speed</strong> on {SOILS_PLANTABLE.find(s => s.val === soilTier)?.name}. Each crop plants at its drained axis above 50. Plant <strong>{cropList}</strong> on a single tile and keep cycling.</>;
  }
  if (sim.yieldVerdict === 'lower') {
    return <>Sustainable, just <strong>10% slowed (0.90× growth speed)</strong>. {drainedAxis} stabilizes at {min.toFixed(0)} at plant time, which falls in the 36-50 band. Cycles take ~10% longer than nominal but the rotation keeps working indefinitely. Step up to High Fertility (65) or Terra Preta (80) for full speed.</>;
  }
  return (
    <>
      <strong className="text-terra-800">This rotation depletes the soil.</strong> {drainedAxis} at plant time stabilizes at <strong>{min.toFixed(0)}</strong>, which means the next crop in cycle starts growing at {min > 20 ? '0.60×' : min > 5 ? '0.30×' : '0.10×'} speed. Cycles stretch out so much they may not finish in the season.
      {' '}On <strong>{SOILS_PLANTABLE.find(s => s.val === soilTier)?.name}</strong> with these crops, you have three real options:
      <ul className="mt-2 ml-4 list-disc text-xs space-y-1">
        <li><strong>Use parallel tile groups</strong> (the planner above): each crop on its own tiles, no shared drain. Higher tile count but full speed.</li>
        <li><strong>Step up to Terra Preta soil</strong> (tier 80): the higher cap gives more headroom; the steady-state plant-time level often climbs 30+ points.</li>
        <li><strong>Apply potash/saltpeter between cycles</strong>: refills the {drainedAxis} axis to viable levels in one application. Trades fertilizer cost for tile efficiency.</li>
      </ul>
    </>
  );
}

// Year planner from a primary crop. Different from the rotation cycle
// builder above: that one tests "is this rotation sustainable in steady
// state". This one says "I dedicated a tile group to flax (or soybean) for
// the season. What do I plant on those tiles AFTER the primary harvest, and
// can I fit another primary cycle in?". The auto-fill picks the highest
// satiety-per-day filler at each step while respecting axis recovery.
function YearPlannerCard() {
  const [settings] = useSettings();
  const { climate: CLIMATE } = useClimate();
  const dpm = settings.daysPerMonth || 9;

  const [primaryKey, setPrimaryKey] = useState('soybean');
  const [secondaryKey, setSecondaryKey] = useState('flax');
  const [splitMode, setSplitMode] = useState(true);  // compare two halves
  const [soilTier, setSoilTier] = useState(settings.defaultSoil ?? 50);
  const [greenhouse, setGreenhouse] = useState(false);
  const [satMode, setSatMode] = useState('meal');

  const primaryCrop = CROPS_LIST.find(c => c.key === primaryKey);
  const secondaryCrop = CROPS_LIST.find(c => c.key === secondaryKey);

  // Plumb the user's actual moisture factor into the planner so good rainfall
  // correctly accelerates predicted harvests.
  const moistF = useMemo(() =>
    rainfallGrowRange(settings.rainfallFrequency || 'common', 1, greenhouse).expected,
    [settings.rainfallFrequency, greenhouse]
  );

  // Same for light. Above-sea outdoor → 1.0; cellars and below-sea farms
  // see slower growth that the planner needs to model.
  const lightF = useMemo(() => greenhouse ? 1.0 : lightGrowthFactor({
    underground: !!settings.underground,
    lightLevel: settings.lightLevel ?? 22,
    depthBelowSea: settings.depthBelowSea ?? 0,
    allowUnderground: !!settings.allowUndergroundFarming,
  }), [greenhouse, settings.underground, settings.lightLevel, settings.depthBelowSea, settings.allowUndergroundFarming]);

  function planFor(crop) {
    if (!crop) return null;
    return planSeasonAutoFill({
      primaryCrop: crop,
      candidateCrops: CROPS_LIST,
      soilTier,
      daysPerMonth: dpm,
      climate: CLIMATE,
      seasonStartDay: SEASON_START_DAY,
      seasonEndDay: SEASON_END_DAY,
      greenhouse,
      cropGrowthRateMul: settings.worldConfig?.cropGrowthRateMul ?? 1.0,
      moistF,
      lightF,
      satietyMode: satMode,
    });
  }

  const planA = useMemo(() => planFor(primaryCrop),
    [CLIMATE, primaryCrop?.key, soilTier, dpm, greenhouse, satMode, moistF, lightF]);
  const planB = useMemo(() => splitMode ? planFor(secondaryCrop) : null,
    [CLIMATE, secondaryCrop?.key, soilTier, dpm, greenhouse, splitMode, satMode, moistF, lightF]);

  const farmTotal = (planA?.totalSatiety || 0) + (planB?.totalSatiety || 0);
  const farmHarvests = (planA?.totalHarvests || 0) + (planB?.totalHarvests || 0);

  return (
    <Card>
      <CardHeader
        eyebrow="Year planner from a primary crop"
        title="Dedicate this tile group to one crop, fill the rest with food"
        subtitle="If you split your farm in halves (e.g., one half for flax, one half for soybean), each half ends up with leftover season time after the primary harvest. This planner replants the primary as often as it fits AND inserts different-axis filler crops between cycles to maximize total food output. Toggle split mode to compare both halves side by side."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 pb-4 border-b border-parchment-300/40">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setSplitMode(false)}
                className={`px-2 py-1 rounded text-xs ${!splitMode ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}
              >Single half</button>
              <button
                onClick={() => setSplitMode(true)}
                className={`px-2 py-1 rounded text-xs ${splitMode ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}
              >Split farm (compare 2 halves)</button>
            </div>
            <label className="block text-xs font-medium text-ink-700 mb-1">
              Half A primary {splitMode && <span className="text-forest-700">(left)</span>}
            </label>
            <select className="select-field text-sm" value={primaryKey} onChange={e => setPrimaryKey(e.target.value)}>
              {CROPS_LIST.map(c => (
                <option key={c.key} value={c.key}>{c.name} ({c.nutrient})</option>
              ))}
            </select>
            {splitMode && (
              <>
                <label className="block text-xs font-medium text-ink-700 mb-1 mt-3">
                  Half B primary <span className="text-forest-700">(right)</span>
                </label>
                <select className="select-field text-sm" value={secondaryKey} onChange={e => setSecondaryKey(e.target.value)}>
                  {CROPS_LIST.map(c => (
                    <option key={c.key} value={c.key}>{c.name} ({c.nutrient})</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Soil tier (both halves)</label>
            <select className="select-field" value={soilTier} onChange={e => setSoilTier(parseInt(e.target.value))}>
              {SOILS_PLANTABLE.map(s => (
                <option key={s.val} value={s.val}>{s.name} ({s.val})</option>
              ))}
            </select>
            <label className="block text-xs font-medium text-ink-700 mb-1 mt-3">Conditions</label>
            <button onClick={() => setGreenhouse(g => !g)}
              className={`px-3 py-2 rounded-md border text-sm ${greenhouse ? 'bg-forest-600 text-parchment-50 border-forest-700' : 'bg-parchment-200/40 text-ink-700 border-parchment-300/60'}`}>
              {greenhouse ? 'Greenhouse on (+5°C)' : 'Outdoor (no greenhouse)'}
            </button>
            <label className="block text-xs font-medium text-ink-700 mb-1 mt-3">Satiety mode (how filler ranking values food)</label>
            <div className="flex gap-1">
              <button onClick={() => setSatMode('meal')}
                className={`px-2 py-1 rounded text-xs flex-1 ${satMode === 'meal' ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}
                title="Score crops by their value in cooked meals (most representative for actual gameplay)">
                Cooked meals
              </button>
              <button onClick={() => setSatMode('auto')}
                className={`px-2 py-1 rounded text-xs flex-1 ${satMode === 'auto' ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}
                title="Auto-pick raw vs meal value depending on crop">
                Auto
              </button>
              <button onClick={() => setSatMode('raw')}
                className={`px-2 py-1 rounded text-xs flex-1 ${satMode === 'raw' ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}
                title="Score crops by raw consumption only (ignores meals)">
                Raw only
              </button>
            </div>
          </div>
          <div className="text-xs text-ink-600 italic">
            <p>Fillers are picked greedily by satiety-per-day among crops that fit the remaining season AND drain a different axis than the just-harvested crop. Primary replants whenever its drained axis recovers to viable (≥35).</p>
            {splitMode && (
              <p className="mt-2 not-italic"><strong className="text-forest-900">Whole-farm total</strong> assumes equal tile counts on both halves. Multiply by your tile count per half for absolute output.</p>
            )}
          </div>
        </div>

        {splitMode && planA && planB ? (
          <>
            {/* Whole-farm summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Stat label="Whole-farm harvests" value={farmHarvests} note={`${planA.primaryCount}× ${primaryCrop.name} + ${planB.primaryCount}× ${secondaryCrop.name} + ${planA.fillerCount + planB.fillerCount} fillers`} />
              <Stat label="Whole-farm satiety" value={farmTotal.toLocaleString()} note="per tile per year (1 tile each half)" />
              <Stat label="Half A satiety" value={planA.totalSatiety.toLocaleString()} note={`${primaryCrop.name} half`} />
              <Stat label="Half B satiety" value={planB.totalSatiety.toLocaleString()} note={`${secondaryCrop.name} half`} />
            </div>

            {/* Side-by-side plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HalfPlan plan={planA} primary={primaryCrop} dpm={dpm} accent="forest" label="Half A" />
              <HalfPlan plan={planB} primary={secondaryCrop} dpm={dpm} accent="amber" label="Half B" />
            </div>

            {/* Cross-half verdict */}
            <div className="mt-5 px-4 py-3 rounded border-l-4 border-l-forest-500 bg-forest-50/40 text-sm leading-relaxed">
              <div className="font-medium text-forest-900 mb-1">Verdict on the whole farm</div>
              <SplitFarmVerdict planA={planA} planB={planB} primaryA={primaryCrop} primaryB={secondaryCrop} soilTier={soilTier} />
            </div>
          </>
        ) : planA && primaryCrop ? (
          <>
            {/* Single half mode */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Stat label={`Total harvests`} value={planA.totalHarvests} note={`${planA.primaryCount}× ${primaryCrop.name} + ${planA.fillerCount} fillers`} />
              <Stat label={`Total satiety/year`} value={planA.totalSatiety.toLocaleString()} note="across all harvests" />
              <Stat label={`Days used`} value={planA.daysUsed} note={`of ${SEASON_END_DAY - SEASON_START_DAY} season days`} />
              <Stat label={`Frost-locked tail`} value={`${planA.daysRemaining}d`} note="cold-snap window unusable" accent={planA.daysRemaining > 30 ? 'text-amber-800' : 'text-ink-600'} />
            </div>
            {planA.stalledOnPrimary && (
              <div className="px-3 py-2 rounded border-l-4 border-l-terra-500 bg-terra-50/30 text-xs mb-4">
                <strong className="text-terra-800">Primary doesn't fit:</strong> {primaryCrop.name} can't ripen in this season at this soil tier. Pick a different primary or upgrade soil/greenhouse.
              </div>
            )}
            {planA.sequence.length > 0 && (
              <div>
                <div className="text-xs font-medium text-ink-700 mb-2">The plan, day by day</div>
                <div className="space-y-1">
                  {planA.sequence.map((s, i) => (
                    <PlanStep key={i} step={s} index={i} dpm={dpm} />
                  ))}
                </div>
              </div>
            )}
            {planA.sequence.length > 0 && (
              <div className="mt-5 px-4 py-3 rounded border-l-4 border-l-forest-500 bg-forest-50/40 text-sm leading-relaxed">
                <div className="font-medium text-forest-900 mb-1">Verdict for this half-farm</div>
                <YearPlanVerdict plan={planA} primary={primaryCrop} soilTier={soilTier} />
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-ink-500 italic">Pick a primary crop above.</div>
        )}
      </CardBody>
    </Card>
  );
}

function PlanStep({ step: s, index: i, dpm }) {
  return (
    <div className={`px-3 py-2 rounded border text-sm flex items-center gap-3 ${
      s.isPrimary ? 'border-forest-400 bg-forest-50/40' : 'border-parchment-300/60 bg-parchment-100/40'
    }`}>
      <span className="text-forest-700/60 font-display tabular w-6 text-xs">#{i + 1}</span>
      <NutrientChip axis={s.crop.nutrient} />
      <span className={`font-display text-base ${s.isPrimary ? 'text-forest-900 font-semibold' : 'text-forest-900'}`}>
        {s.crop.name}
      </span>
      {s.isPrimary && (
        <span className="text-[10px] uppercase tracking-wider font-mono text-forest-700 bg-forest-100/60 border border-forest-300/40 px-1.5 py-0.5 rounded">
          primary
        </span>
      )}
      <span className="ml-auto tabular text-xs text-ink-700">
        plant <strong>day {s.plantDay}</strong> ({dateLabel(s.plantDay, dpm)}) → harvest <strong>day {s.harvestDay}</strong> ({dateLabel(s.harvestDay, dpm)})
      </span>
      <span className="tabular text-xs text-forest-700 w-20 text-right">+{s.satiety} sat</span>
      <span className="tabular text-[10px] text-ink-500 w-24 text-right">
        end {s.endN}/{s.endP}/{s.endK}
      </span>
    </div>
  );
}

function HalfPlan({ plan, primary, dpm, accent, label }) {
  const accentMap = {
    forest: { border: 'border-forest-300/60', bg: 'bg-forest-50/30', heading: 'text-forest-900' },
    amber: { border: 'border-amber-300/60', bg: 'bg-amber-50/30', heading: 'text-amber-900' },
  };
  const a = accentMap[accent] || accentMap.forest;
  return (
    <div className={`border-2 ${a.border} rounded p-4 ${a.bg}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-ink-500">{label}</span>
        <span className={`font-display text-base ${a.heading}`}>{primary.name} primary</span>
      </div>
      <div className="text-[11px] text-ink-600 mb-3 tabular">
        {plan.primaryCount}× {primary.name} + {plan.fillerCount} fillers &middot; {plan.totalSatiety.toLocaleString()} sat &middot; {plan.daysUsed}d used, {plan.daysRemaining}d frost-locked
      </div>
      {plan.sequence.length === 0 ? (
        <div className="text-xs text-terra-700">{primary.name} doesn't fit on this soil/season.</div>
      ) : (
        <div className="space-y-1">
          {plan.sequence.map((s, i) => (
            <div key={i} className={`px-2 py-1.5 rounded text-xs flex items-center gap-2 ${
              s.isPrimary ? 'bg-parchment-50 border border-forest-300/40' : 'bg-parchment-100/40 border border-parchment-300/30'
            }`}>
              <span className="tabular text-ink-500 w-4">#{i + 1}</span>
              <NutrientChip axis={s.crop.nutrient} />
              <span className={`font-display text-sm ${s.isPrimary ? 'font-semibold' : ''} text-forest-900`}>{s.crop.name}</span>
              <span className="ml-auto tabular text-ink-700">
                d{s.plantDay} → {s.harvestDay}
              </span>
              <span className="tabular text-forest-700 w-14 text-right">+{s.satiety}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SplitFarmVerdict({ planA, planB, primaryA, primaryB, soilTier }) {
  const total = planA.totalSatiety + planB.totalSatiety;
  const aShare = total > 0 ? Math.round((planA.totalSatiety / total) * 100) : 0;
  const bShare = 100 - aShare;
  const winner = aShare > bShare ? primaryA : primaryB;
  const winShare = Math.max(aShare, bShare);
  const lossShare = 100 - winShare;
  const stalledA = planA.totalHarvests === 0;
  const stalledB = planB.totalHarvests === 0;
  const tier = SOILS_PLANTABLE.find(s => s.val === soilTier)?.name || `tier ${soilTier}`;

  if (stalledA || stalledB) {
    const stalled = stalledA ? primaryA.name : primaryB.name;
    return <p className="text-ink-700">{stalled} can't ripen on {tier} in this season. Either pick a hardier primary for that half or upgrade to Terra Preta + greenhouse.</p>;
  }

  // Compute filler satiety per half from the actual sequence, not from
  // crop.satiety (which doesn't exist as a flat field, it depends on mode)
  const fillerSatA = planA.sequence.filter(s => !s.isPrimary).reduce((sum, s) => sum + s.satiety, 0);
  const fillerSatB = planB.sequence.filter(s => !s.isPrimary).reduce((sum, s) => sum + s.satiety, 0);
  const primarySatA = planA.totalSatiety - fillerSatA;
  const primarySatB = planB.totalSatiety - fillerSatB;
  const fillerShareA = planA.totalSatiety > 0 ? Math.round((fillerSatA / planA.totalSatiety) * 100) : 0;
  const fillerShareB = planB.totalSatiety > 0 ? Math.round((fillerSatB / planB.totalSatiety) * 100) : 0;

  return (
    <div className="text-ink-700 space-y-2">
      <p>
        <strong className="text-forest-900">Whole farm produces {total.toLocaleString()} satiety per pair of tiles per year.</strong>
        {' '}{primaryA.name} half: {planA.totalSatiety.toLocaleString()} ({aShare}%). {primaryB.name} half: {planB.totalSatiety.toLocaleString()} ({bShare}%).
        {Math.abs(aShare - bShare) >= 25
          ? <> The {winner.name} half pulls way more weight ({winShare}% vs {lossShare}%). If tile allocation is flexible, give it more space.</>
          : <> The two halves are roughly balanced.</>
        }
      </p>
      {(planA.fillerCount > 0 || planB.fillerCount > 0) && (
        <p>
          <strong className="text-forest-900">What the fillers are doing:</strong>
          {' '}On Half A, {primaryA.name} alone produces {primarySatA.toLocaleString()} sat ({100 - fillerShareA}%); the fillers add {fillerSatA.toLocaleString()} more ({fillerShareA}%).
          {' '}On Half B, {primaryB.name} alone produces {primarySatB.toLocaleString()} sat ({100 - fillerShareB}%); fillers add {fillerSatB.toLocaleString()} more ({fillerShareB}%).
          {' '}If the filler share is over 50%, the primary is producing little food relative to its tile time, and the fillers are doing the actual feeding.
        </p>
      )}
      {(primaryA.nutrient === primaryB.nutrient) && (
        <p className="text-amber-800">
          <strong>Both primaries drain the same axis ({primaryA.nutrient}).</strong> That's fine here because the tile groups are separate, but it means your farm is heavy on {primaryA.nutrient}-axis production. If you ever consolidate into a single rotation, the math flips back to the depletion problem from the rotation cycle card above.
        </p>
      )}
      <p className="text-ink-600 italic">
        Multiply both numbers by your tile count per half. If you have 100 tiles split 50/50, multiply each by 50.
      </p>
    </div>
  );
}

function YearPlanVerdict({ plan, primary, soilTier }) {
  const soilName = SOILS_PLANTABLE.find(s => s.val === soilTier)?.name;
  if (plan.primaryCount === 0) {
    return <p className="text-ink-700">Couldn't fit a single {primary.name} cycle on {soilName}. The primary either takes too long for the season or its axis recovers too slowly. Try a different primary or upgrade soil.</p>;
  }
  const fillers = plan.sequence.filter(s => !s.isPrimary).map(s => s.crop.name);
  const uniqueFillers = [...new Set(fillers)];
  if (plan.primaryCount === 1) {
    return (
      <p className="text-ink-700">
        One full {primary.name} cycle fits this season. After it harvests, the planner adds <strong>{plan.fillerCount} filler crop{plan.fillerCount === 1 ? '' : 's'}</strong> ({uniqueFillers.join(', ')}) to fill the tail with food, totaling <strong>{plan.totalSatiety.toLocaleString()} satiety</strong> on this tile for the year. {plan.daysRemaining > 14 && `Last ${plan.daysRemaining} days are frost-locked; nothing can ripen there.`}
      </p>
    );
  }
  return (
    <p className="text-ink-700">
      <strong>{plan.primaryCount} {primary.name} cycles</strong> fit this season, separated by <strong>{plan.fillerCount} filler crop{plan.fillerCount === 1 ? '' : 's'}</strong> ({uniqueFillers.join(', ')}) that drain different axes so {primary.nutrient} recovers in time for the next cycle. Total <strong>{plan.totalSatiety.toLocaleString()} satiety</strong> from the food output, on top of the {primary.name} you actually need. {plan.daysRemaining > 14 && `Last ${plan.daysRemaining} days frost out.`}
    </p>
  );
}

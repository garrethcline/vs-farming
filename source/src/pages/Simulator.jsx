// Simulator. Pick a crop, plant date, soil tier, and see stage-by-stage projection.
// Inputs match the Decision tab so the projection is accurate, not a default.
import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import {
  Card, CardHeader, CardBody, Reveal, Stat, Toggle, NutrientChip, Flourish,
  StatusBadge,
} from '../components/ui/Primitives.jsx';
import { CROPS, CROPS_LIST, growDays as cropGrowDays, drainPerStage } from '../data/crops.js';
import { SOILS_PLANTABLE, GAME, FERTILIZERS } from '../data/game.js';
import {
  climateAt, climateWindow, dayLabel, dateLabel, dateParts, dayFromDate,
  daysPerYear, MONTH_NAMES, SEASON_END_DAY, TICKS_PER_DAY,
} from '../data/climate.js';
import { useClimate } from '../lib/useClimate.js';
import { useChartColors } from '../lib/useTheme.js';
import { useSettings } from '../lib/storage.js';
import {
  nutrientFactor, damageRisk, damageMultiplier,
  rainfallGrowRange, lightGrowthFactor, dailyGrowthChance,
} from '../lib/mechanics.js';
import { effectivePool } from '../lib/decisionScore.js';
import { classProduceYieldMul } from '../data/specializedClasses.js';
import LocationPicker from '../components/LocationPicker.jsx';

export default function SimulatorPage() {
  const { climate: CLIMATE } = useClimate();
  const cc = useChartColors();
  const [settings] = useSettings();
  const [cropKey, setCropKey] = useState('carrot');
  const [plantDay, setPlantDay] = useState(40);
  const [soilTier, setSoilTier] = useState(settings.defaultSoil ?? 50);
  const [greenhouse, setGreenhouse] = useState(false);
  const [waterDistance, setWaterDistance] = useState(1);
  // Per-axis current nutrients. Default to soil tier so changing the soil
  // dropdown still updates the math. Editing any axis decouples it from soil.
  const [nutOverride, setNutOverride] = useState(false);
  const [curN, setCurN] = useState(settings.defaultSoil ?? 50);
  const [curP, setCurP] = useState(settings.defaultSoil ?? 50);
  const [curK, setCurK] = useState(settings.defaultSoil ?? 50);
  // Slow-release pool (per axis), 0-150.
  const [poolN, setPoolN] = useState(0);
  const [poolP, setPoolP] = useState(0);
  const [poolK, setPoolK] = useState(0);
  // Fertilizer: which one and whether to apply at plant time.
  const [willFert, setWillFert] = useState(false);
  const [fertKey, setFertKey] = useState('none');

  const crop = CROPS[cropKey];
  const baseGrowDays = cropGrowDays(crop, settings.daysPerMonth, settings.worldConfig?.cropGrowthRateMul ?? 1.0);

  // If nutrients are not overridden, every axis follows soil tier.
  const useN = nutOverride ? curN : soilTier;
  const useP = nutOverride ? curP : soilTier;
  const useK = nutOverride ? curK : soilTier;

  // Effective pool with any fertilizer applied.
  const pool = effectivePool(poolN, poolP, poolK, fertKey, willFert);

  // The crop drains a specific axis. Pull starting nutrient + pool for that axis.
  const startNutrient = crop.nutrient === 'N' ? useN : crop.nutrient === 'P' ? useP : useK;
  const startPool     = crop.nutrient === 'N' ? pool.n : crop.nutrient === 'P' ? pool.p : pool.k;

  // Per-stage moisture/light multipliers. Greenhouse blocks rain but assumes
  // an internal water source, so range collapses to a flat ~0.97. Light = 1.0
  // for greenhouse (glass roof) and outdoor at sea level / full daylight.
  const moistRange = rainfallGrowRange(
    settings.rainfallFrequency || 'common',
    waterDistance,
    greenhouse,
  );
  const lightF = greenhouse ? 1.0 : lightGrowthFactor({
    underground: false, lightLevel: 22, depthBelowSea: 0,
    allowUnderground: !!settings.allowUndergroundFarming,
  });

  // SC mod yield multiplier. Carries over from Settings.
  const classYieldMul = classProduceYieldMul(settings.playerClass || 'commoner', crop);

  // Stage-by-stage simulation. Walks day-by-day applying the per-tick
  // growthChance from temperature (1 + (T-10)*0.1, clamped 0-1) along with
  // nutrientFactor, moistF and lightF. Stage progress accumulates day-by-day.
  // When a stage completes, we record day/temp/nutrient at that moment so the
  // chart shows accurate stage transitions. This is the same algorithm as
  // scoreCrop's effectiveGrowDays so headline numbers match the Dashboard /
  // Decision / Calendar tabs.
  const sim = useMemo(() => {
    const drainPerStageVal = drainPerStage(crop);
    const stagesN = crop.stages;
    const baseDaysPerStage = baseGrowDays / Math.max(1, stagesN - 1);

    function runOne(moistF) {
      const stages = [];
      let nutrient = startNutrient;
      let poolRemaining = startPool;
      let cumulativeDay = plantDay;
      let stageProgress = 0;     // baseline-rate days accumulated this stage
      let stage = 0;             // 0-indexed
      let stalled = false;
      let safety = 0;
      const SAFETY_DAYS = 365 * 2;

      // Record stage 1 starting state
      const firstC = climateAt(cumulativeDay, greenhouse);
      const firstGc = dailyGrowthChance(firstC);
      const firstNf = nutrientFactor(nutrient);
      const firstRate = firstGc * firstNf * moistF * lightF;
      stages.push({
        stage: 1,
        day: Math.round(cumulativeDay * 10) / 10,
        nutrient: Math.round(nutrient * 10) / 10,
        temp: firstC.avg,
        growthChance: firstGc,
        nutrientFactor: firstNf,
        effectiveDays: 0,        // filled in below as the stage closes out
        stalled: firstRate < 0.01,
      });

      const stageStartDay = [cumulativeDay];   // when each stage started

      while (stage < stagesN - 1) {
        if (safety++ > SAFETY_DAYS * 4) { stalled = true; break; }

        const c = climateAt(cumulativeDay, greenhouse);
        const gc = dailyGrowthChance(c);
        const nf = nutrientFactor(nutrient);
        const rate = gc * nf * moistF * lightF;

        if (rate < 0.001 && cumulativeDay - plantDay > SAFETY_DAYS) {
          stalled = true;
          break;
        }

        if (rate <= 0) {
          // Day paused (cold). Advance one day with no progress.
          cumulativeDay += 1;
          continue;
        }

        const stageRemaining = baseDaysPerStage - stageProgress;
        const daysToFinishStage = stageRemaining / rate;

        if (daysToFinishStage <= 1.0) {
          // Stage transitions partway through this day
          const partialDay = daysToFinishStage;
          cumulativeDay += partialDay;

          const ticks = partialDay * TICKS_PER_DAY;
          const drip = Math.min(poolRemaining, GAME.slowReleasePerTick * ticks);
          poolRemaining = Math.max(0, poolRemaining - drip);
          nutrient = Math.max(0, nutrient - drainPerStageVal + drip);

          // Close this stage and open the next
          stages[stages.length - 1].effectiveDays = cumulativeDay - stageStartDay[stage];
          stage++;
          stageProgress = 0;
          stageStartDay.push(cumulativeDay);

          if (stage < stagesN - 1) {
            // Sample for the new stage's starting state
            const c2 = climateAt(cumulativeDay, greenhouse);
            const gc2 = dailyGrowthChance(c2);
            const nf2 = nutrientFactor(nutrient);
            const rate2 = gc2 * nf2 * moistF * lightF;
            stages.push({
              stage: stage + 1,
              day: Math.round(cumulativeDay * 10) / 10,
              nutrient: Math.round(nutrient * 10) / 10,
              temp: c2.avg,
              growthChance: gc2,
              nutrientFactor: nf2,
              effectiveDays: 0,
              stalled: rate2 < 0.01,
            });
          } else {
            // Final stage = ripe. Record end state but no further progress.
            stages.push({
              stage: stage + 1,
              day: Math.round(cumulativeDay * 10) / 10,
              nutrient: Math.round(nutrient * 10) / 10,
              temp: climateAt(cumulativeDay, greenhouse).avg,
              growthChance: 1,
              nutrientFactor: nutrientFactor(nutrient),
              effectiveDays: 0,
              stalled: false,
            });
          }
        } else {
          // Move forward one full day
          stageProgress += rate;
          cumulativeDay += 1;
          const drip = Math.min(poolRemaining, GAME.slowReleasePerTick * TICKS_PER_DAY);
          poolRemaining = Math.max(0, poolRemaining - drip);
        }
      }

      const lastDay = stages[stages.length - 1].day;
      return { stages, stalled, harvestDay: lastDay, growDays: lastDay - plantDay };
    }

    const expected = runOne(moistRange.expected);
    const fast = runOne(moistRange.max);
    const slow = runOne(moistRange.min);

    return {
      stages: expected.stages,
      stalled: expected.stalled,
      effectiveHarvestDay: expected.harvestDay,
      effectiveGrowDays: expected.growDays,
      minHarvestDay: fast.stalled ? null : Math.round(fast.harvestDay),
      maxHarvestDay: slow.stalled ? null : Math.round(slow.harvestDay),
      moistRange,
      lightF,
    };
  }, [crop, plantDay, startNutrient, startPool, greenhouse, baseGrowDays, moistRange, lightF, CLIMATE]);

  const harvestDay = sim.effectiveHarvestDay;
  const effectiveGrowDays = sim.effectiveGrowDays;
  const slowdownPct = Math.round((effectiveGrowDays / baseGrowDays - 1) * 100);
  const window = climateWindow(plantDay, effectiveGrowDays, greenhouse);
  const risk = damageRisk(crop, window.min, window.max, {
    climate: CLIMATE, plantDay, growDays: effectiveGrowDays, greenhouse,
  });
  const damMul = damageMultiplier(crop, risk);
  const expectedYield = crop.yield * damMul * classYieldMul;

  const stages = sim.stages;

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="section-eyebrow text-forest-700">§8 · Simulator</div>
            <h2 className="heading-display text-4xl md:text-5xl mt-2">
              <span className="heading-italic">What if</span> I plant…
            </h2>
            <p className="mt-3 text-ink-700 max-w-2xl">
              Run one crop in detail, stage by stage. Pick the planting date, soil tier, and any
              current-nutrient overrides if your plot isn't fresh. Fertilizer, slow-release pool,
              water distance, and greenhouse all factor in. Rainfall and player class come from Settings.
              The stage-time math matches{' '}
              <code className="font-mono text-xs bg-parchment-200/50 px-1.5 py-0.5 rounded">BEFarmland.cs</code>{' '}
              but uses expected values (no per-stage random jitter), so a real plot may finish ±10% off the projected day.
            </p>
          </div>
          <LocationPicker />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader title="Configure" subtitle={
            settings.playerClass && settings.playerClass !== 'commoner'
              ? `Class: ${settings.playerClass}. Yield × ${classYieldMul.toFixed(2)} applied.`
              : 'Class: Commoner (vanilla). Change in Settings if you use Specialized Classes.'
          } />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Crop">
                <select className="select-field" value={cropKey} onChange={(e) => setCropKey(e.target.value)}>
                  {CROPS_LIST.map(c => (<option key={c.key} value={c.key}>{c.name} ({c.nutrient})</option>))}
                </select>
              </Field>
              <Field label="Plant date" hint={`Day ${plantDay}. Drain axis: ${crop.nutrient}.`}>
                {(() => {
                  const dpm = settings.daysPerMonth || 9;
                  const parts = dateParts(plantDay, dpm) || { monthIdx: 0, dayOfMonth: 1, year: 1 };
                  return (
                    <div className="flex items-center gap-2">
                      <select
                        className="select-field flex-1"
                        value={parts.monthIdx + 1}
                        onChange={(e) => setPlantDay(dayFromDate(parseInt(e.target.value), parts.dayOfMonth, parts.year, dpm))}
                      >
                        {MONTH_NAMES.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                      </select>
                      <input
                        type="number" min="1" max={dpm} className="input-field tabular w-20"
                        value={parts.dayOfMonth}
                        onChange={(e) => {
                          const dom = Math.max(1, Math.min(dpm, parseInt(e.target.value) || 1));
                          setPlantDay(dayFromDate(parts.monthIdx + 1, dom, parts.year, dpm));
                        }}
                      />
                    </div>
                  );
                })()}
              </Field>
              <Field label="Soil tier" hint="Sets starting nutrients on all 3 axes unless overridden below.">
                <select className="select-field" value={soilTier} onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setSoilTier(v);
                  if (!nutOverride) { setCurN(v); setCurP(v); setCurK(v); }
                }}>
                  {SOILS_PLANTABLE.map(s => (<option key={s.key} value={s.val}>{s.name} ({s.val})</option>))}
                </select>
              </Field>
              <Field label="Greenhouse">
                <Toggle checked={greenhouse} onChange={setGreenhouse} label={greenhouse ? 'On (+5°C, no rain, water assumed)' : 'Off'} />
              </Field>
              <Field label="Water distance" hint="Chebyshev blocks. 1 = touching water (floor 0.75), 4+ = no moisture floor.">
                <select className="select-field" value={waterDistance} onChange={(e) => setWaterDistance(parseInt(e.target.value))} disabled={greenhouse}>
                  <option value={1}>1 (touching, floor 0.75)</option>
                  <option value={2}>2 (floor 0.50)</option>
                  <option value={3}>3 (floor 0.25)</option>
                  <option value={4}>4+ (rainfall only)</option>
                </select>
              </Field>
              <Field label="Rainfall (from Settings)" hint="Set in Settings. Greenhouse ignores this.">
                <input type="text" className="input-field tabular bg-parchment-200/30" disabled
                  value={settings.rainfallFrequency || 'common'} />
              </Field>
            </div>

            <div className="mt-5 pt-4 border-t border-parchment-300/50">
              <div className="flex items-center justify-between mb-3">
                <div className="section-eyebrow text-forest-700">Current soil nutrients</div>
                <Toggle
                  checked={nutOverride}
                  onChange={(v) => {
                    setNutOverride(v);
                    if (v) { setCurN(soilTier); setCurP(soilTier); setCurK(soilTier); }
                  }}
                  label={nutOverride ? 'Custom (per-axis)' : 'Match soil tier'}
                />
              </div>
              {nutOverride && (
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Field label="N">
                    <input type="number" min="0" max="100" className="input-field tabular"
                      value={curN} onChange={(e) => setCurN(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} />
                  </Field>
                  <Field label="P">
                    <input type="number" min="0" max="100" className="input-field tabular"
                      value={curP} onChange={(e) => setCurP(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} />
                  </Field>
                  <Field label="K">
                    <input type="number" min="0" max="100" className="input-field tabular"
                      value={curK} onChange={(e) => setCurK(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} />
                  </Field>
                </div>
              )}

              <div className="section-eyebrow text-forest-700 mb-2">Slow-release pool (0-150 per axis)</div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Field label="Pool N">
                  <input type="number" min="0" max="150" className="input-field tabular"
                    value={poolN} onChange={(e) => setPoolN(Math.max(0, Math.min(150, parseInt(e.target.value) || 0)))} />
                </Field>
                <Field label="Pool P">
                  <input type="number" min="0" max="150" className="input-field tabular"
                    value={poolP} onChange={(e) => setPoolP(Math.max(0, Math.min(150, parseInt(e.target.value) || 0)))} />
                </Field>
                <Field label="Pool K">
                  <input type="number" min="0" max="150" className="input-field tabular"
                    value={poolK} onChange={(e) => setPoolK(Math.max(0, Math.min(150, parseInt(e.target.value) || 0)))} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Apply fertilizer">
                  <Toggle checked={willFert} onChange={setWillFert} label={willFert ? 'Yes (adds to pool)' : 'No'} />
                </Field>
                <Field label="Fertilizer type">
                  <select className="select-field" value={fertKey} onChange={(e) => setFertKey(e.target.value)} disabled={!willFert}>
                    {Object.entries(FERTILIZERS).map(([k, f]) => (
                      <option key={k} value={k}>
                        {f.name} {k !== 'none' ? `(N+${f.n} P+${f.p} K+${f.k})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {willFert && fertKey !== 'none' && (
                <div className="mt-3 px-3 py-2 rounded-md bg-forest-100/30 text-xs text-ink-700">
                  Effective starting pool for {crop.nutrient}: <strong className="tabular text-forest-900">{startPool.toFixed(0)}</strong>
                  {' '}(was {(crop.nutrient === 'N' ? poolN : crop.nutrient === 'P' ? poolP : poolK)},
                  fertilizer added {(FERTILIZERS[fertKey] || {})[crop.nutrient.toLowerCase()] || 0}, capped at {GAME.poolMax}).
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader
            title={`${crop.name} planted ${dateLabel(plantDay, settings.daysPerMonth)}`}
            subtitle={
              sim.stalled
                ? `Required nutrient: ${crop.nutrient} · GROWTH STALLS at this soil + climate. Crop won't finish.`
                : `Required nutrient: ${crop.nutrient} · ${effectiveGrowDays.toFixed(1)} days to harvest at this soil ${slowdownPct === 0 ? '(ideal pace)' : slowdownPct > 0 ? `(${slowdownPct}% slower than ideal ${baseGrowDays.toFixed(1)}d)` : `(${Math.abs(slowdownPct)}% faster than nominal)`}`
            }
          />
          <CardBody>
            {sim.stalled && (
              <div className="mb-4 px-4 py-3 rounded-md border-l-4 border-l-terra-500 bg-terra-300/15 text-sm text-ink-700">
                <strong className="text-terra-700">Growth stalls.</strong>{' '}
                One or more stages have nutrient + temperature low enough that the per-tick advance probability is effectively zero. Either bring the soil up (use Compost, apply fertilizer, or pick a richer soil tier) or replant when temperatures rise.
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Stat
                label="Harvest day"
                value={
                  sim.stalled ? '·'
                  : (sim.minHarvestDay !== null && sim.maxHarvestDay !== null && sim.minHarvestDay !== sim.maxHarvestDay)
                    ? `${sim.minHarvestDay}…${sim.maxHarvestDay}`
                    : Math.round(harvestDay)
                }
                sub={
                  sim.stalled ? 'will not finish'
                  : (sim.minHarvestDay !== null && sim.maxHarvestDay !== null && sim.minHarvestDay !== sim.maxHarvestDay)
                    ? `expected ${Math.round(harvestDay)} (${dateLabel(Math.round(harvestDay), settings.daysPerMonth)}) · ${effectiveGrowDays.toFixed(1)}d`
                    : `${dateLabel(Math.round(harvestDay), settings.daysPerMonth)} · ${effectiveGrowDays.toFixed(1)}d total`
                }
                accent={sim.stalled ? 'text-terra-700' : 'text-forest-900'}
              />
              <Stat
                label="Pace vs ideal"
                value={sim.stalled ? 'stalled' : `${(baseGrowDays / Math.max(0.1, effectiveGrowDays)).toFixed(1)}×`}
                sub={sim.stalled ? '0× growth' : slowdownPct === 0 ? 'matches base' : slowdownPct > 0 ? `${slowdownPct}% behind` : `${Math.abs(slowdownPct)}% ahead`}
                accent={sim.stalled ? 'text-terra-700' : slowdownPct > 25 ? 'text-amber-700' : slowdownPct < 0 ? 'text-forest-900' : 'text-ink-700'}
              />
              <Stat label="Window min" value={`${window.min.toFixed(1)}°`} sub={`crop limit ${crop.cold ?? GAME.defaultCold}°`} accent={risk.coldDamage > 0 ? 'text-terra-700' : 'text-forest-900'} />
              <Stat label="Window max" value={`${window.max.toFixed(1)}°`} sub={`crop limit ${crop.heat >= 9999 ? '∞' : crop.heat}°`} accent={risk.heatDamage > 0 ? 'text-terra-700' : 'text-forest-900'} />
              <Stat label="Expected yield" value={expectedYield.toFixed(1)} sub={`base ${crop.yield} × ${damMul} dmg${classYieldMul !== 1 ? ` × ${classYieldMul.toFixed(2)} class` : ''}`} accent={damMul < 1 ? 'text-amber-700' : 'text-forest-900'} />
            </div>

            <div className="section-eyebrow mb-2">Temperature window</div>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={CLIMATE.slice(plantDay - 1, Math.min(CLIMATE.length, Math.round(harvestDay)))}>
                  <CartesianGrid strokeDasharray="2 4" stroke={cc.grid} />
                  <XAxis dataKey="d" tick={{ fontSize: 10, fill: cc.axisText }} />
                  <YAxis tick={{ fontSize: 10, fill: cc.axisText }} unit="°" />
                  <Tooltip />
                  <ReferenceLine y={crop.cold ?? GAME.defaultCold} stroke="#BC4749" strokeDasharray="3 3" label={{ value: 'cold limit', fontSize: 9, fill: cc.today }} />
                  {crop.heat < 9999 && <ReferenceLine y={crop.heat} stroke="#DDA15E" strokeDasharray="3 3" label={{ value: 'heat limit', fontSize: 9, fill: '#DDA15E' }} />}
                  <Line type="monotone" dataKey="min" stroke="#52796F" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                  <Line type="monotone" dataKey="max" stroke="#BC4749" strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                  <Line type="monotone" dataKey="avg" stroke={cc.avgLine} strokeWidth={2.5} dot={false} isAnimationActive={false}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="section-eyebrow mb-2">Stage-by-stage projection</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment-300/60 bg-parchment-200/30">
                    <th className="px-3 py-2 text-left section-eyebrow">Stage</th>
                    <th className="px-3 py-2 text-left section-eyebrow">Day</th>
                    <th className="px-3 py-2 text-left section-eyebrow">Temp (avg)</th>
                    <th className="px-3 py-2 text-left section-eyebrow">{crop.nutrient} level</th>
                    <th className="px-3 py-2 text-left section-eyebrow">Growth chance</th>
                    <th className="px-3 py-2 text-left section-eyebrow">Nutrient factor</th>
                    <th className="px-3 py-2 text-left section-eyebrow">Stage takes</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map(s => (
                    <tr key={s.stage} className="border-b border-parchment-300/30">
                      <td className="px-3 py-2 font-display text-base text-forest-900">{s.stage}</td>
                      <td className="px-3 py-2 tabular text-ink-700">{s.day}</td>
                      <td className="px-3 py-2 tabular text-ink-700">{s.temp.toFixed(1)}°</td>
                      <td className="px-3 py-2 tabular text-ink-700">{s.nutrient}</td>
                      <td className="px-3 py-2 tabular text-ink-700">
                        <span className={s.growthChance < 0.5 ? 'text-terra-700' : s.growthChance < 0.8 ? 'text-amber-700' : 'text-forest-900'}>
                          {(s.growthChance * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular text-ink-700">
                        <span className={s.nutrientFactor < 0.6 ? 'text-terra-700' : s.nutrientFactor < 1.0 ? 'text-amber-700' : 'text-forest-900'}>
                          {s.nutrientFactor.toFixed(2)}×
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular text-ink-700">
                        {s.stage === stages.length ? (
                          <span className="text-ink-400 italic">harvest</span>
                        ) : s.stalled ? (
                          <span className="text-terra-700 font-medium">stalls</span>
                        ) : (
                          <span className={s.effectiveDays > 3 ? 'text-amber-700' : 'text-ink-700'}>
                            {s.effectiveDays.toFixed(1)}d
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}


function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-600 mt-1 italic">{hint}</p>}
    </div>
  );
}

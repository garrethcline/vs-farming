// Plantings page. Track active farms as planting BATCHES, not individual plots.
// A "planting" is one entry like "30 carrots planted day 84 on Medium soil".
// The page focuses on three questions:
//   1. When will each batch ripen?
//   2. What should I rotate to next on that soil?
//   3. Will the soil have regenerated enough to replant?
//
// Owner is kept in the edit panel for those who want it but de-emphasized.
// Math runs once per planting (per-tile drain, harvest day) and the same
// numbers are shown for the whole batch since all tiles in a batch share
// soil tier, plant day, and conditions.
import { useState, useMemo, useEffect } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Toggle, NutrientChip, StatusBadge, Flourish,
} from '../components/ui/Primitives.jsx';
import { usePlots, useSettings, useActivity, useGameClock } from '../lib/storage.js';
import { CROPS, CROPS_LIST, growDays as cropGrowDays } from '../data/crops.js';
import { SOILS_PLANTABLE } from '../data/game.js';
import { daysPerYear, SEASON_END_DAY, dateLabel, dayLabel } from '../data/climate.js';
import { useClimate } from '../lib/useClimate.js';
import { useChartColors } from '../lib/useTheme.js';
import {
  effectiveGrowDays, harvestDayRange, rainfallGrowRange, lightGrowthFactor,
  simulateNutrientRecovery, simulateCropDamage,
} from '../lib/mechanics.js';
import { rankCrops } from '../lib/decisionScore.js';
import LocationPicker from '../components/LocationPicker.jsx';
import FrostBanner from '../components/FrostBanner.jsx';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceArea, ReferenceLine, Legend,
} from 'recharts';

// Planting harvest math. Climate-aware: per-day temperature growth chance
// stretches grow time when planted late in summer.
function plantingHarvest(p, settings, climate = null) {
  if (!p.crop || p.plantDay === null) return null;
  const crop = CROPS[p.crop];
  if (!crop) return null;
  const baseGrowDays = cropGrowDays(crop, settings.daysPerMonth, settings.worldConfig?.cropGrowthRateMul ?? 1.0);
  const startNutrient =
    crop.nutrient === 'N' ? p.n :
    crop.nutrient === 'P' ? p.p : p.k;
  const startPool =
    crop.nutrient === 'N' ? (p.poolN || 0) :
    crop.nutrient === 'P' ? (p.poolP || 0) : (p.poolK || 0);

  const moistRange = rainfallGrowRange(
    settings.rainfallFrequency || 'common',
    p.waterDistance ?? 1,
    !!p.greenhouse,
  );
  const lightF = p.greenhouse ? 1.0 : lightGrowthFactor({
    underground: !!p.underground,
    lightLevel: p.lightLevel ?? 22,
    depthBelowSea: p.depthBelowSea ?? 0,
    allowUnderground: !!settings.allowUndergroundFarming,
  });
  const climateForSim = (climate && p.greenhouse)
    ? climate.map(c => ({ ...c, avg: c.avg + 5, min: c.min + 5, max: c.max + 5 }))
    : climate;

  const range = harvestDayRange(crop, baseGrowDays, startNutrient, startPool, moistRange, lightF, p.plantDay, climateForSim);
  if (range.stalled) return { day: null, days: Infinity, stalled: true, baseGrowDays, crop };
  // Damage check: walks the actual climate window day-by-day with the
  // game's leaky-bucket accumulator. willDie when temp stays past
  // cold/heat threshold for >48 cumulative hours; flagged when the
  // threshold is crossed at all (drops × 0.5 on harvest).
  const damage = climateForSim && climateForSim.length > 0
    ? simulateCropDamage(crop, p.plantDay, range.expected, climateForSim, !!p.greenhouse)
    : null;
  return {
    day: Math.round(p.plantDay + range.expected),
    minDay: Math.round(p.plantDay + range.min),
    maxDay: Math.round(p.plantDay + range.max),
    days: range.expected,
    minDays: range.min,
    maxDays: range.max,
    stalled: false,
    baseGrowDays,
    crop,
    damage,
  };
}

// Compute 3 best follow-up crops to plant on this same soil after harvest.
// Filters out the just-harvested crop's nutrient axis (rotation discipline)
// and ranks by score for the post-harvest plant day.
function followUpSuggestions(planting, harvestDay, settings) {
  if (!planting.crop || harvestDay === null || harvestDay > daysPerYear() * 2) return [];
  const justHarvested = CROPS[planting.crop];
  if (!justHarvested) return [];

  // After harvest, the just-grown axis is drained; the OTHER two are still
  // near soil cap. Estimate post-harvest nutrient state:
  const cap = planting.soil ?? 50;
  const drainedAxis = justHarvested.nutrient;
  const postN = drainedAxis === 'N' ? Math.max(0, cap - justHarvested.cons) : cap;
  const postP = drainedAxis === 'P' ? Math.max(0, cap - justHarvested.cons) : cap;
  const postK = drainedAxis === 'K' ? Math.max(0, cap - justHarvested.cons) : cap;

  const ranked = rankCrops({
    today: harvestDay,
    daysPerMonth: settings.daysPerMonth,
    soilTier: cap,
    greenhouse: !!planting.greenhouse,
    playerClass: settings.playerClass || 'commoner',
    satietyMode: settings.satietyMode,
    willFert: false,
    fertKey: 'none',
    curN: postN, curP: postP, curK: postK,
    poolN: 0, poolP: 0, poolK: 0,
    prevNutrient: drainedAxis,
    seasonEndDay: SEASON_END_DAY,
    rainfallFrequency: settings.rainfallFrequency || 'common',
    waterDistance: planting.waterDistance ?? 1,
    underground: !!planting.underground,
    lightLevel: planting.lightLevel ?? 22,
    depthBelowSea: planting.depthBelowSea ?? 0,
    allowUndergroundFarming: !!settings.allowUndergroundFarming,
    weights: settings.weights,
    categoryBoosts: settings.categoryBoosts,
  });

  // Take top 3 that aren't outright failing. Don't filter same-axis crops
  // entirely (the user might still want to plant rye-after-rye if that's
  // what they have); instead let the rotation factor's score penalty surface.
  return ranked
    .filter(r => !r.stalled && r.frost > 0 && r.totalSatiety > 0)
    .slice(0, 3);
}

// Same-axis regen check: how many days until the just-drained axis regens
// enough to support a fresh planting of the same crop (or any same-axis crop).
function regenDaysForSameAxis(planting, harvestDay, climate) {
  if (!planting.crop || harvestDay === null) return null;
  const crop = CROPS[planting.crop];
  if (!crop) return null;
  const cap = planting.soil ?? 50;
  const drainedAxis = crop.nutrient;
  const postLevel = Math.max(0, cap - crop.cons);

  // We want to know: when does this axis recover to soil cap (or 50,
  // whichever is lower)? At 50 the nutrientFactor jumps to 0.90 (game uses
  // strict >, so 50 is at the lower-tier boundary). Above 50 you get the
  // 1.00 tier. Setting target = min(50, cap) means the planner waits just
  // long enough for the next planting to grow at decent speed, even on a
  // higher-tier soil where waiting longer would hit 1.10 above 75.
  const TARGET = Math.min(50, cap);
  if (postLevel >= TARGET) return 0;

  const sim = simulateNutrientRecovery({
    startN: drainedAxis === 'N' ? postLevel : cap,
    startP: drainedAxis === 'P' ? postLevel : cap,
    startK: drainedAxis === 'K' ? postLevel : cap,
    cap,
    tileState: 'empty',
    climate,
    startDay: harvestDay,
    daysToSimulate: 240,
  });
  const hit = sim.find(d => {
    const v = drainedAxis === 'N' ? d.n : drainedAxis === 'P' ? d.p : d.k;
    return v >= TARGET;
  });
  return hit ? hit.day - harvestDay : null;
}

export default function PlotsPage() {
  const { plots, updatePlot, addPlot, removePlot } = usePlots();
  const [settings, updateSettings] = useSettings();
  const { addEntry } = useActivity();
  const { climate: CLIMATE } = useClimate();
  const [editingId, setEditingId] = useState(null);
  const clock = useGameClock(15000);  // re-render every 15s while live

  // Auto-advance settings.today when the live game clock crosses a day.
  // Only the Plots page does this; other tabs read whatever today is set to.
  useEffect(() => {
    if (!clock) return;
    if (clock.liveDay !== settings.today) {
      updateSettings({ today: clock.liveDay });
    }
  }, [clock?.liveDay, settings.today, updateSettings]);

  const dpm = settings.daysPerMonth || 9;

  // Compute harvest data for all plantings, then sort chronologically
  const plantings = useMemo(() => {
    return plots.map(p => {
      const harvest = plantingHarvest(p, settings, CLIMATE);
      const status = plantingStatusOf(p, harvest, settings.today);
      const ready = harvest && !harvest.stalled && (harvest.day - settings.today) <= 5;
      const followUps = ready ? followUpSuggestions(p, harvest?.day ?? null, settings) : [];
      const regenDays = ready ? regenDaysForSameAxis(p, harvest?.day ?? null, CLIMATE) : null;
      return { p, harvest, status, ready, followUps, regenDays };
    }).sort((a, b) => {
      // Empties last; stalled before ripe before growing (most actionable first)
      if (!a.p.crop && b.p.crop) return 1;
      if (a.p.crop && !b.p.crop) return -1;
      if (a.harvest?.stalled && !b.harvest?.stalled) return -1;
      if (!a.harvest?.stalled && b.harvest?.stalled) return 1;
      const aDay = a.harvest?.day ?? Infinity;
      const bDay = b.harvest?.day ?? Infinity;
      return aDay - bDay;
    });
  }, [plots, settings, CLIMATE]);

  function harvestPlanting(p) {
    addEntry('harvested', `Harvested ${p.count || 1} × ${CROPS[p.crop]?.name || p.crop} from ${p.id}`);
    updatePlot(p.id, { crop: '', plantDay: null });
  }

  function clonePlanting(p) {
    // Add a duplicate of this planting with crop cleared, ready for replanting
    const newCount = p.count || 1;
    addPlot();
    // The fresh plot from addPlot has default values; we'll let the user
    // pick the new crop. The intent is "I'm done with this batch, give me
    // a fresh one to enter the replacement". Easier than editing in place.
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="section-eyebrow text-forest-700">§3 · Plantings</div>
            <h2 className="heading-display text-4xl md:text-5xl mt-2">
              <span className="heading-italic">When</span> will it ripen, what comes <span className="heading-italic">next</span>
            </h2>
            <p className="mt-3 text-ink-600 max-w-3xl">
              Track planting batches, not individual tiles. A row is a crop + plant day + soil tier with a count of tiles. The page sorts by upcoming harvest so you can see what ripens first, and surfaces follow-up rotation picks the moment a batch is about to come in.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <LocationPicker />
            <FrostBanner compact />
            <button onClick={addPlot} className="btn-primary">+ Add planting</button>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.03}>
        <GameClockCard clock={clock} settings={settings} updateSettings={updateSettings} dpm={dpm} />
      </Reveal>

      {plantings.length === 0 && (
        <Reveal delay={0.05}>
          <Card>
            <CardBody>
              <div className="text-center py-8 text-ink-500">
                <div className="text-base font-medium text-forest-900 mb-1">No plantings yet</div>
                <div className="text-sm">Click "+ Add planting" above. Each entry is a batch: a count of tiles all planted on the same day with the same crop and soil tier.</div>
              </div>
            </CardBody>
          </Card>
        </Reveal>
      )}

      {plantings.length > 0 && (
        <Reveal delay={0.05}>
          <UpcomingTimeline plantings={plantings} dpm={dpm} today={settings.today} />
        </Reveal>
      )}

      <Reveal delay={0.1}>
        <div className="space-y-4">
          {plantings.map(({ p, harvest, status, ready, followUps, regenDays }) => {
            const crop = p.crop ? CROPS[p.crop] : null;
            const isEditing = editingId === p.id;
            const count = p.count ?? 1;
            return (
              <Card key={p.id}>
                <CardBody>
                  {/* Top row: crop name, count, harvest date, actions */}
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-display text-2xl text-forest-900/40 tabular">{p.id}</span>
                      {crop ? (
                        <>
                          <span className="font-display text-xl text-forest-900">{count} × {crop.name}</span>
                          <NutrientChip axis={crop.nutrient} />
                          <span className="text-xs text-ink-500">on {SOILS_PLANTABLE.find(s => s.val === p.soil)?.name ?? p.soil}</span>
                        </>
                      ) : (
                        <span className="font-display text-xl text-ink-500 italic">empty planting</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge level={status.level}>{status.label}</StatusBadge>
                      {crop && p.plantDay !== null && (
                        <button onClick={() => harvestPlanting(p)} className="btn-primary !py-1.5 !px-3 !text-xs">
                          Mark harvested
                        </button>
                      )}
                      <button onClick={() => setEditingId(isEditing ? null : p.id)} className="btn-secondary !py-1.5 !px-3 !text-xs">
                        {isEditing ? 'Done' : 'Edit'}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Remove ${p.id}?`)) removePlot(p.id); }}
                        className="text-xs text-terra-700 hover:text-terra-900 px-2"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Summary line: plant day, harvest day, days to go.
                      Numbers come first because that's what the user enters
                      and what /time shows in-game. Date label is parenthetical
                      so they have it for human reference without having to
                      look it up. */}
                  {crop && p.plantDay !== null && harvest && (
                    <div className="flex items-center gap-4 flex-wrap text-sm text-ink-600 mb-3">
                      <span>Planted <strong className="text-forest-900 tabular">day {p.plantDay}</strong> <span className="text-ink-500">({dateLabel(p.plantDay, dpm)})</span></span>
                      {harvest.stalled ? (
                        <span className="text-terra-700">Stalled (won't finish before frost or nutrients dried up)</span>
                      ) : (
                        <>
                          <span>→ harvest <strong className="text-forest-900 tabular">day {harvest.day}</strong> <span className="text-ink-500">({dateLabel(harvest.day, dpm)})</span></span>
                          <span className="text-ink-500">
                            ({harvest.day - settings.today > 0 ? `in ${harvest.day - settings.today} days` : harvest.day - settings.today === 0 ? 'today' : `${settings.today - harvest.day} days overdue`})
                          </span>
                          <span className="text-ink-400">·</span>
                          <span className="text-ink-500">{harvest.days.toFixed(1)}d total</span>
                        </>
                      )}
                    </div>
                  )}
                  {harvest && harvest.damage && harvest.damage.willDie && (
                    <div className="mb-3 px-3 py-2 rounded border border-terra-300/60 bg-terra-50/60 text-sm text-terra-800">
                      <strong>Will die day {harvest.damage.deathDay}.</strong> Climate dips past {harvest.damage.peakCold > harvest.damage.peakHeat ? `cold threshold (${harvest.crop.cold}C)` : `heat threshold (${harvest.crop.heat}C)`} long enough to kill the crop. Replant after the danger window or move to a greenhouse.
                    </div>
                  )}
                  {harvest && harvest.damage && !harvest.damage.willDie && harvest.damage.flagged && (
                    <div className="mb-3 px-3 py-2 rounded border border-amber-300/60 bg-amber-50/60 text-sm text-amber-800">
                      <strong>Will be damaged.</strong> Temp crosses {harvest.damage.peakCold > 0 ? `${harvest.crop.cold}C cold` : `${harvest.crop.heat}C heat`} threshold during grow. Drops will be halved on harvest (game's damageGrowthStuntMul = 0.5).
                    </div>
                  )}

                  {/* Follow-up suggestions: shown when crop is ready or near-ready */}
                  {ready && followUps.length > 0 && (
                    <div className="mt-3 px-3 py-3 rounded border border-forest-300/40 bg-forest-50/40">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-forest-900 text-sm">Replace with</span>
                        <span className="text-xs text-ink-500">on the same {SOILS_PLANTABLE.find(s => s.val === p.soil)?.name ?? p.soil} tile after harvest</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {followUps.map((r, i) => (
                          <FollowUpRow key={r.crop.key} r={r} rank={i + 1} dpm={dpm} />
                        ))}
                      </div>
                      {regenDays !== null && regenDays > 0 && (
                        <div className="mt-2 text-xs text-amber-800 bg-amber-50/40 border border-amber-200/40 rounded px-2 py-1.5">
                          <strong>Replanting the same {crop.nutrient} crop?</strong> Soil's {crop.nutrient} axis needs ~{regenDays} days to recover to a usable level. Rotating to a different axis (above) avoids the wait.
                        </div>
                      )}
                      {regenDays === 0 && (
                        <div className="mt-2 text-xs text-forest-700">
                          Soil regen status: {crop.nutrient} axis is fine to replant immediately if you want.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Edit panel */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-parchment-300/40">
                      <PlantingEditor p={p} settings={settings} updatePlot={updatePlot} dpm={dpm} />
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <NutrientRecoveryCard />
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function plantingStatusOf(p, harvest, today) {
  if (!p.crop) return { level: 'info', label: 'empty' };
  if (p.plantDay === null) return { level: 'info', label: 'planned' };
  if (!harvest || harvest.stalled) return { level: 'severe', label: 'stalled' };
  // Damage status takes priority over time-remaining: a doomed planting is
  // more important to surface than "5 days left". Game's leaky-bucket damage
  // sim says willDie on >48h cumulative past threshold.
  if (harvest.damage?.willDie) {
    return { level: 'severe', label: 'will die' };
  }
  if (harvest.damage?.flagged) {
    // Flagged but not fatal: drops will be halved at harvest.
    const remaining = harvest.day - today;
    if (remaining < 0) return { level: 'good', label: 'overdue (damaged)' };
    if (remaining === 0) return { level: 'good', label: 'ripe today (damaged)' };
    return { level: 'warn', label: 'damaged drops' };
  }
  const remaining = harvest.day - today;
  if (remaining < 0) return { level: 'top pick', label: 'overdue' };
  if (remaining === 0) return { level: 'top pick', label: 'ripe today' };
  if (remaining <= 2) return { level: 'good', label: 'almost' };
  if (remaining <= 5) return { level: 'ok', label: `${remaining}d left` };
  return { level: 'ok', label: `growing` };
}

function FollowUpRow({ r, rank, dpm }) {
  return (
    <div className="px-2 py-1.5 rounded bg-parchment-100/60 border border-parchment-300/40 flex items-center gap-2 min-w-0">
      <span className="text-forest-700/60 font-display text-sm tabular w-4">#{rank}</span>
      <NutrientChip axis={r.crop.nutrient} />
      <div className="flex-1 min-w-0">
        <div className="font-display text-sm text-forest-900 truncate">{r.crop.name}</div>
        <div className="text-[10px] text-ink-500 truncate tabular">
          {r.growDays.toFixed(0)}d grow · score {r.score.toFixed(0)} · harvest day {r.harvestDay}
        </div>
      </div>
    </div>
  );
}

function UpcomingTimeline({ plantings, dpm, today }) {
  const active = plantings.filter(({ p, harvest }) => p.crop && harvest && !harvest.stalled);
  if (active.length === 0) return null;
  return (
    <Card>
      <CardHeader
        eyebrow="Upcoming harvests"
        title={`Next ${Math.min(active.length, 8)} ripening, in order`}
        subtitle="Sorted by harvest day. Click a planting card below for the rotation suggestions."
      />
      <CardBody>
        <div className="flex flex-col gap-1.5">
          {active.slice(0, 8).map(({ p, harvest }) => {
            const crop = CROPS[p.crop];
            const remaining = harvest.day - today;
            const tone =
              remaining < 0 ? 'text-terra-700 font-medium' :
              remaining === 0 ? 'text-forest-900 font-semibold' :
              remaining <= 5 ? 'text-amber-800' :
              'text-ink-700';
            return (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <NutrientChip axis={crop.nutrient} />
                <span className="font-display text-base text-forest-900 min-w-0 truncate flex-1">
                  {p.count ?? 1} × {crop.name}
                </span>
                <span className="text-xs text-ink-500 tabular">{p.id}</span>
                <span className={`tabular text-sm ${tone} w-32 text-right`}>
                  {remaining < 0 ? `overdue ${Math.abs(remaining)}d` :
                   remaining === 0 ? 'ripe today' :
                   `in ${remaining}d`}
                </span>
                <span className="text-xs text-ink-500 tabular w-24 text-right">
                  day {harvest.day}
                </span>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}

function PlantingEditor({ p, settings, updatePlot, dpm }) {
  const yearLen = daysPerYear();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
      <Field label="Crop">
        <select
          className="select-field"
          value={p.crop || ''}
          onChange={(e) => updatePlot(p.id, { crop: e.target.value, plantDay: e.target.value && p.plantDay === null ? settings.today : p.plantDay })}
        >
          <option value="">(empty)</option>
          {CROPS_LIST.map(c => (
            <option key={c.key} value={c.key}>{c.name} ({c.nutrient})</option>
          ))}
        </select>
      </Field>
      <Field label="Tile count">
        <input
          type="number" min="1" max="999" className="input-field tabular"
          value={p.count ?? 1}
          onChange={(e) => updatePlot(p.id, { count: Math.max(1, parseInt(e.target.value) || 1) })}
        />
      </Field>
      <Field label="Plant day (1-N)">
        <input
          type="number" min="1" max={yearLen}
          className="input-field tabular"
          value={p.plantDay ?? ''}
          onChange={(e) => updatePlot(p.id, { plantDay: e.target.value ? parseInt(e.target.value) : null })}
          placeholder={`today: ${settings.today}`}
        />
      </Field>
      <Field label="Soil tier">
        <select
          className="select-field"
          value={p.soil}
          onChange={(e) => updatePlot(p.id, { soil: parseInt(e.target.value) })}
        >
          {SOILS_PLANTABLE.map(s => (
            <option key={s.val} value={s.val}>{s.name} ({s.val})</option>
          ))}
        </select>
      </Field>
      <Field label="Greenhouse">
        <Toggle checked={p.greenhouse} onChange={(v) => updatePlot(p.id, { greenhouse: v })} label={p.greenhouse ? '+5°C' : 'Outdoor'} />
      </Field>
      <Field label="Water distance (0-4+)">
        <input
          type="number" min="0" max="10" className="input-field tabular"
          value={p.waterDistance ?? 1}
          onChange={(e) => updatePlot(p.id, { waterDistance: parseInt(e.target.value) || 0 })}
        />
      </Field>
      <Field label="N (current)">
        <input type="number" min="0" max="100" className="input-field tabular"
          value={p.n} onChange={(e) => updatePlot(p.id, { n: parseInt(e.target.value) || 0 })} />
      </Field>
      <Field label="P (current)">
        <input type="number" min="0" max="100" className="input-field tabular"
          value={p.p} onChange={(e) => updatePlot(p.id, { p: parseInt(e.target.value) || 0 })} />
      </Field>
      <Field label="K (current)">
        <input type="number" min="0" max="100" className="input-field tabular"
          value={p.k} onChange={(e) => updatePlot(p.id, { k: parseInt(e.target.value) || 0 })} />
      </Field>
      <Field label="N pool (slow-release)">
        <input type="number" min="0" max="150" className="input-field tabular"
          value={p.poolN || 0} onChange={(e) => updatePlot(p.id, { poolN: parseInt(e.target.value) || 0 })} />
      </Field>
      <Field label="P pool">
        <input type="number" min="0" max="150" className="input-field tabular"
          value={p.poolP || 0} onChange={(e) => updatePlot(p.id, { poolP: parseInt(e.target.value) || 0 })} />
      </Field>
      <Field label="K pool">
        <input type="number" min="0" max="150" className="input-field tabular"
          value={p.poolK || 0} onChange={(e) => updatePlot(p.id, { poolK: parseInt(e.target.value) || 0 })} />
      </Field>
      <Field label="Owner (optional)">
        <input type="text" className="input-field" value={p.owner || ''}
          placeholder="for shared servers"
          onChange={(e) => updatePlot(p.id, { owner: e.target.value })} />
      </Field>
      <Field label="Notes (optional)" wide>
        <input type="text" className="input-field" value={p.notes || ''}
          placeholder="anything you want to remember about this batch"
          onChange={(e) => updatePlot(p.id, { notes: e.target.value })} />
      </Field>
    </div>
  );
}

function GameClockCard({ clock, settings, updateSettings, dpm }) {
  const [editing, setEditing] = useState(false);
  const anchor = settings.realtimeAnchor;

  // Form state when editing. defaults to current settings.today / noon
  const [formDay, setFormDay] = useState(() => settings.today);
  const [formHour, setFormHour] = useState(12);
  const [formMin, setFormMin] = useState(0);

  const realMinutesPerGameDay = ((settings.realHoursPerMonth || 16) * 60) / dpm;

  function startSync() {
    setFormDay(clock?.liveDay ?? settings.today);
    setFormHour(clock?.liveHour ?? 12);
    setFormMin(clock?.liveMinute ?? 0);
    setEditing(true);
  }

  function saveSync() {
    updateSettings({
      realtimeAnchor: {
        realTimestamp: Date.now(),
        gameDay: Math.max(1, Math.floor(formDay)),
        gameHour: Math.max(0, Math.min(23, Math.floor(formHour))) + (Math.max(0, Math.min(59, Math.floor(formMin))) / 60),
      },
      today: Math.max(1, Math.floor(formDay)),
    });
    setEditing(false);
  }

  function stopSync() {
    if (!confirm('Stop syncing the game clock with real time?')) return;
    updateSettings({ realtimeAnchor: null });
    setEditing(false);
  }

  return (
    <Card>
      <CardBody className="!py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="section-eyebrow text-forest-700">Game clock</div>
            {clock ? (
              <>
                <span className="font-display text-lg text-forest-900 tabular">
                  day {clock.liveDay} at {String(clock.liveHour).padStart(2, '0')}:{String(clock.liveMinute).padStart(2, '0')}
                </span>
                <span className="text-xs text-ink-500">({dateLabel(clock.liveDay, dpm)})</span>
                <span className="text-xs text-forest-700 bg-forest-50 border border-forest-300/40 rounded px-2 py-0.5">
                  ● live
                </span>
              </>
            ) : (
              <span className="text-sm text-ink-600">
                Manual mode. Today is <strong className="tabular text-forest-900">day {settings.today}</strong>.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {clock && !editing && (
              <button onClick={stopSync} className="text-xs text-terra-700 hover:text-terra-900 px-2">
                Stop sync
              </button>
            )}
            <button onClick={editing ? () => setEditing(false) : startSync} className="btn-secondary !py-1.5 !px-3 !text-xs">
              {editing ? 'Cancel' : (clock ? 'Re-sync' : 'Sync to in-game time')}
            </button>
          </div>
        </div>

        {editing && (
          <div className="mt-3 pt-3 border-t border-parchment-300/40">
            <div className="text-xs text-ink-600 mb-2">
              Open <code className="font-mono bg-parchment-200/50 px-1 rounded">/time</code> in-game and read the current day and hour. Type those numbers in below. From then on the dashboard will auto-advance as real time passes, using your server's pace ({(realMinutesPerGameDay).toFixed(0)} real minutes per game day, derived from <code className="font-mono">daysPerMonth={dpm}</code> and <code className="font-mono">realHoursPerMonth={settings.realHoursPerMonth || 16}</code>).
            </div>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-ink-500 mb-1">Game day</label>
                <input type="number" min="1" max={daysPerYear()} className="input-field tabular w-24"
                  value={formDay} onChange={(e) => setFormDay(parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-ink-500 mb-1">Hour (0-23)</label>
                <input type="number" min="0" max="23" className="input-field tabular w-20"
                  value={formHour} onChange={(e) => setFormHour(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-ink-500 mb-1">Minute</label>
                <input type="number" min="0" max="59" className="input-field tabular w-20"
                  value={formMin} onChange={(e) => setFormMin(parseInt(e.target.value) || 0)} />
              </div>
              <button onClick={saveSync} className="btn-primary !py-1.5 !px-4">Start sync</button>
            </div>
          </div>
        )}

        {clock && !editing && (
          <div className="mt-2 text-[11px] text-ink-500 italic">
            All harvest countdowns below tick forward as real time passes. Synced at day {anchor.gameDay} hour {Math.floor(anchor.gameHour)} on {new Date(anchor.realTimestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. Speed: {realMinutesPerGameDay.toFixed(0)} real minutes per game day.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function NutrientRecoveryCard() {
  const [settings] = useSettings();
  const { climate } = useClimate();
  const cc = useChartColors();

  const [startNutrient, setStartNutrient] = useState(0);
  const [soilTier, setSoilTier] = useState(settings.defaultSoil ?? 50);
  const [tileState, setTileState] = useState('empty');
  const [growingNutrient, setGrowingNutrient] = useState('N');
  const [startDay, setStartDay] = useState(settings.today || 1);

  const yearLen = climate.length || 240;

  const sim = useMemo(() => {
    return simulateNutrientRecovery({
      startN: startNutrient,
      startP: startNutrient,
      startK: startNutrient,
      cap: soilTier,
      tileState,
      growingNutrient,
      climate,
      startDay,
      daysToSimulate: yearLen,
    });
  }, [startNutrient, soilTier, tileState, growingNutrient, climate, startDay, yearLen]);

  const fullDay = useMemo(() => {
    const r = sim.find(d => d.capped);
    return r ? r.day : null;
  }, [sim]);

  const pauseSpans = useMemo(() => {
    const spans = [];
    let start = null;
    for (const d of sim) {
      if (d.paused && start === null) start = d.day;
      if (!d.paused && start !== null) { spans.push([start, d.day - 1]); start = null; }
    }
    if (start !== null) spans.push([start, sim[sim.length - 1].day]);
    return spans;
  }, [sim]);

  const slowSpans = useMemo(() => {
    const spans = [];
    let start = null;
    for (const d of sim) {
      if (d.slow && start === null) start = d.day;
      if (!d.slow && start !== null) { spans.push([start, d.day - 1]); start = null; }
    }
    if (start !== null) spans.push([start, sim[sim.length - 1].day]);
    return spans;
  }, [sim]);

  return (
    <Card>
      <CardHeader
        eyebrow="Soil regen sim"
        title="How fast nutrients recover"
        subtitle="When soil regen pauses (cold) and slows (cool), and when each axis hits the soil tier cap. Uses your loaded climate."
      />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mb-4">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Starting nutrient</label>
            <input type="number" min="0" max="100" className="input-field tabular"
              value={startNutrient} onChange={(e) => setStartNutrient(parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Soil tier (cap)</label>
            <select className="select-field" value={soilTier} onChange={(e) => setSoilTier(parseInt(e.target.value))}>
              {SOILS_PLANTABLE.map(s => (
                <option key={s.val} value={s.val}>{s.name} ({s.val})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Tile state</label>
            <select className="select-field" value={tileState} onChange={(e) => setTileState(e.target.value)}>
              <option value="empty">empty (full regen)</option>
              <option value="growing">growing (1/3 rate on used axis)</option>
              <option value="ripe">ripe (no regen)</option>
            </select>
          </div>
          {tileState === 'growing' && (
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Crop's axis</label>
              <select className="select-field" value={growingNutrient} onChange={(e) => setGrowingNutrient(e.target.value)}>
                <option value="N">N</option>
                <option value="P">P</option>
                <option value="K">K</option>
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Start day</label>
            <input type="number" min="1" max={yearLen} className="input-field tabular"
              value={startDay} onChange={(e) => setStartDay(parseInt(e.target.value) || 1)} />
          </div>
        </div>

        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={sim} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={cc.grid} strokeDasharray="2 2" />
              {pauseSpans.map(([s, e], i) => (
                <ReferenceArea key={`p${i}`} x1={s} x2={e} y1={0} y2={100} fill="#3B82F6" fillOpacity={0.10} />
              ))}
              {slowSpans.map(([s, e], i) => (
                <ReferenceArea key={`s${i}`} x1={s} x2={e} y1={0} y2={100} fill="#F59E0B" fillOpacity={0.10} />
              ))}
              <XAxis dataKey="day" stroke={cc.tick} tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} stroke={cc.tick} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: cc.tooltipBg, border: `1px solid ${cc.tooltipBorder}`, borderRadius: 4 }}
                labelStyle={{ color: cc.tooltipText, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={soilTier} stroke={cc.cap} strokeDasharray="4 4" label={{ value: `cap ${soilTier}`, fontSize: 10, fill: cc.cap, position: 'right' }} />
              <Line type="monotone" dataKey="n" name="N" stroke="#0F5132" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="p" name="P" stroke="#7F77DD" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="k" name="K" stroke="#DDA15E" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {fullDay && (
          <div className="mt-3 text-sm text-forest-700">
            Reaches cap on day {fullDay} ({dateLabel(fullDay, settings.daysPerMonth)}), which is {fullDay - startDay} days from the start.
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-ink-600">
          <div>
            <strong>Cold pause (blue bands)</strong>: at 0°C and below, every soil tick is skipped. No regen.
          </div>
          <div>
            <strong>Slow days (amber bands)</strong>: between 0 and 10°C, regen scales linearly with temperature. At 5°C you get half the daily regen rate. At 2°C, 20%. The line on the chart still climbs through these spans, just more slowly.
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ label, children, wide }) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-3 lg:col-span-4' : ''}>
      <label className="block text-xs font-medium text-ink-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

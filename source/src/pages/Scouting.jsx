// Scouting (beta). Project the user's bundled climate to nearby latitudes
// and re-run all the per-crop / per-tree / per-berry checks to surface
// what becomes viable elsewhere.
//
// EXPERIMENTAL. The math assumes vanilla worldgen and no altitude shifts;
// see climateProjection.js for the full set of caveats.

import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import { useClimate } from '../lib/useClimate.js';
import { useSettings } from '../lib/storage.js';
import {
  fitClimate, projectClimate, CLIMATE_PROJECTION_LIMITS,
} from '../data/climateProjection.js';
import { diffFromVanilla, isProjectionSupported } from '../lib/worldConfig.js';
import { CROPS_LIST, growDays } from '../data/crops.js';
import { TREES_LIST, treeTimeline, climateSurvivable } from '../data/fruitTrees.js';
import { BERRIES_LIST, berryClimateAnalysis, berryTempGates } from '../data/berries.js';
import { dateLabel } from '../data/climate.js';

// Per-crop viability against an arbitrary climate array (so we can pass
// the projected climate, not just the bundled one). Mirrors the logic in
// lib/mechanics.js damageRisk + climateWindow, but operates day-by-day on
// the supplied curve instead of via the module-level `_climate`.
//
// Returns:
//   { viable, bestPlantDay, harvestDay, dangerDays, reason }
//
// "Viable" means: somewhere in the year there's a contiguous stretch of
// growDays where min temp stays ≥ crop.cold and max temp stays ≤ crop.heat.
// If yes, returns the earliest such plant day.
function cropClimateViability(crop, climate, dpm) {
  if (!crop || !Array.isArray(climate) || climate.length === 0) return null;
  const need = Math.ceil(growDays(crop, dpm));
  const cold = crop.cold ?? -5;
  const heat = crop.heat ?? 35;

  // Slide a need-day window through the year; the crop can plant if any
  // window keeps min ≥ cold AND max ≤ heat throughout.
  let bestPlantDay = null;
  let dangerDays = 0; // count of climate days outside [cold, heat]
  for (const c of climate) {
    if (c.min < cold || c.max > heat) dangerDays++;
  }

  for (let start = 0; start + need <= climate.length; start++) {
    let ok = true;
    for (let i = start; i < start + need; i++) {
      const c = climate[i];
      if (c.min < cold || c.max > heat) { ok = false; break; }
    }
    if (ok) { bestPlantDay = start + 1; break; }
  }

  if (bestPlantDay !== null) {
    return {
      viable: true,
      bestPlantDay,
      harvestDay: bestPlantDay + need - 1,
      dangerDays,
      reason: null,
    };
  }
  // Find why: is it cold-limited or heat-limited or both?
  const tooCold = climate.some(c => c.min < cold);
  const tooHot  = climate.some(c => c.max > heat);
  let reason;
  if (tooCold && tooHot) reason = 'no frost-and-heat-free window long enough';
  else if (tooCold)      reason = `min temp drops below ${cold}°C frost line`;
  else if (tooHot)       reason = `max temp exceeds ${heat}°C heat line`;
  else                   reason = `growing season shorter than ${need} days`;
  return { viable: false, bestPlantDay: null, harvestDay: null, dangerDays, reason };
}

// LARGEST CONSECUTIVE GROWING WINDOW for a crop in a given climate.
// Returns the longest stretch of days where min >= cold AND max <= heat.
// Different from cropClimateViability (which only asks "do we have ENOUGH
// days for one cycle"). This tells you how much room you have to plant
// flexibly AND whether double/triple-cropping is possible.
//
// Returns:
//   { lengthDays, startDay, endDay, harvestsFitMaxCycle }
// where harvestsFitMaxCycle = floor(lengthDays / grow_days) tells you how
// many full cycles fit in the largest window.
function largestWindow(crop, climate, dpm) {
  if (!crop || !Array.isArray(climate) || climate.length === 0) return null;
  const cold = crop.cold ?? -5;
  const heat = crop.heat ?? 35;
  const need = Math.ceil(growDays(crop, dpm));

  let best = 0;
  let bestStart = -1;
  let cur = 0;
  let curStart = 0;
  for (let i = 0; i < climate.length; i++) {
    const c = climate[i];
    if (c.min >= cold && c.max <= heat) {
      if (cur === 0) curStart = i;
      cur++;
      if (cur > best) { best = cur; bestStart = curStart; }
    } else {
      cur = 0;
    }
  }
  if (best === 0) return { lengthDays: 0, startDay: null, endDay: null, harvestsFitMaxCycle: 0, growDays: need };
  return {
    lengthDays: best,
    startDay: bestStart + 1,
    endDay: bestStart + best,
    harvestsFitMaxCycle: Math.floor(best / Math.max(1, need)),
    growDays: need,
  };
}

export default function ScoutingPage() {
  const { climate } = useClimate();
  const [settings] = useSettings();
  const dpm = settings.daysPerMonth || 9;
  const worldConfig = settings.worldConfig || {};

  const fit = useMemo(() => fitClimate(climate), [climate]);
  // Default the slider to the inferred latitude. Allow ±0.20 either way.
  const [targetLat, setTargetLat] = useState(() => fit?.inferredLatitude ?? 0.5);
  const minLat = (fit?.inferredLatitude ?? 0.5) - CLIMATE_PROJECTION_LIMITS.maxLatitudeShift;
  const maxLat = (fit?.inferredLatitude ?? 0.5) + CLIMATE_PROJECTION_LIMITS.maxLatitudeShift;

  const projection = useMemo(
    () => projectClimate(climate, targetLat, {}, worldConfig),
    [climate, targetLat, worldConfig]
  );
  const projectionUnsupported = projection?.unsupported === true;
  const projectedClimate = (projection && !projectionUnsupported) ? projection.climate : null;

  // Non-vanilla worldConfig keys (informational banner)
  const nonVanilla = useMemo(() => diffFromVanilla(worldConfig), [worldConfig]);

  // Re-evaluate trees and berries against the projected climate.
  const treeAnalysis = useMemo(() => {
    if (!projectedClimate) return [];
    return TREES_LIST.map(t => {
      const tl = treeTimeline(t, projectedClimate, settings.today, dpm);
      const s = climateSurvivable(t, projectedClimate);
      return { tree: t, fruit: !!tl?.fruitInClimate, survives: s.survives, dangerDays: s.dangerDays };
    });
  }, [projectedClimate, settings.today, dpm]);

  const berryAnalysis = useMemo(() => {
    if (!projectedClimate) return [];
    return BERRIES_LIST.map(b => {
      const a = berryClimateAnalysis(b, projectedClimate);
      const gates = berryTempGates(b);
      return { berry: b, ...a, wakeAbove: gates.wakeAbove };
    });
  }, [projectedClimate]);

  const cropAnalysis = useMemo(() => {
    if (!projectedClimate) return [];
    return CROPS_LIST.map(c => ({
      crop: c,
      ...cropClimateViability(c, projectedClimate, dpm),
    }));
  }, [projectedClimate, dpm]);

  // Same checks against the user's CURRENT climate, so we can show deltas.
  const treeCurrent = useMemo(
    () => TREES_LIST.map(t => {
      const tl = treeTimeline(t, climate, settings.today, dpm);
      const s = climateSurvivable(t, climate);
      return { tree: t, fruit: !!tl?.fruitInClimate, survives: s.survives };
    }),
    [climate, settings.today, dpm]
  );
  const berryCurrent = useMemo(
    () => BERRIES_LIST.map(b => berryClimateAnalysis(b, climate)),
    [climate]
  );
  const cropCurrent = useMemo(
    () => CROPS_LIST.map(c => cropClimateViability(c, climate, dpm)),
    [climate, dpm]
  );

  const newlyFruitingTrees = treeAnalysis.filter((row, i) =>
    row.fruit && !treeCurrent[i].fruit
  );
  const lostTrees = treeAnalysis.filter((row, i) =>
    !row.fruit && treeCurrent[i].fruit
  );
  const newlyHarvestingBerries = berryAnalysis.filter((row, i) =>
    (row.estimatedHarvestsPerYear || 0) > (berryCurrent[i]?.estimatedHarvestsPerYear || 0)
  );
  const newlyViableCrops = cropAnalysis.filter((row, i) =>
    row.viable && !cropCurrent[i]?.viable
  );
  const lostCrops = cropAnalysis.filter((row, i) =>
    !row.viable && cropCurrent[i]?.viable
  );

  if (!climate || !fit) {
    return (
      <div className="space-y-8">
        <Reveal>
          <div>
            <div className="section-eyebrow text-amber-700">§β · Scouting (beta)</div>
            <h2 className="heading-display text-4xl mt-2">Climate scouting</h2>
            <p className="mt-3 text-ink-600">No climate data loaded. Upload a temperatureplot CSV in Settings first.</p>
          </div>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-amber-700">§β · Scouting (beta)</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Climate <span className="heading-italic">scouting</span>
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl">
            What grows if you move? Slide the latitude to project your bundled climate
            to a different spot. Within ±0.2 of your current latitude, the seasonal
            shape is reliable; further than that, world generation noise and altitude
            effects swamp the projection.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="border-l-4 border-l-amber-400 bg-amber-100/20">
          <CardBody>
            <div className="text-sm text-ink-700 space-y-1">
              <p><strong>Beta. Read the assumptions.</strong></p>
              <p>This page assumes vanilla worldgen and that your altitude stays the same. It uses the formula in <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">Temperature.cs</code> to derive your seasonal amplitude, then re-applies it at the target latitude. Yearly mean drifts about 30°C per full latitude unit toward the equator; that slope can be off by several degrees in any specific world due to noise and config.</p>
              <p>If your server runs a worldgen mod (Wilderness, BetterClimate, similar), these projections will be wrong. Treat this as a sketch, not a forecast. The most useful thing you can do is travel to a spot you're considering and run <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">/wgen pos</code> to check.</p>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {projectionUnsupported && (
        <Reveal delay={0.06}>
          <Card className="border-l-4 border-l-red-500 bg-red-50/40 dark:bg-red-950/20">
            <CardBody>
              <div className="text-sm text-ink-700 space-y-1">
                <p><strong className="text-red-700">Projection disabled by your world config.</strong></p>
                <p>{projection.reason}</p>
                <p>Set <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">worldClimate</code> to <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">"realistic"</code> in Settings (World config card) to re-enable. The latitude slider and tables below will stay frozen until then.</p>
              </div>
            </CardBody>
          </Card>
        </Reveal>
      )}

      {!projectionUnsupported && nonVanilla.length > 0 && (
        <Reveal delay={0.06}>
          <Card className="border-l-4 border-l-forest-500 bg-forest-50/30">
            <CardBody>
              <div className="text-sm text-ink-700 space-y-1">
                <p><strong>Non-vanilla world config in use.</strong> The projection has been adjusted for these {nonVanilla.length} key{nonVanilla.length === 1 ? '' : 's'}:</p>
                <ul className="text-xs space-y-0.5 mt-2 ml-4 list-disc text-ink-600">
                  {nonVanilla.map(d => (
                    <li key={d.key}>
                      <code className="font-mono">{d.key}</code> = <strong>{String(d.value)}</strong>{' '}
                      <span className="text-ink-500">(vanilla: {String(d.default)})</span>
                    </li>
                  ))}
                </ul>
                {projection?.tempPerLatitude !== undefined && projection.tempPerLatitude !== 30 && (
                  <p className="mt-2 text-xs italic">Effective slope is now <strong>{projection.tempPerLatitude.toFixed(1)}°C per full latitude unit</strong> (vanilla 30°C).</p>
                )}
              </div>
            </CardBody>
          </Card>
        </Reveal>
      )}

      <Reveal delay={0.08}>
        <Card>
          <CardHeader
            eyebrow="Your climate, fit"
            title="What we read from your CSV"
            subtitle="Inferred latitude is back-calculated from the seasonal amplitude. Inferred rainfall comes from the average diurnal swing."
          />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Stat label="Yearly mean" value={`${fit.yearlyMean.toFixed(1)}°C`} />
              <Stat label="Seasonal amp" value={`${fit.seasonalAmp.toFixed(1)}°C`} />
              <Stat label="Inferred latitude" value={fit.inferredLatitude.toFixed(2)} />
              <Stat label="Inferred rainfall" value={fit.inferredRainfall.toFixed(2)} />
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card elevated>
          <CardHeader
            eyebrow="Latitude slider"
            title={`Project to latitude ${targetLat.toFixed(2)}`}
            subtitle={`Range capped at ±${CLIMATE_PROJECTION_LIMITS.maxLatitudeShift} from your current position.`}
          />
          <CardBody>
            <div className="space-y-4">
              <input
                type="range"
                min={minLat}
                max={maxLat}
                step={0.01}
                value={targetLat}
                onChange={e => setTargetLat(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-ink-500 tabular">
                <span>{minLat.toFixed(2)} (toward equator)</span>
                <span className="font-medium text-forest-800">current: {fit.inferredLatitude.toFixed(2)}</span>
                <span>{maxLat.toFixed(2)} (toward pole)</span>
              </div>

              {projectedClimate && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm pt-2">
                  <Stat
                    label="Yearly mean"
                    value={`${(fit.yearlyMean + projection.yearlyMeanShift).toFixed(1)}°C`}
                    delta={projection.yearlyMeanShift.toFixed(1)}
                  />
                  <Stat
                    label="Seasonal amp"
                    value={`${projection.newSeasonalAmp.toFixed(1)}°C`}
                    delta={(projection.newSeasonalAmp - fit.seasonalAmp).toFixed(1)}
                  />
                  <Stat
                    label="Summer peak"
                    value={`${Math.max(...projectedClimate.map(c => c.avg)).toFixed(1)}°C`}
                  />
                  <Stat
                    label="Winter low"
                    value={`${Math.min(...projectedClimate.map(c => c.avg)).toFixed(1)}°C`}
                  />
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.11}>
        <BestWindowCard
          climate={climate}
          fit={fit}
          dpm={dpm}
          worldConfig={worldConfig}
        />
      </Reveal>

      <Reveal delay={0.13}>
        <Card>
          <CardHeader
            eyebrow="What changes"
            title="Plants that gain or lose viability at this latitude"
            subtitle="Compared to your current spot. Small wins are usually winters becoming milder; lost ones are typically summers no longer warm enough."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DeltaList
                title="Trees that start fruiting"
                items={newlyFruitingTrees.map(r => r.tree.name)}
                emptyMsg="No new trees become viable."
                tone="positive"
              />
              <DeltaList
                title="Trees you'd lose"
                items={lostTrees.map(r => r.tree.name)}
                emptyMsg="No trees stop working."
                tone="negative"
              />
              <DeltaList
                title="Berries with more harvests"
                items={newlyHarvestingBerries.map(r => {
                  const before = berryCurrent[BERRIES_LIST.indexOf(r.berry)]?.estimatedHarvestsPerYear || 0;
                  const after = r.estimatedHarvestsPerYear || 0;
                  return `${r.berry.name}: ${before} to ${after}/yr`;
                })}
                emptyMsg="No berries gain harvests."
                tone="positive"
              />
              <DeltaList
                title="Crops that become plantable"
                items={newlyViableCrops.map(r => r.crop.name)}
                emptyMsg="No new crops become viable."
                tone="positive"
              />
              <DeltaList
                title="Crops you'd lose"
                items={lostCrops.map(r => r.crop.name)}
                emptyMsg="No crops stop working."
                tone="negative"
              />
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.16}>
        <Card>
          <CardHeader
            eyebrow="Full tree list at this latitude"
            title="Per-variety projection"
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment-300/60 text-left text-ink-500 text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 font-normal">Tree</th>
                    <th className="px-3 py-2 font-normal">Cycle</th>
                    <th className="px-3 py-2 font-normal">Survives?</th>
                    <th className="px-3 py-2 font-normal">Fruits at this lat?</th>
                    <th className="px-3 py-2 font-normal">Vs current</th>
                  </tr>
                </thead>
                <tbody>
                  {treeAnalysis.map((row, i) => {
                    const cur = treeCurrent[i];
                    const change = row.fruit && !cur.fruit ? 'gained'
                      : !row.fruit && cur.fruit ? 'lost'
                      : 'same';
                    return (
                      <tr key={row.tree.key} className="border-b border-parchment-200/40 hover:bg-parchment-100/30">
                        <td className="px-3 py-3 font-medium text-forest-900">{row.tree.name}</td>
                        <td className="px-3 py-3 text-xs text-ink-600">{row.tree.cycleType}</td>
                        <td className="px-3 py-3 text-sm">
                          {row.survives
                            ? <span className="text-forest-800">Yes</span>
                            : <span className="text-terra-700">No ({row.dangerDays}d cold)</span>}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {row.fruit
                            ? <span className="text-forest-800 font-medium">Yes</span>
                            : <span className="text-terra-700">No</span>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {change === 'gained' && <span className="text-forest-700 font-medium">+ gained</span>}
                          {change === 'lost' && <span className="text-terra-700 font-medium">− lost</span>}
                          {change === 'same' && <span className="text-ink-500">unchanged</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="Full berry list at this latitude"
            title="Harvest estimates"
            subtitle="Recall: dormancy takes precedence over reset, so cold winters mostly put the bush to sleep instead of killing progress."
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment-300/60 text-left text-ink-500 text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 font-normal">Berry</th>
                    <th className="px-3 py-2 font-normal">Wake @</th>
                    <th className="px-3 py-2 font-normal">Wakes here?</th>
                    <th className="px-3 py-2 font-normal">Active days</th>
                    <th className="px-3 py-2 font-normal">Harvests/yr</th>
                    <th className="px-3 py-2 font-normal">Vs current</th>
                  </tr>
                </thead>
                <tbody>
                  {berryAnalysis.map((row, i) => {
                    const cur = berryCurrent[i] || {};
                    const before = cur.estimatedHarvestsPerYear || 0;
                    const after = row.estimatedHarvestsPerYear || 0;
                    const delta = after - before;
                    return (
                      <tr key={row.berry.key} className="border-b border-parchment-200/40 hover:bg-parchment-100/30">
                        <td className="px-3 py-3 font-medium text-forest-900">{row.berry.name}</td>
                        <td className="px-3 py-3 text-sm tabular text-ink-700">{row.wakeAbove}°C</td>
                        <td className="px-3 py-3 text-sm">
                          {row.couldWake
                            ? <span className="text-forest-800">Yes</span>
                            : <span className="text-terra-700">No</span>}
                        </td>
                        <td className="px-3 py-3 text-sm tabular text-ink-700">{row.activeDays || 0}</td>
                        <td className="px-3 py-3 text-sm tabular font-medium text-forest-900">{after}</td>
                        <td className="px-3 py-3 text-xs">
                          {delta > 0 && <span className="text-forest-700 font-medium">+{delta}</span>}
                          {delta < 0 && <span className="text-terra-700 font-medium">{delta}</span>}
                          {delta === 0 && <span className="text-ink-500">same</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.23}>
        <Card>
          <CardHeader
            eyebrow="Full crop list at this latitude"
            title="Per-crop frost and heat fit"
            subtitle="Earliest plant day: where in the year the crop can fit a damage-free growing window. Takes the crop's cold and heat thresholds straight from the crop config."
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment-300/60 text-left text-ink-500 text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 font-normal">Crop</th>
                    <th className="px-3 py-2 font-normal">Cold / heat</th>
                    <th className="px-3 py-2 font-normal">Grow days</th>
                    <th className="px-3 py-2 font-normal">Plantable?</th>
                    <th className="px-3 py-2 font-normal">Earliest plant</th>
                    <th className="px-3 py-2 font-normal">Vs current</th>
                  </tr>
                </thead>
                <tbody>
                  {cropAnalysis.map((row, i) => {
                    const cur = cropCurrent[i] || {};
                    const change = row.viable && !cur.viable ? 'gained'
                      : !row.viable && cur.viable ? 'lost'
                      : 'same';
                    const need = Math.ceil((row.crop.months || 0) * dpm);
                    return (
                      <tr key={row.crop.key} className="border-b border-parchment-200/40 hover:bg-parchment-100/30">
                        <td className="px-3 py-3">
                          <div className="font-medium text-forest-900">{row.crop.name}</div>
                          <div className="text-xs text-ink-600">{row.crop.foodCategory}</div>
                        </td>
                        <td className="px-3 py-3 text-sm tabular text-ink-700">
                          {row.crop.cold}°C / {row.crop.heat}°C
                        </td>
                        <td className="px-3 py-3 text-sm tabular text-ink-700">{need}</td>
                        <td className="px-3 py-3 text-sm">
                          {row.viable
                            ? <span className="text-forest-800 font-medium">Yes</span>
                            : <div>
                                <span className="text-terra-700 font-medium">No</span>
                                {row.reason && <div className="text-xs text-ink-600 mt-0.5">{row.reason}</div>}
                              </div>}
                        </td>
                        <td className="px-3 py-3 text-sm tabular text-ink-700">
                          {row.bestPlantDay !== null ? <span title={`Day ${row.bestPlantDay}`}>{dateLabel(row.bestPlantDay, dpm)}</span> : 'n/a'}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {change === 'gained' && <span className="text-forest-700 font-medium">+ gained</span>}
                          {change === 'lost' && <span className="text-terra-700 font-medium">- lost</span>}
                          {change === 'same' && <span className="text-ink-500">unchanged</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-ink-600 italic">
              Plantability is a hard filter: the crop must find a contiguous stretch of grow-days where daily min stays at or above the cold threshold and daily max stays at or below the heat threshold. The Decision page does a richer scoring with stunt multipliers; this is the binary survives-or-doesn't view.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.25}><Flourish>※</Flourish></Reveal>
    </div>
  );
}

function Stat({ label, value, delta, unit = '°C', positiveGood = false }) {
  const deltaNum = delta !== undefined && delta !== null ? parseFloat(delta) : null;
  return (
    <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
      <div className="section-eyebrow text-forest-800 mb-1">{label}</div>
      <div className="font-display text-xl text-forest-900 tabular">{value}</div>
      {deltaNum !== null && !Number.isNaN(deltaNum) && (
        <div className={`text-xs tabular mt-0.5 ${
          deltaNum === 0 ? 'text-ink-500'
            : (deltaNum > 0) === positiveGood ? 'text-forest-700' : 'text-terra-700'
        }`}>
          {deltaNum > 0 ? '+' : ''}{deltaNum}{unit} vs current
        </div>
      )}
    </div>
  );
}

function DeltaList({ title, items, emptyMsg, tone }) {
  const color = tone === 'positive' ? 'text-forest-800' : tone === 'negative' ? 'text-terra-700' : 'text-ink-700';
  return (
    <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
      <div className={`section-eyebrow mb-2 ${color}`}>{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-ink-500 italic">{emptyMsg}</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map(item => (
            <li key={item} className="text-ink-700">{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// BEST GROWING WINDOW CARD: pick a crop, sweep all reachable latitudes, find
// the one that maximizes the longest contiguous viable window. Reports the
// distance in blocks (signed: north or south) using the user's polarEquator
// distance.
function BestWindowCard({ climate, fit, dpm, worldConfig }) {
  const [cropKey, setCropKey] = useState('flax');
  const crop = CROPS_LIST.find(c => c.key === cropKey);

  // Sweep latitudes from -MAX_SHIFT to +MAX_SHIFT around current
  const sweep = useMemo(() => {
    if (!crop || !climate || !fit) return null;
    const cfg = worldConfig || {};
    const polarEq = cfg.polarEquatorDistance || 50000;
    const sourceLat = fit.inferredLatitude;
    const STEP = 0.01;
    const max = CLIMATE_PROJECTION_LIMITS.maxLatitudeShift;

    const points = [];
    let bestPoint = null;

    // Include the home position as a baseline
    const homeWin = largestWindow(crop, climate, dpm);
    const homePoint = {
      latShift: 0,
      latitude: sourceLat,
      blocks: 0,
      lengthDays: homeWin?.lengthDays || 0,
      startDay: homeWin?.startDay,
      endDay: homeWin?.endDay,
      harvestsFitMaxCycle: homeWin?.harvestsFitMaxCycle || 0,
      isHome: true,
    };
    points.push(homePoint);
    bestPoint = homePoint;

    for (let shift = -max; shift <= max + 1e-9; shift += STEP) {
      if (Math.abs(shift) < 1e-6) continue;  // skip duplicate of home
      const targetLat = sourceLat + shift;
      const proj = projectClimate(climate, targetLat, {}, worldConfig);
      if (!proj || proj.unsupported) continue;
      const win = largestWindow(crop, proj.climate, dpm);
      if (!win) continue;
      const blocks = Math.round(shift * polarEq);
      const point = {
        latShift: shift,
        latitude: targetLat,
        blocks,
        lengthDays: win.lengthDays,
        startDay: win.startDay,
        endDay: win.endDay,
        harvestsFitMaxCycle: win.harvestsFitMaxCycle,
        isHome: false,
      };
      points.push(point);
      // Tie-break: prefer the LEAST distance (smaller |blocks|) at equal window length
      if (point.lengthDays > bestPoint.lengthDays ||
          (point.lengthDays === bestPoint.lengthDays && Math.abs(point.blocks) < Math.abs(bestPoint.blocks))) {
        bestPoint = point;
      }
    }

    points.sort((a, b) => a.blocks - b.blocks);
    return { points, best: bestPoint, home: homePoint, polarEq };
  }, [crop, climate, fit, dpm, worldConfig]);

  if (!sweep || sweep.points.length === 0) {
    return (
      <Card>
        <CardHeader
          eyebrow="Best window finder"
          title="How far to walk for the largest growing window"
        />
        <CardBody>
          <div className="text-sm text-ink-500 italic">No projection available (worldClimate isn't realistic, or no climate loaded).</div>
        </CardBody>
      </Card>
    );
  }

  const { best, home, points, polarEq } = sweep;
  const gain = best.lengthDays - home.lengthDays;
  const cyclesGain = best.harvestsFitMaxCycle - home.harvestsFitMaxCycle;
  const direction = best.blocks > 0 ? 'north (toward pole)' : best.blocks < 0 ? 'south (toward equator)' : 'right where you are';
  const absBlocks = Math.abs(best.blocks);

  return (
    <Card>
      <CardHeader
        eyebrow="Best window finder"
        title="How far to walk for the largest growing window"
        subtitle="Pick a crop. We sweep every reachable latitude, project the climate, and find the spot that gives the LONGEST contiguous run of days within the crop's safe min/max temps. Larger window = more flexibility on plant date and more cycles per year."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 pb-4 border-b border-parchment-300/40">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Crop</label>
            <select className="select-field" value={cropKey} onChange={e => setCropKey(e.target.value)}>
              {CROPS_LIST.map(c => (
                <option key={c.key} value={c.key}>
                  {c.name} (cold {c.cold ?? -5}°C, heat {c.heat ?? 35}°C)
                </option>
              ))}
            </select>
            <div className="text-[11px] text-ink-500 mt-1">
              The crop's safe temperature gates determine "viable" days. A day counts if min ≥ cold AND max ≤ heat.
            </div>
          </div>
          <div className="md:col-span-2 text-xs text-ink-600 italic">
            <p>The sweep covers ±{CLIMATE_PROJECTION_LIMITS.maxLatitudeShift} latitude around your current position, in 0.01-latitude steps. With your server's <code className="font-mono not-italic bg-parchment-200/40 px-1 rounded">polarEquatorDistance = {polarEq.toLocaleString()}</code>, that's a max range of ±{(CLIMATE_PROJECTION_LIMITS.maxLatitudeShift * polarEq).toLocaleString()} blocks N/S.</p>
            <p className="mt-1.5 not-italic"><strong className="text-forest-900">Tie-breaker:</strong> when multiple latitudes give the same window length, the closest one wins (less travel for the same gain).</p>
          </div>
        </div>

        {/* Headline result */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Best distance" value={absBlocks === 0 ? 'home' : `${absBlocks.toLocaleString()} blocks`} />
          <Stat label="Direction" value={best.blocks === 0 ? '-' : best.blocks > 0 ? 'N' : 'S'} />
          <Stat label="Window at home" value={`${home.lengthDays} days`} />
          <Stat label="Window at best" value={`${best.lengthDays} days`}
            delta={gain !== 0 ? gain : null} unit=" days" positiveGood />
        </div>

        {/* Headline verdict */}
        <div className={`px-4 py-3 rounded border-l-4 text-sm leading-relaxed ${
          best.lengthDays === 0
            ? 'border-l-terra-500 bg-terra-50/40'
            : gain > 14
            ? 'border-l-forest-500 bg-forest-50/40'
            : gain > 0
            ? 'border-l-amber-400 bg-amber-50/40'
            : 'border-l-ink-400 bg-parchment-100/40'
        }`}>
          <div className="font-medium text-forest-900 mb-1">For {crop.name}</div>
          {best.lengthDays === 0 ? (
            <p className="text-ink-700">
              <strong className="text-terra-800">No viable window anywhere within {(CLIMATE_PROJECTION_LIMITS.maxLatitudeShift * polarEq).toLocaleString()} blocks.</strong> {crop.name} can't survive your area's temperature swings at any reachable latitude. Either the world is too cold (winter min &lt; {crop.cold ?? -5}°C) or too hot (summer max &gt; {crop.heat ?? 35}°C) everywhere within range.
            </p>
          ) : absBlocks === 0 ? (
            <p className="text-ink-700">
              <strong className="text-forest-900">You're already at the best spot.</strong> Window of {best.lengthDays} days, fits {best.harvestsFitMaxCycle} full cycle{best.harvestsFitMaxCycle === 1 ? '' : 's'} of {crop.name} ({best.growDays || 0}d each). Moving in either direction shrinks the window.
            </p>
          ) : (
            <p className="text-ink-700">
              <strong className="text-forest-900">Walk ~{absBlocks.toLocaleString()} blocks {direction}</strong> for the longest window: {best.lengthDays} days (vs {home.lengthDays} here, +{gain} day{gain === 1 ? '' : 's'}).
              {' '}This fits <strong>{best.harvestsFitMaxCycle} full cycle{best.harvestsFitMaxCycle === 1 ? '' : 's'}</strong> of {crop.name} (vs {home.harvestsFitMaxCycle} at home, {cyclesGain > 0 ? `+${cyclesGain}` : cyclesGain === 0 ? 'same count' : `${cyclesGain}`}).
              {' '}At the best spot, the window runs from day {best.startDay} to day {best.endDay} ({dateLabel(best.startDay, dpm)} to {dateLabel(best.endDay, dpm)}).
            </p>
          )}
        </div>

        {/* Sweep visualization */}
        <div className="mt-5">
          <div className="text-xs font-medium text-ink-700 mb-2">Window length vs distance from home</div>
          <SweepBars points={points} best={best} home={home} />
          <div className="mt-2 text-[10px] text-ink-500 flex justify-between">
            <span>{points[0].blocks.toLocaleString()} blocks (S)</span>
            <span className="font-medium text-forest-700">home (0)</span>
            <span>{points[points.length-1].blocks.toLocaleString()} blocks (N)</span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Small bar chart of window lengths across the sweep. Each bar = one latitude
// step; height is window length in days. Best is highlighted, home marked.
function SweepBars({ points, best, home }) {
  const maxLen = Math.max(1, ...points.map(p => p.lengthDays));
  return (
    <div className="flex items-end h-24 bg-parchment-100/40 border border-parchment-300/40 rounded px-1 py-1 gap-px">
      {points.map((p, i) => {
        const heightPct = (p.lengthDays / maxLen) * 100;
        const isBest = p.blocks === best.blocks;
        const isHome = p.blocks === 0;
        const cls = isBest
          ? 'bg-forest-600'
          : isHome
          ? 'bg-amber-500'
          : 'bg-forest-300/60';
        const title = `${p.blocks.toLocaleString()} blocks: ${p.lengthDays}d window${isBest ? ' ← best' : isHome ? ' ← home' : ''}`;
        return (
          <div
            key={i}
            className={`flex-1 ${cls} rounded-t hover:opacity-80 transition-opacity`}
            style={{ height: `${heightPct}%`, minHeight: p.lengthDays > 0 ? '2px' : '1px' }}
            title={title}
          />
        );
      })}
    </div>
  );
}

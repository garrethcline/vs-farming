// Climate estimator (beta).
//
// Practical use case: the player has moved to a new spot and wants an
// estimate of the climate there without re-running /debug exptempplot.
// What they actually have access to in-game is a SINGLE temperature
// reading at a known date and hour (visible on F3 or the thermometer).
//
// This tool takes that single reading and shifts the loaded climate's
// curve so it would predict the same value at that date+hour. The
// offset becomes a constant adjustment to every day of the year.
//
// Optional second-pass adjustments still available:
//   - Different rainfall (rescales diurnal min-to-max swing)
//   - Different latitude / Z coordinate (rescales seasonal amplitude)

import { useState, useMemo } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import {
  computeYearAvg, computeSeasonalAmp, computeDiurnalAvg,
  shiftFromSingleReading, shiftAmpAndRainfall, climateToCsvString,
  predictTempAtHour,
} from '../data/climateEstimator.js';
import { useSettings } from '../lib/storage.js';
import { useClimate } from '../lib/useClimate.js';
import { dateLabel, MONTH_NAMES } from '../data/climate.js';

export default function ClimateEstimatorPage() {
  const [settings] = useSettings();
  const { climate, source, setCustom, addLocation } = useClimate();
  const dpm = settings.daysPerMonth || 9;

  // Stats from the currently loaded climate.
  const oldStats = useMemo(() => {
    if (!climate || climate.length === 0) return null;
    const yearAvg = computeYearAvg(climate);
    const amp = computeSeasonalAmp(climate);
    const diurnal = computeDiurnalAvg(climate);
    const rainfall = Math.max(0, Math.min(1, (18 - diurnal) / 13));
    const latitude = amp / 65;
    return { yearAvg, amp, diurnal, rainfall, latitude, days: climate.length };
  }, [climate]);

  // Single-reading inputs. Default to today + noon, blank temperature.
  const [readMonth, setReadMonth] = useState(() => Math.floor((settings.today - 1) / dpm) % 12);
  const [readDayOfMonth, setReadDayOfMonth] = useState(() => ((settings.today - 1) % dpm) + 1);
  const [readHour, setReadHour] = useState(12);
  const [readTemp, setReadTemp] = useState('');

  // Optional second-pass adjustments
  const [adjustRainfall, setAdjustRainfall] = useState(false);
  const [newRainfall, setNewRainfall] = useState(() => oldStats ? oldStats.rainfall.toFixed(2) : '0.89');
  const [adjustAmp, setAdjustAmp] = useState(false);
  const [newLatitude, setNewLatitude] = useState(() => oldStats ? oldStats.latitude.toFixed(2) : '0.55');

  const dayOfYear = useMemo(() => {
    const m = Math.max(0, Math.min(11, Math.floor(readMonth)));
    const d = Math.max(1, Math.min(dpm, Math.floor(readDayOfMonth)));
    return m * dpm + d;
  }, [readMonth, readDayOfMonth, dpm]);

  // What the loaded climate predicts for the user's reported (date, hour).
  // Shown so they can sanity-check the offset before applying.
  const predictedAtMoment = useMemo(() => {
    if (!climate || climate.length === 0) return null;
    if (dayOfYear < 1 || dayOfYear > climate.length) return null;
    const day = climate[dayOfYear - 1];
    if (!day) return null;
    return predictTempAtHour(day, readHour);
  }, [climate, dayOfYear, readHour]);

  // Step 1: shift by the single-reading delta.
  const stepOne = useMemo(() => {
    if (!oldStats) return null;
    const t = parseFloat(readTemp);
    if (!isFinite(t)) return null;
    return shiftFromSingleReading(climate, dayOfYear, readHour, t);
  }, [climate, dayOfYear, readHour, readTemp, oldStats]);

  // Step 2 (optional): apply seasonal amp + rainfall rescale on the
  // already-offset climate. Keeps the new yearAvg from step 1.
  const estimated = useMemo(() => {
    if (!stepOne || stepOne.error) return stepOne;
    if (!adjustAmp && !adjustRainfall) return stepOne;
    const opts = { newYearAvg: stepOne.newYearAvg };
    if (adjustAmp) {
      const lat = parseFloat(newLatitude);
      if (isFinite(lat)) opts.newAmp = Math.abs(lat) * 65;
    }
    if (adjustRainfall && oldStats) {
      const rain = parseFloat(newRainfall);
      if (isFinite(rain)) {
        opts.oldRainfall = oldStats.rainfall;
        opts.newRainfall = rain;
      }
    }
    const result = shiftAmpAndRainfall(stepOne.climate, opts);
    if (result.error) return result;
    return {
      ...result,
      offset: stepOne.offset,
      predictedReading: stepOne.predictedReading,
      observedReading: stepOne.observedReading,
    };
  }, [stepOne, adjustAmp, adjustRainfall, newLatitude, newRainfall, oldStats]);

  const apply = () => {
    if (!estimated || estimated.error) return;
    setCustom(estimated.climate);
  };

  const saveAsLocation = () => {
    if (!estimated || estimated.error) return;
    const defaultName = `Estimate from ${dateLabel(dayOfYear, dpm)} ${readHour}:00 (${(estimated.offset >= 0 ? '+' : '') + estimated.offset.toFixed(1)}°C)`;
    const name = prompt('Name this location:', defaultName);
    if (!name) return;
    addLocation(name, estimated.climate, {
      notes: `Estimated from ${source} climate. Reading: ${parseFloat(readTemp).toFixed(2)}°C at ${dateLabel(dayOfYear, dpm)} ${readHour}:00. Offset ${(estimated.offset >= 0 ? '+' : '') + estimated.offset.toFixed(2)}°C.`,
      activate: true,
    });
  };

  const downloadEstimate = () => {
    if (!estimated || estimated.error) return;
    const csv = climateToCsvString(estimated.climate, {
      source: `Estimated from ${source} climate via single reading at ${dateLabel(dayOfYear, dpm)} ${readHour}:00`,
      oldYearAvg: estimated.oldYearAvg,
      newYearAvg: estimated.newYearAvg,
      offset: estimated.offset,
      ampScale: estimated.ampScale,
      diurnalRatio: estimated.diurnalRatio,
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'climate-estimated.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§E · Climate estimator (beta)</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Estimate from a <span className="heading-italic">single thermometer reading</span>
          </h2>
          <p className="mt-3 text-ink-600 max-w-3xl">
            Stand somewhere in-world, check the date, hour, and temperature on F3 or your thermometer block, type those three numbers in, and this tool produces a full-year estimated climate. The math: the offset between the loaded climate's prediction for that exact moment and your actual reading gets applied to every day of the year. Useful when you don't want to run <code className="font-mono text-xs bg-parchment-200/60 px-1 rounded">/debug exptempplot</code> after every move.
          </p>
        </div>
      </Reveal>

      {!oldStats && (
        <Reveal delay={0.05}>
          <Card>
            <CardBody>
              <div className="text-sm text-terra-700">
                No climate is currently loaded. Upload a CSV in Settings → Climate first (the bundled climate or your own <code className="font-mono">/debug exptempplot</code> output). Without a baseline curve, there's nothing to shift.
              </div>
            </CardBody>
          </Card>
        </Reveal>
      )}

      {oldStats && (
        <>
          <Reveal delay={0.05}>
            <Card>
              <CardHeader eyebrow="Source curve" title="Currently loaded climate" subtitle={`Stats computed from the climate the rest of the app is using right now (source: ${source}). The curve shape stays; only its mean shifts.`} />
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <Stat label="Days in year" value={oldStats.days} />
                  <Stat label="Year avg" value={`${oldStats.yearAvg.toFixed(2)}°C`} />
                  <Stat label="Seasonal amp" value={`${oldStats.amp.toFixed(1)}°C`} note="summer-to-winter swing" />
                  <Stat label="Diurnal avg" value={`${oldStats.diurnal.toFixed(1)}°C`} note={`implies rainfall ${(oldStats.rainfall * 100).toFixed(0)}%`} />
                  <Stat label="Implied lat" value={oldStats.latitude.toFixed(2)} note="from amp = |lat| × 65" />
                </div>
              </CardBody>
            </Card>
          </Reveal>

          <Reveal delay={0.1}>
            <Card>
              <CardHeader
                eyebrow="Your reading"
                title="What you observed at the new spot"
                subtitle="Three numbers from in-game: the date you took the reading, the hour, and the temperature on F3 (or thermometer block)."
              />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-ink-700 mb-1">Month</label>
                    <select
                      className="select-field"
                      value={readMonth}
                      onChange={(e) => setReadMonth(parseInt(e.target.value))}
                    >
                      {MONTH_NAMES.map((m, i) => (
                        <option key={i} value={i}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-700 mb-1">Day of month (1-{dpm})</label>
                    <input
                      type="number" min="1" max={dpm}
                      className="input-field tabular w-full"
                      value={readDayOfMonth}
                      onChange={(e) => setReadDayOfMonth(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-700 mb-1">Hour (0-23)</label>
                    <input
                      type="number" min="0" max="23" step="1"
                      className="input-field tabular w-full"
                      value={readHour}
                      onChange={(e) => setReadHour(parseInt(e.target.value) || 0)}
                    />
                    <div className="text-[10px] text-ink-500 italic mt-1">
                      Coldest: 4 AM. Warmest: 4 PM.
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-700 mb-1">Temperature reading (°C)</label>
                    <input
                      type="number" step="0.1"
                      className="input-field tabular w-full"
                      placeholder="e.g. 12.4"
                      value={readTemp}
                      onChange={(e) => setReadTemp(e.target.value)}
                    />
                  </div>
                </div>

                {predictedAtMoment !== null && (
                  <div className="mt-4 px-3 py-2 rounded bg-parchment-100/60 border border-parchment-300/40 text-sm">
                    <span className="text-ink-600">Loaded climate predicts </span>
                    <strong className="tabular text-forest-900">{predictedAtMoment.toFixed(2)}°C</strong>
                    <span className="text-ink-600"> at {dateLabel(dayOfYear, dpm)} {readHour}:00.</span>
                    {readTemp && isFinite(parseFloat(readTemp)) && (
                      <span className="ml-3 text-ink-600">
                        Your reading: <strong className="tabular text-forest-900">{parseFloat(readTemp).toFixed(2)}°C</strong>.
                        Offset: <strong className={`tabular ${(parseFloat(readTemp) - predictedAtMoment) >= 0 ? 'text-forest-700' : 'text-terra-700'}`}>
                          {(parseFloat(readTemp) - predictedAtMoment) >= 0 ? '+' : ''}{(parseFloat(readTemp) - predictedAtMoment).toFixed(2)}°C
                        </strong>
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-5 border-t border-parchment-300/40 pt-4 space-y-4">
                  <div className="text-xs uppercase tracking-wider text-ink-500 font-medium">Optional fine-tuning</div>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adjustRainfall}
                      onChange={(e) => setAdjustRainfall(e.target.checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-forest-900">Different rainfall at the new spot</div>
                      <div className="text-xs text-ink-600 italic">F3 also shows rainfall as a percentage. If it differs from the loaded climate, the daily min-to-max swing rescales accordingly.</div>
                    </div>
                  </label>
                  {adjustRainfall && (
                    <div className="ml-7">
                      <FieldRow label="New rainfall (0-1)" hint={`Was ${(oldStats.rainfall * 100).toFixed(0)}% in the loaded climate.`}>
                        <input
                          type="number" step="0.01" min="0" max="1"
                          className="input-field tabular w-32"
                          value={newRainfall}
                          onChange={(e) => setNewRainfall(e.target.value)}
                        />
                      </FieldRow>
                    </div>
                  )}

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adjustAmp}
                      onChange={(e) => setAdjustAmp(e.target.checked)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-forest-900">Moved a long way north or south</div>
                      <div className="text-xs text-ink-600 italic">A long Z-axis move changes the gap between summer peak and winter low. Game formula: seasonal amp = |latitude| × 65, where latitude is -1 (south pole) to 1 (north pole).</div>
                    </div>
                  </label>
                  {adjustAmp && (
                    <div className="ml-7">
                      <FieldRow label="New latitude (-1 to 1)" hint={`Was ${oldStats.latitude.toFixed(2)} in the loaded climate.`}>
                        <input
                          type="number" step="0.05" min="-1" max="1"
                          className="input-field tabular w-32"
                          value={newLatitude}
                          onChange={(e) => setNewLatitude(e.target.value)}
                        />
                      </FieldRow>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </Reveal>

          {estimated && !estimated.error && (
            <Reveal delay={0.15}>
              <Card>
                <CardHeader
                  eyebrow="Result"
                  title="Estimated climate at the new spot"
                  subtitle={`Constant offset of ${estimated.offset >= 0 ? '+' : ''}${estimated.offset.toFixed(2)}°C applied to every day. ${(adjustAmp || adjustRainfall) ? 'Plus seasonal amp and/or rainfall rescaling.' : 'Curve shape and noise preserved exactly.'}`}
                />
                <CardBody>
                  <ResultStats estimated={estimated} oldStats={oldStats} />
                  <div className="mt-4 flex gap-3 flex-wrap">
                    <button onClick={saveAsLocation} className="btn-primary">Save as a new location</button>
                    <button onClick={apply} className="btn-secondary">Use this as the current climate</button>
                    <button onClick={downloadEstimate} className="btn-secondary">Download CSV</button>
                  </div>
                  <div className="mt-3 text-xs text-ink-600 italic">
                    "Save as a new location" adds this estimate to the location picker (top right) so you can switch between it and your other named climates without losing data. "Use as the current climate" overwrites your active climate without saving it.
                  </div>
                </CardBody>
              </Card>
            </Reveal>
          )}

          {estimated && estimated.error && (
            <Reveal delay={0.15}>
              <Card>
                <CardBody>
                  <div className="text-sm text-terra-700">{estimated.error}</div>
                </CardBody>
              </Card>
            </Reveal>
          )}
        </>
      )}

      <Reveal delay={0.2}>
        <Card>
          <CardHeader eyebrow="When this works, when it doesn't" title="Caveats" />
          <CardBody>
            <div className="text-sm text-ink-700 space-y-3">
              <p>
                The single-reading approach <strong className="text-forest-800">only captures a constant offset</strong>. If the new spot has the same latitude (similar Z) and similar rainfall as the loaded climate, that's enough. The seasonal swing and noise pattern carry over exactly.
              </p>
              <p>
                If you moved a long distance north or south, the seasonal amplitude is wrong (poles swing harder than the equator). Toggle "Moved a long way north or south" and provide a guess at the new latitude.
              </p>
              <p>
                If F3 shows a different rainfall percentage, the daily min-to-max swing is also wrong. Toggle "Different rainfall" and enter the new value.
              </p>
              <p>
                For an exact climate, run <code className="font-mono">/debug exptempplot</code> at the new spot and upload that CSV in Settings.
              </p>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Flourish />
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">{children}</div>
      {hint && <div className="text-[10px] text-ink-500 italic mt-1 max-w-2xl">{hint}</div>}
    </div>
  );
}

function Stat({ label, value, note }) {
  return (
    <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3">
      <div className="text-xs text-ink-600 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-medium text-forest-900 tabular">{value}</div>
      {note && <div className="text-xs text-ink-500 italic mt-0.5">{note}</div>}
    </div>
  );
}

function ResultStats({ estimated, oldStats }) {
  const newAvg = computeYearAvg(estimated.climate);
  const newAmp = computeSeasonalAmp(estimated.climate);
  const newDiurnal = computeDiurnalAvg(estimated.climate);
  const newColdest = Math.min(...estimated.climate.map(d => d.avg));
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <CompareStat label="Year avg" oldValue={oldStats.yearAvg} newValue={newAvg} unit="°C" />
      <CompareStat label="Seasonal amp" oldValue={oldStats.amp} newValue={newAmp} unit="°C" />
      <CompareStat label="Diurnal avg" oldValue={oldStats.diurnal} newValue={newDiurnal} unit="°C" />
      <Stat label="Coldest day" value={`${newColdest.toFixed(2)}°C`} note="of the new estimated curve" />
    </div>
  );
}

function CompareStat({ label, oldValue, newValue, unit }) {
  const delta = newValue - oldValue;
  return (
    <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3">
      <div className="text-xs text-ink-600 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-medium text-forest-900 tabular">{newValue.toFixed(2)}{unit}</div>
      <div className="text-xs text-ink-500 mt-0.5">
        was <span className="tabular">{oldValue.toFixed(2)}{unit}</span>
        {Math.abs(delta) > 0.01 && (
          <span className={delta > 0 ? 'text-forest-700' : 'text-terra-700'}>
            {' '}({delta >= 0 ? '+' : ''}{delta.toFixed(2)})
          </span>
        )}
      </div>
    </div>
  );
}

// Climate Estimator (beta).
//
// Predicts a full game year's climate at any spot using only inputs the
// player can directly read off F3 or the in-game UI:
//   - X, Y, Z coordinates of the new spot
//   - Current temperature shown on F3
//   - Current in-game date and hour
//   - Qualitative rainfall (Almost never to Almost always)
//
// Optional: enter the Z of the spot where the loaded climate was sampled
// (the /debug exptempplot location) and the estimator adjusts latitude based
// on the Z delta. Without that, latitude is assumed equal to the loaded
// climate's.
//
// All math is traced to the source (Temperature.cs, Climate.cs, GenMaps.cs);
// see comments in data/climateEstimator.js.

import { useState, useMemo } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import { useSettings } from '../lib/storage.js';
import { useClimate } from '../lib/useClimate.js';
import { dateLabel, MONTH_NAMES } from '../data/climate.js';
import {
  RAINFALL_LEVELS, SEA_LEVEL,
  inferLatitudeMagnitude, solveWorldGenTemperature, projectYearClimate,
  latitudeSlope, climateToCsvString,
} from '../data/climateEstimator.js';

export default function ClimateEstimatorPage() {
  const [settings] = useSettings();
  const { climate, setCustom, addLocation } = useClimate();
  const dpm = settings.daysPerMonth || 9;
  const daysPerYear = dpm * 12;
  const polarEqDist = settings.worldConfig?.polarEquatorDistance || 50000;

  // Old climate stats. Just for latitude inference and the "for comparison"
  // readout against the user's F3 temperature.
  const oldStats = useMemo(() => {
    if (!climate || climate.length === 0) return null;
    const sumAvg = climate.reduce((s, d) => s + d.avg, 0);
    const sumDiu = climate.reduce((s, d) => s + (d.max - d.min), 0);
    const yearAvg = sumAvg / climate.length;
    const diurnalAvg = sumDiu / climate.length;
    const sorted = climate.map(d => d.avg).slice().sort((a, b) => a - b);
    const seasonalAmp = sorted[sorted.length - 1] - sorted[0];
    const latMag = inferLatitudeMagnitude(climate);
    const rainfall = Math.max(0, Math.min(1, (18 - diurnalAvg) / 13));
    return {
      yearAvg, diurnalAvg, seasonalAmp,
      latitudeMagnitude: latMag,
      rainfall,
      hemisphere: yearAvg >= 0 ? 'north' : 'south',
    };
  }, [climate]);

  // Inputs at the new spot.
  const [newX, setNewX] = useState('');
  const [newY, setNewY] = useState(String(SEA_LEVEL));
  const [newZ, setNewZ] = useState('');
  const [readTemp, setReadTemp] = useState('');
  const [readMonth, setReadMonth] = useState(() => Math.floor((settings.today - 1) / dpm) % 12);
  const [readDay, setReadDay] = useState(() => ((settings.today - 1) % dpm) + 1);
  const [readHour, setReadHour] = useState(12);
  const [rainfallKey, setRainfallKey] = useState('often');
  const [hemisphere, setHemisphere] = useState(() => oldStats?.hemisphere || 'north');

  // Optional: old sample location for latitude delta.
  const [useOldCoords, setUseOldCoords] = useState(false);
  const [oldZ, setOldZ] = useState('');

  const rainfallNum = RAINFALL_LEVELS.find(r => r.key === rainfallKey)?.value ?? 0.5;
  const dayOfYear = readMonth * dpm + readDay;

  // Resolve the new spot's latitude.
  const latitude = useMemo(() => {
    const base = (oldStats?.latitudeMagnitude ?? 0.5) * (hemisphere === 'north' ? 1 : -1);
    if (!useOldCoords) return base;
    const oz = parseFloat(oldZ);
    const nz = parseFloat(newZ);
    if (!isFinite(oz) || !isFinite(nz)) return base;
    const slope = latitudeSlope(polarEqDist);
    const sign = hemisphere === 'north' ? 1 : -1;
    const shifted = base + sign * (nz - oz) * slope;
    return Math.max(-1, Math.min(1, shifted));
  }, [oldStats, hemisphere, useOldCoords, oldZ, newZ, polarEqDist]);

  // The estimate.
  const estimate = useMemo(() => {
    const t = parseFloat(readTemp);
    const y = parseFloat(newY);
    if (!isFinite(t) || !isFinite(y)) return null;

    const wgt = solveWorldGenTemperature({
      observedTemp: t, dayOfYear, hourOfDay: readHour, daysPerYear,
      latitude, rainfall: rainfallNum, y,
    });

    const days = projectYearClimate({
      worldGenTemp: wgt, latitude, rainfall: rainfallNum, daysPerMonth: dpm, y,
    });

    const sumAvg = days.reduce((s, d) => s + d.avg, 0);
    const yearAvg = sumAvg / days.length;
    const sorted = days.map(d => d.avg).slice().sort((a, b) => a - b);
    const winterLow = sorted[0];
    const summerPeak = sorted[sorted.length - 1];

    return {
      days, worldGenTemp: wgt, latitude, rainfall: rainfallNum,
      yearAvg, summerPeak, winterLow,
      seasonalAmp: summerPeak - winterLow,
      diurnalAmp: 18 - rainfallNum * 13,
    };
  }, [readTemp, newY, dayOfYear, readHour, daysPerYear, latitude, rainfallNum, dpm]);

  // Sanity check: what the OLD climate would have read at this same moment.
  const oldPredictionAtMoment = useMemo(() => {
    if (!climate || climate.length === 0) return null;
    if (dayOfYear < 1 || dayOfYear > climate.length) return null;
    const d = climate[dayOfYear - 1];
    if (!d) return null;
    const dayAmp = d.max - d.min;
    let diff = readHour - 4;
    diff = ((diff % 24) + 24) % 24;
    if (diff > 12) diff -= 24;
    const tt = Math.abs(diff) / 12;
    const xs = Math.max(0, Math.min(1, tt));
    const d6Am = xs * xs * (3 - 2 * xs);
    return d.avg + (d6Am - 0.5) * dayAmp;
  }, [climate, dayOfYear, readHour]);

  const ready = Boolean(estimate);

  const apply = () => { if (estimate) setCustom(estimate.days); };
  const saveAsLocation = () => {
    if (!estimate) return;
    const x = parseFloat(newX), y = parseFloat(newY), z = parseFloat(newZ);
    const coordTxt = [x, y, z].every(isFinite) ? ` at (${x}, ${y}, ${z})` : '';
    const defaultName = `Estimate${coordTxt}`;
    const name = prompt('Name this location:', defaultName);
    if (!name) return;
    addLocation(name, estimate.days, {
      notes: `Estimated from F3 reading: ${parseFloat(readTemp).toFixed(1)}\u00B0C at ${dateLabel(dayOfYear, dpm)} ${readHour}:00. Y=${y}, latitude ${estimate.latitude.toFixed(2)}, rainfall ${rainfallKey}.`,
      activate: true,
    });
  };
  const downloadCsv = () => {
    if (!estimate) return;
    const x = parseFloat(newX), y = parseFloat(newY), z = parseFloat(newZ);
    const csv = climateToCsvString(estimate.days, {
      location: [x, y, z].every(isFinite) ? { x, y, z } : undefined,
      worldGenTemp: estimate.worldGenTemp,
      latitude: estimate.latitude,
      rainfall: estimate.rainfall,
      daysPerMonth: dpm,
      note: `Estimated from F3 reading at ${dateLabel(dayOfYear, dpm)} ${readHour}:00 (${parseFloat(readTemp).toFixed(2)} C). Rainfall picker: ${rainfallKey}.`,
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
          <div className="section-eyebrow text-forest-700">\u00A7E \u00B7 Climate estimator (beta)</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Predict a year of weather <span className="heading-italic">from a single F3 reading</span>
          </h2>
          <p className="mt-3 text-ink-600 max-w-3xl">
            You stand somewhere, press F3, write down where you are and what the screen says. This tool plugs those numbers into the game's own per-spot temperature formula and projects a year of daily averages, mins, and maxes for that location. Useful when scouting a new base site, or when you want to know what crops will survive somewhere before you carry seeds out there.
          </p>
        </div>
      </Reveal>

      {!oldStats && (
        <Reveal delay={0.05}>
          <Card>
            <CardBody>
              <div className="text-sm text-terra-700">
                No climate is currently loaded. Upload a CSV in Settings, then Climate first, or use the bundled climate. The estimator borrows the loaded climate's latitude as a starting point.
              </div>
            </CardBody>
          </Card>
        </Reveal>
      )}

      {oldStats && (
        <>
          <Reveal delay={0.05}>
            <Card>
              <CardHeader
                eyebrow="Where you are"
                title="What F3 tells you"
                subtitle="Open F3 and copy these numbers across. Temperature is on the climate line. X, Y, Z are on the position line. The in-game clock gives you the date and hour."
              />
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="X (east-west)">
                    <input type="number" step="1" className="input-field tabular w-full"
                      placeholder="e.g. 510320" value={newX}
                      onChange={(e) => setNewX(e.target.value)} />
                  </Field>
                  <Field label="Y (altitude)" hint={`Sea level is ${SEA_LEVEL}. Each block above sea level is about -0.67\u00B0C; below is +0.67\u00B0C.`}>
                    <input type="number" step="1" className="input-field tabular w-full"
                      placeholder={String(SEA_LEVEL)} value={newY}
                      onChange={(e) => setNewY(e.target.value)} />
                  </Field>
                  <Field label="Z (north-south)">
                    <input type="number" step="1" className="input-field tabular w-full"
                      placeholder="e.g. 488015" value={newZ}
                      onChange={(e) => setNewZ(e.target.value)} />
                  </Field>
                  <Field label="Month">
                    <select className="select-field" value={readMonth}
                      onChange={(e) => setReadMonth(parseInt(e.target.value))}>
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label={`Day of month (1-${dpm})`}>
                    <input type="number" min="1" max={dpm} className="input-field tabular w-full"
                      value={readDay}
                      onChange={(e) => setReadDay(Math.max(1, Math.min(dpm, parseInt(e.target.value) || 1)))} />
                  </Field>
                  <Field label="Hour (0-23)" hint="In-game time. F3 shows it in the bottom-left, or run /time in chat.">
                    <input type="number" min="0" max="23" className="input-field tabular w-full"
                      value={readHour}
                      onChange={(e) => setReadHour(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))} />
                  </Field>
                  <Field label="Temperature (\u00B0C)" hint="The number after Temp on the F3 climate line.">
                    <input type="number" step="0.1" className="input-field tabular w-full"
                      placeholder="e.g. 12.4" value={readTemp}
                      onChange={(e) => setReadTemp(e.target.value)} />
                  </Field>
                  <Field label="How often does it rain here?" hint="Pick what matches what you've observed walking around. The game uses rainfall to set the day-night temperature swing.">
                    <select className="select-field" value={rainfallKey}
                      onChange={(e) => setRainfallKey(e.target.value)}>
                      {RAINFALL_LEVELS.map(r => (
                        <option key={r.key} value={r.key}>{r.label} ({r.hint})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Hemisphere" hint="Northern winters peak in Jan, southern winters in Jul.">
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => setHemisphere('north')}
                        className={`px-3 py-1.5 rounded border text-xs flex-1 ${hemisphere === 'north' ? 'border-forest-700 bg-forest-50 text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40'}`}>
                        North
                      </button>
                      <button type="button"
                        onClick={() => setHemisphere('south')}
                        className={`px-3 py-1.5 rounded border text-xs flex-1 ${hemisphere === 'south' ? 'border-forest-700 bg-forest-50 text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40'}`}>
                        South
                      </button>
                    </div>
                  </Field>
                </div>

                {ready && oldPredictionAtMoment !== null && (
                  <div className="mt-5 px-3 py-2 rounded bg-parchment-100/60 border border-parchment-300/40 text-sm">
                    <span className="text-ink-600">For comparison, the loaded climate would read </span>
                    <strong className="tabular text-forest-900">{oldPredictionAtMoment.toFixed(1)}\u00B0C</strong>
                    <span className="text-ink-600"> at this same date and hour. Your reading is </span>
                    <strong className={`tabular ${parseFloat(readTemp) >= oldPredictionAtMoment ? 'text-forest-700' : 'text-terra-700'}`}>
                      {(parseFloat(readTemp) - oldPredictionAtMoment >= 0 ? '+' : '') + (parseFloat(readTemp) - oldPredictionAtMoment).toFixed(1)}\u00B0C
                    </strong>
                    <span className="text-ink-600"> away from that.</span>
                  </div>
                )}

                <div className="mt-5 border-t border-parchment-300/40 pt-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={useOldCoords}
                      onChange={(e) => setUseOldCoords(e.target.checked)} className="mt-1" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-forest-900">I know the Z of where my loaded climate came from</div>
                      <div className="text-xs text-ink-600 italic">If you ran /debug exptempplot at a specific spot, enter its Z here so the estimator adjusts latitude based on how far north or south you've moved. Otherwise it assumes the new spot has the same latitude as the loaded climate.</div>
                    </div>
                  </label>
                  {useOldCoords && (
                    <div className="mt-3 ml-7 max-w-xs">
                      <Field label="Old Z (the /debug exptempplot spot)" hint={`Slope: ${(latitudeSlope(polarEqDist) * 1000).toFixed(3)} latitude per 1000 Z blocks on this server's polarEquatorDistance (${polarEqDist}).`}>
                        <input type="number" step="1" className="input-field tabular w-full"
                          value={oldZ} onChange={(e) => setOldZ(e.target.value)} />
                      </Field>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </Reveal>

          {ready && estimate && (
            <Reveal delay={0.1}>
              <Card>
                <CardHeader
                  eyebrow="Result"
                  title="Estimated climate at this spot"
                  subtitle="Computed from the game's own per-spot formula. Numbers are deterministic; the real game adds about \u00B13\u00B0C yearly noise and \u00B11\u00B0C daily noise on top."
                />
                <CardBody>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Stat label="Year avg" value={`${estimate.yearAvg.toFixed(1)}\u00B0C`}
                      note={oldStats ? `loaded: ${oldStats.yearAvg.toFixed(1)}\u00B0C` : undefined} />
                    <Stat label="Summer peak" value={`${estimate.summerPeak.toFixed(1)}\u00B0C`} note="warmest daily avg" />
                    <Stat label="Winter low" value={`${estimate.winterLow.toFixed(1)}\u00B0C`} note="coldest daily avg" />
                    <Stat label="Day-night swing" value={`${estimate.diurnalAmp.toFixed(1)}\u00B0C`} note={`from rainfall ${rainfallKey.replace('-', ' ')}`} />
                  </div>

                  <div className="mt-4 px-3 py-2 rounded border border-parchment-300/40 text-xs text-ink-600 leading-relaxed">
                    Computed latitude: <strong className="tabular text-forest-900">{estimate.latitude.toFixed(2)}</strong>
                    {' '}({hemisphere}). Worldgen base temperature at this spot:{' '}
                    <strong className="tabular text-forest-900">{estimate.worldGenTemp.toFixed(1)}\u00B0C</strong>.
                    Seasonal amplitude: <strong className="tabular">{estimate.seasonalAmp.toFixed(1)}\u00B0C</strong> peak-to-trough.
                  </div>

                  <div className="mt-4 flex gap-3 flex-wrap">
                    <button onClick={saveAsLocation} className="btn-primary">Save as a new location</button>
                    <button onClick={apply} className="btn-secondary">Use this as the current climate</button>
                    <button onClick={downloadCsv} className="btn-secondary">Download CSV</button>
                  </div>
                  <div className="mt-3 text-xs text-ink-600 italic">
                    "Save as a new location" adds this to the location picker so you can switch back to your original climate without losing it. "Use as the current climate" replaces your active climate immediately.
                  </div>
                </CardBody>
              </Card>
            </Reveal>
          )}

          <Reveal delay={0.15}>
            <Card>
              <CardHeader eyebrow="How this works, and what it can't do" title="Caveats" />
              <CardBody>
                <div className="text-sm text-ink-700 space-y-3">
                  <p>
                    The math comes straight from the game's <code className="font-mono text-xs bg-parchment-200/60 px-1 rounded">Event_OnGetClimate</code>, then <code className="font-mono text-xs bg-parchment-200/60 px-1 rounded">updateTemperature</code>. From your single reading, the tool solves for the location's static average temperature (what the game calls <em>WorldGenTemperature</em>), then projects every day of the year using the same formula in reverse.
                  </p>
                  <p>
                    <strong className="text-forest-900">Altitude does count.</strong> The game subtracts (Y minus sea level) / 1.5 from the displayed temperature. A spot at Y=160 is about 33\u00B0C colder than the same spot at Y=110, all else equal. If you typed the wrong Y, the entire projected year will be biased.
                  </p>
                  <p>
                    <strong className="text-forest-900">X doesn't affect climate</strong> beyond what the worldgen climate map randomly placed (which is locked in at world creation). The estimator captures whatever the actual map says via your temperature reading; you don't need to do anything with X yourself.
                  </p>
                  <p>
                    <strong className="text-forest-900">Z affects latitude</strong>, but only the difference matters. Without knowing where your loaded climate was sampled, the estimator assumes the new spot has the same latitude. Toggle the "I know the old Z" option to get a latitude shift for long north-south journeys.
                  </p>
                  <p>
                    <strong className="text-forest-900">Rainfall is qualitative.</strong> Pick the option that matches what you've actually seen at the new spot. The numeric mapping is approximate; the labels span 17\u00B0C (Almost never) down to 7\u00B0C (Almost always) of day-night swing in even steps.
                  </p>
                  <p>
                    <strong className="text-forest-900">For an exact answer</strong>, run <code className="font-mono text-xs bg-parchment-200/60 px-1 rounded">/debug exptempplot</code> at the new spot and upload that CSV in Settings, then Climate. The estimator is for the case where you haven't done that yet, or can't (no <code className="font-mono">controlserver</code> privilege).
                  </p>
                </div>
              </CardBody>
            </Card>
          </Reveal>
        </>
      )}

      <Flourish />
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-700 mb-1">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-ink-500 italic mt-1">{hint}</div>}
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

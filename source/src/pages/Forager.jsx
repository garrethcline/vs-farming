// Forager / wild-spawn estimator (beta).
//
// Given a player's current climate, estimates how far they'd need to travel
// to find naturally-spawned crops, berries, fruit-tree branches, and forest
// trees including bamboo. Numbers come from the worldgen JSONs:
//   crops, berry bushes -> blockpatches/{crop,berrybush}.json
//   fruit trees         -> blocktypes/plant/fruittreebranch.json (worldgen attr)
//   forest trees        -> worldgen/treengenproperties.json
//
// Limits:
// - Latitude-driven temperature is a first-order linear estimate. Real
//   game has seasonal smootherstep and yearly noise (we use yearly avg).
// - Rainfall is noise-driven, so the "rain-distance" is a rough wander
//   guess, not directional.
// - Patch chance assumes avg ChanceMultiplier (2.5) per chunk; in reality
//   it ranges 0.5-4.5 with gaussian variance. So real distances spread
//   roughly +/-50% from the headline number.
// - Forest tree distances assume the species mix at your spot honors weight;
//   we estimate "blocks until first matching tree" but trees are mixed in
//   with all the others.

import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import { useSettings } from '../lib/storage.js';
import { useClimate } from '../lib/useClimate.js';
import { dateLabel, climateAt } from '../data/climate.js';
import {
  WILD_CROPS, WILD_BUSHES, WILD_FRUIT_TREES, WILD_TREES,
  spawnEstimate, formatDistance,
} from '../data/wildSpawn.js';
import LocationPicker from '../components/LocationPicker.jsx';

const CATEGORIES = [
  { id: 'crops', label: 'Crops', data: WILD_CROPS, kind: 'crop' },
  { id: 'bushes', label: 'Berry bushes', data: WILD_BUSHES, kind: 'bush' },
  { id: 'fruittrees', label: 'Fruit-tree branches', data: WILD_FRUIT_TREES, kind: 'fruittree' },
  { id: 'trees', label: 'Forest trees', data: null, kind: 'tree' },  // resolved at runtime
  { id: 'shrubs', label: 'Forest shrubs', data: null, kind: 'shrub' },
];

export default function ForagerPage() {
  const [settings] = useSettings();
  const { climate: climateArr } = useClimate();
  const todayClimate = useMemo(() => climateAt(settings.today, false), [settings.today, climateArr]);
  const [category, setCategory] = useState('crops');
  const [search, setSearch] = useState('');
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideTemp, setOverrideTemp] = useState(todayClimate?.avg ?? 10);
  const [overrideRain, setOverrideRain] = useState(todayClimate?.rainfall ?? 0.6);
  const [polarEqDist, setPolarEqDist] = useState(settings.worldConfig?.polarEquatorDistance ?? settings.polarEquatorDistance ?? 50000);
  const worldLength = settings.worldConfig?.worldLength ?? Infinity;
  // Forest hint = landcover × 255. The user can override on a per-spot basis
  // since their farm might be in a clearing (lower) or deep forest (higher)
  // even if the world-wide landcover average is something else.
  const landcover = settings.worldConfig?.landcover ?? 0.50;
  const [forestHint, setForestHint] = useState(Math.round(landcover * 255));
  const [hemisphere, setHemisphere] = useState(settings.hemisphere ?? 'north');

  const playerTemp = overrideMode ? overrideTemp : (todayClimate?.avg ?? 10);
  const playerRain = overrideMode ? overrideRain : (todayClimate?.rainfall ?? 0.6);

  const list = useMemo(() => {
    const cat = CATEGORIES.find(c => c.id === category);
    if (!cat) return [];
    let data = cat.data;
    if (cat.id === 'trees') data = WILD_TREES.filter(t => t.kind === 'tree');
    if (cat.id === 'shrubs') data = WILD_TREES.filter(t => t.kind === 'shrub');
    const filter = search.trim().toLowerCase();
    return data
      .map(entry => ({
        entry,
        result: spawnEstimate(entry, { playerTemp, playerRain, polarEqDist, worldLength, forestHint, kind: cat.kind }),
      }))
      .filter(({ entry }) => !filter || entry.name.toLowerCase().includes(filter))
      .sort((a, b) => {
        if (a.result.inRange !== b.result.inRange) return a.result.inRange ? -1 : 1;
        return a.result.totalDistance - b.result.totalDistance;
      });
  }, [category, search, playerTemp, playerRain, polarEqDist, worldLength, forestHint]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="section-eyebrow text-forest-700">§ Forager (beta)</div>
            <h2 className="heading-display text-4xl md:text-5xl mt-2">
              How far is the nearest <span className="heading-italic">wild</span> patch?
            </h2>
            <p className="mt-3 text-ink-600 max-w-3xl">
              Given your spot's climate, this estimates how far you'd need to walk to find naturally-spawning crops, berry bushes, fruit-tree branches, or forest trees. Useful when you need a specific resource (rice, bamboo, peach branches) and don't want to wander blind. Numbers are first-order estimates from the worldgen JSONs; reality has noise variance of roughly +/-50%.
            </p>
          </div>
          <LocationPicker />
        </div>
      </Reveal>

      {/* Climate readout + override */}
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            eyebrow="Your climate"
            title={`${playerTemp.toFixed(1)}°C, rainfall ${(playerRain * 100).toFixed(0)}%`}
            subtitle={overrideMode ? 'Manually overridden below.' : `From your today setting (${dateLabel(settings.today, settings.daysPerMonth)}, climate at this date).`}
          />
          <CardBody>
            <div className="flex flex-wrap gap-2 items-end mb-3">
              <button
                onClick={() => setOverrideMode(!overrideMode)}
                className={`px-3 py-1.5 rounded border text-xs ${overrideMode ? 'border-forest-700 satiety-card-selected text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40'}`}
              >
                {overrideMode ? '✓ Manual climate' : 'Use my today setting'}
              </button>
              {overrideMode && (
                <>
                  <label className="block text-xs">
                    <span className="text-ink-600 block mb-0.5">Temperature (°C)</span>
                    <input
                      type="number"
                      step="0.5"
                      value={overrideTemp}
                      onChange={e => setOverrideTemp(parseFloat(e.target.value) || 0)}
                      className="input-field tabular w-24"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="text-ink-600 block mb-0.5">Rainfall (0-1)</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0" max="1"
                      value={overrideRain}
                      onChange={e => setOverrideRain(parseFloat(e.target.value) || 0)}
                      className="input-field tabular w-24"
                    />
                  </label>
                </>
              )}
              <label className="block text-xs">
                <span className="text-ink-600 block mb-0.5">Polar-equator distance (blocks)</span>
                <input
                  type="number"
                  step="1000"
                  value={polarEqDist}
                  onChange={e => setPolarEqDist(parseInt(e.target.value, 10) || 50000)}
                  className="input-field tabular w-32"
                />
              </label>
              <label className="block text-xs">
                <span className="text-ink-600 block mb-0.5">Forest density (0 to 255)</span>
                <input
                  type="number"
                  min="0" max="255" step="5"
                  value={forestHint}
                  onChange={e => setForestHint(Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 0)))}
                  className="input-field tabular w-20"
                />
              </label>
              <label className="block text-xs">
                <span className="text-ink-600 block mb-0.5">Hemisphere</span>
                <select
                  value={hemisphere}
                  onChange={e => setHemisphere(e.target.value)}
                  className="select-field w-28"
                >
                  <option value="north">Northern</option>
                  <option value="south">Southern</option>
                </select>
              </label>
            </div>
            <div className="text-xs text-ink-600 italic space-y-1">
              <div>The polar-equator distance comes from your server's worldconfig and controls how steep the temperature gradient is. Default vanilla is 50000 blocks; smaller values mean climate changes faster as you walk N/S.</div>
              <div>Forest density is the local forest score at your spot (0 = open field, 128 = average forest, 255 = dense old-growth). Defaults to landcover × 255 from your worldconfig. Affects which trees/shrubs spawn at your spot. Read F3 / world map for the local value if you want exact.</div>
              <div>Hemisphere flips which direction is warmer. Northern: walking south takes you toward the equator (warmer). Southern: north is warmer. Check your in-game world map; the equator is the line where temperatures peak.</div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Category tabs + search */}
      <Reveal delay={0.1}>
        <Card>
          <CardHeader
            eyebrow="What to look for"
            title="Pick a category"
          />
          <CardBody>
            <div className="flex flex-wrap gap-2 mb-3">
              {CATEGORIES.map(c => {
                let count = c.data ? c.data.length : 0;
                if (c.id === 'trees') count = WILD_TREES.filter(t => t.kind === 'tree').length;
                if (c.id === 'shrubs') count = WILD_TREES.filter(t => t.kind === 'shrub').length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`px-3 py-1.5 rounded border text-xs ${category === c.id ? 'border-forest-700 satiety-card-selected text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40'}`}
                  >
                    {c.label} <span className="text-ink-500 tabular">({count})</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field w-full md:w-80"
            />
          </CardBody>
        </Card>
      </Reveal>

      {/* Results table */}
      <Reveal delay={0.15}>
        <Card>
          <CardHeader
            eyebrow={`Results · ${list.length} ${list.length === 1 ? 'entry' : 'entries'}`}
            title="Estimated travel"
            subtitle="Sorted by total expected distance from your spot. Green = your spot already matches; you'll find these locally if patch density is high enough."
          />
          <CardBody>
            {list.length === 0 ? (
              <div className="text-sm text-ink-600 italic">No matches for that search.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular">
                  <thead className="text-xs text-ink-500 text-left border-b border-parchment-300/40">
                    <tr>
                      <th className="font-normal py-2 pr-3">Name</th>
                      <th className="font-normal py-2 pr-3">Climate</th>
                      <th className="font-normal py-2 pr-3">Travel direction</th>
                      <th className="font-normal py-2 pr-3">Climate distance</th>
                      <th className="font-normal py-2 pr-3">In-biome density</th>
                      <th className="font-normal py-2 pr-3">Nearest in biome</th>
                      <th className="font-normal py-2 pr-3">Total estimate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(({ entry, result }) => (
                      <ResultRow key={entry.code} entry={entry} result={result} category={category} hemisphere={hemisphere} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </Reveal>

      {/* Methodology card */}
      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="How this is calculated"
            title="Methodology and limits"
          />
          <CardBody>
            <ul className="text-sm text-ink-700 space-y-2 list-disc pl-6">
              <li><strong>Climate distance</strong>: Vintage Story's temperature follows a triangular wave on the z-axis with period <code>2 × polarEquatorDistance</code>. So a world has <strong>multiple equators</strong> (z = 0, ±2P, ±4P, ...) and <strong>multiple poles</strong> (z = ±P, ±3P, ...). Walking past a pole, the temperature trend reverses. The estimator computes blocks of travel to first reach the variant's range, capped by world length (your finite world wraps), and tries the wrap-around path if it's shorter than the direct one. If the variant needs hotter than your equator gets or colder than your pole, it shows "unreachable".</li>
              <li><strong>Direction</strong>: shown as N or S based on the hemisphere setting. Northern hemisphere: south is warmer (toward equator). Southern hemisphere: north is warmer. The wrap-around path can flip direction since you're going around the world the long way.</li>
              <li><strong>Crops and bushes</strong> (chance-driven): density per chunk = chance × ChanceMultiplier(2.5 avg) × quantity.avg. The ChanceMultiplier has gaussian variance (var=2), so real densities range 0.5x to 4.5x. Nearest-neighbor distance ≈ 0.5 / sqrt(per-block density).</li>
              <li><strong>Forest trees and shrubs</strong> (weight-driven competition): the game gives each chunk ~70 trees / ~90 shrubs distributed by weighted score. For each variant we compute distance from your climate to its mid-point on temp/rain/fertility/forest/height (each normalized by half-range), then score = weight × clamp(1 - sumDist/5, 0, 1). The game also rolls a per-attempt skip chance: a variant survives with probability max(0, 1 - sum of (1.2 × axisD² - 1) over axes that exceed bounds). We multiply the score by that survival probability. Per-chunk count = (perChunkAll) × (variant.adjustedScore / sum_of_adjusted_scores).</li>
              <li><strong>Fruit-tree branches</strong>: spawn ON existing forest trees during worldgen. Per-tree roll depends on local forest mix and tree-host count, which we don't model. We only show the climate range and direction.</li>
              <li><strong>Bamboo</strong>: counted under forest trees. Green bamboo wants 34-40°C and rain 0.67-0.92 (very hot, very humid). Brown is 25-35°C, same rain.</li>
              <li><strong>Variants</strong>: silver birch and old English oak appear twice in the source as separate worldgen entries with different climate ranges. Both are listed since the game treats them as separate candidates that can spawn in different biomes.</li>
              <li><strong>Trees vs shrubs</strong>: many species also have a shrub form (sugar maple small, English oak small, kapok small, dwarf birch). The game spawns shrubs from a separate pool of ~90 per chunk. They're a separate category here.</li>
              <li><strong>Real-world variance</strong>: ChanceMultiplier and trees-per-chunk both have gaussian variance, so densities range roughly 0.5x to 4.5x of estimate. Plus rainfall noise wraps biome edges. A "1000 blocks" estimate could be 500 or 2000 in practice.</li>
            </ul>
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function ResultRow({ entry, result, category, hemisphere = 'north' }) {
  const inRange = result.inRange;
  const isTreeOrShrub = category === 'trees' || category === 'shrubs';
  const isFruitTree = category === 'fruittrees';

  // Map climate direction (warmer/cooler) to compass (N/S) given hemisphere.
  // North hemisphere: south is warmer (toward equator). South hemisphere: north is warmer.
  const compass = (climateDir) => {
    if (climateDir === 'warmer') return hemisphere === 'north' ? 'south' : 'north';
    if (climateDir === 'cooler') return hemisphere === 'north' ? 'north' : 'south';
    return null;
  };
  const compassDir = compass(result.tempDirection);
  const direction = result.tempDirection === 'warmer'
    ? `${compassDir} (warmer)`
    : result.tempDirection === 'cooler'
      ? `${compassDir} (cooler)`
      : 'temperature matches';

  const minRainDisplay = isTreeOrShrub ? (entry.minRain255 / 255).toFixed(2) : (entry.minRain ?? 0).toFixed(2);
  const maxRainDisplay = isTreeOrShrub ? (entry.maxRain255 / 255).toFixed(2) : (entry.maxRain ?? 1).toFixed(2);
  const climateText = `${entry.minTemp}°C to ${entry.maxTemp}°C, rain ${minRainDisplay} to ${maxRainDisplay}`;

  // For trees: temp matches but other axes (rain/fertility/forest) push it
  // out. Distinguish that from "needs different temp".
  const tempMatchesButOutOfRange = isTreeOrShrub && !inRange && result.tempDirection === 'here';

  let densityText;
  if (isFruitTree) {
    densityText = 'spawns on host trees';
  } else if (result.perChunkHere > 0.01) {
    densityText = `${result.perChunkHere.toFixed(2)} per chunk here`;
  } else if (tempMatchesButOutOfRange) {
    densityText = 'wrong rain or soil';
  } else if (isTreeOrShrub) {
    densityText = "won't spawn at your spot";
  } else {
    densityText = 'out of climate range';
  }

  return (
    <tr className={`border-b border-parchment-300/30 ${inRange ? 'bg-forest-50/40' : ''}`}>
      <td className="py-2 pr-3 font-medium text-forest-900">
        {entry.name}
        {isTreeOrShrub && entry.weight !== undefined && (
          <span className="ml-1 text-[10px] text-ink-500 tabular">w={entry.weight}</span>
        )}
      </td>
      <td className="py-2 pr-3 text-xs text-ink-600">{climateText}</td>
      <td className="py-2 pr-3">
        {inRange ? (
          <span className="text-forest-700">in range here</span>
        ) : result.unreachable ? (
          <span className="text-terra-700">past the world's hottest/coldest</span>
        ) : tempMatchesButOutOfRange ? (
          <span className="text-amber-700">find wetter or drier biome</span>
        ) : (
          <span className="text-ink-700">{direction}</span>
        )}
      </td>
      <td className="py-2 pr-3">
        {inRange ? (
          <span className="text-ink-500">here</span>
        ) : result.unreachable ? (
          <span className="text-terra-700">unreachable</span>
        ) : tempMatchesButOutOfRange ? (
          <span className="text-ink-500">temperature ok</span>
        ) : (
          <span>{formatDistance(result.climateDistanceBlocks)}</span>
        )}
      </td>
      <td className="py-2 pr-3 text-xs">
        <span className="text-ink-700">{densityText}</span>
      </td>
      <td className="py-2 pr-3">
        {result.nearestInBiomeBlocks === null ? (
          <span className="text-ink-500 italic">depends on host</span>
        ) : (
          <span>{formatDistance(result.nearestInBiomeBlocks)}</span>
        )}
      </td>
      <td className="py-2 pr-3 font-medium">
        {inRange && result.nearestInBiomeBlocks !== null ? (
          <span className="text-forest-800">{formatDistance(result.nearestInBiomeBlocks)}</span>
        ) : inRange ? (
          <span className="text-forest-800">in range</span>
        ) : isFruitTree ? (
          <span className="text-amber-700">{formatDistance(result.climateDistanceBlocks)} + host</span>
        ) : tempMatchesButOutOfRange ? (
          <span className="text-amber-700">cross biome</span>
        ) : (
          <span className="text-amber-700">{formatDistance(result.totalDistance)}</span>
        )}
      </td>
    </tr>
  );
}

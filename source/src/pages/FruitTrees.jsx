// Fruit trees reference. All 12 cultivated tree varieties.
//
// Source: src/data/fruitTrees.js (which cites the .cs and .json files).
// Companion to the Berries page. Same shape, different data.
import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, NutrientChip, Flourish, Toggle,
} from '../components/ui/Primitives.jsx';
import {
  TREES_LIST, TREE_TYPES, activeCycleDays, canGraft,
  treeTimeline, plantingWindow, vernalizationCheck, climateSurvivable,
} from '../data/fruitTrees.js';
import { useClimate } from '../lib/useClimate.js';
import { useSettings } from '../lib/storage.js';
import { dateLabel } from '../data/climate.js';
import { classStat } from '../data/specializedClasses.js';
import { gameDaysToRealString } from '../lib/realTime.js';
import LocationPicker from '../components/LocationPicker.jsx';

export default function FruitTreesPage() {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [scion, setScion] = useState('redapple');
  const [rootstock, setRootstock] = useState('cherry');
  const [greenhouse, setGreenhouse] = useState(false);
  const [settings] = useSettings();
  const { climate } = useClimate();
  const ghBonus = greenhouse ? 5 : 0;

  // SC mod fruitTreeDropRate stat. 1.0 default. Vintner = 2.0. Most other
  // classes = 0.75. Multiplies the avgFruitsPerHarvest column.
  const classMul = classStat(settings.playerClass || 'commoner', 'fruitTreeDropRate');
  const dpm = settings.daysPerMonth || 9;
  const rhpm = settings.realHoursPerMonth || 16;

  const sorted = useMemo(() => {
    const rows = TREES_LIST.slice();
    rows.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'name':         av = a.name; bv = b.name; break;
        case 'cycle':        av = a.cycleType; bv = b.cycleType; break;
        case 'fruiting':     av = a.fruitingDays; bv = b.fruitingDays; break;
        case 'ripe':         av = a.ripeDays; bv = b.ripeDays; break;
        case 'fruits':       av = a.avgFruitsPerHarvest; bv = b.avgFruitsPerHarvest; break;
        case 'satiety':      av = a.fruitSatietyRaw; bv = b.fruitSatietyRaw; break;
        case 'perHarvest':   av = a.fruitSatietyRaw * a.avgFruitsPerHarvest; bv = b.fruitSatietyRaw * b.avgFruitsPerHarvest; break;
        case 'die':          av = a.dieBelowTemp; bv = b.dieBelowTemp; break;
        case 'wgenMin':      av = a.worldgenTemp.min; bv = b.worldgenTemp.min; break;
        case 'wgenMax':      av = a.worldgenTemp.max; bv = b.worldgenTemp.max; break;
        default:             av = a.name; bv = b.name;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [sortKey, sortDir]);

  function setSort(k) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  const graftAllowed = canGraft(scion, rootstock);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="section-eyebrow text-forest-700">§ · Fruit Trees</div>
            <h2 className="font-display text-3xl text-forest-900 mb-2">Fruit trees & grafting</h2>
            <p className="text-ink-700 max-w-3xl">
              Twelve varieties. Six deciduous (apples, cherry, pear, peach) need a cold winter to vernalize before they flower.
              Six evergreen (mango, olive, orange, breadfruit, lychee, pomegranate) flower at a fixed point in the year and
              don't tolerate cold averages. Trees grow from cuttings; you can also graft a cutting onto a side branch of an
              existing tree, but only if both share the same cycle type. Per-variety values come from{' '}
              <code className="font-mono text-xs bg-parchment-200/50 px-1.5 py-0.5 rounded">BEFruitTreePart.cs</code>{' '}
              and the cutting JSONs. Vernalization, dormancy, and blossom timing are reconstructed from the tick-by-tick state
              machine; treat the projected first-fruit dates as ballpark.
            </p>
          </div>
          <LocationPicker />
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader title="Lifecycle" subtitle="From cutting to first harvest." />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <div className="section-eyebrow text-forest-700 mb-1">Deciduous (apples, cherry, pear, peach)</div>
                <ol className="list-decimal pl-5 space-y-1.5 text-ink-700">
                  <li>Plant a cutting on farmland. Survival chance = <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">cuttingRootingChance</code> (0.4 for all).</li>
                  <li>Young branch grows over multiple <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">growthStepDays</code> (~5 each). Tree slowly matures.</li>
                  <li>Vernalization: tree must accumulate <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">vernalizationHours</code> (~250) under <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">vernalizationTemp</code>. Without that cold dose, no flowers.</li>
                  <li>Dormancy: leaves drop when temp falls under <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">enterDormancyTemp</code>, returns when temp rises above <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">leaveDormancyTemp</code>.</li>
                  <li>Flowers (~4.5 days), fruits (per-variety), ripens (per-variety). Harvest. Repeat next year.</li>
                </ol>
              </div>
              <div>
                <div className="section-eyebrow text-forest-700 mb-1">Evergreen (mango, olive, orange, breadfruit, lychee, pomegranate)</div>
                <ol className="list-decimal pl-5 space-y-1.5 text-ink-700">
                  <li>Plant a cutting on farmland. Same 0.4 chance.</li>
                  <li>Young branch grows over <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">growthStepDays</code> (~5 each).</li>
                  <li>No vernalization. Blossoms when the year reaches <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">blossomAtYearRel</code> (e.g. 0.3 = 30% into the year).</li>
                  <li>Loses leaves only if temp drops below <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">looseLeavesBelowTemp</code>.</li>
                  <li>Flowers, fruits (much longer than deciduous, often 50d+), ripens, drops fruit. Returns to bare and waits for next year.</li>
                </ol>
                <div className="text-xs text-ink-600 mt-2 italic">Evergreens often die at average temperatures most players consider cool (mango/lychee/breadfruit die under 10°C).</div>
              </div>
            </div>
            <div className="mt-4 px-4 py-3 rounded-md border-l-4 border-l-forest-500 bg-forest-100/30 text-xs text-ink-700">
              <strong>Where the numbers come from:</strong> the per-variety properties block in <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">blocktypes/plant/fruittreebranch.json</code>. The lifecycle code is in <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">vssurvivalmod/Systems/FruitTree/</code>.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.08}>
        <Card>
          <CardHeader
            title="Timing for your climate"
            subtitle={`Today is ${dateLabel(settings.today, dpm)}. Plant a cutting in the warm window. Deciduous trees won't fruit until they survive a winter.`}
          />
          <CardBody>
            <div className="mb-4 flex items-center gap-3">
              <Toggle
                checked={greenhouse}
                onChange={setGreenhouse}
                label={greenhouse ? 'Greenhouse on (+5°C all year)' : 'Outdoor (no greenhouse)'}
                helperText={greenhouse
                  ? 'Sealed glass-roof room with a tile above the trunk. Lifts every climate sample by 5°C, which can rescue evergreens that would otherwise die in winter and bring deciduous dormancy break earlier. Note: warm winters under-fill vernalization, so heated greenhouses can break flowering for apples and cherries that depend on cold dosing.'
                  : 'Trees see ambient outdoor temperature. Toggle on to model a sealed glass-roof greenhouse around the tree.'}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment-300/60 text-left text-ink-600 text-xs uppercase tracking-wider">
                    <th className="px-3 py-3">Variety</th>
                    <th className="px-3 py-3">Survives in this climate?</th>
                    <th className="px-3 py-3">Plant window</th>
                    <th className="px-3 py-3">Next flowers</th>
                    <th className="px-3 py-3">Next ripe</th>
                  </tr>
                </thead>
                <tbody>
                  {TREES_LIST.map(t => {
                    const tl = treeTimeline(t, climate, settings.today, dpm, ghBonus);
                    const pw = plantingWindow(t, climate, ghBonus);
                    const v = vernalizationCheck(t, climate, 24, ghBonus);
                    const s = climateSurvivable(t, climate, ghBonus);
                    return (
                      <tr key={t.key} className="border-b border-parchment-300/30 hover:bg-parchment-200/30">
                        <td className="px-3 py-3">
                          <div className="font-medium text-ink-900">{t.name}</div>
                          <div className="text-xs text-ink-600">{t.cycleType}</div>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {!tl?.fruitInClimate ? (
                            <div>
                              <span className="text-terra-700 font-medium">No</span>
                              <div className="text-xs text-ink-600 mt-0.5">
                                {!s.survives ? (
                                  <>Tree dies. {s.dangerDays} day{s.dangerDays !== 1 ? 's' : ''} of the year drop under {t.dieBelowTemp}°C.</>
                                ) : tl?.reason ? (
                                  tl.reason
                                ) : t.cycleType === 'Deciduous' && !v.vernalizes ? (
                                  <>Vernalization fails: only {Math.round(v.hoursAvailable)}h available, needs {v.needed}h under {t.vernalizationTemp}°C.</>
                                ) : (
                                  <>Climate doesn't support this variety.</>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-forest-800 font-medium">Yes</span>
                          )}
                        </td>
                        <td className="px-3 py-3 tabular text-ink-700">
                          {pw && pw.earliestDay && pw.latestDay
                            ? <span title={`Days ${pw.earliestDay} to ${pw.latestDay}`}>{dateLabel(pw.earliestDay, dpm)}<span className="text-ink-500"> to </span>{dateLabel(pw.latestDay, dpm)}</span>
                            : <span className="text-ink-500 italic">no warm days</span>}
                        </td>
                        <td className="px-3 py-3 tabular text-ink-700">
                          {tl?.fruitInClimate && tl.flowers
                            ? <span title={`Day ${tl.flowers}`}>{dateLabel(tl.flowers, dpm)}</span>
                            : <span className="text-ink-500 italic">·</span>}
                        </td>
                        <td className="px-3 py-3 tabular text-forest-900 font-medium">
                          {tl?.fruitInClimate && tl.ripe
                            ? <span title={`Ripe ${dateLabel(tl.ripe, dpm)}, ripe through ${dateLabel(tl.ripeEnd, dpm)}`}>{dateLabel(tl.ripe, dpm)}</span>
                            : <span className="text-ink-500 italic">·</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 px-4 py-3 rounded-md border-l-4 border-l-forest-500 bg-forest-100/30 text-xs text-ink-700">
              <strong>How "next ripe" is computed:</strong> for deciduous trees, the first day of the year where average temp ≥ leaveDormancyTemp (~19°C) plus floweringDays + fruitingDays gives the ripe date. For evergreens, blossomAtYearRel × yearLength is the start of the next flowering cycle. If the date already passed this year, it's pushed to next year. Assumes the tree is fully mature; freshly planted cuttings need extra growthStepDays to mature first.
            </div>
            <div className="mt-2 px-4 py-3 rounded-md border-l-4 border-l-amber-500 bg-amber-100/30 text-xs text-ink-700">
              <strong>Vernalization rule (deciduous):</strong> the tree needs {' '}
              <span className="tabular">~250 hours</span> of accumulated cold (under variety-specific vernalizationTemp, typically 2-5°C) during dormancy before it'll flower. Without that cold dose, no fruit. The "Survives in this climate?" column above estimates whether your climate's winter provides enough cold. If not, no fruit will ever appear.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader title="Variety reference" subtitle={
            classMul !== 1
              ? `Click a column to sort. Class fruitTreeDropRate = ${classMul.toFixed(2)} applied to "Avg fruit/harvest" and "Sat/harvest".`
              : 'Click a column to sort. Sortable by yield, satiety, cold tolerance.'
          } />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment-300/60 text-left text-ink-600 text-xs uppercase tracking-wider">
                  <Th k="name" sortKey={sortKey} dir={sortDir} onClick={() => setSort('name')}>Variety</Th>
                  <Th k="cycle" sortKey={sortKey} dir={sortDir} onClick={() => setSort('cycle')}>Cycle</Th>
                  <Th k="fruiting" sortKey={sortKey} dir={sortDir} onClick={() => setSort('fruiting')}>Fruiting (d)</Th>
                  <Th k="ripe" sortKey={sortKey} dir={sortDir} onClick={() => setSort('ripe')}>Ripe (d)</Th>
                  <Th k="fruits" sortKey={sortKey} dir={sortDir} onClick={() => setSort('fruits')}>Avg fruit/harvest</Th>
                  <Th k="satiety" sortKey={sortKey} dir={sortDir} onClick={() => setSort('satiety')}>Sat/fruit</Th>
                  <Th k="perHarvest" sortKey={sortKey} dir={sortDir} onClick={() => setSort('perHarvest')}>Sat/harvest</Th>
                  <Th k="die" sortKey={sortKey} dir={sortDir} onClick={() => setSort('die')}>Die ≤</Th>
                  <Th k="wgenMin" sortKey={sortKey} dir={sortDir} onClick={() => setSort('wgenMin')}>Wgen min</Th>
                  <Th k="wgenMax" sortKey={sortKey} dir={sortDir} onClick={() => setSort('wgenMax')}>Wgen max</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(t => (
                  <tr key={t.key} className="border-b border-parchment-300/30 hover:bg-parchment-200/30">
                    <td className="px-3 py-3">
                      <div className="font-medium text-ink-900">{t.name}</div>
                      <div className="text-xs text-ink-600 italic">{t.notes}</div>
                    </td>
                    <td className="px-3 py-3">
                      {t.cycleType === 'Deciduous'
                        ? <span className="pill-mod !bg-amber-100 !border-amber-200 !text-amber-800">Deciduous</span>
                        : <span className="pill-mod !bg-forest-100 !border-forest-200 !text-forest-800">Evergreen</span>}
                    </td>
                    <td className="px-3 py-3 tabular text-ink-700" title={`${t.fruitingDays} game days from blossom to fruit. Real-world: ${gameDaysToRealString(t.fruitingDays, dpm, rhpm)} (only counts time when a player is on the server).`}>
                      {t.fruitingDays}
                      <div className="text-[10px] text-ink-500">≈ {gameDaysToRealString(t.fruitingDays, dpm, rhpm)} real</div>
                    </td>
                    <td className="px-3 py-3 tabular text-ink-700" title={`${t.ripeDays} game days the fruit stays harvestable. Real-world: ${gameDaysToRealString(t.ripeDays, dpm, rhpm)} (player must be on the server).`}>
                      {t.ripeDays}
                      <div className="text-[10px] text-ink-500">≈ {gameDaysToRealString(t.ripeDays, dpm, rhpm)} real</div>
                    </td>
                    <td className="px-3 py-3 tabular text-ink-700">
                      <span title={`NatFloat strongerinvexp: avg ${t.avgFruitsPerHarvest}, var ${t.fruitsPerHarvestVar || 4}. Right-skewed: most rolls near low end (often 1-2), occasional bigger pulls up to ${t.avgFruitsPerHarvest + (t.fruitsPerHarvestVar || 4)}.`}>
                        {(t.avgFruitsPerHarvest * classMul).toFixed(1)}<span className="text-ink-400">±{t.fruitsPerHarvestVar || 4}</span>
                      </span>
                      {classMul !== 1 && <span className="text-xs text-ink-500 ml-1">({t.avgFruitsPerHarvest} × {classMul.toFixed(2)})</span>}
                    </td>
                    <td className="px-3 py-3 tabular text-ink-700">{t.fruitSatietyRaw}</td>
                    <td className="px-3 py-3 tabular font-medium text-forest-900">{(t.avgFruitsPerHarvest * t.fruitSatietyRaw * classMul).toFixed(0)}</td>
                    <td className="px-3 py-3 tabular text-terra-700">{t.dieBelowTemp}°</td>
                    <td className="px-3 py-3 tabular text-ink-700">{t.worldgenTemp.min}°</td>
                    <td className="px-3 py-3 tabular text-ink-700">{t.worldgenTemp.max}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card>
          <CardHeader
            eyebrow="Grafting"
            title="Pair a cutting with a rootstock"
            subtitle="Grafting attaches a cutting to an existing tree's side branch. Faster than waiting for a fresh cutting to mature, but constrained by cycle type."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
              <div>
                <label className="section-eyebrow block mb-1 text-forest-700">Cutting (scion)</label>
                <select className="select-field" value={scion} onChange={(e) => setScion(e.target.value)}>
                  {TREES_LIST.map(t => <option key={t.key} value={t.key}>{t.name} ({t.cycleType})</option>)}
                </select>
              </div>
              <div>
                <label className="section-eyebrow block mb-1 text-forest-700">Rootstock (existing tree)</label>
                <select className="select-field" value={rootstock} onChange={(e) => setRootstock(e.target.value)}>
                  {TREES_LIST.map(t => <option key={t.key} value={t.key}>{t.name} ({t.cycleType})</option>)}
                </select>
              </div>
            </div>

            <div className={`px-4 py-4 rounded-md border-l-4 ${
              graftAllowed
                ? 'border-l-forest-500 bg-forest-100/30 text-ink-800'
                : 'border-l-terra-500 bg-terra-300/15 text-ink-800'
            }`}>
              {graftAllowed ? (
                <>
                  <div className="font-medium text-forest-900">
                    {TREE_TYPES[scion].name} can graft onto {TREE_TYPES[rootstock].name}.
                  </div>
                  <div className="text-sm mt-1.5">
                    Both are {TREE_TYPES[scion].cycleType.toLowerCase()}. Survival chance = {TREE_TYPES[scion].graftChance * 100}%.
                    The grafted scion will produce {TREE_TYPES[scion].name.toLowerCase()} fruit, not {TREE_TYPES[rootstock].name.toLowerCase()}.
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium text-terra-700">
                    {TREE_TYPES[scion].name} cannot graft onto {TREE_TYPES[rootstock].name}.
                  </div>
                  <div className="text-sm mt-1.5">
                    Cycle types differ ({TREE_TYPES[scion].cycleType} vs {TREE_TYPES[rootstock].cycleType}).
                    The game returns failure code <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">fruittreecutting-ctypemix</code>.
                    Pick a rootstock with the same cycle type.
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-ink-700">
              <div>
                <div className="section-eyebrow text-forest-700 mb-1">Why graft?</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Faster harvests. The rootstock is already mature, so the scion can fruit much sooner than a fresh cutting.</li>
                  <li>Multiple varieties on one tree. Graft cherries onto the side of a pear, eat both off the same trunk.</li>
                  <li>Easier replacement. If a variety dies in a cold snap, you can graft a replacement onto a hardier rootstock.</li>
                </ul>
              </div>
              <div>
                <div className="section-eyebrow text-forest-700 mb-1">Constraints (from source)</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Cycle type must match (deciduous to deciduous, evergreen to evergreen). <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">BlockFruitTreeBranch.cs:118</code></li>
                  <li>Graft on a side face only, not the bottom. <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">BlockFruitTreeBranch.cs:110</code></li>
                  <li>Scion still inherits the rootstock's vernalization status (root is what feels the cold).</li>
                  <li>Each variety has cuttingGraftChance = 0.6 (default 0.5 in code, overridden to 0.6 in JSON).</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader title="Specialized Classes" subtitle="Mod hooks for tree drops." />
          <CardBody>
            <div className="text-sm text-ink-700 space-y-2">
              <p>
                The Specialized Classes mod (opt-in) patches tree drops at <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">survival-blocktypes-plant-fruittreebranch.json</code> with the <code className="text-xs px-1.5 py-0.5 bg-parchment-200/40 rounded">fruitTreeDropRate</code> stat. Two classes use it:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-ink-800">Vintner:</strong> fruitTreeDropRate +1.0 (doubles fruit per harvest), forageDropRate +1.0, treeSeedDropRate +1.0</li>
                <li><strong className="text-ink-800">Forester:</strong> treeSeedDropRate +3.0 (only affects seeds, not fruit drops)</li>
              </ul>
              <p className="text-xs text-ink-600 italic">Default Commoner gets the base avgFruitsPerHarvest from the table. Vintner doubles it.</p>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function Th({ children, k, sortKey, dir, onClick }) {
  const active = k === sortKey;
  return (
    <th
      className={`px-3 py-3 cursor-pointer hover:text-forest-800 select-none ${active ? 'text-forest-800' : ''}`}
      onClick={onClick}
    >
      {children}
      {active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

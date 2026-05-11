// Berries reference. All 10 cultivated berry varieties.
import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, NutrientChip, Flourish,
} from '../components/ui/Primitives.jsx';
import {
  BERRIES_LIST, BERRY_STAGES, FIRST_RIPE_MONTHS, RECYCLE_MONTHS,
  berryNpk, berrySatietyPerHarvest, berrySatietyPerMonth, berryTempGates,
  berryClimateAnalysis, berryClassYieldMul,
} from '../data/berries.js';
import { useClimate } from '../lib/useClimate.js';
import { useSettings } from '../lib/storage.js';
import { dateLabel } from '../data/climate.js';
import { classStat } from '../data/specializedClasses.js';
import { gameDaysToRealString } from '../lib/realTime.js';

export default function BerriesPage() {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [includeCultivated, setIncludeCultivated] = useState(false);
  const [settings] = useSettings();
  const { climate } = useClimate();

  // Class drop rate. Vintner = 2.0, sheltered/overkill = 0.75, others = 1.0.
  const forageDropRate = classStat(settings.playerClass || 'commoner', 'forageDropRate');
  const dpm = settings.daysPerMonth || 9;
  const rhpm = settings.realHoursPerMonth || 16;
  const yieldMul = berryClassYieldMul(forageDropRate, includeCultivated);

  const sorted = useMemo(() => {
    const rows = BERRIES_LIST.slice();
    rows.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'name':       av = a.name; bv = b.name; break;
        case 'yield':      av = a.yieldRipe; bv = b.yieldRipe; break;
        case 'satiety':    av = a.satietyPerFruit; bv = b.satietyPerFruit; break;
        case 'perHarvest': av = berrySatietyPerHarvest(a); bv = berrySatietyPerHarvest(b); break;
        case 'perMonth':   av = berrySatietyPerMonth(a); bv = berrySatietyPerMonth(b); break;
        case 'minTemp':    av = a.wildClimate.minTemp; bv = b.wildClimate.minTemp; break;
        case 'maxTemp':    av = a.wildClimate.maxTemp; bv = b.wildClimate.maxTemp; break;
        case 'tier':       av = a.npkTier; bv = b.npkTier; break;
        default:           av = a.name; bv = b.name;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [sortKey, sortDir]);

  function setSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§6 · Berries</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            The <span className="heading-italic">ten</span> berry bushes
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl">
            Reworked perennial system from VS 1.20+. Bushes consume NPK like crops, cycle through five named stages, and pause / reset growth based on temperature. Mechanics from{' '}
            <code className="font-mono text-xs bg-parchment-200/50 px-1.5 py-0.5 rounded">BlockBehaviorFruitingBush.cs</code>
            ; per-variety yields, NPK schedule, dormancy temps, and stage timings from{' '}
            <code className="font-mono text-xs bg-parchment-200/50 px-1.5 py-0.5 rounded">survival/blocktypes/plant/fruitingbush.json</code>. The JSON's NatFloat distributions have ±10 to 20% variance per stage; numbers shown are the means.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <Card>
          <CardHeader
            eyebrow="Lifecycle"
            title="Five stages, six-and-a-half months to first ripe"
            subtitle="The bush walks through these stages in order. After harvest it returns to empty. The next ripe stage arrives 2.5 months later if you harvested promptly; if you let the ripe stage run its full month, the gap between harvests is 3.5 months."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {Object.entries(BERRY_STAGES).map(([key, s], i) => (
                <div key={key} className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
                  <div className="section-eyebrow text-forest-800 mb-1">Stage {i + 1}</div>
                  <div className="font-display text-base text-forest-900 capitalize">{key}</div>
                  <div className="text-sm text-ink-700 tabular mt-1">{s.months} avg months</div>
                  <div className="text-xs text-ink-600 italic mt-1">{s.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-forest-50/40 border border-forest-200/60 rounded p-3">
                <div className="section-eyebrow text-forest-800 mb-1">From seed to first harvest</div>
                <div className="font-display text-2xl text-forest-900 tabular">{FIRST_RIPE_MONTHS} months</div>
                <div className="text-xs text-ink-600 italic mt-1">3m young + 1m empty + 0.5m flowering + 1m ripening + 1m ripe.</div>
              </div>
              <div className="bg-forest-50/40 border border-forest-200/60 rounded p-3">
                <div className="section-eyebrow text-forest-800 mb-1">Each subsequent harvest</div>
                <div className="font-display text-2xl text-forest-900 tabular">{RECYCLE_MONTHS} months</div>
                <div className="text-xs text-ink-600 italic mt-1">Empty → flowering → ripening → ripe. Bush stays at "grown" forever once mature.</div>
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card elevated>
          <CardHeader
            eyebrow="Variety table"
            title="All ten cultivated bushes"
            subtitle="Per-harvest = yield × per-fruit satiety. Per-month assumes you harvest the moment fruit ripens (2.5-month cycle); slack on harvest pushes it longer."
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment-300/60 text-left text-ink-500 text-xs uppercase tracking-wider">
                  <SortHeader k="name" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>Berry</SortHeader>
                  <th className="px-3 py-2 font-normal">Type</th>
                  <SortHeader k="yield" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>Yield/ripe</SortHeader>
                  <SortHeader k="satiety" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>Sat/fruit</SortHeader>
                  <SortHeader k="perHarvest" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>Per harvest</SortHeader>
                  <SortHeader k="perMonth" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>Per month</SortHeader>
                  <SortHeader k="minTemp" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>Wild min°C</SortHeader>
                  <SortHeader k="maxTemp" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>Wild max°C</SortHeader>
                  <SortHeader k="tier" sortKey={sortKey} sortDir={sortDir} setSort={setSort}>NPK tier</SortHeader>
                </tr>
              </thead>
              <tbody>
                {sorted.map(b => {
                  const perHarvest = berrySatietyPerHarvest(b);
                  const perMonth = berrySatietyPerMonth(b).toFixed(1);
                  return (
                    <tr key={b.key} className="border-b border-parchment-200/40 hover:bg-parchment-100/30">
                      <td className="px-3 py-3">
                        <div className="font-medium text-forest-900">{b.name}</div>
                        <div className="text-xs text-ink-600 italic">{b.note}</div>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {b.isCurrant ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100/50 text-terra-700">currant</span>
                        ) : (
                          <span className="text-ink-500">bush</span>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular text-ink-700">{b.yieldRipe.toFixed(2)}</td>
                      <td className="px-3 py-3 tabular text-ink-700">{b.satietyPerFruit}</td>
                      <td className="px-3 py-3 tabular font-medium text-forest-900">{perHarvest}</td>
                      <td className="px-3 py-3 tabular font-medium text-forest-900">{perMonth}</td>
                      <td className="px-3 py-3 tabular text-ink-700">{b.wildClimate.minTemp}</td>
                      <td className="px-3 py-3 tabular text-ink-700">{b.wildClimate.maxTemp}</td>
                      <td className="px-3 py-3 text-xs">
                        {b.npkTier === 'light' ? (
                          <span className="px-1.5 py-0.5 rounded bg-parchment-100 border border-forest-300/60 text-forest-800" title="5/3.5/2/0.5 per axis">light</span>
                        ) : (
                          <span className="text-ink-500" title="10/7/4/1 per axis">default</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.12}>
        <Card>
          <CardHeader
            eyebrow="Timing for your climate"
            title="Will it produce here, and how often"
            subtitle="Per-variety analysis using your bundled climate. Dormancy takes precedence over reset, so cold winters won't kill the bush; the question is whether spring gets warm enough to wake it."
          />
          <CardBody>
            {forageDropRate !== 1.0 && (
              <div className="mb-4 p-3 bg-forest-50/40 border border-forest-200/60 rounded text-sm">
                <div className="flex items-center justify-between">
                  <div className="text-ink-700">
                    Class <strong>{settings.playerClass}</strong> has forageDropRate <strong>{forageDropRate.toFixed(2)}×</strong>.
                    Wild bushes always scale by this. Cultivated bushes only scale if the server's blocktype JSON sets <code className="font-mono text-xs">forageStatAffected: true</code>.
                  </div>
                  <label className="ml-4 flex items-center gap-2 text-xs text-ink-600 whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCultivated}
                      onChange={e => setIncludeCultivated(e.target.checked)}
                      className="rounded"
                    />
                    Apply to cultivated
                  </label>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment-300/60 text-left text-ink-500 text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 font-normal">Berry</th>
                    <th className="px-3 py-2 font-normal">Wakes here?</th>
                    <th className="px-3 py-2 font-normal">First wake</th>
                    <th className="px-3 py-2 font-normal">Active days/yr</th>
                    <th className="px-3 py-2 font-normal">Harvests/yr</th>
                    <th className="px-3 py-2 font-normal">Sat/yr (est.)</th>
                  </tr>
                </thead>
                <tbody>
                  {BERRIES_LIST.map(b => {
                    const a = berryClimateAnalysis(b, climate);
                    const gates = berryTempGates(b);
                    const harvestSat = berrySatietyPerHarvest(b) * yieldMul;
                    const yearlySat = a ? Math.round(a.estimatedHarvestsPerYear * harvestSat) : 0;
                    return (
                      <tr key={b.key} className="border-b border-parchment-200/40 hover:bg-parchment-100/30">
                        <td className="px-3 py-3">
                          <div className="font-medium text-forest-900">{b.name}</div>
                          <div className="text-xs text-ink-600">
                            {b.isCurrant ? 'currant' : 'bush'} · wakes ≥ {gates.wakeAbove}°C
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          {!a ? (
                            <span className="text-ink-500">no climate data</span>
                          ) : a.couldWake ? (
                            <span className="text-forest-800 font-medium">Yes</span>
                          ) : (
                            <div>
                              <span className="text-terra-700 font-medium">No</span>
                              <div className="text-xs text-ink-600 mt-0.5">
                                Peak avg {a.peakAvgTemp.toFixed(1)}°C, needs {gates.wakeAbove}°C
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm tabular text-ink-700">
                          {a?.firstWakeDay ? dateLabel(a.firstWakeDay, dpm) : 'n/a'}
                        </td>
                        <td className="px-3 py-3 text-sm tabular text-ink-700">
                          {a?.activeDays ?? 0}
                        </td>
                        <td className="px-3 py-3 text-sm tabular font-medium text-forest-900">
                          {a?.estimatedHarvestsPerYear ?? 0}
                        </td>
                        <td className="px-3 py-3 text-sm tabular font-medium text-forest-900">
                          {yearlySat > 0 ? yearlySat : 'n/a'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-ink-600 italic">
              Active days = daily avg between 4°C and 30°C (the pause window). Harvests/year is a floor estimate: (active days after first wake) ÷ (2.5 months × days-per-month). Real game has tick-by-tick variability; expect ±1.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.13}>
        <Card>
          <CardHeader
            eyebrow="Cycle timing"
            title="How long a bush takes to fruit"
            subtitle={`Based on your server: ${dpm} days/month, ${rhpm} real hours/month. Real-world numbers assume a player is online; game time freezes when the server is empty.`}
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
                <div className="section-eyebrow text-forest-800 mb-2">Seed → first ripe</div>
                <table className="text-sm tabular w-full">
                  <tbody>
                    <tr><td className="py-1 pr-3 text-ink-600">In months:</td><td className="font-medium">{FIRST_RIPE_MONTHS}</td></tr>
                    <tr><td className="py-1 pr-3 text-ink-600">In game days:</td><td className="font-medium">{(FIRST_RIPE_MONTHS * dpm).toFixed(0)}</td></tr>
                    <tr><td className="py-1 pr-3 text-ink-600">Real-world:</td><td className="font-medium text-forest-700">{gameDaysToRealString(FIRST_RIPE_MONTHS * dpm, dpm, rhpm)}</td></tr>
                  </tbody>
                </table>
                <div className="text-xs text-ink-500 italic mt-2">Young (3 mo) → Empty (1 mo) → Flowering (0.5 mo) → Ripening (1 mo) → Ripe (1 mo).</div>
              </div>
              <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
                <div className="section-eyebrow text-forest-800 mb-2">After harvest → next ripe</div>
                <table className="text-sm tabular w-full">
                  <tbody>
                    <tr><td className="py-1 pr-3 text-ink-600">In months:</td><td className="font-medium">{RECYCLE_MONTHS}</td></tr>
                    <tr><td className="py-1 pr-3 text-ink-600">In game days:</td><td className="font-medium">{(RECYCLE_MONTHS * dpm).toFixed(0)}</td></tr>
                    <tr><td className="py-1 pr-3 text-ink-600">Real-world:</td><td className="font-medium text-forest-700">{gameDaysToRealString(RECYCLE_MONTHS * dpm, dpm, rhpm)}</td></tr>
                  </tbody>
                </table>
                <div className="text-xs text-ink-500 italic mt-2">Empty (1 mo) → Flowering (0.5 mo) → Ripening (1 mo) → Ripe.</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-600">
              These are the floor numbers; actual time stretches if the bush enters dormancy (cold winter), pause (off-temp days), or hits a "barren" health state. The Per-month column in the table above already accounts for your loaded climate.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card>
          <CardHeader
            eyebrow="Temperature gates"
            title="When a bush stops, when it dies"
            subtitle="Same gates apply to all 10 varieties; only the dormancy bounds differ for currants."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
                <div className="section-eyebrow text-forest-800 mb-2">Universal</div>
                <table className="text-xs tabular w-full">
                  <tbody>
                    <tr><td className="py-1 pr-3">Pause growth below</td><td className="font-medium">4°C</td></tr>
                    <tr><td className="py-1 pr-3">Pause growth above</td><td className="font-medium">30°C</td></tr>
                    <tr><td className="py-1 pr-3 text-red-700">Reset to young below</td><td className="font-medium text-red-700">-3°C</td></tr>
                    <tr><td className="py-1 pr-3 text-red-700">Reset to young above</td><td className="font-medium text-red-700">38°C</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
                <div className="section-eyebrow text-forest-800 mb-2">Dormancy (varies by type)</div>
                <table className="text-xs tabular w-full">
                  <tbody>
                    <tr><td className="py-1 pr-3">Currants dormant below</td><td className="font-medium">-2°C</td></tr>
                    <tr><td className="py-1 pr-3">Currants wake above</td><td className="font-medium">12°C</td></tr>
                    <tr><td className="py-1 pr-3">Other 7 dormant below</td><td className="font-medium">-5°C</td></tr>
                    <tr><td className="py-1 pr-3">Other 7 wake above</td><td className="font-medium">15°C</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-600">
              Reset means the bush flips back to stage 1 and you lose months of progress. This happens on extreme heat (above 38°C) or hard freezes (below -3°C). Pause is harmless: the bush sits, waits for temperature to recover, and resumes. Dormancy takes precedence over reset, so most cold winters put the bush to sleep instead of resetting it.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="NPK consumption"
            title="What healthy means, what struggling means"
            subtitle="Each cycle, the bush draws this from the soil block beneath it. Two tiers depending on the variety."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
                <div className="section-eyebrow text-forest-800 mb-2">Default tier</div>
                <div className="text-xs text-ink-600 italic mb-2">Beautyberry, blackberry, blackcurrant, blueberry, cranberry, raspberry, redcurrant, whitecurrant.</div>
                <table className="text-xs tabular w-full">
                  <thead className="text-ink-500 text-left"><tr><th className="font-normal py-1">Health state</th><th className="font-normal">N / P / K</th></tr></thead>
                  <tbody>
                    <tr><td className="py-1 pr-3 text-forest-700 font-medium">bountiful</td><td>10 / 10 / 10</td></tr>
                    <tr><td className="py-1 pr-3">healthy</td><td>7 / 7 / 7</td></tr>
                    <tr><td className="py-1 pr-3 text-amber-700">struggling</td><td>4 / 4 / 4</td></tr>
                    <tr><td className="py-1 pr-3 text-red-700">barren</td><td>1 / 1 / 1</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="bg-forest-50/40 border border-forest-200/60 rounded p-3">
                <div className="section-eyebrow text-forest-800 mb-2">Light tier (cloudberry, strawberry)</div>
                <div className="text-xs text-ink-600 italic mb-2">Half the consumption per state. Pairs with their lower yield (2.75 vs 5.5).</div>
                <table className="text-xs tabular w-full">
                  <thead className="text-ink-500 text-left"><tr><th className="font-normal py-1">Health state</th><th className="font-normal">N / P / K</th></tr></thead>
                  <tbody>
                    <tr><td className="py-1 pr-3 text-forest-700 font-medium">bountiful</td><td>5 / 5 / 5</td></tr>
                    <tr><td className="py-1 pr-3">healthy</td><td>3.5 / 3.5 / 3.5</td></tr>
                    <tr><td className="py-1 pr-3 text-amber-700">struggling</td><td>2 / 2 / 2</td></tr>
                    <tr><td className="py-1 pr-3 text-red-700">barren</td><td>0.5 / 0.5 / 0.5</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-4 text-sm text-ink-600">
              Berries draw from <strong>all three axes simultaneously</strong>, unlike crops which only consume one. So a row of blueberries on Medium soil (50/50/50) at "bountiful" loses 10 from each per cycle, and the soil's recovery (0.25 per axis per tick, no axis-specific slowdown since none is "currently consumed" in the same way) tries to keep up. In practice you'll need fertilizer or rotation to keep a hedge productive.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.25}>
        <Card>
          <CardHeader
            eyebrow="MOD · Specialized Classes"
            title="What classes do to berries"
            subtitle="The forageDropRate stat scales wild bush drops. Cultivated bush scaling is unverified."
          />
          <CardBody>
            <ul className="space-y-2 text-sm text-ink-700">
              <li>
                <strong className="text-forest-800">Vintner (gatherer):</strong>{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">forageDropRate +1.0</code>.
                Doubles wild bush drops. May or may not affect cultivated bushes; needs to be confirmed against{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">BEBehaviorFruitingBush.GetDrops</code>.
              </li>
              <li>
                <strong className="text-forest-800">Vintner (picker):</strong>{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">plantMiningSpeedMul +0.5</code>.
                Faster harvest swing, no yield change.
              </li>
              <li>
                <strong className="text-amber-700">sheltered (Blackguard, Brickmaker, Clockmaker, Messenger, Quarrier, Spelunker):</strong>{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">forageDropRate -0.25</code>.
                Wild bushes drop 0.75×.
              </li>
              <li>
                <strong className="text-amber-700">overkill (Butcher, Hunter):</strong>{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">forageDropRate -0.25</code>.
                Same 0.75×.
              </li>
              <li>
                <strong className="text-ink-500">Forester:</strong>{' '}
                Strong on tree seeds (treeSeedDropRate +3.0 = 4× total), but no berry bonus.
              </li>
            </ul>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.3}>
        <Card>
          <CardHeader
            eyebrow="Planting from cuttings"
            title="The shortcut, and the catch"
          />
          <CardBody>
            <p className="text-sm text-ink-700">
              You can plant a cutting (shears + leaves) instead of waiting for a wild bush. Per{' '}
              <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">fruitingbushcutting.json</code>:{' '}
              cuttings mature to a "grown" bush in <strong>2 to 4 months</strong> on average. The matured
              bush starts at the empty stage (not young), so the time to first ripe is roughly:
            </p>
            <p className="mt-2 font-mono text-xs bg-parchment-200/50 rounded p-2">
              cutting (2-4 months) + empty (1m) + flowering (0.5m) + ripening (1m) + ripe (1m) ≈ 5.5 to 7.5 months
            </p>
            <p className="mt-2 text-sm text-ink-700">
              Comparable to waiting for a wild bush to first ripe (6.5 months from young). The cutting's advantage is <strong>placement</strong>: you can plant exactly where you want, on prepared soil, without wandering the world.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.35}><Flourish /></Reveal>
    </div>
  );
}

function SortHeader({ k, sortKey, sortDir, setSort, children }) {
  const active = sortKey === k;
  return (
    <th
      className={`px-3 py-2 font-normal cursor-pointer select-none ${active ? 'text-forest-800' : 'hover:text-forest-600'}`}
      onClick={() => setSort(k)}
    >
      {children}
      {active && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}

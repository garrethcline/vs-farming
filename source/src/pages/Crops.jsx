// Crops reference. All 18 crops with parameters extracted from the JSONs (post 1.20).
import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, NutrientChip, Flourish,
} from '../components/ui/Primitives.jsx';
import { CROPS_LIST, growDays, drainPerStage, drainPerDay } from '../data/crops.js';
import { GAME } from '../data/game.js';
import { useSettings } from '../lib/storage.js';
import { gameDaysToRealString } from '../lib/realTime.js';

export default function CropsPage() {
  const [settings] = useSettings();
  const dpm = settings.daysPerMonth || 9;
  const rhpm = settings.realHoursPerMonth || 16;
  const cgrm = settings.worldConfig?.cropGrowthRateMul ?? 1.0;
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const sorted = useMemo(() => {
    const rows = CROPS_LIST.slice();
    rows.sort((a, b) => {
      let av, bv;
      switch (sortKey) {
        case 'name':       av = a.name; bv = b.name; break;
        case 'nutrient':   av = a.nutrient; bv = b.nutrient; break;
        case 'cons':       av = a.cons; bv = b.cons; break;
        case 'months':     av = a.months; bv = b.months; break;
        case 'growDays':   av = growDays(a, dpm, cgrm); bv = growDays(b, dpm, cgrm); break;
        case 'drainPerDay': av = drainPerDay(a, dpm, cgrm); bv = drainPerDay(b, dpm, cgrm); break;
        case 'cold':       av = a.cold; bv = b.cold; break;
        case 'heat':       av = a.heat; bv = b.heat; break;
        case 'yield':      av = a.yield; bv = b.yield; break;
        default:           av = a.name; bv = b.name;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [sortKey, sortDir, dpm]);

  function setSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§5 · Crops</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            All <span className="heading-italic">eighteen</span> crops
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl">
            Parameters extracted from <code className="font-mono text-xs bg-parchment-200/50 px-1.5 py-0.5 rounded">survival/blocktypes/plant/crop/*.json</code>{' '}
            in the 1.22.1 decompile. Yield numbers are NatFloat distributions (avg ± var); a single harvest will land somewhere in that range. Every crop also drops avg 1.2 seeds at full ripe; pumpkin uses an inverse-exponential yield (right-skewed). <span className="text-ink-500">Grow times shown are base/ideal at full nutrients; on real plots low soil tiers extend these significantly (see Simulator).</span>
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <Card elevated>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment-300/60 bg-parchment-200/30">
                  <Th k="name" sortKey={sortKey} dir={sortDir} onClick={() => setSort('name')}>Crop</Th>
                  <Th k="nutrient" sortKey={sortKey} dir={sortDir} onClick={() => setSort('nutrient')}>Axis</Th>
                  <Th k="cons" sortKey={sortKey} dir={sortDir} onClick={() => setSort('cons')}>Consumption</Th>
                  <Th k="months" sortKey={sortKey} dir={sortDir} onClick={() => setSort('months')}>Months</Th>
                  <Th k="growDays" sortKey={sortKey} dir={sortDir} onClick={() => setSort('growDays')}>Days</Th>
                  <Th k="drainPerDay" sortKey={sortKey} dir={sortDir} onClick={() => setSort('drainPerDay')}>Drain/d</Th>
                  <Th k="cold" sortKey={sortKey} dir={sortDir} onClick={() => setSort('cold')}>Cold</Th>
                  <Th k="heat" sortKey={sortKey} dir={sortDir} onClick={() => setSort('heat')}>Heat</Th>
                  <Th k="yield" sortKey={sortKey} dir={sortDir} onClick={() => setSort('yield')}>Yield</Th>
                  <th className="px-3 py-3 section-eyebrow text-left">Uses</th>
                  <th className="px-3 py-3 section-eyebrow text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((c) => {
                  const eff_cold = c.cold ?? GAME.defaultCold;
                  const eff_heat = c.heat >= 9999 ? '∞' : (c.heat ?? GAME.defaultHeat);
                  return (
                    <tr key={c.key} className="border-b border-parchment-300/30 hover:bg-parchment-200/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="font-display text-base text-forest-900">{c.name}</span>
                        {c.isNew && <span className="ml-2 pill-mod !bg-forest-100 !border-forest-200 !text-forest-800">new</span>}
                      </td>
                      <td className="px-3 py-2.5"><NutrientChip axis={c.nutrient} /></td>
                      <td className="px-3 py-2.5 tabular text-ink-700">{c.cons}</td>
                      <td className="px-3 py-2.5 tabular text-ink-700">{c.months}</td>
                      <td className="px-3 py-2.5 tabular text-ink-700" title={`${growDays(c, dpm, cgrm).toFixed(1)} game days. Real-world: ${gameDaysToRealString(growDays(c, dpm, cgrm), dpm, rhpm)} of someone being on the server (game time only advances when at least one player is online).`}>
                        {growDays(c, dpm, cgrm).toFixed(1)}
                        <div className="text-[10px] text-ink-500">≈ {gameDaysToRealString(growDays(c, dpm, cgrm), dpm, rhpm)} real</div>
                      </td>
                      <td className="px-3 py-2.5 tabular text-ink-700">{drainPerDay(c, dpm, cgrm).toFixed(2)}</td>
                      <td className="px-3 py-2.5 tabular text-ink-700">
                        {eff_cold}°
                      </td>
                      <td className="px-3 py-2.5 tabular text-ink-700">{eff_heat}{eff_heat !== '∞' ? '°' : ''}</td>
                      <td className="px-3 py-2.5 tabular text-ink-700">
                        <span title={c.yieldDist === 'invexp' ? `NatFloat invexp: avg ${c.yield}, var ${c.yieldVar}. Right-skewed: most rolls near low end, occasional ${c.yield + c.yieldVar}.` : `NatFloat normal: avg ${c.yield}, var ${c.yieldVar}. Most rolls within ${(c.yield - c.yieldVar).toFixed(1)} to ${(c.yield + c.yieldVar).toFixed(1)}.`}>
                          {c.yield}<span className="text-ink-400">±{c.yieldVar}</span>
                          {c.yieldDist === 'invexp' && <span className="text-[10px] text-amber-700 ml-1">invexp</span>}
                        </span>
                        <div className="text-[10px] text-ink-500" title="Every crop drops avg 1.2 seeds at full ripe (0.99 if harvested one stage early, 0.7 earlier).">
                          + 1.2 seed
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <UsesPills uses={c.secondaryUses || []} category={c.foodCategory} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ink-600" title={c.satietyNote || ''}>
                        {c.hardy && <span className="text-forest-700 mr-2">hardy</span>}
                        {c.stages} stages
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <PumpkinSpotlight />
      </Reveal>

      <Reveal delay={0.2}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Card><CardBody>
            <div className="section-eyebrow mb-2">What "hardy" means</div>
            <p className="text-ink-700">
              Hardy crops (Carrot, Parsnip, Rye, Fennel, Licorice) keep <strong>75%</strong> of their yield
              when damaged unripe (vs the 50% default). They also tolerate the lowest cold thresholds
              (-8 to -12°C). Best picks for fringe-of-season planting.
            </p>
          </CardBody></Card>
          <Card><CardBody>
            <div className="section-eyebrow mb-2">"Default" cold/heat</div>
            <p className="text-ink-700">
              Several crops (Flax, Spelt, Sunflower, Soybean, Pumpkin) don't set
              <code className="font-mono text-xs mx-1 bg-parchment-200/50 px-1 rounded">coldDamageBelow</code>
              or
              <code className="font-mono text-xs mx-1 bg-parchment-200/50 px-1 rounded">heatDamageAbove</code>
              in their JSONs. They use the C# class default (0°C cold, no heat limit).
            </p>
          </CardBody></Card>
        </div>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function PumpkinSpotlight() {
  return (
    <Card>
      <CardHeader
        eyebrow="Crop spotlight"
        title="Pumpkins are not like other crops"
        subtitle="Vines spread, fruits grow on neighboring tiles, and the plant itself can't be harvested until its kids wither. Layout matters more than for any other crop."
      />
      <CardBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 text-sm text-ink-700">
            <h3 className="font-display text-lg text-forest-900">How they actually work</h3>
            <p>
              Plant a pumpkin seed and you get a <strong>motherplant</strong>. It grows through 8 stages on the farmland tile like any crop, but starting at stage 3 it begins spawning <strong>vines</strong> onto adjacent tiles (north, south, east, west).
            </p>
            <p>
              Vines do their own thing. Each vine has 3 growth stages plus a "blooming" state. When a vine blooms (50% chance once it reaches stage 3), it tries to spawn a <strong>pumpkin fruit</strong> on a tile next to it. A vine can attempt up to 3 pumpkins in its life.
            </p>
            <p>
              Vines also spread. At stage 2, a vine has a 50% chance to send a new vine to an adjacent empty tile, with a 75% bias toward growing <em>away from the motherplant</em>. So one motherplant can produce a small network of vines fanning outward.
            </p>
            <p>
              Catch: the motherplant <strong>cannot reach harvest stage 8</strong> until every vine it spawned has withered. It just sits at stage 7. So expect to wait through the vine lifecycle (typically 2-4 game days after motherplant maturity) before you can harvest the motherplant itself.
            </p>
            <p>
              If you destroy the motherplant, every vine and growing fruit linked to it dies immediately.
            </p>

            <h3 className="font-display text-lg text-forest-900 pt-2">Tile rules</h3>
            <p>
              Vines and fruits can spawn on <strong>any solid block with a supportable top</strong>. They don't need farmland. Dirt, stone, gravel, packed surfaces all work. So you don't have to till a 3×3 field; you only need farmland for the motherplant.
            </p>
            <p>
              The supporting block has to actually be there (no holes, no slabs, no half-blocks). And the tile above has to be empty air.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-display text-lg text-forest-900 text-sm">Best practice</h3>

            <div className="bg-forest-50/40 border border-forest-200/40 rounded p-3 text-sm">
              <div className="font-semibold text-forest-900 mb-2">1. Space them out</div>
              <p className="text-ink-700">
                Give each motherplant a clear 3×3 area (or bigger). Vines prefer growing away from the parent, but they'll still wander. Two motherplants 2 tiles apart will fight for vine territory and give you fewer fruits than the same two plants placed 4 tiles apart.
              </p>
            </div>

            <div className="bg-forest-50/40 border border-forest-200/40 rounded p-3 text-sm">
              <div className="font-semibold text-forest-900 mb-2">2. Solid floor everywhere</div>
              <p className="text-ink-700">
                Don't plant a pumpkin next to a ledge, stairs, or a path that's not block-height. Vines and fruits won't spawn over unsupported tiles, so you're throwing away spread potential. A flat patch of dirt or grass around the farmland is fine.
              </p>
            </div>

            <div className="bg-forest-50/40 border border-forest-200/40 rounded p-3 text-sm">
              <div className="font-semibold text-forest-900 mb-2">3. Use phosphorus soil</div>
              <p className="text-ink-700">
                Pumpkins are P-axis crops with consumption 30 (heavy feeder). Plant after a Nitrogen crop to leave P intact, or apply bonemeal. Skip Compost (it adds N/P/K but the K and N go to waste here).
              </p>
            </div>

            <div className="bg-forest-50/40 border border-forest-200/40 rounded p-3 text-sm">
              <div className="font-semibold text-forest-900 mb-2">4. Pad your timeline</div>
              <p className="text-ink-700">
                Total cycle is roughly: <strong>34 days</strong> motherplant grow time at 20-dpm + ~<strong>2-4 days</strong> for vines to spread, bloom, and produce mature fruits. Don't plant pumpkins in the last 40 days of your warm season; the motherplant will mature but you'll be racing the frost on the fruits.
              </p>
            </div>

            <div className="bg-forest-50/40 border border-forest-200/40 rounded p-3 text-sm">
              <div className="font-semibold text-forest-900 mb-2">5. Harvest the fruits, then the plant</div>
              <p className="text-ink-700">
                Pumpkin fruits go through 4 size stages over ~2 game days each. Harvest when they're at full size (stage 4). Once all fruits and vines are gone or withered, the motherplant can finally advance to stage 8 and you harvest it for seeds.
              </p>
            </div>

            <h3 className="font-display text-lg text-forest-900 pt-2 text-sm">Yield expectation</h3>
            <p className="text-sm text-ink-700">
              A typical motherplant produces 1-3 fruits in good conditions, occasionally up to 4-5 if the vine network spreads well and bloom rolls go your way. Compared to a single-fruit crop like onion or carrot, that's much better food per farmland tile, but you spend many surrounding tiles to get there.
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-parchment-300/40">
          <h3 className="font-display text-lg text-forest-900 mb-2">A working layout</h3>
          <p className="text-sm text-ink-700 mb-3">
            One motherplant per 5×5 patch is the conservative version. Center tile is farmland with the seed; the other 24 tiles are flat solid ground (dirt, grass, stone) for vines and fruits.
          </p>
          <pre className="font-mono text-xs bg-parchment-200/30 border border-parchment-300/40 rounded p-3 text-ink-700 leading-tight overflow-x-auto">
{`. . . . .       . . . . .
. . . . .       . V f V .       V = vine
. . F . .  -->  . V F V .       F = farmland (motherplant)
. . . . .       . V f V .       f = fruit
. . . . .       . . . . .`}
          </pre>
          <p className="text-sm text-ink-600 italic mt-3">
            For a row of pumpkins, leave 4 empty tiles between motherplants in the row direction. So planting positions every 5 tiles. You can fit a second row 3 tiles offset (vines don't grow diagonally, so as long as cardinal-direction tiles are clear, they can share space).
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function UsesPills({ uses, category }) {
  const labels = {
    bait: { text: 'bait', color: 'bg-amber-50 border border-amber-300/60 text-terra-800', title: 'Farmhand-only via SC mod: 1 + 1 dough = 6 fishingbait-dough through mortar.' },
    fiber: { text: 'fiber', color: 'bg-parchment-100 border border-forest-300/60 text-forest-800', title: 'Drops 4 flax fiber per harvest (Tailor scales by flaxFiberDropRate).' },
    spice: { text: 'spice', color: 'bg-parchment-200 border border-parchment-400/50 text-ink-800', title: 'Used as a flavoring in cooking. No direct satiety.' },
    oil: { text: 'oil', color: 'bg-amber-50 border border-amber-300/60 text-amber-900', title: 'Pressable to oil (separate system, not modeled here).' },
  };
  const items = [];
  if (category === 'Grain') items.push({ key: 'food', text: 'food (bread)', color: 'bg-parchment-100 border border-forest-300/60 text-forest-800', title: 'Grain. Eat as bread (perfect bake values vary by grain).' });
  else if (category === 'Spice') items.push({ key: 'food', text: 'flavoring', color: 'bg-parchment-200 border border-parchment-400/50 text-ink-800', title: 'Spice. Used in cooking but no direct satiety.' });
  else items.push({ key: 'food', text: 'food', color: 'bg-parchment-100 border border-forest-300/60 text-forest-800', title: 'Direct food source.' });
  uses.forEach(u => { if (labels[u]) items.push({ key: u, ...labels[u] }); });
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(it => (
        <span key={it.key} className={`px-1.5 py-0.5 rounded text-[10px] ${it.color}`} title={it.title}>{it.text}</span>
      ))}
    </div>
  );
}

function Th({ k, sortKey, dir, onClick, children }) {
  const active = k === sortKey;
  return (
    <th className="px-3 py-3 text-left section-eyebrow cursor-pointer select-none hover:text-forest-900 transition-colors"
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}

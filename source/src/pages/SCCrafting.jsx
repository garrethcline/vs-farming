// Specialized Classes farming-relevant crafting reference (beta).
//
// Lists every recipe gated by a Specialized Classes trait that affects
// farming, fertilization, or rot/compost flow. Source: assets/specializedclasses
// /recipes/grid/{class}/*.json.
//
// Beta-gated because: (a) only relevant if your server runs the mod, (b)
// recipe ratios may shift in future SC mod versions.

import { useMemo } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import { SC_RECIPES } from '../data/scCrafting.js';

const TRAIT_INFO = {
  farmhand: { name: 'Farmhand', tone: 'forest', desc: 'The farming class. Soil tier-up, double-yield fertilizer crafts, rot doubling, fishing-bait recipes that use farmed crops.' },
  spelunker: { name: 'Spelunker', tone: 'amber', desc: 'The mining class. Doubles lime/salt yields. Their saltpeter grid recipe also exists at the Compounding Vat without a trait, so saltpeter is NOT Spelunker-exclusive.' },
  vintner: { name: 'Vintner', tone: 'amber', desc: 'The brewing/berry class. Has one farming-relevant recipe (berry-bush cutting) but the Sprouting Table workstation does it cheaper, no trait needed.' },
  tailor: { name: 'Tailor', tone: 'amber', desc: 'The textile class. Processes wild grass and reeds into fibers, twine, papyrus, and rope. Useful when flax or papyrus do not grow in your biome.' },
  none: { name: 'No trait required', tone: 'forest', desc: 'Workstation recipes (Sprouting Table, Compounding Vat) that ANY player can use. These are the most overlooked farming recipes in the mod.' },
};

const CATEGORY_INFO = {
  soil: { label: 'Soil tier-up', desc: 'Convert lower-fertility soil blocks into higher-tier ones. Hoe must be in your hand. See the Fertilizers tab for an efficiency calculator comparing this vs direct fertilizing.' },
  fertilizer: { label: 'Fertilizer recipes', desc: 'Make NPK fertilizers from raw mats. Faster and higher-yield than vanilla quern recipes.' },
  rot: { label: 'Rot doubling', desc: 'Convert excess crop drops into rot. Feeds the compost pipeline.' },
  mining: { label: 'Mining processing', desc: 'Stone-to-lime, ore-to-powder. Lime is the saltpeter precursor.' },
  propagation: { label: 'Berry / fruit-tree propagation (grid)', desc: 'Grid recipes for cuttings. The Sprouting Table workstation versions below are usually cheaper.' },
  wildprocessing: { label: 'Wild crop processing', desc: 'Drygrass, reeds, vines into rope/twine/fibers. Bridge for biomes where flax or papyrus cannot grow.' },
  baiting: { label: 'Fishing bait from farm crops', desc: 'Use harvested licorice or fennel + meat to make fishing bait. A way to monetize excess herb crops.' },
  sprouting: { label: 'Sprouting Table (NO trait needed)', desc: 'Workstation recipes anyone can use. Convert harvested food back into seeds, get fruit-tree cuttings from any fruit, plus berry bush cuttings cheaper than the Vintner grid version.' },
  vat: { label: 'Compounding Vat (NO trait needed)', desc: 'Workstation recipes anyone can use. Alternate compost path AND the saltpeter recipe (yes, the same one Spelunker has).' },
};

export default function SCCraftingPage() {
  // Group recipes by trait, then category, in stable order
  const grouped = useMemo(() => {
    const out = {};
    for (const [key, r] of Object.entries(SC_RECIPES)) {
      out[r.trait] ??= {};
      out[r.trait][r.category] ??= [];
      out[r.trait][r.category].push({ key, ...r });
    }
    return out;
  }, []);

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§SC · Special crafting (beta)</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Recipes from the <span className="heading-italic">Specialized Classes</span> mod
          </h2>
          <p className="mt-3 text-ink-600 max-w-3xl">
            Every recipe here requires a <code className="font-mono text-xs bg-parchment-200/60 px-1 rounded">requiresTrait</code> on the player. Numbers are verbatim from the recipe JSONs in the mod files. Listed by class, then by category. Vanilla equivalents (when they exist) are noted in the per-recipe text.
          </p>
        </div>
      </Reveal>

      {Object.entries(grouped).map(([trait, byCategory], traitIdx) => {
        const info = TRAIT_INFO[trait] || { name: trait, tone: 'parchment', desc: '' };
        return (
          <Reveal key={trait} delay={0.05 + traitIdx * 0.05}>
            <Card>
              <CardHeader
                eyebrow={`Class · ${info.name}`}
                title={`${info.name} recipes`}
                subtitle={info.desc}
              />
              <CardBody>
                {Object.entries(byCategory).map(([cat, recipes]) => {
                  const ci = CATEGORY_INFO[cat] || { label: cat, desc: '' };
                  return (
                    <div key={cat} className="mb-6 last:mb-0">
                      <div className="section-eyebrow text-forest-700 mb-1">{ci.label}</div>
                      <div className="text-xs text-ink-600 italic mb-3">{ci.desc}</div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {recipes.map(r => <RecipeCard key={r.key} r={r} />)}
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          </Reveal>
        );
      })}

      <Reveal delay={0.18}>
        <Card>
          <CardHeader
            eyebrow="What this mod does for farming"
            title="Quick rundown"
          />
          <CardBody>
            <ul className="text-sm text-ink-700 list-disc pl-6 space-y-2">
              <li><strong className="text-forest-800">Farmhand</strong> can build a fertilizer pipeline from rot up. Doubles bonemeal/charcoal-powder, 4x potash from sylvite, makes compost in seconds without a barrel, and converts spare crop drops into more rot for the next round.</li>
              <li><strong className="text-forest-800">Farmhand</strong> can also tier-up soil blocks (Very Low → Low → Medium → High → Terra Preta). The Fertilizers tab has a side-by-side calculator showing whether crafting up vs spreading those same fertilizers directly gives more permanent NPK.</li>
              <li><strong className="text-forest-800">Spelunker</strong> doubles lime from chalk/limestone/marble. The saltpeter recipe (4 compost + 16 lime → 8 saltpeter) ALSO exists at the Compounding Vat without any trait, so you can make saltpeter without a Spelunker - the class just gets it as a grid recipe instead of needing the workstation.</li>
              <li><strong className="text-amber-800">Vintner</strong> has one farming-relevant grid recipe for berry-bush cuttings, but it costs 8 berries + 1 High soil per cutting. The Sprouting Table version (1 berry + 1 compost) is much better.</li>
              <li><strong className="text-amber-800">Tailor</strong> processes wild grass and reeds into fibers/twine/papyrus/rope. Useful in biomes where flax or papyrus cannot grow.</li>
              <li><strong className="text-forest-800">Sprouting Table workstation</strong> needs NO trait. Lets anyone convert harvested food back into seeds (great for cabbage/pumpkin which rarely drop seeds), make fruit-tree cuttings from any fruit, and get berry bush cuttings cheaply. The biggest hidden farming feature in the mod.</li>
              <li><strong className="text-forest-800">Compounding Vat workstation</strong> needs NO trait. Alternate compost path plus the saltpeter recipe.</li>
            </ul>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="Passive trait stats"
            title="What each class does without crafting"
            subtitle="From assets/specializedclasses/config/traits.json. These are always-on multipliers and bonuses; no recipe required."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-parchment-300/60 rounded p-3 bg-parchment-100/50">
                <div className="font-medium text-forest-900 mb-2">Farmhand class traits</div>
                <ul className="text-xs text-ink-700 space-y-1.5 list-disc pl-5">
                  <li><strong>fertilizer</strong>: <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">fertilizerPermanencePercentage = 0.25</code>. Each fertilizer application permanently bumps the soil's base NPK by 25% of the application's value (e.g. compost = +10N/+2P/+2K permanent per use).</li>
                  <li><strong>harvester</strong>: <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">cropProduceDropRate +0.5</code> (1.5× crop yield), <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">cropSeedDropRate +1</code> (2× seeds), <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">wildCropDropRate +1</code> (2× wild crop drops), <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">youngseeddropchance +1</code> (always get seeds when harvesting young).</li>
                  <li><strong>tiller</strong>: <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">soilMiningSpeedMul +1</code> (2× tilling speed), 75% durability save on hoes/scythes, +25% plant mining speed.</li>
                  <li><strong>fisherman</strong>: <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">swimSpeedMul +1.0</code> (2× swim speed). Useful for water access when irrigating.</li>
                  <li><strong>militia</strong>: combat trait, no farming relevance.</li>
                  <li className="text-terra-700"><strong>delicate</strong> (negative): <code className="font-mono text-[10px] bg-amber-100/40 px-1 rounded">oreDropRate -0.1</code>, slower stone/ore mining. Doesn't affect farming.</li>
                </ul>
              </div>
              <div className="border border-parchment-300/60 rounded p-3 bg-parchment-100/50">
                <div className="font-medium text-amber-800 mb-2">Spelunker class traits</div>
                <ul className="text-xs text-ink-700 space-y-1.5 list-disc pl-5">
                  <li><strong>spelunker</strong>: gates the saltpeter/lime/salt recipes above. No passive multipliers.</li>
                  <li><strong>prospector</strong>: <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">oreDropRate +1.0</code>, +50% mining speed, 50% pickaxe durability save.</li>
                  <li><strong>panner</strong>: <code className="font-mono text-[10px] bg-parchment-200/60 px-1 rounded">panningDropRate +3</code>. Affects metal sourcing, not farming.</li>
                  <li><strong>sapper</strong>: animals are 25% less likely to detect you. Useful for raiding wild bushes without aggro.</li>
                  <li className="text-terra-700"><strong>uncultured</strong> (negative): <code className="font-mono text-[10px] bg-amber-100/40 px-1 rounded">cropProduceDropRate -0.25</code>, <code className="font-mono text-[10px] bg-amber-100/40 px-1 rounded">cropSeedDropRate -0.25</code>, <code className="font-mono text-[10px] bg-amber-100/40 px-1 rounded">flaxFiberDropRate -0.25</code>, <code className="font-mono text-[10px] bg-amber-100/40 px-1 rounded">fruitTreeDropRate -0.25</code>. Spelunkers harvest 25% less from every cultivated source.</li>
                  <li className="text-terra-700"><strong>sheltered</strong> (negative): <code className="font-mono text-[10px] bg-amber-100/40 px-1 rounded">forageDropRate -0.25</code>, <code className="font-mono text-[10px] bg-amber-100/40 px-1 rounded">wildCropDropRate -0.25</code>, <code className="font-mono text-[10px] bg-amber-100/40 px-1 rounded">animalLootDropRate -0.1</code>.</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 px-3 py-2 rounded border-l-4 border-l-amber-500 bg-amber-50/40 text-xs text-ink-700 leading-relaxed">
              <strong className="text-terra-800">The Spelunker tradeoff:</strong> harvesting saltpeter from compost+lime is unique to Spelunker, but the class also takes 25% off every crop, seed, fruit-tree drop, and wild-crop yield. If your team has a dedicated Spelunker who mainly mines and processes, the saltpeter pipeline is a big win. If you need that one player to also farm, the negative traits cost more than they gain.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.27}>
        <Card>
          <CardHeader
            eyebrow="Vanilla equivalents"
            title="Alternatives without the Specialized Classes mod"
            subtitle="Things you can already do without any class trait."
          />
          <CardBody>
            <ul className="text-sm text-ink-700 space-y-2 list-disc pl-6">
              <li><strong>Compost:</strong> vanilla compost barrel. Fill a barrel with rot + vegetables/grain/fruit, wait several game days. The mod's Farmhand mortar+pestle recipe (4 rot + 1 soil → 2 compost) and the no-trait Compounding Vat recipe (same ratio) skip the wait but consume a soil block per craft.</li>
              <li><strong>Bonemeal, charcoal powder, potash:</strong> grind in a quern. Vanilla quern recipes give 1 output per input; the Farmhand grid recipes double or quadruple that.</li>
              <li><strong>Saltpeter:</strong> in vanilla, only mineable from world deposits. The mod adds a craft path (4 compost + 16 lime → 8) usable by Spelunker (grid) OR by anyone (Compounding Vat workstation).</li>
              <li><strong>Soil tier-up:</strong> vanilla has no equivalent. Lower-tier farmland just stays at its tier; you can only fertilize on top. The Farmhand recipe chain is the only way to permanently change a block's base fertility tier.</li>
              <li><strong>Seed conversion (food → seed):</strong> vanilla has no general way. Sprouting Table (no trait) is the only path.</li>
              <li><strong>Fruit-tree cutting from fruit:</strong> vanilla requires finding wild branches. Sprouting Table (no trait) lets you make a cutting from any harvested fruit.</li>
            </ul>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.3}><Flourish>※</Flourish></Reveal>
    </div>
  );
}

function RecipeCard({ r }) {
  const inputs = Object.entries(r.in).filter(([_, v]) => v !== 'tool');
  const tool = Object.entries(r.in).find(([_, v]) => v === 'tool');
  const outputs = Object.entries(r.out);
  return (
    <div className="border border-parchment-300/60 rounded p-3 bg-parchment-100/50">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {inputs.map(([code, qty]) => (
          <span key={code} className="px-1.5 py-0.5 rounded border border-forest-300/60 text-forest-800 text-[11px] bg-parchment-100">
            {qty}× <code className="font-mono">{prettyCode(code)}</code>
          </span>
        ))}
        <span className="text-forest-700 font-medium">→</span>
        {outputs.map(([code, qty]) => (
          <span key={code} className="px-1.5 py-0.5 rounded border border-amber-300/60 text-terra-800 text-[11px] bg-amber-50/40 font-medium">
            {qty}× <code className="font-mono">{prettyCode(code)}</code>
          </span>
        ))}
      </div>
      {tool && (
        <div className="text-[11px] text-ink-600 italic mb-1">
          Tool: <code className="font-mono">{prettyCode(tool[0])}</code>
        </div>
      )}
      {r.note && (
        <div className="text-xs text-ink-700 leading-snug">{r.note}</div>
      )}
    </div>
  );
}

// Map game item codes to the names a player sees in the in-game tooltip.
// Soil tiers especially: internal codes are verylow/low/medium/compost/high
// but the player sees Very Low / Low / Medium / High / Terra Preta.
const ITEM_NAMES = {
  'soil-verylow-none': 'Very Low soil',
  'soil-low-none': 'Low soil',
  'soil-medium-none': 'Medium soil',
  'soil-compost-none': 'High soil',
  'soil-high-none': 'Terra Preta soil',
  'soil-*-none': 'any soil',
  'soil-{fertility}-none': 'any soil',
  'powder-charcoal': 'charcoal powder',
  'powder-{ore}': 'ore powder',
  'ore-sylvite': 'sylvite ore',
  'ore-{any}': 'any ore',
  'stone-halite': 'halite stone',
  'stone-{chalk/limestone/marble}': 'chalk/limestone/marble stone',
  'fruit-{berry}': 'berry fruit',
  'fruit-*': 'any fruit',
  'fruit-{fruit}': 'tree fruit',
  'fruit-{fruittype}': 'tree fruit',
  'vegetable-*': 'any vegetable',
  'vegetable-fennel': 'fennel',
  'grain-*': 'any grain',
  'grain-{grain}': 'any grain',
  'mushroom-*': 'any mushroom',
  'seeds-*': 'any seeds',
  'legume-*': 'any legume',
  'rawcassava-raw': 'raw cassava',
  'spice-licorice-raw': 'raw licorice',
  'spice-licorice OR vegetable-fennel': 'licorice OR fennel',
  'dough-*': 'any dough',
  'bushmeat-raw': 'raw bushmeat',
  'fish-raw': 'raw fish',
  'poultry-raw': 'raw poultry',
  'redmeat-raw': 'raw redmeat',
  'fishingbait-dough': 'dough fishing bait',
  'fishingbait-bushmeat': 'bushmeat fishing bait',
  'fishingbait-fishmeat': 'fishmeat fishing bait',
  'fishingbait-poultry': 'poultry fishing bait',
  'fishingbait-redmeat': 'redmeat fishing bait',
  'fruittree-cutting': 'fruit-tree cutting',
  'fruitingbushcutting-{berry}-free': 'planted berry-bush cutting',
  'seeds-{grain}': 'grain seeds',
  'seeds-{vegetable}': 'vegetable seeds',
  'seeds-{fruit}': 'fruit seeds',
  'seeds-{legume}': 'legume seeds',
  'seeds-cassava': 'cassava seeds',
  'seeds-licorice': 'licorice seeds',
  'mortar-pestle': 'mortar+pestle',
  'sprouting-table': 'sprouting table',
  'compounding-vat': 'compounding vat',
  'wildvine-*': 'wild vines',
  'reedtops': 'reed tops',
};

function prettyCode(code) {
  if (ITEM_NAMES[code]) return ITEM_NAMES[code];
  // Generic cleanup for anything not explicitly mapped.
  return code
    .replace('game:', '')
    .replace(/^\*\-?/, '')
    .replace('powder-', '');
}

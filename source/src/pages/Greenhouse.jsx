// Greenhouse design + mechanics. Layout viewer, Y picker (sea-level penalty),
// greenhouse rules, hidden-water options, and materials list.
//
// Mechanics traced to:
//   BESoilNutrition.GetNearbyWaterDistance (lines 154-196): 9x9 horizontal
//     water search at same Y; Chebyshev distance; <4 to count.
//   BESoilNutrition.updateMoistureLevel (line 233): minMoisture = clamp(1 - dist/4, 0, 1).
//   BlockEntityFastForwardGrowth (lines 83-89): lightpenalty = max(0, SeaLevel - Pos.Y)
//     when allowUndergroundFarming is off; sunlight sampled at upPos (crop block).
//   Climate.Sealevel = 110 (default).
//   FarmingConfig: DelayGrowthBelowSunLight = 19, LossPerLevel = 0.1.
//   Rooms doc: greenhouse = enclosed 14x14x14 max with >=50% skylight, +5C buff.
import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import { useSettings } from '../lib/storage.js';

const N = 14;

// Pick water positions for each layout. Stride-3 = water on a 3-step grid
// gives every farmland tile chebyshev <= 1. Wiki = perimeter on 2 sides plus
// interior pattern (faithful to the wiki design with 156 farmland). Beezone =
// stride-3 in left half, dry zone with bees+flowers+berries in right half.
function layoutFor(mode) {
  const water = new Set();
  const bee = new Set();
  const flower = new Set();
  const berry = new Set();
  if (mode === 'stride3') {
    for (let r = 1; r < N; r += 3) for (let c = 1; c < N; c += 3) water.add(r + ',' + c);
  } else if (mode === 'wiki') {
    for (let r = 0; r < N; r++) { water.add(r + ',0'); water.add(r + ',13'); }
    const interior = [[3,4],[3,7],[3,10],[6,4],[6,7],[6,10],[9,4],[9,7],[9,10],[12,4],[12,7],[12,10]];
    for (const [r, c] of interior) water.add(r + ',' + c);
  } else if (mode === 'beezone') {
    for (let r = 1; r < N; r += 3) for (let c = 1; c < 8; c += 3) water.add(r + ',' + c);
    bee.add('3,10'); bee.add('3,12'); bee.add('10,10'); bee.add('10,12');
    flower.add('5,9'); flower.add('5,11'); flower.add('5,13'); flower.add('8,9'); flower.add('8,11'); flower.add('8,13');
    berry.add('1,9'); berry.add('1,11'); berry.add('1,13'); berry.add('12,9'); berry.add('12,11'); berry.add('12,13');
  }
  return { water, bee, flower, berry };
}

function moistureAt(r, c, waterSet) {
  if (waterSet.has(r + ',' + c)) return null;
  let md = 99;
  for (let dr = -3; dr <= 3; dr++) {
    for (let dc = -3; dc <= 3; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      if (waterSet.has(nr + ',' + nc)) {
        const d = Math.max(Math.abs(dr), Math.abs(dc));
        if (d < md) md = d;
      }
    }
  }
  if (md >= 4) return 0;
  return Math.round((1 - md / 4) * 100);
}

export default function GreenhousePage() {
  return (
    <div className="space-y-6">
      <Reveal delay={0.05}><PageHero /></Reveal>
      <Reveal delay={0.10}><LayoutViewerCard /></Reveal>
      <Reveal delay={0.15}><YPickerCard /></Reveal>
      <Reveal delay={0.20}><RulesCard /></Reveal>
      <Reveal delay={0.25}><HiddenWaterCard /></Reveal>
      <Reveal delay={0.30}><MaterialsCard /></Reveal>
      <Reveal delay={0.35}><Flourish /></Reveal>
    </div>
  );
}

function PageHero() {
  return (
    <div className="px-1">
      <div className="section-eyebrow mb-3">§ &middot; Greenhouse</div>
      <h2 className="heading-display text-3xl md:text-4xl mb-2">
        Layouts, <em>moisture</em>, sunlight, <em>and</em> bees.
      </h2>
      <p className="text-ink-600 max-w-2xl">
        Three working layouts for a 14&times;14 interior, the sea-level math that decides where you can put the floor, and the trade-offs of hiding water inside walls. All numbers traced to BESoilNutrition.cs and BlockEntityFastForwardGrowth.cs.
      </p>
    </div>
  );
}

function LayoutViewerCard() {
  const [mode, setMode] = useState('stride3');
  const [selected, setSelected] = useState(null);

  const layout = useMemo(() => layoutFor(mode), [mode]);

  const stats = useMemo(() => {
    let farm = 0, water = 0, bee = 0, mSum = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const k = r + ',' + c;
        if (layout.water.has(k)) water++;
        else if (layout.bee.has(k)) bee++;
        else if (!layout.flower.has(k) && !layout.berry.has(k)) {
          farm++;
          mSum += moistureAt(r, c, layout.water);
        }
      }
    }
    return { farm, water, bee, avg: farm ? Math.round(mSum / farm) : 0 };
  }, [layout]);

  function describe(r, c) {
    const k = r + ',' + c;
    if (layout.water.has(k)) return { type: 'Water block', detail: 'Hydrates farmland up to 3 blocks horizontally. Walls can sit on top.' };
    if (layout.bee.has(k)) return { type: 'Bee skep', detail: 'On solid block. Detects flowers in 7-block radius regardless of walls.' };
    if (layout.flower.has(k)) return { type: 'Flower', detail: 'On regular dirt. Feeds bees within 7 blocks.' };
    if (layout.berry.has(k)) return { type: 'Berry bush', detail: 'No moisture or fertility needed. Currants stack 2 high.' };
    const m = moistureAt(r, c, layout.water);
    return {
      type: 'Farmland ' + m + '%',
      detail: m === 0 ? 'No water in 4-block range. Will not grow.' : 'Growth speed multiplier from moisture.',
    };
  }

  function cellFill(r, c) {
    const k = r + ',' + c;
    if (layout.water.has(k)) return 'bg-[#378ADD] text-[#042C53]';
    if (layout.bee.has(k)) return 'bg-[#EF9F27] text-[#412402]';
    if (layout.flower.has(k)) return 'bg-[#ED93B1] text-[#4B1528]';
    if (layout.berry.has(k)) return 'bg-[#7F77DD] text-[#26215C]';
    const m = moistureAt(r, c, layout.water);
    if (m === 75) return 'bg-[#97C459] text-[#173404]';
    if (m === 50) return 'bg-[#FAC775] text-[#412402]';
    if (m === 25) return 'bg-[#F5C4B3] text-[#4A1B0C]';
    return 'bg-[#D3D1C7] text-[#2C2C2A]';
  }

  function cellLabel(r, c) {
    const k = r + ',' + c;
    if (layout.water.has(k)) return 'W';
    if (layout.bee.has(k)) return 'B';
    if (layout.flower.has(k)) return 'F';
    if (layout.berry.has(k)) return 'R';
    return '';
  }

  const sel = selected ? (() => { const [r, c] = selected.split(',').map(Number); return { r, c, ...describe(r, c) }; })() : null;

  return (
    <Card>
      <CardHeader
        eyebrow="Interior 14&times;14 layouts"
        title="Three working designs, all moisture math is live"
        subtitle="Hover or click any tile. Game reads water at chebyshev distance up to 3, same Y as farmland."
      />
      <CardBody>
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { id: 'stride3', label: 'Stride-3 grid', sub: 'max farmland' },
            { id: 'wiki', label: 'Wiki layout', sub: '156 farmland' },
            { id: 'beezone', label: 'Half farm + bee zone', sub: 'crops + bees' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => { setMode(opt.id); setSelected(null); }}
              className={`px-3 py-2 rounded text-xs border transition-colors ${
                mode === opt.id
                  ? 'bg-forest-600 text-parchment-50 border-forest-600'
                  : 'bg-parchment-100/40 text-ink-700 border-parchment-300/40 hover:bg-parchment-200/40'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-[10px] opacity-80">{opt.sub}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-4 items-start flex-wrap">
          <div className="grid gap-px bg-parchment-300/40 p-px rounded shrink-0" style={{ gridTemplateColumns: `repeat(${N}, 26px)` }}>
            {Array.from({ length: N * N }, (_, i) => {
              const r = Math.floor(i / N), c = i % N;
              const k = r + ',' + c;
              return (
                <div
                  key={k}
                  className={`w-[26px] h-[26px] flex items-center justify-center text-[10px] cursor-pointer transition-opacity hover:opacity-70 ${cellFill(r, c)} ${selected === k ? 'ring-2 ring-ink-900 ring-inset' : ''}`}
                  onMouseEnter={() => setSelected(k)}
                  onClick={() => setSelected(k)}
                >
                  {cellLabel(r, c)}
                </div>
              );
            })}
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Stat label="Farmland" value={stats.farm} />
              <Stat label="Water blocks" value={stats.water} />
              <Stat label="Avg moisture" value={stats.avg + '%'} />
              <Stat label="Bee skeps" value={stats.bee} />
            </div>

            <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 min-h-[80px] text-xs">
              {sel ? (
                <>
                  <div className="font-medium text-forest-900 mb-1">{sel.type}</div>
                  <div className="text-ink-500 mb-1">Row {sel.r}, col {sel.c}</div>
                  <div className="text-ink-600">{sel.detail}</div>
                </>
              ) : (
                <div className="text-ink-500">Hover or click a tile.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 px-3 py-2 bg-parchment-100/40 rounded text-[11px] text-ink-600">
          <Legend color="#378ADD" label="Water" />
          <Legend color="#97C459" label="75%" />
          <Legend color="#FAC775" label="50%" />
          <Legend color="#F5C4B3" label="25%" />
          <Legend color="#D3D1C7" label="Dry" />
          <Legend color="#EF9F27" label="Bee skep" />
          <Legend color="#ED93B1" label="Flower" />
          <Legend color="#7F77DD" label="Berry" />
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-2">
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className="text-lg font-display text-forest-900 tabular">{value}</div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </span>
  );
}

function YPickerCard() {
  const [settings] = useSettings();
  const allowUnderground = !!settings.allowUndergroundFarming;
  const SEA_LEVEL = 110;
  const [farmlandY, setFarmlandY] = useState(110);

  // Game source: lightpenalty = max(0, SeaLevel - Pos.Y) when underground farming is off.
  // factor = clamp(1 - (19 - (sunlight - penalty)) * 0.1, 0, 1).
  // Outdoor sunlight = 22.
  const penalty = allowUnderground ? 0 : Math.max(0, SEA_LEVEL - farmlandY);
  const effectiveSun = Math.max(0, 22 - penalty);
  const factor = Math.max(0, Math.min(1, 1 - (19 - effectiveSun) * 0.1));
  const pct = Math.round(factor * 100);

  const tiers = [];
  for (let y = 110; y >= 96; y--) {
    const p = allowUnderground ? 0 : Math.max(0, SEA_LEVEL - y);
    const eff = Math.max(0, 22 - p);
    const f = Math.max(0, Math.min(1, 1 - (19 - eff) * 0.1));
    tiers.push({ y, factor: Math.round(f * 100) });
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Where to put the farmland block"
        title="Sea level is Y=110, every block lower costs sunlight"
        subtitle="lightpenalty = max(0, SeaLevel - farmlandY) when allowUndergroundFarming is false."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-ink-600 block mb-1">Farmland Y</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="90"
                max="120"
                value={farmlandY}
                onChange={e => setFarmlandY(parseInt(e.target.value))}
                className="flex-1"
              />
              <div className="text-xl font-display tabular text-forest-900 w-12 text-right">{farmlandY}</div>
            </div>
          </div>
          <Stat label="Sunlight penalty" value={penalty} />
          <Stat label="Growth speed" value={pct + '%'} />
        </div>

        <div className="text-xs text-ink-600 mb-3">
          {allowUnderground
            ? 'allowUndergroundFarming is on in your world config. Sea-level penalty is zeroed. Farmland can go anywhere with sunlight or torchlight reaching level 10+.'
            : 'allowUndergroundFarming is off (default). Sky access only. Y=98 is the lowest viable, Y=97 = no growth.'}
        </div>

        <div className="grid grid-cols-[80px_1fr_60px] gap-1 text-xs items-center">
          <div className="font-mono text-[10px] text-ink-500">Y</div>
          <div className="text-ink-500">Growth speed</div>
          <div className="text-ink-500 text-right">factor</div>
          {tiers.map(t => (
            <div key={t.y} className="contents">
              <div className="font-mono tabular text-ink-700">Y={t.y}</div>
              <div className="bg-parchment-100/60 rounded h-4 relative overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: t.factor + '%',
                    background: t.factor >= 90 ? '#97C459' : t.factor >= 50 ? '#FAC775' : t.factor > 0 ? '#F5C4B3' : '#D3D1C7',
                  }}
                />
              </div>
              <div className="font-mono tabular text-right text-ink-700">{t.factor}%</div>
            </div>
          ))}
        </div>

        <pre className="font-mono text-[10px] bg-parchment-100/60 border border-parchment-300/40 rounded p-3 mt-4 overflow-x-auto">
{`int lightpenalty = 0;
if (!allowundergroundfarming)
    lightpenalty = Math.Max(0, world.SeaLevel - Pos.Y);
int sunlight = blockAccessor.GetLightLevel(upPos,
    allowundergroundfarming ? MaxLight : OnlySunLight);
double factor = Clamp(1 - (19 - (sunlight - lightpenalty)) * 0.1, 0, 1);`}
        </pre>
      </CardBody>
    </Card>
  );
}

function RulesCard() {
  return (
    <Card>
      <CardHeader
        eyebrow="Greenhouse detection rules"
        title="What the room registry checks for the +5&deg;C buff"
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-ink-700">
          <RuleItem
            title="Interior &le; 14&times;14&times;14"
            body="Maximum interior dimensions. The 14-high includes the farmland row itself, since the top of farmland is not counted as a floor (BlockFarmland.GetRetention returns 0 for the top face)."
          />
          <RuleItem
            title="Skylight score &ge; 50%"
            body="At least half the ceiling lets sunlight through. Glass blocks and glass slabs both work. If you use slabs, the solid side must face into the room."
          />
          <RuleItem
            title="Fully enclosed"
            body="No gaps. Crude or ruined doors do not seal. Fence gates do not seal. Path blocks and stair blocks sometimes break detection. Solid wood, iron, and trapdoors are reliable."
          />
          <RuleItem
            title="Solid floor under farmland"
            body="Water below farmland gives no moisture and prevents room registration. If the greenhouse is over a pond, place a solid block under each farmland tile."
          />
          <RuleItem
            title="Snow does not break the buff"
            body="Snow accumulating on glass does not cancel the buff, but if it&rsquo;s cold enough for snow, growth is already paused."
          />
          <RuleItem
            title="Greenhouses can&rsquo;t be fully underground"
            body="The 50% skylight requirement makes a fully buried structure impossible to register. allowUndergroundFarming bypasses the sea-level penalty but does not fix this."
          />
        </div>
      </CardBody>
    </Card>
  );
}

function RuleItem({ title, body }) {
  return (
    <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3">
      <div className="font-medium text-forest-900 text-sm mb-1" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="text-xs text-ink-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: body }} />
    </div>
  );
}

function HiddenWaterCard() {
  return (
    <Card>
      <CardHeader
        eyebrow="Hiding water from the interior"
        title="The 100% farmland trick has a moisture cost"
      />
      <CardBody>
        <p className="text-sm text-ink-600 mb-4">
          Water has to be at chebyshev 1 for 75% moisture, but the wall has to be solid for room detection. So either the water IS the wall (not solid, fails) or the water sits behind a solid wall (chebyshev 2 = 50% max). Three options, ranked by interior moisture:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <OptionCard
            tag="Wiki"
            title="Slabs over water"
            row={['B', 'F', 'F', 'B', 'F', 'F', 'B']}
            colors={['#B5D4F4', '#97C459', '#97C459', '#B5D4F4', '#97C459', '#97C459', '#B5D4F4']}
            stat="9 farmland @ 75%"
            note="Slabs cover the upper half of water blocks. Looks like a path, plays like 75% moisture. Floor surface is 100% usable (slabs are walkable)."
          />
          <OptionCard
            tag="Hidden"
            title="2-block thick walls, water inside"
            row={['#', '%', '#', 'F', 'F', 'F', 'F']}
            colors={['#888780', '#378ADD', '#888780', '#FAC775', '#F5C4B3', '#D3D1C7', '#D3D1C7']}
            stat="Outer farmland: 50%"
            note="Walls stay solid, water tucked between layers. Interior reads 100% farmland visually but moisture drops fast as you go deeper. Need internal water for the center."
          />
          <OptionCard
            tag="Wiki+"
            title="Perimeter water + internal stride-3"
            row={['W', 'F', 'F', 'F', 'W', 'F', 'F']}
            colors={['#378ADD', '#97C459', '#97C459', '#97C459', '#378ADD', '#97C459', '#97C459']}
            stat="Most farmland @ 75%"
            note="Water visible on the floor but functionally productive everywhere. The version that wins on average moisture and on harvest output. 156 farmland in 14&times;14."
          />
        </div>
      </CardBody>
    </Card>
  );
}

function OptionCard({ tag, title, row, colors, stat, note }) {
  return (
    <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3">
      <div className="text-[10px] text-forest-700 uppercase tracking-wide mb-1">{tag}</div>
      <div className="font-medium text-forest-900 text-sm mb-2" dangerouslySetInnerHTML={{ __html: title }} />
      <div className="flex gap-px mb-3">
        {row.map((cell, i) => (
          <div
            key={i}
            className="w-7 h-7 flex items-center justify-center text-[10px] font-mono"
            style={{ background: colors[i] }}
          >
            {cell}
          </div>
        ))}
      </div>
      <div className="text-xs font-medium text-forest-900 mb-1">{stat}</div>
      <div className="text-[11px] text-ink-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: note }} />
    </div>
  );
}

function MaterialsCard() {
  return (
    <Card>
      <CardHeader
        eyebrow="Build list"
        title="What to gather for a 14&times;14 wiki-style greenhouse"
        subtitle="From the wiki guide. Walls 4 high (deer-proof), 4 sections of glass roof."
      />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Mat label="Wall blocks" qty="52" sub="cobblestone or planks, 4 high" />
          <Mat label="Doors" qty="4" sub="solid wood or iron only" />
          <Mat label="Roof beams" qty="16" sub="debarked logs" />
          <Mat label="Glass slabs" qty="144" sub="98 minimum for 50% skylight" />
          <Mat label="Quartz chunks" qty="144" sub="2 slabs per chunk via saw" />
          <Mat label="Water blocks" qty="40" sub="placed before walls" />
          <Mat label="Soil to till" qty="156" sub="medium fertility ideal" />
          <Mat label="Bucket" qty="1" sub="copper saw tier" />
          <Mat label="Cobble (floor under perimeter walls)" qty="28" sub="optional, fixes room detection" />
        </div>
        <div className="mt-4 text-xs text-ink-600 leading-relaxed">
          <strong className="text-forest-900">Build sequence:</strong> place water blocks first (need bucket = copper saw tier). Till the soil. Build walls 4 blocks high. Add ceiling beams (logs every 4 blocks). Fill remaining ceiling with glass slabs. If room won&apos;t register, swap top and bottom water rows for solid blocks (wiki edit note). Snow on glass does not break the buff.
        </div>
      </CardBody>
    </Card>
  );
}

function Mat({ label, qty, sub }) {
  return (
    <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-2.5">
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className="text-lg font-display text-forest-900 tabular leading-tight">{qty}</div>
      <div className="text-[10px] text-ink-500 leading-tight">{sub}</div>
    </div>
  );
}

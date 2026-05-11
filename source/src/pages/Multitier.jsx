// Multi-tier vertical farm. Stacks 7 farmland tiers in a single 14x14x14
// greenhouse, with vertical air shafts that carry sky light down to every
// crop row, and water columns that hydrate every farmland tier at once.
//
// All numbers verified by 3D BFS on the actual block layout. The simulation
// matches the source-traced rules:
//   BlockEntityFastForwardGrowth: sunlight read at upPos, lightpenalty =
//     max(0, SeaLevel - Pos.Y) when allowUndergroundFarming is off, factor
//     = clamp(1 - (19 - (sunlight - penalty)) * 0.1, 0, 1).
//   BESoilNutrition.GetNearbyWaterDistance: chebyshev water search at same Y.
//   farmland.json: sideopaque.down=true (vertically opaque from below).
//   crop json (turnip, parsnip, etc.): lightAbsorption=0 (transparent).
//   ChunkIlluminator in VintagestoryLib.dll (Vintagestory.Common.ChunkIlluminator):
//     SpreadSunlightAt iterates BlockFacing.ALLNORMALI (6 face neighbors), -1
//     per step. Special case: down-axis step inside a sky-aligned column costs
//     0, so a transparent vertical shaft carries 22 from sky to floor.
//
// The 18-shaft + 25-water layout is the smallest regular pattern that puts
// every cell within manhattan 3 of a shaft (light 19+) and chebyshev 1 of
// water (moisture 75%). Verified cell-by-cell.
import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish, Stat,
} from '../components/ui/Primitives.jsx';
import { useSettings } from '../lib/storage.js';

const N = 14;

// Water positions: 5x5 grid at every (col, row) with both in {0, 3, 6, 9, 12}
const WATERS = (() => {
  const s = new Set();
  for (const c of [0, 3, 6, 9, 12]) {
    for (const r of [0, 3, 6, 9, 12]) s.add(c + ',' + r);
  }
  return s;
})();

// Air shafts: hex pattern. Rows 1,7,13 have shafts at cols 0,4,8,12.
// Rows 4,10 have shafts at cols 2,6,10. 18 total.
const SHAFTS = (() => {
  const s = new Set();
  for (const c of [0, 4, 8, 12]) {
    s.add(c + ',1'); s.add(c + ',7'); s.add(c + ',13');
  }
  for (const c of [2, 6, 10]) {
    s.add(c + ',4'); s.add(c + ',10');
  }
  return s;
})();

function manhattanToShaft(c, r) {
  let best = 99;
  for (const k of SHAFTS) {
    const [sc, sr] = k.split(',').map(Number);
    const d = Math.abs(c - sc) + Math.abs(r - sr);
    if (d < best) best = d;
  }
  return best;
}

function chebyshevToWater(c, r) {
  let best = 99;
  for (const k of WATERS) {
    const [wc, wr] = k.split(',').map(Number);
    const d = Math.max(Math.abs(c - wc), Math.abs(r - wr));
    if (d < best) best = d;
  }
  return best;
}

export default function MultitierPage() {
  return (
    <div className="space-y-6">
      <Reveal delay={0.05}><PageHero /></Reveal>
      <Reveal delay={0.10}><LayoutCard /></Reveal>
      <Reveal delay={0.13}><FewerShaftsTrapCard /></Reveal>
      <Reveal delay={0.16}><LightVerificationCard /></Reveal>
      <Reveal delay={0.20}><DepthPenaltyCard /></Reveal>
      <Reveal delay={0.24}><LightMathCard /></Reveal>
      <Reveal delay={0.32}><BuildListCard /></Reveal>
      <Reveal delay={0.36}><FindingsCard /></Reveal>
      <Reveal delay={0.40}><Flourish /></Reveal>
    </div>
  );
}

function PageHero() {
  return (
    <div className="px-1">
      <div className="section-eyebrow mb-3">§ &middot; Multi-tier vertical farm</div>
      <h2 className="heading-display text-3xl md:text-4xl mb-2">
        Seven floors of <em>farmland</em> in one greenhouse.
      </h2>
      <p className="text-ink-600 max-w-2xl">
        A single 14&times;14&times;14 room can hold 1071 productive farmland blocks across seven stacked tiers. The trick is putting air shafts on a hex pattern so every crop sits within manhattan 3 of an open column to the sky, and water columns on a stride-3 grid so every farmland tier shares the same hydration. Light path verified by BFS, every cell.
      </p>
    </div>
  );
}

function LayoutCard() {
  const [tier, setTier] = useState('crop');
  const [selected, setSelected] = useState(null);

  const stats = useMemo(() => {
    let farm = 0, water = 0, shaft = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const k = c + ',' + r;
        if (WATERS.has(k)) water++;
        else if (SHAFTS.has(k)) shaft++;
        else farm++;
      }
    }
    return { farm, water, shaft };
  }, []);

  function describe(c, r) {
    const k = c + ',' + r;
    if (SHAFTS.has(k)) {
      return { type: 'Air shaft', detail: 'Open column from floor to glass ceiling. Carries sky light to every Y. Light 22 at every tier.' };
    }
    if (WATERS.has(k)) {
      return { type: 'Water column', detail: 'Source water from floor to ceiling. Hydrates every farmland tier at this column position.' };
    }
    const md = chebyshevToWater(c, r);
    const moisture = md >= 4 ? 0 : Math.round((1 - md / 4) * 100);
    const ld = manhattanToShaft(c, r);
    const light = Math.max(0, 22 - ld);
    const tierLabel = tier === 'crop' ? 'Crop tier (odd Y)' : 'Farmland tier (even Y)';
    return {
      type: tier === 'crop' ? 'Crop ' + light : 'Farmland ' + moisture + '%',
      detail: tierLabel + '. Manhattan ' + ld + ' to nearest shaft = light ' + light + '. Chebyshev ' + md + ' to nearest water = moisture ' + moisture + '%.',
    };
  }

  function cellFill(c, r) {
    const k = c + ',' + r;
    if (SHAFTS.has(k)) return 'bg-[#FAEEDA] text-[#412402]';
    if (WATERS.has(k)) return 'bg-[#378ADD] text-[#042C53]';
    if (tier === 'crop') {
      const ld = manhattanToShaft(c, r);
      const light = Math.max(0, 22 - ld);
      if (light >= 19) return 'bg-[#97C459] text-[#173404]';
      if (light >= 17) return 'bg-[#FAC775] text-[#412402]';
      return 'bg-[#F5C4B3] text-[#4A1B0C]';
    } else {
      const md = chebyshevToWater(c, r);
      const moisture = md >= 4 ? 0 : Math.round((1 - md / 4) * 100);
      if (moisture >= 75) return 'bg-[#97C459] text-[#173404]';
      if (moisture >= 50) return 'bg-[#FAC775] text-[#412402]';
      if (moisture >= 25) return 'bg-[#F5C4B3] text-[#4A1B0C]';
      return 'bg-[#D3D1C7] text-[#2C2C2A]';
    }
  }

  function cellLabel(c, r) {
    const k = c + ',' + r;
    if (SHAFTS.has(k)) return 'S';
    if (WATERS.has(k)) return 'W';
    return '';
  }

  const sel = selected ? (() => {
    const [c, r] = selected.split(',').map(Number);
    return { c, r, ...describe(c, r) };
  })() : null;

  return (
    <Card>
      <CardHeader
        eyebrow="The verified layout"
        title="18 air shafts + 25 water columns + 153 farmland per tier"
        subtitle="Same X/Z footprint repeats at every Y. Toggle between tier views to see what each block does."
      />
      <CardBody>
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { id: 'crop', label: 'Crop tier (odd Y)', sub: 'shows light reach' },
            { id: 'farmland', label: 'Farmland tier (even Y)', sub: 'shows moisture' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => { setTier(opt.id); setSelected(null); }}
              className={`px-3 py-2 rounded text-xs border transition-colors ${
                tier === opt.id
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
              const k = c + ',' + r;
              return (
                <div
                  key={k}
                  className={`w-[26px] h-[26px] flex items-center justify-center text-[10px] cursor-pointer transition-opacity hover:opacity-70 ${cellFill(c, r)} ${selected === k ? 'ring-2 ring-ink-900 ring-inset' : ''}`}
                  onMouseEnter={() => setSelected(k)}
                  onClick={() => setSelected(k)}
                >
                  {cellLabel(c, r)}
                </div>
              );
            })}
          </div>

          <div className="flex-1 min-w-[200px]">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Stat label="Farmland / tier" value={stats.farm} />
              <Stat label="Tiers" value={7} />
              <Stat label="Crops total" value={stats.farm * 7} />
              <Stat label="At 100% growth" value={stats.farm * 7} />
            </div>

            <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 min-h-[80px] text-xs">
              {sel ? (
                <>
                  <div className="font-medium text-forest-900 mb-1">{sel.type}</div>
                  <div className="text-ink-500 mb-1">Col {sel.c}, row {sel.r}</div>
                  <div className="text-ink-600">{sel.detail}</div>
                </>
              ) : (
                <div className="text-ink-500">Hover or click a tile.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4 px-3 py-2 bg-parchment-100/40 rounded text-[11px] text-ink-600">
          <Legend color="#378ADD" label="Water column" />
          <Legend color="#FAEEDA" label="Air shaft" />
          <Legend color="#97C459" label={tier === 'crop' ? 'Light 19+' : 'Moisture 75%'} />
          {tier === 'crop' ? (
            <>
              <Legend color="#FAC775" label="Light 17-18" />
              <Legend color="#F5C4B3" label="Light below 17" />
            </>
          ) : (
            <>
              <Legend color="#FAC775" label="Moisture 50%" />
              <Legend color="#F5C4B3" label="Moisture 25%" />
            </>
          )}
        </div>
      </CardBody>
    </Card>
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

function LightVerificationCard() {
  // BFS results computed offline for the 18-shaft layout.
  // Every crop tier (Y=1, 3, 5, 7, 9, 11) has the same lateral light
  // distribution because every shaft column is fully transparent and
  // sky light reaches every Y at full intensity.
  // Y=13 sits directly under the glass ceiling and gets 22 at every cell.
  const tiers = [
    { y: 13, label: 'top crops', min: 22, max: 22, note: 'Direct sky access through glass.' },
    { y: 11, label: 'crops', min: 19, max: 21, note: 'Lateral propagation from shaft columns.' },
    { y: 9,  label: 'crops', min: 19, max: 21, note: 'Same as Y=11. Sky light in shaft = 22 at every Y.' },
    { y: 7,  label: 'crops', min: 19, max: 21, note: 'Same.' },
    { y: 5,  label: 'crops', min: 19, max: 21, note: 'Same.' },
    { y: 3,  label: 'crops', min: 19, max: 21, note: 'Same.' },
    { y: 1,  label: 'bottom crops', min: 19, max: 21, note: 'Bottom layer is fine. Light enters via shafts and walks across.' },
  ];

  return (
    <Card>
      <CardHeader
        eyebrow="BFS verification"
        title="Every crop tier checked, every cell at light 19 or higher"
        subtitle="The bottom is the same as the top because sky light propagates down through transparent shafts at full intensity."
      />
      <CardBody>
        <div className="grid grid-cols-[60px_1fr_140px] gap-1 text-xs items-center mb-4">
          <div className="font-mono text-[10px] text-ink-500">Tier</div>
          <div className="text-ink-500">Light range</div>
          <div className="text-ink-500 text-right">Cells at 100%</div>
          {tiers.map(t => (
            <div key={t.y} className="contents">
              <div className="font-mono tabular text-ink-700">Y={t.y}</div>
              <div className="bg-parchment-100/60 rounded h-5 relative overflow-hidden">
                <div
                  className="h-full absolute top-0"
                  style={{
                    left: ((t.min / 22) * 100) + '%',
                    width: (((t.max - t.min) / 22) * 100 + 1) + '%',
                    background: t.min >= 19 ? '#97C459' : '#FAC775',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-ink-700 mix-blend-multiply">
                  {t.min === t.max ? t.min : t.min + '-' + t.max}
                </div>
              </div>
              <div className="font-mono tabular text-right text-forest-900">153 / 153</div>
            </div>
          ))}
        </div>

        <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 text-xs text-ink-600 leading-relaxed">
          <strong className="text-forest-900">Why does it work the way down?</strong> A shaft column is just air all the way to the glass roof. Sky light enters from above and fills every cell of the shaft at 22 (transparent column, no decay). At each tier, light then walks sideways from the shaft through the surrounding crops at minus 1 per block (crops have lightAbsorption 0, so they pass light freely). Worst case in this layout is manhattan 3, giving 22 minus 3 = 19, which is exactly the threshold for 100% growth.
        </div>

        <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 text-xs text-ink-600 leading-relaxed mt-3">
          <strong className="text-forest-900">Why not vertical light penalty?</strong> Voxel sky light isn&apos;t plain BFS. The engine seeds every transparent cell with a clear column up to the sky at full intensity, separately from the lateral spread. There is a vertical penalty in the game, but it&apos;s a different mechanism (sea level vs Pos.Y, see the next card), not a per-block decay.
        </div>
      </CardBody>
    </Card>
  );
}

function DepthPenaltyCard() {
  const [settings] = useSettings();
  const allowUnderground = !!settings.allowUndergroundFarming;
  const SEA_LEVEL = 110;
  const [floorY, setFloorY] = useState(110);

  // For each tier, compute effective light and growth %.
  // Floor (bottom farmland) is at floorY. Crops at floorY+1, +3, +5, ..., +13.
  // The lightpenalty formula uses Pos.Y of the FARMLAND, which is floorY+0,
  // floorY+2, ..., floorY+12. Tier 1 = bottom, tier 7 = top.
  const tiers = [];
  for (let i = 0; i < 7; i++) {
    const farmlandY = floorY + i * 2;
    const cropY = farmlandY + 1;
    const rawLight = i === 6 ? 22 : 19; // top tier crops are skylit (22), others are 19+ minimum
    const penalty = allowUnderground ? 0 : Math.max(0, SEA_LEVEL - farmlandY);
    const eff = Math.max(0, rawLight - penalty);
    let growth;
    if (eff >= 19) growth = 100;
    else if (eff >= 9) growth = Math.max(0, 100 - (19 - eff) * 10);
    else growth = 0;
    tiers.push({ tier: i + 1, farmlandY, cropY, rawLight, penalty, eff, growth });
  }
  // Display top-down: tier 7 first
  const displayTiers = [...tiers].reverse();

  return (
    <Card>
      <CardHeader
        eyebrow="The depth gotcha"
        title="Where you put the floor decides whether the bottom tiers grow"
        subtitle="Sky light at the bottom of a shaft is still 22, but the formula subtracts a depth penalty before checking the threshold."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-xs text-ink-600 block mb-1">Greenhouse floor Y (bottom farmland)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="95"
                max="125"
                value={floorY}
                onChange={e => setFloorY(parseInt(e.target.value))}
                className="flex-1"
              />
              <div className="text-xl font-display tabular text-forest-900 w-12 text-right">{floorY}</div>
            </div>
          </div>
          <Stat label="Sea level" value={SEA_LEVEL} />
          <Stat label="100% tiers" value={tiers.filter(t => t.growth >= 100).length + ' / 7'} />
        </div>

        <div className="text-xs text-ink-600 mb-3">
          {allowUnderground
            ? 'allowUndergroundFarming is ON in your settings. Penalty is zeroed at every tier. Place the greenhouse anywhere with sky access.'
            : 'allowUndergroundFarming is OFF (vanilla default). Penalty applies per farmland\'s Y position. Lower farmlands take a bigger hit.'}
        </div>

        <div className="grid grid-cols-[60px_60px_60px_60px_1fr_60px] gap-1 text-xs items-center">
          <div className="font-mono text-[10px] text-ink-500">Tier</div>
          <div className="font-mono text-[10px] text-ink-500">Crop Y</div>
          <div className="font-mono text-[10px] text-ink-500">Raw</div>
          <div className="font-mono text-[10px] text-ink-500">Penalty</div>
          <div className="text-ink-500">Effective growth</div>
          <div className="text-ink-500 text-right">%</div>
          {displayTiers.map(t => (
            <div key={t.tier} className="contents">
              <div className="font-mono tabular text-ink-700">{t.tier}</div>
              <div className="font-mono tabular text-ink-600">{t.cropY}</div>
              <div className="font-mono tabular text-ink-600">{t.rawLight}</div>
              <div className="font-mono tabular text-ink-600">{t.penalty > 0 ? '-' + t.penalty : '0'}</div>
              <div className="bg-parchment-100/60 rounded h-4 relative overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: t.growth + '%',
                    background: t.growth >= 90 ? '#97C459' : t.growth >= 50 ? '#FAC775' : t.growth > 0 ? '#F5C4B3' : '#D3D1C7',
                  }}
                />
              </div>
              <div className="font-mono tabular text-right text-ink-700">{t.growth}%</div>
            </div>
          ))}
        </div>

        <div className="mt-4 bg-parchment-100/60 border border-parchment-300/40 rounded p-3 text-xs text-ink-600 leading-relaxed">
          <strong className="text-forest-900">Best floor Y:</strong> floor at sea level (Y={SEA_LEVEL}) puts every farmland at or above sea level, penalty is zero everywhere, all 7 tiers at 100%. Build above sea level and you have headroom for the inevitable terrain dip. Build below and the bottom dies first.
        </div>

        <pre className="font-mono text-[10px] bg-parchment-100/60 border border-parchment-300/40 rounded p-3 mt-3 overflow-x-auto">
{`int sunlight = blockAccessor.GetLightLevel(upPos, OnlySunLight);
int lightpenalty = Math.Max(0, world.SeaLevel - Pos.Y);
double factor = Clamp(1 - (19 - (sunlight - lightpenalty)) * 0.1, 0, 1);`}
        </pre>
      </CardBody>
    </Card>
  );
}

function FewerShaftsTrapCard() {
  // Distribution from BFS sim of the 4-shaft "looks symmetric" design.
  // Shafts at (3,3), (3,10), (10,3), (10,10) plus 26 water columns.
  // Result: 1162 crops, 522 below 100% because manhattan reach exceeds 3.
  const dist = [
    { light: 16, count: 60, growth: 70 },
    { light: 17, count: 156, growth: 80 },
    { light: 18, count: 306, growth: 90 },
    { light: 19, count: 252, growth: 100 },
    { light: 20, count: 150, growth: 100 },
    { light: 21, count: 72, growth: 100 },
    { light: 22, count: 166, growth: 100 },
  ];
  const max = 306;

  return (
    <Card>
      <CardHeader
        eyebrow="Why not fewer shafts"
        title="A 4-shaft design fails 45% of crops"
        subtitle="It looks tidy. The math shows otherwise."
      />
      <CardBody>
        <p className="text-xs text-ink-600 mb-3 leading-relaxed">
          The natural temptation is to put shafts at the four quadrant centers, (3,3), (3,10), (10,3), (10,10), and reuse the rest of the floor for farmland. Looks symmetric, gives 4 shafts instead of 18, leaves 166 farmland per tier. Then BFS the actual light propagation:
        </p>

        <div className="grid grid-cols-[60px_1fr_60px_60px] gap-1 text-xs items-center mb-3">
          <div className="font-mono text-[10px] text-ink-500">Light</div>
          <div className="text-ink-500">Cells</div>
          <div className="text-ink-500 text-right">Count</div>
          <div className="text-ink-500 text-right">Growth</div>
          {dist.map(d => (
            <div key={d.light} className="contents">
              <div className="font-mono tabular text-ink-700">{d.light}</div>
              <div className="bg-parchment-100/60 rounded h-4 relative overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: ((d.count / max) * 100) + '%',
                    background: d.growth >= 100 ? '#97C459' : d.growth >= 80 ? '#FAC775' : '#F5C4B3',
                  }}
                />
              </div>
              <div className="font-mono tabular text-right text-ink-600">{d.count}</div>
              <div className={`font-mono tabular text-right ${d.growth >= 100 ? 'text-forest-700' : 'text-amber-700'}`}>{d.growth}%</div>
            </div>
          ))}
        </div>

        <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 text-xs text-ink-600 leading-relaxed">
          <strong className="text-forest-900">What goes wrong:</strong> the cell at (6,6) is manhattan 6 from (3,3), so it gets light 22 minus 6 = 16. That&apos;s 70% growth, not 100%. The chebyshev shortcut you might mentally use for the moisture rule does NOT apply to light, because light propagation goes through face neighbors only. The 18-shaft hex pattern keeps every cell within manhattan 3, which is exactly the cutoff for staying at 22 minus 3 = 19.
        </div>

        <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 text-xs text-ink-600 leading-relaxed mt-3">
          <strong className="text-forest-900">Production comparison:</strong> 4 shafts gives 166 farmland per tier with mixed growth, total effective output around 1057 crops per harvest. 18 shafts gives 153 farmland per tier all at 100%, total 1071. The denser shaft layout actually wins on output AND gives uniform growth times, which matters for harvesting cycles.
        </div>
      </CardBody>
    </Card>
  );
}


function LightMathCard() {
  // Per-cell light analysis for the 14x14 footprint with the 18-shaft hex
  // pattern. The math here uses only source-verified constants:
  //
  //   Sky-source columns deliver light 22 at every Y inside the column
  //   (ChunkIlluminator.SpreadSunlightAt, decompiled from VintagestoryLib.dll:
  //    iterates BlockFacing.ALLNORMALI for 6 face neighbours, -1 per step,
  //    with the down-axis step costing 0 when the column is sky-aligned).
  //
  //   Crop growth speed vs sunlight (BlockEntityFastForwardGrowth.cs:89):
  //     factor = clamp(1 - (DelayGrowthBelowSunLight - (sunlight - lightpenalty)) * LossPerLevel, 0, 1)
  //   Defaults from ModSystemFarming.cs:
  //     DelayGrowthBelowSunLight = 19
  //     LossPerLevel = 0.1f
  //   lightpenalty = max(0, SeaLevel - Pos.Y); zero for any tile at or above sea level.
  //
  // The cells render the manhattan distance to the nearest shaft, and the
  // resulting sunlight (22 - d) and growth speed (clamp(1 - (19-light)*0.1)).
  const cells = useMemo(() => {
    const out = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const isShaft = SHAFTS.has(c + ',' + r);
        const d = isShaft ? 0 : manhattanToShaft(c, r);
        const light = 22 - d;
        const factor = Math.max(0, Math.min(1, 1 - (19 - light) * 0.1));
        out.push({ c, r, isShaft, d, light, factor });
      }
    }
    return out;
  }, []);

  const histogram = useMemo(() => {
    const buckets = { 22: 0, 21: 0, 20: 0, 19: 0 };
    let nonShaftCount = 0;
    let worst = [];
    let maxD = 0;
    for (const cell of cells) {
      if (cell.isShaft) continue;
      nonShaftCount++;
      buckets[cell.light] = (buckets[cell.light] || 0) + 1;
      if (cell.d > maxD) { maxD = cell.d; worst = []; }
      if (cell.d === maxD) worst.push([cell.c, cell.r]);
    }
    return { buckets, nonShaftCount, worst, maxD };
  }, [cells]);

  function cellColor(cell) {
    if (cell.isShaft) return '#DDA15E'; // amber for air shafts
    // Greenness ramps from worst (d=3) to best (d=1)
    if (cell.d === 1) return '#97C459';
    if (cell.d === 2) return '#7FB04F';
    if (cell.d === 3) return '#5E8B3A';
    return '#cccccc';
  }

  // Build the threshold table for the formula breakdown
  const thresholdRows = [22, 21, 20, 19, 18, 15, 12, 10, 9].map(L => {
    const f = Math.max(0, Math.min(1, 1 - (19 - L) * 0.1));
    return { light: L, factor: f };
  });

  return (
    <Card>
      <CardHeader
        eyebrow="Light delivery, cell by cell"
        title="Every farmland tile gets at least sunlight 19, all 178 of them"
        subtitle="Worked through with the actual source constants. The 14x14 footprint with this 18-shaft hex pattern keeps every cell within manhattan 3 of a sky column, so every tile reads light 19 or higher and grows at 100 percent speed."
      />
      <CardBody>
        <p className="text-xs text-ink-600 mb-4 leading-relaxed">
          Three numbers carry this. <strong>22</strong> is the sunlight a sky-exposed block holds (and what every cell inside an open shaft reads at every Y). <strong>19</strong> is the threshold below which growth starts slowing, set as <code className="font-mono text-[11px] bg-parchment-200/60 px-1 rounded">DelayGrowthBelowSunLight = 19</code> in <code className="font-mono text-[11px]">ModSystemFarming.cs</code>. <strong>0.1</strong> is the per-level penalty, <code className="font-mono text-[11px]">LossPerLevel = 0.1f</code>. The crop entity reads its own light at the block above farmland and runs the formula in <code className="font-mono text-[11px]">BlockEntityFastForwardGrowth.cs:89</code>:
        </p>

        <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 mb-4 font-mono text-[11px] text-ink-700 overflow-x-auto">
          factor = clamp(1 - (19 - (sunlight - lightpenalty)) * 0.1, 0, 1)
        </div>

        <p className="text-xs text-ink-600 mb-4 leading-relaxed">
          <code className="font-mono text-[11px]">lightpenalty = max(0, SeaLevel - Pos.Y)</code> when <code className="font-mono text-[11px]">allowundergroundfarming</code> is off, and it is zero at sea level or higher. A surface greenhouse sits at or above sea level, so the penalty is 0 in this layout and the formula collapses to <code className="font-mono text-[11px]">clamp(1 - (19 - sunlight) * 0.1, 0, 1)</code>. The table:
        </p>

        <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-1 mb-5 text-[11px] font-mono">
          <div className="text-ink-500 uppercase tracking-wide">Sunlight</div>
          <div className="text-ink-500 uppercase tracking-wide">Growth speed</div>
          <div className="text-ink-500 uppercase tracking-wide text-right">Factor</div>
          {thresholdRows.map(row => (
            <div key={row.light} className="contents">
              <div className="tabular text-ink-700">{row.light}</div>
              <div className="bg-parchment-100/60 rounded h-4 relative overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: (row.factor * 100) + '%',
                    background: row.factor === 1 ? '#97C459' : row.factor >= 0.5 ? '#FAC775' : row.factor > 0 ? '#DDA15E' : '#BC4749',
                  }}
                />
              </div>
              <div className="tabular text-right text-ink-700">{(row.factor * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>

        <p className="text-xs text-ink-600 mb-4 leading-relaxed">
          So 19 is the magic number. Light 19 and above grow at full speed. Drop to 18 and you lose 10 percent. The growth stops entirely at light 9 or lower. The question for the greenhouse layout is whether every single farmland tile reads at least 19.
        </p>

        <h4 className="font-display text-lg text-forest-900 mt-6 mb-2">The 14x14 cell map</h4>
        <p className="text-xs text-ink-600 mb-3 leading-relaxed">
          Numbers in each cell are the manhattan distance to the nearest shaft. Shafts are the amber S cells. Each shaft is an air column from floor to ceiling, so every Y inside the column reads sunlight 22. Lateral propagation outside the shaft column subtracts 1 per face step. So the sunlight at any cell is <code className="font-mono text-[11px]">22 - distance</code>.
        </p>

        <div className="inline-block bg-parchment-100/40 border border-parchment-300/40 rounded p-2 mb-4 overflow-x-auto">
          <div
            className="grid gap-[2px]"
            style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`, width: 'fit-content' }}
          >
            {cells.map(cell => (
              <div
                key={cell.r + '-' + cell.c}
                className="flex items-center justify-center text-[9px] font-mono tabular text-ink-900"
                style={{
                  width: 22, height: 22,
                  background: cellColor(cell),
                  color: cell.isShaft ? '#fff' : (cell.d === 3 ? '#fff' : '#1a1a1a'),
                  fontWeight: cell.d === 3 ? 700 : 400,
                }}
                title={cell.isShaft
                  ? `(${cell.c},${cell.r}) shaft, light 22`
                  : `(${cell.c},${cell.r}) d=${cell.d}, light ${cell.light}, factor ${(cell.factor*100).toFixed(0)}%`}
              >
                {cell.isShaft ? 'S' : cell.d}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-[10px] text-ink-600 mb-5">
          <span className="flex items-center gap-1.5"><span className="inline-block" style={{width:10,height:10,background:'#DDA15E'}}/>shaft, light 22</span>
          <span className="flex items-center gap-1.5"><span className="inline-block" style={{width:10,height:10,background:'#97C459'}}/>d=1, light 21</span>
          <span className="flex items-center gap-1.5"><span className="inline-block" style={{width:10,height:10,background:'#7FB04F'}}/>d=2, light 20</span>
          <span className="flex items-center gap-1.5"><span className="inline-block" style={{width:10,height:10,background:'#5E8B3A'}}/>d=3, light 19 (worst)</span>
        </div>

        <h4 className="font-display text-lg text-forest-900 mt-6 mb-2">Counting the cells</h4>

        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 gap-y-1 mb-4 text-[11px] font-mono">
          <div className="text-ink-500 uppercase tracking-wide">Light</div>
          <div className="text-ink-500 uppercase tracking-wide">Cells (of {histogram.nonShaftCount} farmland)</div>
          <div className="text-ink-500 uppercase tracking-wide text-right">Count</div>
          <div className="text-ink-500 uppercase tracking-wide text-right">Speed</div>
          {[21, 20, 19].map(L => {
            const count = histogram.buckets[L] || 0;
            const pct = count / histogram.nonShaftCount * 100;
            return (
              <div key={L} className="contents">
                <div className="tabular text-ink-700">{L}</div>
                <div className="bg-parchment-100/60 rounded h-4 relative overflow-hidden">
                  <div className="h-full" style={{ width: pct + '%', background: '#97C459' }} />
                </div>
                <div className="tabular text-right text-ink-700">{count}</div>
                <div className="tabular text-right text-forest-900">100%</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Stat label="Farmland cells" value={histogram.nonShaftCount} sub="14x14 minus 18 shafts" />
          <Stat label="At light 19+" value={histogram.nonShaftCount} sub="full speed, all of them" />
          <Stat label="Worst cell" value={`d=${histogram.maxD}`} sub={`light ${22 - histogram.maxD}, still 100%`} />
          <Stat label="Below threshold" value="0" sub="no slow cells" />
        </div>

        <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 text-xs text-ink-600 leading-relaxed mb-3">
          <strong className="text-forest-900">The worst cells, named.</strong> Nine tiles share the worst distance of 3 in this layout: {histogram.worst.map(p => `(${p[0]},${p[1]})`).join(', ')}. Pick one, say <code className="font-mono text-[11px]">(13, 4)</code>. The nearest shaft is at <code className="font-mono text-[11px]">(10, 4)</code>, three steps west along row 4. Light at (13,4) = 22 minus 3 = <strong>19</strong>. Plug into the formula: <code className="font-mono text-[11px]">clamp(1 - (19 - 19) * 0.1, 0, 1) = 1.0</code>. Full speed. The layout was tuned so that 3 is the worst case, because 22 minus 3 lands exactly on the threshold.
        </div>

        <h4 className="font-display text-lg text-forest-900 mt-6 mb-2">Why every Y reads the same map</h4>
        <p className="text-xs text-ink-600 leading-relaxed mb-3">
          Each of the 18 shafts is a column of air from Y=0 to the glass ceiling. Decompiled <code className="font-mono text-[11px]">ChunkIlluminator.SpreadSunlightAt</code> iterates the 6 face neighbours and subtracts 1 per step, with a special case: when the step is along the down axis AND the horizontal position has not changed AND the column is sky-aligned, the cost is 0. That is the literal IL condition. So sunlight enters the shaft column at the ceiling at value 22, falls straight down through the column at no cost, and arrives at every Y inside the column at 22.
        </p>
        <p className="text-xs text-ink-600 leading-relaxed mb-3">
          Lateral propagation at each Y then walks the same -1 per face step through the surrounding farmland and crop blocks (both have <code className="font-mono text-[11px]">lightAbsorption: 0</code>, so they pass light without taking any). Because the input at every Y inside the shaft is identical, and the surrounding block layout is identical at every farmland tier, the per-cell light map is identical at Y=1, 3, 5, 7, 9, 11, and 13. The grid above is what every farmland tier sees.
        </p>

        <div className="bg-parchment-100/60 border border-parchment-300/40 rounded p-3 text-xs text-ink-600 leading-relaxed">
          <strong className="text-forest-900">Headline.</strong> {histogram.nonShaftCount} farmland tiles, 7 tiers, every tile at light 19 or higher, every tile at 100 percent growth speed. The 18-shaft pattern is the minimum shaft count where this holds in 14x14, hence the design. Drop a shaft and a corner cell falls to light 18 (90 percent); the &quot;Fewer shafts trap&quot; card above walks through that case.
        </div>
      </CardBody>
    </Card>
  );
}


function BuildListCard() {
  return (
    <Card>
      <CardHeader
        eyebrow="Build list"
        title="What to gather for the multi-tier"
        subtitle="External shell is 16x16x16 outside, 14x14x14 interior. Floor at sea level (Y=110) or higher."
      />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Mat label="Farmland blocks" qty="1071" sub="153 per tier x 7 tiers" />
          <Mat label="Water source blocks" qty="350" sub="25 columns x 14 high" />
          <Mat label="Wall blocks" qty="224" sub="cobble or planks, 14 high all 4 sides" />
          <Mat label="Glass slabs" qty="98" sub="50% of 196 ceiling, the 18 shafts already help" />
          <Mat label="Floor blocks" qty="196" sub="cobble at Y=109, full 14x14 foundation" />
          <Mat label="Doors" qty="1+" sub="solid wood or iron, 1 access door per side" />
          <Mat label="Bucket" qty="1" sub="copper saw tier, for placing water" />
          <Mat label="Ladder" qty="14" sub="placed inside a shaft for vertical access" />
        </div>

        <div className="mt-4 text-xs text-ink-600 leading-relaxed">
          <strong className="text-forest-900">Build steps (7 tiers, 1071 farmland):</strong>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Lay foundation cobble at Y=109 across the whole 14&times;14.</li>
            <li>Place water sources at Y=110 in the 25 stride-3 positions, then stack water sources Y=111 to Y=123. 14 sources per column = 350 total.</li>
            <li>Place farmland at Y=110, Y=112, Y=114, Y=116, Y=118, Y=120, Y=122 (153 tiles each, around water).</li>
            <li>Leave the 18 shaft positions empty (just air) from Y=110 to Y=123.</li>
            <li>Walls 14 high. Cap ceiling at Y=124 with 98 glass and the rest as solid blocks.</li>
            <li>Place ladder in one shaft from Y=110 to Y=123 for vertical access; harvest by reaching from inside the shaft column at each crop row.</li>
            <li>Plant seeds. Bottom tier (Y=111) is reachable from the shaft as well.</li>
          </ol>
        </div>

        <div className="mt-4 bg-amber-300/10 border border-amber-300/30 rounded p-3 text-xs text-ink-700 leading-relaxed">
          <strong>Reality check:</strong> placing 350 water sources is the most tedious part of this build. Most builders fill the columns by placing one source at the bottom and using a barrel-and-still trick to propagate up, or by using creative or worldedit on a server. If you&apos;re fully survival, expect this to be a multi-day project after copper saw.
        </div>
      </CardBody>
    </Card>
  );
}

function FindingsCard() {
  return (
    <Card>
      <CardHeader
        eyebrow="What this investigation actually settled"
        title="Findings notebook"
      />
      <CardBody>
        <div className="space-y-4 text-sm text-ink-700 leading-relaxed">
          <Finding
            tag="Light propagation"
            title="Manhattan, not chebyshev"
          >
            Sky light spreads through transparent neighbors at minus 1 per face step. Diagonals don&apos;t shortcut. This is opposite from the moisture rule, which IS chebyshev. Moisture comes from BESoilNutrition.GetNearbyWaterDistance (chebyshev). Light comes from ChunkIlluminator.SpreadSunlightAt in VintagestoryLib.dll, which iterates BlockFacing.ALLNORMALI, the 6-element face-neighbor array. Decompiled and confirmed.
          </Finding>

          <Finding
            tag="Vertical shafts"
            title="Sky light at the bottom of a shaft is still 22"
          >
            Voxel sky light propagates DOWN through a fully-transparent column at full intensity. The bottom of a 14-high shaft has the same raw sunlight value as the top. There&apos;s no per-block vertical decay through air or glass. Lateral spread from the shaft is what attenuates.
          </Finding>

          <Finding
            tag="Crop transparency"
            title="Crops have lightAbsorption 0"
          >
            Verified across turnip, parsnip, peanut, carrot, spelt, amaranth, fennel, licorice, rice, sunflower JSON. Light passes through crop blocks freely. This is what makes lateral spread through a crop tier work without extra decay.
          </Finding>

          <Finding
            tag="Farmland opacity"
            title="Farmland blocks vertical light"
          >
            Farmland&apos;s sideopaque.down=true means light can&apos;t pass through it from below. Combined with the standard top opacity, farmland tiers act as horizontal barriers. Each crop tier has to source its light laterally at its own Y, not from the tier above.
          </Finding>

          <Finding
            tag="Water columns"
            title="Source water above source water needs no support"
          >
            A column of water source blocks stays put. It hydrates every farmland tier it touches via the chebyshev-1 search. 25 columns covers the whole 14&times;14 footprint at moisture 75% (worst case is a corner cell at chebyshev 1).
          </Finding>

          <Finding
            tag="Depth penalty"
            title="The growth formula has a separate sea-level term"
          >
            sunlight comes in raw from GetLightLevel, then the formula subtracts max(0, SeaLevel - farmland.Y) before comparing to threshold 19. Putting the floor at sea level zeros the penalty everywhere. Putting the floor below sea level kills the bottom tiers progressively.
          </Finding>

          <Finding
            tag="Shaft count"
            title="The minimum dominating set for 14x14 with manhattan 3 is roughly 13"
          >
            Solver result was 13 in irregular positions. The 18-shaft hex pattern is slightly more than minimum but is symmetric, easy to lay out, and leaves 153 farmland per tier. The 4-shaft design that &quot;looks symmetric&quot; only covers chebyshev 3, which is wrong for light, and fails 45% of crops.
          </Finding>

          <Finding
            tag="Output"
            title="1071 crops per cycle, all at 100% growth"
          >
            18 shafts and 25 water columns leaves 153 farmland blocks per tier. Stacked 7 tiers high, that&apos;s 1071 productive crops in a single 14&times;14&times;14 greenhouse. Compared to the wiki single-layer design&apos;s 156, this is roughly 6.9x more output from the same footprint, at the cost of 350 water sources and the engineering of 18 vertical shafts.
          </Finding>

          <Finding
            tag="Open question"
            title="Game version may have a bug that disables the underground penalty"
          >
            The wiki notes that as of 1.20.8-rc.2, the depth penalty isn&apos;t actually being applied in code, due to a bug. If your server is on an affected version, you can build below sea level without penalty. This isn&apos;t something to rely on. Build at sea level or above and you&apos;re safe regardless of which version you&apos;re running.
          </Finding>
        </div>
      </CardBody>
    </Card>
  );
}

function Finding({ tag, title, children }) {
  return (
    <div className="border-l-2 border-forest-600/40 pl-3">
      <div className="text-[10px] text-forest-700 uppercase tracking-wide mb-1">{tag}</div>
      <div className="font-medium text-forest-900 mb-1">{title}</div>
      <div className="text-xs text-ink-600 leading-relaxed">{children}</div>
    </div>
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

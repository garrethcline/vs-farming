// Mushrooms page. Documents the NDL Mushroom Growth mod's mechanics, lists
// all 45 species with toxicity flags, and computes throughput for a player
// running a wall of troughs.
//
// Source: ndlmushroomgrowth.dll v2.0.2 decompiled, plus a post-2.0.2 patch
// (version unspecified) that bumped grow times and removed the cellar
// requirement. See data/mushrooms.js for the full breakdown. Key findings:
// no temperature, no NPK, no class interactions. Just (soil tier) -> fixed
// grow time.
import { useState, useMemo } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish, ModPill, Stat,
} from '../components/ui/Primitives.jsx';
import { useSettings } from '../lib/storage.js';
import {
  MUSHROOM_SOILS, MUSHROOM_SPECIES, GROUND_SPECIES, WALL_SPECIES,
  YIELD_PER_TROUGH, TOXICITY, harvestsPerYear, mushroomsPerRealHour,
  NDL_MUSHROOM_INFO, MUSHROOM_GROW_DAYS,
} from '../data/mushrooms.js';
import { daysPerYear } from '../data/climate.js';

export default function MushroomsPage() {
  const [settings] = useSettings();
  const dpm = settings.daysPerMonth || 9;
  const yearLen = daysPerYear();
  const realMinutesPerGameDay = ((settings.realHoursPerMonth || 16) * 60) / dpm;

  const [troughCount, setTroughCount] = useState(20);
  const [soilTier, setSoilTier] = useState(50);
  const [edibleOnly, setEdibleOnly] = useState(true);
  const [placementFilter, setPlacementFilter] = useState('all');

  const filtered = useMemo(() => {
    return MUSHROOM_SPECIES.filter(m => {
      if (placementFilter !== 'all' && m.placement !== placementFilter) return false;
      if (edibleOnly && m.tox !== TOXICITY.EDIBLE && m.tox !== TOXICITY.MEDICINAL) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [edibleOnly, placementFilter]);

  const cyclesPerYear = harvestsPerYear(soilTier, yearLen);
  const mushroomsPerYear = troughCount * YIELD_PER_TROUGH * cyclesPerYear;
  const mushroomsHourly = mushroomsPerRealHour(troughCount, soilTier, realMinutesPerGameDay);
  const activeDaysForTier = MUSHROOM_GROW_DAYS[soilTier];

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§M · Mushrooms (mod)</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Mushroom troughs: <span className="heading-italic">free food</span> regardless of season
          </h2>
          <p className="mt-3 text-ink-600 max-w-3xl">
            The <strong>NDL Mushroom Growth</strong> mod adds craftable troughs that grow mushrooms anywhere you place them. No climate, no NPK, no class requirement, and as of the post-2.0.2 patch, no cellar requirement either. Place a trough, fill it with soil, insert a spore, and wait. Because temperature is irrelevant, this is the best winter food source you can set up. Numbers below come from the mod's source plus the post-2.0.2 changelog.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            eyebrow={<><ModPill /> <span className="ml-2">Mod requirement</span></>}
            title={`${NDL_MUSHROOM_INFO.name} v${NDL_MUSHROOM_INFO.version}`}
            subtitle={`By ${NDL_MUSHROOM_INFO.author}. This page only matters if the mod is installed on your server.`}
          />
          <CardBody>
            <div className="text-sm text-ink-700">
              Get it at <a href={NDL_MUSHROOM_INFO.url} className="text-forest-700 underline" target="_blank" rel="noopener noreferrer">{NDL_MUSHROOM_INFO.url}</a>. Mod identifier: <code className="font-mono bg-parchment-200/50 px-1 rounded">{NDL_MUSHROOM_INFO.identifier}</code>.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader
            eyebrow="Mechanics"
            title="What actually controls growth"
            subtitle="From the decompiled DLL: SoilGrowthDays dictionary in growntroughBE.cctor. There's no temperature, NPK, light, or moisture check anywhere in the mod's code."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="font-display text-lg text-forest-900 mb-2">Soil tier sets grow time</div>
                <div className="space-y-1.5">
                  {MUSHROOM_SOILS.map(s => (
                    <div key={s.tier} className="bg-parchment-100/60 border border-parchment-300/40 rounded px-3 py-2">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-display text-forest-900 w-32">{s.name}</span>
                        <span className="text-ink-500 text-xs tabular w-16">tier {s.tier}</span>
                        <span className="ml-auto tabular text-forest-700">
                          <strong>{s.days} days</strong>
                        </span>
                      </div>
                      <div className="text-[10px] text-ink-500 mt-0.5 font-mono">
                        internal: <code>{s.internalCode}</code>
                        {s.alias && <span className="italic font-sans"> &middot; {s.alias}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 px-3 py-2 rounded border-l-4 border-l-amber-400 bg-amber-50/30 text-xs text-ink-700 leading-relaxed">
                  <strong className="text-forest-900">Heads up about the in-game chat log:</strong> when you spore a trough,
                  the mod prints "<code className="font-mono bg-parchment-200/50 px-1 rounded">grows in 5 days</code>" no matter what soil you used.
                  That string is hardcoded in the mod's AssignSpore method and isn't tied to the real grow time.
                  The actual ripening still uses the dictionary above (the
                  CheckGrowth tick compares <code className="font-mono bg-parchment-200/50 px-1 rounded">Calendar.TotalDays</code> against
                  <code className="font-mono bg-parchment-200/50 px-1 rounded">growthStartDay + growthDays</code>).
                </div>
              </div>
              <div>
                <div className="font-display text-lg text-forest-900 mb-2">Hard requirements</div>
                <ol className="space-y-2 text-sm text-ink-700">
                  <li className="flex gap-2"><span className="text-forest-700 font-display tabular w-5">1.</span><span><strong>Farmland soil block</strong> in the trough. Any of Low, Medium, High, or Terra Preta works. The soil's NPK doesn't drain or matter.</span></li>
                  <li className="flex gap-2"><span className="text-forest-700 font-display tabular w-5">2.</span><span><strong>Matching spore.</strong> Ground mushroom spores only work in ground troughs; wall mushroom spores only in wall troughs. Spore is consumed.</span></li>
                </ol>
                <div className="font-display text-lg text-forest-900 mb-2 mt-4">Yield</div>
                <div className="text-sm text-ink-700">
                  <strong className="tabular">{YIELD_PER_TROUGH} mushrooms</strong> per ripe trough on average. Trough item drops back when you break it, so it's reusable.
                </div>
              </div>
            </div>

            <div className="mt-5 px-4 py-3 rounded border-l-4 border-l-forest-500 bg-forest-50/40 text-sm">
              <strong className="text-forest-900">Class interactions:</strong> none. The mod doesn't reference Specialized Classes or any class trait. Anyone can craft and use troughs.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card>
          <CardHeader
            eyebrow="Workflow"
            title="From wild forage to ripe trough"
          />
          <CardBody>
            <ol className="space-y-3 text-sm text-ink-700">
              <li className="flex gap-3">
                <span className="font-display text-forest-700 tabular w-6">1.</span>
                <div>
                  <strong>Get spores.</strong> Wild-foraged mushrooms drop spore items when broken (the mod patches every vanilla mushroom block). One spore per break, type-matched to the mushroom you broke.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-forest-700 tabular w-6">2.</span>
                <div>
                  <strong>Craft the trough.</strong> Shaped recipe: 4 planks plus 1 nails. Plank type and nail type are both your choice. The result is a single Mushroom Trough item with ground and wall variants; place it on the ground for ground species, or on a wall for wall species.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-forest-700 tabular w-6">3.</span>
                <div>
                  <strong>Fill with soil.</strong> Right-click the empty trough holding any farmland soil block (Low / Medium / High / Terra Preta).
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-forest-700 tabular w-6">4.</span>
                <div>
                  <strong>Spore it.</strong> Right-click holding a matching spore. The trough switches to "spored" state and the growth timer starts immediately.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-forest-700 tabular w-6">5.</span>
                <div>
                  <strong>Wait.</strong> 5 to 15 game days depending on soil tier. Once the spore is in, the timer runs unconditionally; no room or cellar check.
                </div>
              </li>
              <li className="flex gap-3">
                <span className="font-display text-forest-700 tabular w-6">6.</span>
                <div>
                  <strong>Harvest.</strong> Break the grown trough to drop ~3 mushrooms plus the trough item. Re-soil and re-spore to restart.
                </div>
              </li>
            </ol>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="Throughput"
            title="How many mushrooms can I produce"
            subtitle="Pick how many troughs you'll run and which soil tier you can spare. Numbers scale linearly with trough count."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Trough count</label>
                <input
                  type="number" min="1" max="999"
                  className="input-field tabular w-32"
                  value={troughCount}
                  onChange={e => setTroughCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <div className="text-[10px] text-ink-500 italic mt-1">
                  How many mushroom troughs you're running.
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-700 mb-1">Soil tier in the troughs</label>
                <select
                  className="select-field"
                  value={soilTier}
                  onChange={e => setSoilTier(parseInt(e.target.value))}
                >
                  {MUSHROOM_SOILS.map(s => (
                    <option key={s.tier} value={s.tier}>
                      {s.name} ({s.days} days/cycle)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Days/cycle" value={`${activeDaysForTier}d`} />
              <Stat label="Cycles/year" value={cyclesPerYear} note={`${yearLen}-day year`} />
              <Stat label="Mushrooms/year" value={mushroomsPerYear.toLocaleString()} note={`${troughCount} × ${YIELD_PER_TROUGH} × ${cyclesPerYear}`} />
              <Stat label="Mushrooms/real hour" value={mushroomsHourly.toFixed(1)} note={`server pace ${realMinutesPerGameDay.toFixed(0)} min/game day`} />
            </div>

            <div className="mt-4 px-4 py-3 rounded border-l-4 border-l-amber-400 bg-amber-50/40 text-sm leading-relaxed">
              <strong className="text-forest-900">Feed-the-town context:</strong> at Medium soil with 50 troughs you produce roughly {Math.round(50 * YIELD_PER_TROUGH * harvestsPerYear(50, yearLen))} mushrooms per game year. At Terra Preta with the same trough count you push that to {Math.round(50 * YIELD_PER_TROUGH * harvestsPerYear(80, yearLen))}. Compared to outdoor crops where each tile ripens once or twice a season and freezes solid in winter, mushroom troughs run year-round at a constant rate. Very strong for filling the gap between fall harvest and spring planting.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.25}>
        <Card>
          <CardHeader
            eyebrow={`Species (${MUSHROOM_SPECIES.length} total)`}
            title="What you can grow"
            subtitle="Filter by placement and edibility. Toxicity tags reflect real-world fungi as referenced in the Vintage Story handbook."
          />
          <CardBody>
            <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-parchment-300/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-ink-700">Placement:</span>
                {['all', 'ground', 'wall'].map(p => (
                  <button
                    key={p}
                    onClick={() => setPlacementFilter(p)}
                    className={`px-2 py-1 rounded text-xs border ${
                      placementFilter === p
                        ? 'border-forest-700 bg-forest-50 text-forest-900'
                        : 'border-parchment-300/60 hover:bg-parchment-200/40 text-ink-700'
                    }`}
                  >
                    {p === 'all' ? `All (${MUSHROOM_SPECIES.length})` : p === 'ground' ? `Ground (${GROUND_SPECIES.length})` : `Wall (${WALL_SPECIES.length})`}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={edibleOnly}
                  onChange={e => setEdibleOnly(e.target.checked)}
                />
                <span className="text-ink-700">Edible/medicinal only (hide toxic and inedible)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filtered.map(m => (
                <div key={m.key} className="px-3 py-2 rounded border border-parchment-300/40 bg-parchment-100/40 flex items-start gap-3">
                  <ToxicityChip tox={m.tox} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base text-forest-900">{m.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-ink-500 font-mono">{m.placement}</span>
                    </div>
                    <div className="text-xs text-ink-600 italic">{m.notes}</div>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="text-sm text-ink-500 italic py-4 text-center">
                No species match the current filters.
              </div>
            )}
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function ToxicityChip({ tox }) {
  const styles = {
    [TOXICITY.EDIBLE]: { bg: 'bg-forest-100/60', text: 'text-forest-900', label: 'Edible' },
    [TOXICITY.MEDICINAL]: { bg: 'bg-forest-100/60', text: 'text-forest-900', label: 'Medicinal' },
    [TOXICITY.POISONOUS]: { bg: 'bg-terra-200/60', text: 'text-terra-900', label: 'Toxic' },
    [TOXICITY.HALLUCINOGENIC]: { bg: 'bg-amber-200/60', text: 'text-amber-900', label: 'Hallucin.' },
    [TOXICITY.INEDIBLE]: { bg: 'bg-parchment-200/60', text: 'text-ink-700', label: 'Inedible' },
  };
  const s = styles[tox] || styles[TOXICITY.INEDIBLE];
  return (
    <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded ${s.bg} ${s.text} whitespace-nowrap`}>
      {s.label}
    </span>
  );
}

// Bees + beehives. Mechanics summary + production calculator.
// Source: vssurvivalmod-master/BlockEntity/BEBeehive.cs (decompiled vanilla).
// All numbers verified against the C# behavior, including the explicit
// greenhouse temperature bonus in TestHarvestable().
import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import { useSettings } from '../lib/storage.js';
import { useClimate } from '../lib/useClimate.js';
import { daysPerYear, dateLabel } from '../data/climate.js';
import {
  activityLevel, hivePopSize, POP_SIZE_LABELS,
  HARVEST_DAYS_MIN, HARVEST_DAYS_MAX, HARVEST_DAYS_AVG,
  swarmInDays, SWARM_COOLDOWN_DAYS,
  HONEYCOMB_PER_HARVEST, HONEY_LITRES_PER_HONEYCOMB,
  BEESWAX_PER_HONEYCOMB_PRESS, BEESWAX_PER_HONEYCOMB_HAND,
  HONEY_SAT_PER_LITRE_RAW, HONEY_SAT_PER_LITRE_MEAL,
  SCAN_RADIUS_HORIZONTAL,
  annualOutput,
  BEE_FEED_NOTES,
} from '../data/bees.js';

export default function BeesPage() {
  const [settings] = useSettings();
  const { climate: CLIMATE } = useClimate();
  const dpm = settings.daysPerMonth || 9;

  return (
    <div className="space-y-6">
      <Reveal delay={0.05}>
        <PageHero />
      </Reveal>

      <Reveal delay={0.10}>
        <GreenhouseAnswerCard />
      </Reveal>

      <Reveal delay={0.15}>
        <BeeCalculatorCard climate={CLIMATE} dpm={dpm} />
      </Reveal>

      <Reveal delay={0.20}>
        <MechanicsCard />
      </Reveal>

      <Reveal delay={0.25}>
        <BeeFeedCard />
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function PageHero() {
  return (
    <div className="px-1">
      <div className="section-eyebrow mb-3">§ · Beekeeping</div>
      <h2 className="heading-display text-3xl md:text-4xl mb-2">
        <em>Skeps,</em> swarms, <em>greenhouses,</em> and honey.
      </h2>
      <p className="text-ink-600 max-w-2xl">
        How beehives actually work in vanilla, decompiled from BEBeehive.cs. Greenhouse interaction, flower count, swarm timing, harvest rate, and what one hive produces per game year. Yes, greenhouses help bees, same +5°C bonus as crops.
      </p>
    </div>
  );
}

// Direct answer card to the question "do greenhouses affect bees?"
function GreenhouseAnswerCard() {
  return (
    <Card>
      <CardHeader
        eyebrow="The short answer"
        title="Yes, greenhouses give bees the same +5°C bonus as crops"
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 text-sm leading-relaxed text-ink-700 space-y-3">
            <p>
              From the vanilla source <code className="font-mono text-xs bg-parchment-200/40 px-1 rounded">BEBeehive.TestHarvestable()</code>:
            </p>
            <pre className="font-mono text-[11px] bg-parchment-100/60 border border-parchment-300/40 rounded p-3 overflow-x-auto">
{`float temp = Api.World.BlockAccessor.GetClimateAt(Pos, ...).Temperature;
if (roomness > 0) temp += 5;             // greenhouse bonus
activityLevel = GameMath.Clamp(temp / 5f, 0f, 1f);

if (temp <= 0)   // freeze: pause harvest, swarm, cooldown timers
if (temp <= -10) // hard freeze: RESET timers (winter wipes progress)`}
            </pre>
            <p>
              <strong className="text-forest-900">Roomness</strong> is set the same way the game decides if your crops get the greenhouse boost: a closed room where skylights outnumber non-skylights and the room has zero exits (no doors, no open windows touching outside).
            </p>
            <p>
              The hive even shows you a <code className="font-mono text-xs bg-parchment-200/40 px-1 rounded">"greenhousetempbonus"</code> tooltip in <kbd className="font-mono text-xs bg-parchment-200/40 px-1 rounded">F3</kbd> block info when this kicks in.
            </p>
          </div>
          <div className="bg-forest-50/40 border-l-4 border-l-forest-500 rounded p-3 text-xs">
            <div className="font-display text-base text-forest-900 mb-2">What this changes in practice</div>
            <ul className="list-disc ml-4 space-y-1.5 text-ink-700">
              <li>Bees stay active in colder climates: a hive at outdoor 0°C is dormant; in a greenhouse it's 5°C and at 100% activity.</li>
              <li>Winter doesn't necessarily reset your hives if the greenhouse keeps internal temp above -10°C.</li>
              <li>Harvest cycle keeps ticking through cool weather instead of pausing every other day.</li>
            </ul>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// Main calculator card.
function BeeCalculatorCard({ climate, dpm }) {
  const [settings] = useSettings();
  const today = settings.today || 1;
  const [flowers, setFlowers] = useState(8);
  const [hives, setHives] = useState(1);
  const [greenhouse, setGreenhouse] = useState(false);
  const [pressMethod, setPressMethod] = useState('press');
  const [satMode, setSatMode] = useState('meal');
  const [hiveCount, setHiveCount] = useState(1);

  // Compute current temp at the hive (today's climate, with greenhouse bonus if on)
  const todayIdx = climate ? Math.max(0, Math.min(climate.length - 1, today - 1)) : 0;
  const todayClimate = climate?.[todayIdx];
  const baseTempC = todayClimate?.avg ?? 10;
  const effTempC = baseTempC + (greenhouse ? 5 : 0);
  const timerPaused = effTempC <= 0;
  const timerReset = effTempC <= -10;
  const activity = activityLevel(effTempC);
  const popSize = hivePopSize(flowers, hives);
  const swarmDays = swarmInDays(flowers, hives);

  const annual = useMemo(() =>
    annualOutput({ flowers, hives, greenhouse, climate: climate || [], pressMethod }),
  [flowers, hives, greenhouse, climate, pressMethod]);

  const satPerLitre = satMode === 'meal' ? HONEY_SAT_PER_LITRE_MEAL : HONEY_SAT_PER_LITRE_RAW;
  const totalSat = annual.honeyLitres * satPerLitre;

  return (
    <Card>
      <CardHeader
        eyebrow="The bee calculator"
        title="How much honey does this setup produce?"
        subtitle="Inputs match what the game actually checks: flowers in a 16x16x12 area centered on the hive, count of nearby living hives (your own count, plus any wild ones nearby), greenhouse status, and average temperature. Outputs are per-hive per-year, multiply by your hive count for totals."
      />
      <CardBody>
        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 pb-4 border-b border-parchment-300/40">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Flowers within scan range ({SCAN_RADIUS_HORIZONTAL}-block radius, 12 blocks vertical)
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="40" value={flowers}
                  onChange={e => setFlowers(parseInt(e.target.value))}
                  className="flex-1" />
                <input type="number" min="0" max="100" value={flowers}
                  onChange={e => setFlowers(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input-field tabular w-20 text-right" />
              </div>
              <div className="text-[10px] text-ink-500 mt-0.5">
                Includes flower blocks (except horsetail), lupine, barrel cactus, and crops in their flowering stage.
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Living hives within scan range (incl. this one + nearby wild hives)
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min="1" max="10" value={hives}
                  onChange={e => setHives(parseInt(e.target.value))}
                  className="flex-1" />
                <input type="number" min="1" max="20" value={hives}
                  onChange={e => setHives(Math.max(1, parseInt(e.target.value) || 1))}
                  className="input-field tabular w-20 text-right" />
              </div>
              <div className="text-[10px] text-ink-500 mt-0.5">
                Each extra hive in range needs 3 more flowers to maintain the same population size.
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Hive count (multiplier for whole-farm totals)
              </label>
              <input type="number" min="1" max="500" value={hiveCount}
                onChange={e => setHiveCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field tabular w-24 text-right" />
              <div className="text-[10px] text-ink-500 mt-0.5">
                Per-hive output gets multiplied by this for the whole-farm row at the bottom.
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">Hive location</label>
              <div className="flex gap-2">
                <button onClick={() => setGreenhouse(false)}
                  className={`px-3 py-2 rounded-md border text-sm flex-1 ${!greenhouse ? 'bg-forest-600 text-parchment-50 border-forest-700' : 'bg-parchment-200/40 text-ink-700 border-parchment-300/60'}`}>
                  Outdoor
                </button>
                <button onClick={() => setGreenhouse(true)}
                  className={`px-3 py-2 rounded-md border text-sm flex-1 ${greenhouse ? 'bg-forest-600 text-parchment-50 border-forest-700' : 'bg-parchment-200/40 text-ink-700 border-parchment-300/60'}`}>
                  Greenhouse (+5°C)
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Honeycomb extraction method
              </label>
              <div className="flex gap-2">
                <button onClick={() => setPressMethod('press')}
                  className={`px-2 py-1.5 rounded text-xs flex-1 ${pressMethod === 'press' ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}>
                  Fruit press (5× wax)
                </button>
                <button onClick={() => setPressMethod('hand')}
                  className={`px-2 py-1.5 rounded text-xs flex-1 ${pressMethod === 'hand' ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}>
                  Hand squeeze (1× wax)
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">
                Honey satiety mode
              </label>
              <div className="flex gap-2">
                <button onClick={() => setSatMode('meal')}
                  className={`px-2 py-1.5 rounded text-xs flex-1 ${satMode === 'meal' ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}>
                  In meal (400/L)
                </button>
                <button onClick={() => setSatMode('raw')}
                  className={`px-2 py-1.5 rounded text-xs flex-1 ${satMode === 'raw' ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700'}`}>
                  Raw (300/L)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Hive state stats */}
        <div className="text-xs font-medium text-ink-700 mb-2">Per-hive instantaneous state</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="Population size" value={POP_SIZE_LABELS[popSize]}
            tone={popSize === 0 ? 'terra' : popSize === 1 ? 'amber' : 'forest'}
            note={`flowers - 3 × hives = ${flowers - 3 * hives}`} />
          <Stat label="Bee visual activity" value={`${Math.round(activity * 100)}%`}
            tone={activity === 0 ? 'terra' : activity < 1 ? 'amber' : 'forest'}
            note={`temp ${effTempC.toFixed(1)}°C ${greenhouse ? '(incl. +5° greenhouse)' : ''} · particle density only, harvest timer is binary`} />
          <Stat label="Days to harvest"
            value={popSize === 0 ? 'never' : timerPaused ? 'paused' : `${HARVEST_DAYS_MIN}-${HARVEST_DAYS_MAX}d`}
            tone={popSize === 0 || timerPaused ? 'terra' : 'forest'}
            note={popSize === 0 ? 'Poor population never harvests'
              : timerReset ? 'Today: ≤-10°C, timer RESET each tick'
              : timerPaused ? 'Today: ≤0°C, timer paused'
              : `avg ${HARVEST_DAYS_AVG}d`} />
          <Stat label="Days to swarm"
            value={swarmDays === null ? 'no swarming'
              : timerPaused ? 'paused'
              : swarmDays === 0 ? '~immediate'
              : `${swarmDays.toFixed(1)}d`}
            tone={swarmDays === null ? 'ink' : timerPaused ? 'terra' : swarmDays > 5 ? 'amber' : 'forest'}
            note={swarmDays === null ? 'Need more flowers to swarm'
              : timerPaused ? 'Today: ≤0°C, timer paused'
              : `+${SWARM_COOLDOWN_DAYS}d cooldown after`} />
        </div>

        {/* Annual output stats */}
        <div className="text-xs font-medium text-ink-700 mb-2">Per-hive annual output (using your climate data)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Harvests/year" value={annual.harvestsPerYear}
            note={`out of ${Math.floor(climate?.length || 0) / HARVEST_DAYS_AVG | 0} max if year-round active`} />
          <Stat label="Honeycomb/year" value={annual.honeycombPerYear.toLocaleString()}
            note={`${HONEYCOMB_PER_HARVEST} per harvest`} />
          <Stat label="Honey/year" value={`${annual.honeyLitres.toFixed(1)} L`}
            note={`${HONEY_LITRES_PER_HONEYCOMB} L per honeycomb`} />
          <Stat label="Beeswax/year" value={annual.beeswax.toLocaleString()}
            note={pressMethod === 'press' ? `${BEESWAX_PER_HONEYCOMB_PRESS}× per honeycomb (fruit press)` : `${BEESWAX_PER_HONEYCOMB_HAND}× per honeycomb (hand)`} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          <Stat label="Honey satiety/year" value={Math.round(totalSat).toLocaleString()}
            note={satMode === 'meal' ? `${HONEY_SAT_PER_LITRE_MEAL}/L in cooked meals` : `${HONEY_SAT_PER_LITRE_RAW}/L raw`} />
          <Stat label="New hives spawned/year" value={annual.swarms}
            note={annual.swarms === 0 ? 'No swarming with current setup' : 'Place empty skeps in scan range'} />
          <Stat label="Whole-farm honey/year" value={`${(annual.honeyLitres * hiveCount).toFixed(1)} L`}
            tone="forest"
            note={`${hiveCount} hives × ${annual.honeyLitres.toFixed(1)} L`} />
        </div>

        {annual.reason && (
          <div className="mt-4 px-3 py-2 rounded border-l-4 border-l-terra-500 bg-terra-50/30 text-xs">
            <strong className="text-terra-800">No production:</strong> {annual.reason}
          </div>
        )}

        <div className="mt-5 px-4 py-3 rounded border-l-4 border-l-forest-500 bg-forest-50/40 text-sm leading-relaxed">
          <div className="font-medium text-forest-900 mb-1">Verdict</div>
          <BeeVerdict flowers={flowers} hives={hives} greenhouse={greenhouse}
            climate={climate} effTempC={effTempC} popSize={popSize}
            annual={annual} hiveCount={hiveCount} />
        </div>
      </CardBody>
    </Card>
  );
}

function BeeVerdict({ flowers, hives, greenhouse, climate, effTempC, popSize, annual, hiveCount }) {
  const activeFraction = climate
    ? climate.filter(c => ((c?.avg ?? 10) + (greenhouse ? 5 : 0)) > 0).length / climate.length
    : 1;
  const greenhouseGain = climate
    ? (climate.filter(c => ((c?.avg ?? 10) + 5) > 0).length - climate.filter(c => ((c?.avg ?? 10)) > 0).length)
    : 0;
  const dormantFraction = 1 - activeFraction;

  if (popSize === 0) {
    const needed = 4 + 3 * (hives - 1);
    return (
      <p className="text-ink-700">
        With {flowers} flowers and {hives} living hive{hives === 1 ? '' : 's'}, the population is Poor and never goes harvestable. You need at least <strong>{needed} flowers</strong> in scan range for one hive (or more if you have multiple hives sharing the territory). Plant a flower bed in the {SCAN_RADIUS_HORIZONTAL}-block radius around your skep, or move the hive closer to wild flowers.
      </p>
    );
  }

  return (
    <div className="text-ink-700 space-y-2">
      <p>
        <strong className="text-forest-900">{annual.harvestsPerYear} harvests/year per hive</strong>, producing <strong>{annual.honeyLitres.toFixed(1)} L of honey</strong> and <strong>{annual.beeswax} beeswax</strong>. Population is {POP_SIZE_LABELS[popSize]}.
        {hiveCount > 1 && <> Across {hiveCount} hives that's {(annual.honeyLitres * hiveCount).toFixed(1)} L of honey and {(annual.beeswax * hiveCount).toLocaleString()} beeswax annually.</>}
      </p>
      {dormantFraction > 0.05 && !greenhouse && (
        <p>
          <strong className="text-forest-900">Climate cost:</strong> {Math.round(dormantFraction * 100)}% of the year your hive is below 0°C and dormant.
          {greenhouseGain > 0 && (
            <> Putting it in a greenhouse would unlock {greenhouseGain} extra active days, raising harvests/year from {annual.harvestsPerYear} to roughly {Math.floor((climate.length - climate.filter(c => ((c?.avg ?? 10) + 5) <= 0).length) / HARVEST_DAYS_AVG)}.</>
          )}
        </p>
      )}
      {greenhouse && (
        <p>
          <strong className="text-forest-900">Greenhouse working:</strong> Effective hive temp is {effTempC.toFixed(1)}°C. The +5° bonus shifts {greenhouseGain > 0 ? `${greenhouseGain} previously-frozen days into active production` : 'nothing extra here (already warm enough)'}.
        </p>
      )}
      {annual.swarms > 0 && (
        <p>
          <strong className="text-forest-900">Bonus: {annual.swarms} new hives spawn per year</strong> if you keep empty skeps in scan range. That's free hive expansion. After each spawn the parent hive cools down for {SWARM_COOLDOWN_DAYS} days before swarming again.
        </p>
      )}
    </div>
  );
}

// Mechanics breakdown card.
function MechanicsCard() {
  return (
    <Card>
      <CardHeader
        eyebrow="What the code actually does"
        title="The full mechanics, decompiled"
      />
      <CardBody>
        <div className="space-y-4 text-sm leading-relaxed text-ink-700">
          <Section title="Activity vs temperature">
            <p>
              The hive checks the world climate every 3 seconds and sets <code className="font-mono text-xs bg-parchment-200/40 px-1 rounded">activityLevel = clamp(temp / 5, 0, 1)</code>. Below 5°C, bees slow down; below 0°C they're inactive and the harvest/swarm/cooldown timers all PAUSE. Below -10°C the timers RESET ,  winter wipes any partial progress on the hive's harvest cycle.
            </p>
          </Section>
          <Section title="Greenhouse bonus">
            <p>
              When the hive sits in a small enclosed room where skylights outnumber non-skylights and there are no exits, <code className="font-mono text-xs bg-parchment-200/40 px-1 rounded">roomness = 1</code> and the temperature read by the hive gets +5°C added. This is the same mechanic that gives crops the greenhouse boost. The hive shows a tooltip "+5° greenhouse temperature bonus" in its block info when active.
            </p>
          </Section>
          <Section title="Population size formula">
            <p>
              Every ~30 seconds (game time) the hive scans a 16×16×12 box around itself and counts (a) bee-feed flowers, (b) other living hives. Then:
            </p>
            <pre className="font-mono text-[11px] bg-parchment-100/60 border border-parchment-300/40 rounded p-3 mt-2 overflow-x-auto">
{`hivePopSize = clamp(flowers - 3 × hives, 0, 2)
            0 = Poor    (never goes harvestable)
            1 = Decent  (harvestable)
            2 = Large   (harvestable, can swarm)`}
            </pre>
            <p className="mt-2">
              Each extra living hive in range needs 3 more flowers to maintain the same population. This caps how dense you can pack hives in one location.
            </p>
          </Section>
          <Section title="Harvest cycle">
            <p>
              When placed (or after the previous harvest is taken), the next harvest readiness time is set to <code className="font-mono text-xs bg-parchment-200/40 px-1 rounded">TotalHours + 12 × (3 + Random[0..1] × 8)</code> ,  i.e. 36 to 132 hours from now, average 84 hours = {HARVEST_DAYS_AVG} game days. Harvesting a ready hive (you punch it) drops {HONEYCOMB_PER_HARVEST} honeycomb on average.
            </p>
            <p className="mt-2">
              The hive needs to be Decent or Large to ever go harvestable. Poor hives never produce.
            </p>
          </Section>
          <Section title="Swarming (creating new hives)">
            <p>
              If you have surplus flowers AND empty skeps within scan range, the hive will eventually spawn a new colony in one of those empty skeps. The math:
            </p>
            <pre className="font-mono text-[11px] bg-parchment-100/60 border border-parchment-300/40 rounded p-3 mt-2 overflow-x-auto">
{`surplus      = flowers - 3 - 3 × hives
swarmability = clamp(surplus, 0, 20) / 5      // 0 to 4
swarmInDays  = (4 - swarmability) × 2.5       // 0 to 10 days

if surplus < 0: no swarming at all
After spawning: 2-day cooldown before next swarm.`}
            </pre>
            <p className="mt-2">
              So with 4+ surplus flowers per hive (i.e. {`flowers >= 7 + 3 × extra_hives`}) you get a new colony every 10 days; with 23+ flowers it's continuous (limited only by the cooldown). The new hive is always placed in the closest empty skep to the parent. Wild hives count as living hives but can't be harvested.
            </p>
          </Section>
          <Section title="Honeycomb processing">
            <p>
              One honeycomb yields:
            </p>
            <ul className="list-disc ml-6 mt-1 space-y-0.5 text-xs">
              <li><strong>Fruit press</strong>: {HONEY_LITRES_PER_HONEYCOMB} L honey + 1 honeymash + {BEESWAX_PER_HONEYCOMB_PRESS} beeswax</li>
              <li><strong>Hand squeeze</strong>: {HONEY_LITRES_PER_HONEYCOMB} L honey + {BEESWAX_PER_HONEYCOMB_HAND} beeswax</li>
              <li><strong>Honey nutrition</strong>: {HONEY_SAT_PER_LITRE_RAW} satiety/L raw, {HONEY_SAT_PER_LITRE_MEAL}/L when used in cooked meals</li>
            </ul>
            <p className="mt-2">
              The fruit press is dramatically better for beeswax (5× yield) but requires the press infrastructure. For early-game beekeeping the hand squeezer's enough.
            </p>
          </Section>
        </div>
      </CardBody>
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 className="font-display text-base text-forest-900 mb-1">{title}</h4>
      {children}
    </div>
  );
}

function BeeFeedCard() {
  return (
    <Card>
      <CardHeader
        eyebrow="What counts as a flower"
        title="Bee-feed plants in vanilla"
      />
      <CardBody>
        <div className="text-sm text-ink-700 mb-3">
          The game checks <code className="font-mono text-xs bg-parchment-200/40 px-1 rounded">block.Attributes["beeFeed"] == true</code> on each plant in scan range. The practical answer:
        </div>
        <ul className="space-y-2 text-sm">
          {BEE_FEED_NOTES.map((n, i) => (
            <li key={i} className="px-3 py-2 bg-parchment-100/40 border border-parchment-300/30 rounded">
              <strong className="text-forest-900">{n.name}</strong>
              <span className="text-ink-600"> &middot; {n.detail}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 text-xs text-ink-500 italic">
          For dense flower farming, the easy path is a square of flower-* blocks tiled around the hive. Crops in flowering stage also count as a transient bonus while they're flowering, so a hive overlooking a sunflower or fennel field gets a temporary population boost during bloom.
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value, note, tone = 'forest' }) {
  const toneMap = {
    forest: 'text-forest-700',
    amber: 'text-amber-800',
    terra: 'text-terra-700',
    ink: 'text-ink-700',
  };
  return (
    <div className="bg-parchment-100/40 border border-parchment-300/40 rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className={`font-display text-2xl tabular ${toneMap[tone] || toneMap.forest}`}>{value}</div>
      {note && <div className="text-[10px] text-ink-500 mt-0.5">{note}</div>}
    </div>
  );
}

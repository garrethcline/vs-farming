// Fertilizers page. NPK profiles, slow-release behavior, [MOD] perk math.
import { useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  LineChart, Line, ReferenceLine,
} from 'recharts';
import {
  Card, CardHeader, CardBody, Reveal, ModPill, NutrientChip, Flourish,
} from '../components/ui/Primitives.jsx';
import { FERTILIZERS_LIST, FERTILIZERS, SC_MOD, GAME, perkBoost } from '../data/game.js';
import { useSettings } from '../lib/storage.js';
import { useChartColors } from '../lib/useTheme.js';
import { classFertilizerPermanenceBonus } from '../data/specializedClasses.js';
import { soilCraftCost, compareSoilUpgrade } from '../data/scCrafting.js';

export default function FertilizersPage() {
  const [settings] = useSettings();
  const cc = useChartColors();
  const npkData = FERTILIZERS_LIST.filter(f => f.key !== 'none').map(f => ({
    name: f.name,
    N: f.n, P: f.p, K: f.k,
  }));

  // Fertilizer permanence bonus comes from the Farmhand "fertilizer" trait
  // (+0.25). Any non-Farmhand class returns 0 here, so the math falls back
  // to vanilla cleanly.
  const permBonus = classFertilizerPermanenceBonus(settings.playerClass);
  const hasPerk = permBonus > 0;
  const compostProgression = simulatePerkProgression('compost', 50, permBonus);

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§6 · Fertilizers</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Four <span className="heading-italic">amendments</span>
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl">
            NPK profiles, slow-release behavior, and the perk math (if you have the mod).
          </p>
        </div>
      </Reveal>

      {/* NPK comparison chart */}
      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            eyebrow="At a glance"
            title="NPK profiles"
            subtitle="One application contributes this much to the slow-release pool. The pool then drips up to 0.25 per tick (a tick is about 3.5 in-game hours, so the cap works out to ~1.7 per day) into the actual N/P/K, but tapers as the pool empties."
          />
          <CardBody>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={npkData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={cc.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: cc.axisText }} />
                  <YAxis tick={{ fontSize: 11, fill: cc.axisText }} />
                  <Tooltip />
                  <Bar dataKey="N" fill="#0F5132" radius={[4, 4, 0, 0]} isAnimationActive={false}/>
                  <Bar dataKey="P" fill="#7F77DD" radius={[4, 4, 0, 0]} isAnimationActive={false}/>
                  <Bar dataKey="K" fill="#DDA15E" radius={[4, 4, 0, 0]} isAnimationActive={false}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Per-fertilizer cards */}
      <Reveal delay={0.1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FERTILIZERS_LIST.filter(f => f.key !== 'none').map(f => (
            <Card key={f.key}>
              <CardBody>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="font-display text-2xl text-forest-900">{f.name}</h3>
                  <span className="text-sm text-ink-500 italic">{f.notes}</span>
                </div>
                <div className="flex gap-3 mb-3">
                  <NutrientChip axis="N" value={`+${f.n}`} />
                  <NutrientChip axis="P" value={`+${f.p}`} />
                  <NutrientChip axis="K" value={`+${f.k}`} />
                </div>
                {hasPerk && (
                  <div className="mt-3 pt-3 border-t border-parchment-300/40">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="section-eyebrow">Perk boost per app</span>
                      <ModPill small />
                    </div>
                    <div className="flex gap-3 text-xs">
                      {(() => {
                        const boost = perkBoost(f);
                        return ['n', 'p', 'k'].map(a => (
                          <div key={a} className="flex items-center gap-1.5">
                            <span className="font-mono uppercase text-ink-500">{a}:</span>
                            <span className="font-mono font-semibold text-forest-800">+{boost[a]}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </Reveal>

      {/* SC mod perk panel */}
      <Reveal delay={0.15}>
        <Card className="border-l-4 border-l-amber-500 bg-amber-100/30">
          <CardHeader
            eyebrow={<><ModPill /> <span className="ml-2">Specialized Classes</span></>}
            title="The Farmhand fertilizer perk"
            subtitle={hasPerk
              ? "You have the perk enabled in Settings. The math below applies."
              : "You have NOT enabled the perk in Settings. This is here for reference only. Vanilla servers can ignore."
            }
          />
          <CardBody>
            <div className="prose prose-sm max-w-none text-ink-700">
              <p>
                When the Farmhand class is taken, fertilizing a plot raises that plot's <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">originalFertility[N|P|K]</code> by:
              </p>
              <pre className="bg-parchment-200/40 border border-parchment-300/60 p-3 rounded text-xs font-mono overflow-x-auto">
{`originalFertility[axis] += INT(ROUND(props.NPK * delta, 1))
where delta = 0.25 (Farmhand stat: fertilizerPermanencePercentage)
hard-clamped to [0, 100] per axis`}
              </pre>
              <p className="mt-4">
                Per-application perk boost:
              </p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Compost (40/8/8) → +10 N, +2 P, +2 K</li>
                <li>Saltpeter (13/0/44) → +3 N, +0 P, +11 K</li>
                <li>Bonemeal (3/30/0) → +1 N, +8 P (math says 7, banker's rounding may give 8), +0 K</li>
                <li>Potash (0/0/60) → +0 N, +0 P, +15 K (plus a one-time +15 K PermaBoost via "potash" code)</li>
              </ul>
              <p className="mt-4 text-xs text-ink-500 italic">
                The hard-clamp matters: once an axis reaches 100, additional applications add nothing.
                E.g., on a Medium plot (50/50/50), 4 Compost applications fully cap N at 100, P at 58, K at 58.
              </p>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {/* Perk progression chart (if enabled) */}
      {hasPerk && (
        <Reveal delay={0.2}>
          <Card>
            <CardHeader
              eyebrow={<><ModPill /> <span className="ml-2">Perk simulation</span></>}
              title="Compost applications on a Medium plot (starting 50/50/50)"
              subtitle="N caps at 100 first because Compost is N-heavy."
            />
            <CardBody>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={compostProgression} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke={cc.grid} />
                    <XAxis dataKey="apps" tick={{ fontSize: 11, fill: cc.axisText }} label={{ value: 'Compost applications', position: 'insideBottom', offset: -2, fontSize: 11, fill: cc.axisText }} />
                    <YAxis domain={[0, 110]} tick={{ fontSize: 11, fill: cc.axisText }} />
                    <Tooltip />
                    <ReferenceLine y={100} stroke={cc.today} strokeDasharray="3 3" label={{ value: 'cap', fontSize: 10, fill: cc.today }} />
                    <Line type="monotone" dataKey="N" stroke="#0F5132" strokeWidth={2} dot isAnimationActive={false}/>
                    <Line type="monotone" dataKey="P" stroke="#7F77DD" strokeWidth={2} dot isAnimationActive={false}/>
                    <Line type="monotone" dataKey="K" stroke="#DDA15E" strokeWidth={2} dot isAnimationActive={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        </Reveal>
      )}

      {hasPerk && (
        <Reveal delay={0.21}>
          <PermaBoostOptimizerCard permBonus={permBonus} />
        </Reveal>
      )}

      <Reveal delay={0.22}>
        <SoilTierEfficiencyCard hasFarmhand={hasPerk} />
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function simulatePerkProgression(fertKey, startVal, perkPct) {
  const fert = FERTILIZERS[fertKey];
  if (!fert || perkPct === 0) {
    return [{ apps: 0, N: startVal, P: startVal, K: startVal }];
  }
  const data = [{ apps: 0, N: startVal, P: startVal, K: startVal }];
  let n = startVal, p = startVal, k = startVal;
  for (let i = 1; i <= 8; i++) {
    n = Math.min(100, n + Math.floor(Math.round(fert.n * perkPct * 10) / 10));
    p = Math.min(100, p + Math.floor(Math.round(fert.p * perkPct * 10) / 10));
    k = Math.min(100, k + Math.floor(Math.round(fert.k * perkPct * 10) / 10));
    data.push({ apps: i, N: n, P: p, K: k });
  }
  return data;
}

// MOD-only soil tier-up efficiency calculator.
//
// THE QUESTION: when I have compost + bonemeal + powder-charcoal in hand,
// am I better off crafting up the soil tier or spreading those fertilizers
// directly on the original tile?
//
// COMPARISON: per 1 source-tier soil block, both paths cost the same compost
// + bonemeal. Crafting also burns powder-charcoal (no NPK) AND consumes the
// source tile, but bumps base fertility on all 3 axes by the tier delta
// permanently. Direct application keeps the tile and gives a one-time NPK
// pool boost; with Farmhand, also +25% of each application's NPK as
// permanent base. We compare the PERMANENT base gains apples-to-apples.
function SoilTierEfficiencyCard({ hasFarmhand: defaultFarmhand }) {
  // Player-facing tier names (matches in-game lang). Internal codes preserved.
  // verylow → "Very Low", low → "Low", medium → "Medium",
  // compost → "High" (the +65 NPK tier the wiki calls High Fertility),
  // high → "Terra Preta" (the rare +80 NPK top tier).
  const TIERS = [
    { key: 'verylow', name: 'Very Low',    val: 5  },
    { key: 'low',     name: 'Low',         val: 25 },
    { key: 'medium',  name: 'Medium',      val: 50 },
    { key: 'compost', name: 'High',        val: 65 },
    { key: 'high',    name: 'Terra Preta', val: 80 },
  ];
  const NAME = Object.fromEntries(TIERS.map(t => [t.key, t.name]));

  const [from, setFrom] = useState('medium');
  const [to, setTo] = useState('compost');
  const [farmhandOverride, setFarmhandOverride] = useState(defaultFarmhand ? 'on' : 'off');
  const farmhand = farmhandOverride === 'on';

  const craft = soilCraftCost(from, to);
  if (!craft) return null;

  const fromVal = TIERS.find(t => t.key === from).val;
  const toVal = TIERS.find(t => t.key === to).val;
  const tierGain = toVal - fromVal;

  // What the SAME compost + bonemeal would give if applied directly.
  // Powder-charcoal is wasted in the direct path (no NPK).
  // Compost  = 40N / 8P / 8K per unit
  // Per-app NPK base values (raw, before perk):
  // Compost = 40N / 8P / 8K
  // Bonemeal = 3N / 30P / 0K
  // Saltpeter= 13N / 0P / 44K
  const COMPOST = { n: 40, p: 8, k: 8 };
  const BONEMEAL = { n: 3, p: 30, k: 0 };
  const SALTPETER = { n: 13, p: 0, k: 44 };

  // Game's permanent boost per application = INT(ROUND(NPK × 0.25, 1))
  // i.e. multiply by 0.25, round to 1 decimal, truncate to int.
  // Compost  -> +10 / +2 / +2 perm per app
  // Bonemeal -> +0 / +7 / +0 perm per app  (3×0.25=0.75→0; 30×0.25=7.5→7)
  // Saltpeter-> +3 / +0 / +11 perm per app (13×0.25=3.25→3; 44×0.25=11→11)
  const COMPOST_PERM  = farmhand ? { n: 10, p: 2, k: 2 } : { n: 0, p: 0, k: 0 };
  const BONEMEAL_PERM = farmhand ? { n: 0,  p: 7, k: 0 } : { n: 0, p: 0, k: 0 };

  // Direct path: spread the same fractional fertilizer cost on the tile. Use
  // the integer per-app values × the fractional unit count. This gives the
  // average permanent boost per tile across the batch.
  const directBase = {
    n: craft.compost * COMPOST_PERM.n + craft.bonemeal * BONEMEAL_PERM.n,
    p: craft.compost * COMPOST_PERM.p + craft.bonemeal * BONEMEAL_PERM.p,
    k: craft.compost * COMPOST_PERM.k + craft.bonemeal * BONEMEAL_PERM.k,
  };
  const directPool = {
    n: craft.compost * COMPOST.n + craft.bonemeal * BONEMEAL.n,
    p: craft.compost * COMPOST.p + craft.bonemeal * BONEMEAL.p,
    k: craft.compost * COMPOST.k + craft.bonemeal * BONEMEAL.k,
  };

  // Reverse: how many direct applications to MATCH the tier-up's +tierGain on each axis?
  // Use the integer per-app perm values (game truncates each application).
  const compostsForN  = farmhand && COMPOST_PERM.n > 0  ? Math.ceil(tierGain / COMPOST_PERM.n)  : null;
  const bonemealForP  = farmhand && BONEMEAL_PERM.p > 0 ? Math.ceil(tierGain / BONEMEAL_PERM.p) : null;
  const saltpeterForK = farmhand                         ? Math.ceil(tierGain / 11)               : null;

  return (
    <Card>
      <CardHeader
        eyebrow={<><ModPill /> <span className="ml-2">Boosting plot fertility</span></>}
        title="Crafting a higher-tier soil block vs fertilizing the tile you have"
        subtitle="These aren't two equivalent options. Tier-up recipes (Medium → High → Terra Preta) only exist for the Farmhand class via Specialized Classes; without that class your only option is direct fertilizer. Even with Farmhand the trade-offs are real: tier-up consumes the source block and adds powder-charcoal but raises base fertility on every axis permanently, while fertilizer keeps the tile and adds nutrients without changing its tier name."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <div className="text-xs text-ink-600 mb-1.5 font-medium">From soil tier</div>
            <div className="flex flex-wrap gap-1.5">
              {TIERS.slice(0, 4).map(t => (
                <button
                  key={t.key}
                  onClick={() => {
                    setFrom(t.key);
                    if (TIERS.findIndex(x => x.key === to) <= TIERS.findIndex(x => x.key === t.key)) {
                      setTo(TIERS[TIERS.findIndex(x => x.key === t.key) + 1].key);
                    }
                  }}
                  className={`px-3 py-1.5 rounded border text-xs ${from === t.key ? 'border-forest-700 satiety-card-selected text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40'}`}
                >
                  {t.name} <span className="tabular text-ink-500">({t.val})</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-600 mb-1.5 font-medium">To soil tier</div>
            <div className="flex flex-wrap gap-1.5">
              {TIERS.slice(1).filter(t => TIERS.findIndex(x => x.key === t.key) > TIERS.findIndex(x => x.key === from)).map(t => (
                <button
                  key={t.key}
                  onClick={() => setTo(t.key)}
                  className={`px-3 py-1.5 rounded border text-xs ${to === t.key ? 'border-forest-700 satiety-card-selected text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40'}`}
                >
                  {t.name} <span className="tabular text-ink-500">({t.val})</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-600 mb-1.5 font-medium">Your class</div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setFarmhandOverride('on')}
                className={`px-3 py-1.5 rounded border text-xs ${farmhand ? 'border-forest-700 satiety-card-selected text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40'}`}
              >
                Farmhand
              </button>
              <button
                onClick={() => setFarmhandOverride('off')}
                className={`px-3 py-1.5 rounded border text-xs ${!farmhand ? 'border-forest-700 satiety-card-selected text-forest-900' : 'border-parchment-300/60 hover:bg-parchment-200/40'}`}
              >
                Other class
              </button>
            </div>
            <div className="text-[10px] text-ink-500 italic mt-1.5">
              {farmhand
                ? 'Can craft soil tier-ups. Each fertilizer application also leaves +25% of its NPK as permanent base.'
                : 'Cannot craft soil tier-ups (Farmhand-only recipe). Direct fertilizer leaves no permanent base, only a one-time pool boost.'}
            </div>
          </div>
        </div>

        {!farmhand ? (
          <div className="border border-amber-300/60 bg-amber-50/40 rounded p-4 mb-4">
            <div className="font-medium text-terra-800 mb-1">Tier-up isn't available to your class</div>
            <div className="text-sm text-ink-700">
              The soil tier-up recipes (Medium → High → Terra Preta) live behind the Farmhand class trait in Specialized Classes. Without that class you can only acquire higher tiers by finding them in the world (Terra Preta is rare).
              You can still spread Compost and Bonemeal on your existing tile for a one-time pool boost, but base fertility doesn't change.
              See the direct-application card below.
            </div>
          </div>
        ) : (
          <div className="border border-parchment-300/60 rounded p-3 bg-parchment-100/40 mb-4">
            <div className="section-eyebrow text-forest-700 mb-2">Material cost per craft (compost and bonemeal apply to both options; powder-charcoal is tier-up only)</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm tabular">
              <SmallStat label="Compost" value={craft.compost.toFixed(2)} sub="40N / 8P / 8K each" />
              <SmallStat label="Bonemeal" value={craft.bonemeal.toFixed(2)} sub="3N / 30P / 0K each" />
              <SmallStat label="Powder-charcoal" value={craft.powder.toFixed(2)} sub="tier-up only" />
              <SmallStat label="Source tile" value={craft.soilUsed.toFixed(0)} sub={`${NAME[from]} block (tier-up only)`} />
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${farmhand ? 'lg:grid-cols-2' : ''} gap-3 mb-4`}>
          {farmhand && (
            <div className="border-2 border-forest-300/60 rounded p-3 bg-forest-50/40">
              <div className="font-medium text-forest-900 mb-1">Craft a {NAME[to]} block <span className="text-[10px] text-ink-500 ml-1">(Farmhand recipe)</span></div>
              <div className="text-xs text-ink-600 mb-3">The source {NAME[from]} block is consumed. The new {NAME[to]} block starts at base fertility {toVal}/{toVal}/{toVal} on every axis.</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <NPKStat axis="N" gain={tierGain} hot />
                <NPKStat axis="P" gain={tierGain} hot />
                <NPKStat axis="K" gain={tierGain} hot />
              </div>
              <div className="text-xs text-forest-800">
                <strong>+{tierGain} permanent</strong> on every axis. Powder-charcoal is the cost of the tier promotion.
              </div>
              <div className="text-xs text-terra-700 mt-1">
                Loses: {craft.soilUsed.toFixed(0)} {NAME[from]} block consumed per craft output.
              </div>
            </div>
          )}
          <div className="border-2 border-amber-300/60 rounded p-3 bg-amber-50/40">
            <div className="font-medium text-terra-800 mb-1">Spread compost + bonemeal on the tile</div>
            <div className="text-xs text-ink-600 mb-3">
              {farmhand
                ? 'Tile keeps its tier name. With Farmhand, 25% of each application becomes permanent base fertility.'
                : 'Tile keeps its tier name. Without Farmhand, no permanent base change at all; only a one-time pool boost that decays as crops drain it.'}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <NPKStat axis="N" gain={directBase.n} />
              <NPKStat axis="P" gain={directBase.p} />
              <NPKStat axis="K" gain={directBase.k} />
            </div>
            <div className="text-xs text-ink-700">
              <strong>Permanent base gain:</strong> +{directBase.n.toFixed(1)} N, +{directBase.p.toFixed(1)} P, +{directBase.k.toFixed(1)} K.
              {!farmhand && <span className="text-terra-700"> Without Farmhand this is 0/0/0.</span>}
            </div>
            <div className="text-xs text-ink-600 mt-1.5">
              <strong>One-time pool gain</strong> (decays per harvest): +{directPool.n.toFixed(0)} N, +{directPool.p.toFixed(0)} P, +{directPool.k.toFixed(0)} K.
              {farmhand && " A tile crafted up to higher tier still benefits from this when you later fertilize it."}
            </div>
            <div className="text-xs text-forest-700 mt-1">
              Keeps: original tile stays plantable.
            </div>
          </div>
        </div>

        {farmhand && (
          <div className="px-3 py-3 rounded border-l-4 border-l-forest-500 bg-forest-50/40 text-sm text-ink-700 leading-relaxed mb-3">
            <div className="font-medium text-forest-900 mb-1">Bottom line: {NAME[from]} → {NAME[to]}</div>
            <SoilUpgradeBottomLine from={from} to={to} tierGain={tierGain} directBase={directBase} farmhand={farmhand} craft={craft} />
          </div>
        )}

        {farmhand && tierGain > 0 && (
          <div className="border border-parchment-300/60 rounded p-3 bg-parchment-100/40">
            <div className="section-eyebrow text-forest-700 mb-2">Reverse view: matching the tier-up's +{tierGain} permanent on each axis with direct fertilizing</div>
            <div className="text-xs text-ink-600 mb-3">
              Cheapest single-fertilizer applications that close each axis. Powder-charcoal is irrelevant here (no NPK).
            </div>
            <table className="w-full text-sm tabular">
              <thead className="text-xs text-ink-500 text-left">
                <tr><th className="font-normal pb-1">Axis</th><th className="font-normal pb-1">Best fertilizer</th><th className="font-normal pb-1">Apps needed</th><th className="font-normal pb-1">Side effect</th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-parchment-300/30">
                  <td className="py-1 font-medium text-forest-800">N</td>
                  <td className="py-1">Compost (+10/app perm)</td>
                  <td className="py-1">{compostsForN} compost</td>
                  <td className="py-1 text-ink-500">also adds +{compostsForN * COMPOST_PERM.p} P, +{compostsForN * COMPOST_PERM.k} K perm bonus</td>
                </tr>
                <tr className="border-t border-parchment-300/30">
                  <td className="py-1 font-medium text-forest-800">P</td>
                  <td className="py-1">Bonemeal (+7/app perm)</td>
                  <td className="py-1">{bonemealForP} bonemeal</td>
                  <td className="py-1 text-ink-500">also +{bonemealForP * BONEMEAL_PERM.n} N perm</td>
                </tr>
                <tr className="border-t border-parchment-300/30">
                  <td className="py-1 font-medium text-forest-800">K</td>
                  <td className="py-1">Saltpeter (+11/app perm)</td>
                  <td className="py-1">{saltpeterForK} saltpeter</td>
                  <td className="py-1 text-ink-500">also +{saltpeterForK * 3} N perm</td>
                </tr>
              </tbody>
            </table>
            <div className="text-xs text-ink-600 italic mt-2">
              Total to match tier-up via direct: <strong>{compostsForN} compost + {bonemealForP} bonemeal + {saltpeterForK} saltpeter</strong>. Crafting cost: <strong>{craft.compost.toFixed(2)} compost + {craft.bonemeal.toFixed(2)} bonemeal + {craft.powder.toFixed(2)} powder-charcoal + {craft.soilUsed.toFixed(0)} source tile</strong>. Pick whichever you have more of.
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function NPKStat({ axis, gain, hot = false }) {
  const colors = {
    N: 'text-forest-800 bg-forest-100/50',
    P: 'text-purple-700 bg-purple-50/40',
    K: 'text-amber-700 bg-amber-100/40',
  };
  return (
    <div className={`rounded p-2 text-center ${colors[axis] || ''}`}>
      <div className="text-xs font-medium">{axis}</div>
      <div className={`text-xl font-bold tabular ${hot ? '' : 'opacity-90'}`}>+{gain.toFixed(gain === Math.round(gain) ? 0 : 1)}</div>
      <div className="text-[10px] opacity-70">permanent</div>
    </div>
  );
}

function SmallStat({ label, value, sub }) {
  return (
    <div>
      <div className="text-xs text-ink-600 uppercase tracking-wider">{label}</div>
      <div className="text-base text-forest-900 font-medium">{value}</div>
      {sub && <div className="text-[10px] text-ink-500 italic">{sub}</div>}
    </div>
  );
}

function SoilUpgradeBottomLine({ from, to, tierGain, directBase, farmhand, craft }) {
  const NAME = { verylow: 'Very Low', low: 'Low', medium: 'Medium', compost: 'High', high: 'Terra Preta' };
  const allCraftWins = tierGain >= directBase.n && tierGain >= directBase.p && tierGain >= directBase.k;

  if (!farmhand) {
    return (
      <>
        <strong>Crafting wins by default</strong> when Farmhand is off. Without the perk, direct fertilizing gives ZERO permanent base boost (only a temporary NPK pool that decays each harvest). Crafting gives +{tierGain} permanent on all three axes for the same input cost. The tradeoff: you lose {craft.soilUsed.toFixed(0)} source tile per crafted output, and you spend powder-charcoal that has no other fertilizing use.
      </>
    );
  }
  if (allCraftWins) {
    return (
      <>
        <strong>Crafting wins on every axis.</strong> The same compost + bonemeal applied directly only manages +{directBase.n.toFixed(1)} N / +{directBase.p.toFixed(1)} P / +{directBase.k.toFixed(1)} K permanent (compost is N-heavy so P and K barely move). Crafting hits +{tierGain} on all three. The catch: you destroy {craft.soilUsed.toFixed(0)} source tile, and the powder-charcoal goes into the soil instead of into something else. If your crops only ever use ONE axis (most rotations), direct could still be cheaper if you swap the bonemeal for saltpeter or use straight compost.
      </>
    );
  }
  if (directBase.n >= tierGain) {
    return (
      <>
        <strong>For N-only crops, direct fertilizing matches or beats crafting.</strong> The compost in this craft would give +{directBase.n.toFixed(1)} N permanent direct vs crafting's +{tierGain} N. P and K still benefit from crafting (+{tierGain} vs direct +{directBase.p.toFixed(1)}/+{directBase.k.toFixed(1)}), so crafting is the right call if you're rotating across all three axes. For pure N-grain rotations (rye, spelt, flax, amaranth, sunflower), fertilize direct and save the powder-charcoal.
      </>
    );
  }
  const winners = [
    tierGain >= directBase.n ? 'N' : null,
    tierGain >= directBase.p ? 'P' : null,
    tierGain >= directBase.k ? 'K' : null,
  ].filter(Boolean).join('/');
  return (
    <>
      <strong>Mixed:</strong> direct gives +{directBase.n.toFixed(1)} N / +{directBase.p.toFixed(1)} P / +{directBase.k.toFixed(1)} K permanent; crafting gives +{tierGain} on all three. Crafting is better on the {winners} axes; direct beats crafting on the others. Pick based on your rotation: if your next-up crop needs an axis where craft wins, craft. If you only care about an axis where direct wins, fertilize direct and reroute the powder-charcoal.
    </>
  );
}

// Per-application perk boost for each fertilizer, with current perk percentage.
// Returns { compost: {n,p,k}, saltpeter: {n,p,k}, ... }.
function buildPerkTable(perkPct) {
  const out = {};
  for (const f of FERTILIZERS_LIST) {
    if (f.key === 'none') continue;
    out[f.key] = perkBoost(f, perkPct);
  }
  return out;
}

// Brute force minimum-applications search over all combinations of
// (compost, saltpeter, bonemeal, potash) with each up to 12. Picks the combo
// with fewest total applications that meets the +N, +P, +K targets. Ties
// broken by least total perk waste.
function findOptimalPermaBoost({ targetN, targetP, targetK, perkPct, maxPerType = 12 }) {
  if (targetN <= 0 && targetP <= 0 && targetK <= 0) return { combo: { compost: 0, saltpeter: 0, bonemeal: 0, potash: 0 }, total: 0, gains: { n: 0, p: 0, k: 0 }, waste: 0 };
  const t = buildPerkTable(perkPct);
  let best = null;
  for (let c = 0; c <= maxPerType; c++) {
    for (let s = 0; s <= maxPerType; s++) {
      for (let b = 0; b <= maxPerType; b++) {
        for (let p = 0; p <= maxPerType; p++) {
          const total = c + s + b + p;
          if (best && total > best.total) continue;
          const gN = c * t.compost.n + s * t.saltpeter.n + b * t.bonemeal.n + p * t.potash.n;
          const gP = c * t.compost.p + s * t.saltpeter.p + b * t.bonemeal.p + p * t.potash.p;
          const gK = c * t.compost.k + s * t.saltpeter.k + b * t.bonemeal.k + p * t.potash.k;
          if (gN < targetN || gP < targetP || gK < targetK) continue;
          const waste = (gN - targetN) + (gP - targetP) + (gK - targetK);
          if (!best || total < best.total || (total === best.total && waste < best.waste)) {
            best = {
              combo: { compost: c, saltpeter: s, bonemeal: b, potash: p },
              total,
              gains: { n: gN, p: gP, k: gK },
              waste,
            };
          }
        }
      }
    }
  }
  return best;
}

const SOIL_TIER_OPTIONS = [
  { tier: 5,  name: 'Barren' },
  { tier: 25, name: 'Low' },
  { tier: 50, name: 'Medium' },
  { tier: 65, name: 'High Fertility' },
  { tier: 80, name: 'Terra Preta' },
];

function PermaBoostOptimizerCard({ permBonus }) {
  const [soilTier, setSoilTier] = useState(80);
  const [targetCap, setTargetCap] = useState(100);
  const [startN, setStartN] = useState(80);
  const [startP, setStartP] = useState(80);
  const [startK, setStartK] = useState(80);

  function pickTier(t) {
    setSoilTier(t);
    setStartN(t); setStartP(t); setStartK(t);
  }

  const targetN = Math.max(0, targetCap - startN);
  const targetP = Math.max(0, targetCap - startP);
  const targetK = Math.max(0, targetCap - startK);
  const result = findOptimalPermaBoost({ targetN, targetP, targetK, perkPct: permBonus });
  const t = buildPerkTable(permBonus);

  const finalN = Math.min(targetCap, startN + (result?.gains.n ?? 0));
  const finalP = Math.min(targetCap, startP + (result?.gains.p ?? 0));
  const finalK = Math.min(targetCap, startK + (result?.gains.k ?? 0));

  return (
    <Card>
      <CardHeader
        eyebrow={<><ModPill /> <span className="ml-2">Perma-boost optimizer</span></>}
        title="Fewest fertilizer applications to max out a tile"
        subtitle="Brute-force search across all 4-fertilizer combos. Each application adds INT(NPK × 0.25) to the soil's permanent cap (Farmhand perk), clamped at 100 per axis. The optimizer picks the smallest total apps that hits the target on every axis."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5 pb-4 border-b border-parchment-300/40">
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Starting soil tier</label>
            <div className="flex flex-wrap gap-1">
              {SOIL_TIER_OPTIONS.map(s => (
                <button key={s.tier} onClick={() => pickTier(s.tier)}
                  className={`px-2 py-1 rounded text-xs ${soilTier === s.tier ? 'bg-forest-600 text-parchment-50' : 'bg-parchment-200/40 text-ink-700 border border-parchment-300/60'}`}>
                  {s.name} ({s.tier})
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Target cap (each axis)</label>
            <input type="number" min="1" max="100" step="1" value={targetCap}
              onChange={e => setTargetCap(Math.min(100, Math.max(1, parseInt(e.target.value) || 0)))}
              className="input-field tabular w-24" />
            <p className="text-[11px] text-ink-500 italic mt-1">Hard ceiling is 100 (Farmhand cap clamp).</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-700 mb-1">Override starting N / P / K</label>
            <div className="flex gap-1">
              <input type="number" min="0" max="100" value={startN} onChange={e => setStartN(parseInt(e.target.value) || 0)} className="input-field tabular w-16" />
              <input type="number" min="0" max="100" value={startP} onChange={e => setStartP(parseInt(e.target.value) || 0)} className="input-field tabular w-16" />
              <input type="number" min="0" max="100" value={startK} onChange={e => setStartK(parseInt(e.target.value) || 0)} className="input-field tabular w-16" />
            </div>
            <p className="text-[11px] text-ink-500 italic mt-1">Defaults to soil tier (fresh-tilled).</p>
          </div>
        </div>

        {result && result.total > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="px-4 py-3 rounded border-l-4 border-l-forest-500 bg-forest-50/40">
                <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">Total applications</div>
                <div className="font-display text-3xl text-forest-900 tabular">{result.total}</div>
              </div>
              {['compost', 'saltpeter', 'bonemeal', 'potash'].filter(k => result.combo[k] > 0).map(k => (
                <div key={k} className="px-4 py-3 rounded border border-parchment-300/40 bg-parchment-100/40">
                  <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">{FERTILIZERS[k].name}</div>
                  <div className="font-display text-2xl text-forest-900 tabular">{result.combo[k]}×</div>
                  <div className="text-[10px] text-ink-500">+{result.combo[k] * t[k].n}/{result.combo[k] * t[k].p}/{result.combo[k] * t[k].k} NPK</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[['N', startN, result.gains.n, finalN, targetN], ['P', startP, result.gains.p, finalP, targetP], ['K', startK, result.gains.k, finalK, targetK]].map(([axis, start, gain, final, target]) => {
                const overshoot = gain - target;
                return (
                  <div key={axis} className="px-3 py-2 rounded bg-parchment-100/40 border border-parchment-300/40 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <NutrientChip axis={axis} />
                      <span className="font-medium text-ink-700">{axis} axis</span>
                    </div>
                    <div className="tabular text-ink-600 text-xs">
                      {start} <span className="text-forest-700">+{gain}</span> = <strong className="text-forest-900">{final}</strong>
                      {overshoot > 0 && <span className="text-amber-700 ml-1">(+{overshoot} wasted)</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 rounded border-l-4 border-l-forest-500 bg-forest-50/40 text-sm leading-relaxed">
              <div className="font-medium text-forest-900 mb-1">Verdict</div>
              <p className="text-ink-700">
                On <strong>{SOIL_TIER_OPTIONS.find(s => s.tier === soilTier)?.name || `tier ${soilTier}`}</strong> starting from {startN}/{startP}/{startK}, the smallest combo to reach {targetCap}/{targetCap}/{targetCap} is{' '}
                {Object.entries(result.combo).filter(([k, v]) => v > 0).map(([k, v], i, arr) => (
                  <span key={k}>
                    {i > 0 && (i === arr.length - 1 ? ', and ' : ', ')}
                    <strong className="tabular">{v}× {FERTILIZERS[k].name}</strong>
                  </span>
                ))}
                . Final result: <strong>{finalN}/{finalP}/{finalK}</strong> after {result.total} applications.
                {result.waste > 0 && <> {result.waste} points overshoot the cap (clamped).</>}
              </p>
              {targetCap === 100 && soilTier === 80 && result.total === 6 && (
                <p className="text-[12px] text-ink-600 italic mt-2">
                  P is the bottleneck axis: only Compost (2/app) and Bonemeal (7/app) give P. Three Bonemeal alone get you to +21 P, but they don't help N or K. The optimal blend uses Compost for the N axis (carries P along), Bonemeal to finish P, and one Potash to top off K.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="text-sm text-ink-500 italic">All axes already at or above target. No fertilizer needed.</div>
        )}
      </CardBody>
    </Card>
  );
}

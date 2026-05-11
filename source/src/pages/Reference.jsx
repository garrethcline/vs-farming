// Reference. Glossary, formula reference, [MOD] perk math worked example.
import {
  Card, CardHeader, CardBody, Reveal, ModPill, NutrientChip, Flourish,
} from '../components/ui/Primitives.jsx';
import { useSettings } from '../lib/storage.js';

export default function ReferencePage() {
  const [settings] = useSettings();

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§10 · Reference</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Glossary &amp; <span className="heading-italic">formulas</span>
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl">
            Definitions, formulas, and where each comes from in the game source.
            For the deep dive, see SPEC.md in the repo.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader title="Glossary" subtitle="Terms used throughout this dashboard, in plain language." />
          <CardBody>
            <dl className="space-y-4 text-sm">
              <Term term="Original fertility" def="Per-axis nutrient ceiling for each plot. N, P, K stored independently. Hard-clamped to [0, 100] by the SC perk; otherwise can go higher temporarily through fertilizer." />
              <Term term="Nutrients[]" def="The current N/P/K levels visible in F3/blockinfo. Crops drain this; soil regen and slow-release pool fill it. Capped at 100." />
              <Term term="Slow-release pool" def="Per-axis 0-150 reservoir of fertilizer that drips at 0.25/tick (~1.71/day) into nutrients[]. Visible in F3 as 'Active fertilizer +X%'." />
              <Term term="Tick" def="A game tick is roughly 3.5 hours of game time, so ~6.857 ticks per game day. Every tick: growth check + slow-release drip + nutrient regen check." />
              <Term term="Stage" def="Each crop has 4-16 growth stages. Drain happens at stage transitions (consumption / (stages-1) per transition). Higher-stage crops drain more often but in smaller chunks." />
              <Term term="Hardy" def="Carrot, Parsnip, Rye, Fennel, Licorice. They tolerate low cold (-8 to -12°C) AND keep 75% of yield when damaged unripe (default is 50%)." />
              <Term term="Default cold/heat" def="Some crop JSONs (Flax, Spelt, Sunflower, Soybean, Pumpkin) don't set damage thresholds. They use C# class defaults: 0°C cold, no heat limit." />
              <Term term="Greenhouse" def="Adds +5°C to all temperature checks (cold damage, heat damage, growth chance). Effectively extends the season by ~10 days on each end." />
              <Term term="Frost safety" def="In the Decision Helper score: 1.0 if harvest finishes 5+ days before season end, 0.6 if barely, 0 if won't finish at all." />
              <Term term="Rotation factor" def="In the Decision Helper score: 1.2 if next crop's required axis differs from previous, 1.0 if no previous, 0.7 if same axis (bad)." />
              <Term term="Damage stunt" def="When a crop takes cold/heat damage during growth, its yield is multiplied by stuntMul (default 0.5; hardy crops have 0.75)." />
            </dl>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader title="Decision Helper score formula" subtitle="The scoring math used to rank crops on the Decision tab." />
          <CardBody>
            <pre className="bg-parchment-200/40 border border-parchment-300/60 p-4 rounded text-xs font-mono overflow-x-auto leading-relaxed">
{`score = (yield ÷ effective_grow_days × 100)   ← productivity (accounts for nutrient slowdown)
        × frost_safety                          ← 1.0 / 0.6 / 0 by effective harvest day
        × damage_multiplier                     ← stuntMul if any cold/heat risk
        × rotation_factor                       ← 0.7 / 1.0 / 1.2 by axis fit
        × follow_up_factor                      ← 1.3 / 1.1 / 1.0 by chain potential

Stalled crops (effective_grow_days too long because nutrients run out)
score 0 and verdict "stalls (nutrients)".

effective_grow_days = stage-by-stage simulation walking day by day:
  pool drips into nutrient daily (capped at 100 with active pool):
    daily_drip = MIN(pool, 0.25 × ticks_per_day)
    pool     -= daily_drip
    nutrient  = MIN(100, nutrient + daily_drip)
  for each of (stages - 1) transitions:
    nf = nutrient_factor(current_nutrient)
    if nf < 0.05 → stalled
    stage_days = (base_grow_days ÷ (stages - 1)) ÷ nf
    advance day, accumulate stage progress at growthChance × nf × moistF
    on transition: nutrient = MAX(0, nutrient - drain_per_stage)
  return sum of real days spent

The drip-then-drain order matters: pool drip gives the next stage a higher
nutrient level, so it grows faster. The previous order (drain then drip
only at transitions) understated fertilizer benefit by ~5x.

nutrient_factor (BESoilNutrition step function):
        n > 75 → 1.10×
        n > 50 → 1.00×
        n > 35 → 0.90×
        n > 20 → 0.60×
        n > 5  → 0.30×
        else   → 0.10×  (effectively stalls)

The slowdown compounds: as nutrient drops below thresholds across
stages, later stages take exponentially longer.`}
            </pre>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card className="border-l-4 border-l-amber-500 bg-amber-100/30">
          <CardHeader
            eyebrow={<><ModPill /> <span className="ml-2">Specialized Classes</span></>}
            title="Farmhand fertilizer perk math (worked example)"
            subtitle="Decompiled from SpecializedClasses.dll v2.2.2 IL. Only applies if the mod is installed."
          />
          <CardBody>
            <div className="text-sm text-ink-700 space-y-3">
              <p>
                When a Farmhand applies fertilizer, the plot's <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">originalFertility</code> increases per axis:
              </p>
              <pre className="bg-parchment-200/40 border border-parchment-300/60 p-3 rounded text-xs font-mono">
{`originalFertility[axis] += INT(ROUND(props.NPK * delta, 1))
where delta = 0.25 (Farmhand stat: fertilizerPermanencePercentage)
hard-clamped to [0, 100] per axis
DUPLICATE_GUARD_MS = 50 (rapid double-clicks ignored)`}
              </pre>
              <p>Worked: <strong>Compost on Medium plot</strong> (starting 50/50/50)</p>
              <ul className="space-y-1 list-disc list-inside text-xs">
                <li>Compost NPK = (40, 8, 8). Per app: ROUND(40×0.25,1) = 10, ROUND(8×0.25,1) = 2, ROUND(8×0.25,1) = 2</li>
                <li>App 1: 50+10 / 50+2 / 50+2 = 60 / 52 / 52</li>
                <li>App 2: 70 / 54 / 54</li>
                <li>App 3: 80 / 56 / 56</li>
                <li>App 4: 90 / 58 / 58</li>
                <li>App 5: 100 (capped) / 60 / 60</li>
                <li>App 6+: stays 100 (cap), 62/62, etc.</li>
              </ul>
              <p className="italic text-ink-500 text-xs">
                Bottom line: the Farmhand perk is the only farming bonus from the Specialized Classes mod that affects yields. The other 6 traits in the Farmhand class are dead code for farming purposes.
              </p>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="Plot spacing"
            title="Fire safety"
            subtitle="Farmland doesn't burn. The risk is what's around it."
          />
          <CardBody>
            <div className="text-sm text-ink-700 space-y-4">
              <p>
                Fire in Vintage Story propagates block-to-block through flammable neighbors. There's no fixed "5-block radius". A single block of any non-flammable material breaks the chain.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
                  <div className="section-eyebrow mb-2 text-forest-800">Won't burn</div>
                  <p className="text-xs">
                    Tilled farmland (regardless of crop), all soil and dirt variants, packed dirt, dirt paths, stone, gravel, sand, brick, ingot piles, water (any kind), snow, ice.
                  </p>
                </div>
                <div className="bg-amber-100/30 border border-amber-300/40 rounded p-3">
                  <div className="section-eyebrow mb-2 text-terra-700">Will burn</div>
                  <p className="text-xs">
                    Trees, leaves, dry grass, thatch, logs, firewood, planks, boards, bookshelves, wooden cabinets, ladders, doors, reed mats. Crops are flammable too (burnTemperature 600, burnDuration 10s) but only mature stages are at risk worth caring about.
                  </p>
                </div>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-ink-700">Recommended gaps</div>
                <ul className="space-y-1 list-disc list-inside text-xs">
                  <li><strong>Adjacent crop plots</strong>: 0 blocks. Farmland doesn't transmit fire.</li>
                  <li><strong>Farm to nearby trees or grass</strong>: 2 to 3 blocks of dirt path or stone.</li>
                  <li><strong>Farm to wooden buildings</strong>: 3 to 5 blocks, plus a non-flammable wall on the building.</li>
                  <li><strong>Pit kiln to anything flammable</strong>: 4 to 5 blocks. Pit kilns spread fire while firing; firepits don't.</li>
                </ul>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-ink-700">Lightning rod, how it actually works</div>
                <p className="text-xs">
                  The rod has the <code className="font-mono text-[11px] bg-parchment-200/50 px-1 rounded">AttractsLightning</code> behavior with <code className="font-mono text-[11px] bg-parchment-200/50 px-1 rounded">artificialElevation: 5</code> and <code className="font-mono text-[11px] bg-parchment-200/50 px-1 rounded">elevationAttractivenessMultiplier: 2</code>. The actual range it covers depends on your local terrain, computed per strike like this:
                </p>
                <p className="text-xs mt-2 font-mono bg-parchment-200/30 border border-parchment-300/40 rounded p-2 leading-snug">
                  range = (5 + rod_height - strike_height) × 2, capped at 40 blocks
                </p>
                <p className="text-xs mt-2">
                  So a rod sitting at y=80 in a flat valley where everything else is y=70 covers (5 + 80 − 70) × 2 = <strong>30 blocks</strong>. The same rod at y=80 with mountains around it at y=85 covers (5 + 80 − 85) × 2 = 0; it can't pull strikes that would land on higher ground. The 40-block cap applies regardless of how high you raise it.
                </p>
                <ul className="space-y-1 list-disc list-inside text-xs mt-2">
                  <li>The rod must have <strong>direct sky exposure</strong>. Anything above it (eaves, leaves, lanterns) disables it for that tick.</li>
                  <li>Place it on a <strong>stone or brick pillar</strong>, never on a wooden building. The rod redirects strikes to itself; if it sits on wood, you've just relocated the fire onto your house.</li>
                  <li>Keep flammable blocks at least <strong>1 block away</strong> from the rod itself, since a strike still creates the impact effect at the rod's position.</li>
                  <li>One well-placed elevated rod beats two ground-level rods, because the elevation difference is what determines coverage.</li>
                </ul>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-ink-700">Lightning fires require opt-in</div>
                <p className="text-xs">
                  Lightning only starts fires if the worldconfig setting <code className="font-mono text-[11px] bg-parchment-200/50 px-1 rounded">lightningFires</code> is true. Default is <strong>false</strong>. Even when enabled, a strike only ignites if (a) it lands on a combustible block, and (b) the block's environment wetness is below 0.01, which roughly means "less than half a day of medium rain over the past 10 days." Wet biomes basically never see lightning fires; arid biomes see them often.
                </p>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-ink-700">Rain extinguishes fire</div>
                <p className="text-xs">
                  Per fire-tick, if local precipitation is over 0.05 (5%), there's a <code className="font-mono text-[11px]">precipitation / 2</code> chance to extinguish. Heavy rain (50% precip) douses fires in 2-3 ticks on average. This means lightning fires that do start during a storm tend to be self-limiting unless they reach a sheltered spot under leaves before the rain catches up.
                </p>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-ink-700">Practical farm layout</div>
                <ul className="space-y-1 list-disc list-inside text-xs">
                  <li><strong>Moat or dirt path</strong> 1-block wide around the whole field stops every ground-level fire. Stone bricks work too and look nicer.</li>
                  <li><strong>Don't store hay or thatch piles</strong> next to crops. They burn at 600°C and go up fast in dry climates.</li>
                  <li><strong>If lightningFires is on</strong>, place a stone-pillar lightning rod every 25-30 blocks across open fields. The rod must be the highest thing within its calculated range or it won't redirect.</li>
                  <li><strong>Greenhouses</strong>: glass and stone components don't burn, but the wooden door frames do. Use stone-brick framing or keep a moat around the greenhouse.</li>
                </ul>
              </div>

              <p className="italic text-ink-500 text-xs">
                Server admins can disable fire spread entirely with{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">/serverconfig allowfirespread false</code>{' '}
                and lightning fires with{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">/worldconfig lightningFires false</code>.
              </p>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.27}>
        <Card>
          <CardHeader
            eyebrow="Soil mechanics"
            title="How nutrient drain works"
            subtitle="What happens to N, P, and K under your farmland between planting and harvest. Mechanics traced from BEFarmland.cs and BESoilNutrition.cs."
          />
          <CardBody>
            <div className="text-sm text-ink-700 space-y-4">
              <div>
                <div className="section-eyebrow mb-2 text-forest-800">Per-stage drain</div>
                <p>
                  Each crop has a <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">NutrientConsumption</code> total
                  and a <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">GrowthStages</code> count from its JSON.
                  When the crop advances a stage, the soil loses:
                </p>
                <p className="font-mono text-xs bg-parchment-200/50 rounded p-2 mt-2">
                  loss per stage = NutrientConsumption / max(1, GrowthStages - 1)
                </p>
                <p className="text-xs text-ink-500 italic mt-1">
                  From BEFarmland.cs::ConsumeNutrients line 270. The "minus 1" is because the first stage is the planting itself, which is free.
                </p>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-forest-800">Which axis</div>
                <p>
                  Each crop drains from one of N, P, or K. That axis comes from{' '}
                  <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">CropProps.RequiredNutrient</code> in the crop's JSON. The other two axes are not touched.
                </p>
                <p className="text-xs text-ink-500 italic mt-1">
                  Sample math: carrot has cons=34.3, stages=7, axis=K. Per-stage drain = 34.3 / 6 = 5.72 K per growth tick. From 65 K starting on High soil, 7 ticks = 65 - 6×5.72 = 30.7 K remaining at harvest. Carrot ends in the "struggling" range (under 35 K = 0.9× growth speed).
                </p>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-forest-800">Recovery between crops</div>
                <p>
                  Empty farmland (no crop, or crop not yet ripe) recovers all three N/P/K axes at{' '}
                  <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">fertilityRecoverySpeed</code> per recovery tick (default <strong>0.25</strong>, configurable). Recovery ticks every 3 to 4 in-game hours. Recovery caps at the soil's original fertility (Low=25, Medium=50, High=65, Terra Preta=80).
                </p>
                <p className="mt-2">
                  While a crop is mid-growth, the axis it consumes recovers <strong>3× slower</strong> than the others (line 362). So if you plant a K-axis crop, K recovers at 0.083/tick while N and P recover at 0.25/tick.
                </p>
                <p className="mt-2">
                  Once a crop is ripe and waiting to be harvested, recovery on all three axes pauses entirely.
                </p>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-forest-800">Slow-release pool</div>
                <p>
                  Fertilizer applied at planting goes into a per-axis "slow release" pool, separate from the visible fertility number. Each recovery tick, up to 0.25 transfers from the pool to the visible level (capped at 100), depleting the pool. This is on top of the natural recovery and lets fertility climb above the soil's original cap, briefly.
                </p>
                <p className="mt-2">
                  Once the slow-release pool is empty, any over-cap fertility decays back at <strong>0.05/tick</strong> (line 382), so the boost wears off slowly.
                </p>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-forest-800">Growth speed by current fertility</div>
                <p>From BESoilNutrition.cs lines 406-414:</p>
                <table className="text-xs mt-2 tabular">
                  <thead className="text-left text-ink-500">
                    <tr><th className="pr-4 font-normal">Current N/P/K (axis being consumed)</th><th className="font-normal">Growth speed</th></tr>
                  </thead>
                  <tbody>
                    <tr><td className="pr-4">above 75</td><td className="text-forest-700 font-medium">1.10× (sweet spot)</td></tr>
                    <tr><td className="pr-4">51 to 75</td><td>1.00×</td></tr>
                    <tr><td className="pr-4">36 to 50</td><td>0.90×</td></tr>
                    <tr><td className="pr-4">21 to 35</td><td className="text-amber-700">0.60× (struggling)</td></tr>
                    <tr><td className="pr-4">6 to 20</td><td className="text-amber-800">0.30×</td></tr>
                    <tr><td className="pr-4">5 or less</td><td className="text-red-700 font-medium">0.10× (basically stalled)</td></tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-500 italic">
                  These multiply with a moisture factor of (moisture × 100 / 70 - 0.143)^0.35, which itself ranges from about 0.21 (dry) to 1.09 (saturated).
                </p>
              </div>

              <div>
                <div className="section-eyebrow mb-2 text-forest-800">What this means for planning</div>
                <p>
                  The Decision tab's score already reflects per-stage drain and the speed-vs-fertility curve. The takeaway: <strong>plan rotations so the same axis doesn't get hammered twice in a row</strong>. Plant a K crop, then a P or N crop, then back to K. Otherwise the soil enters the 0.6× or 0.3× zone and your second crop's grow-days inflate.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.25}>
        <Card>
          <CardHeader
            eyebrow="World config"
            title="Underground farming"
            subtitle="A flag in serverconfig.json. Default off. Crops below sea level need this flag plus enough light."
          />
          <CardBody>
            <div className="text-sm text-ink-700 space-y-3">
              <p>
                The <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">allowUndergroundFarming</code>{' '}
                world config setting gates two things at once. When false (the default), every block of farmland below sea level adds a +1 light penalty to the threshold needed for growth, and only natural sunlight counts toward that threshold. When true, torches and lanterns count, and there is no depth penalty.
              </p>

              <p>
                Read in <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">vssurvivalmod</code> source: the flag is checked in{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">BlockEntityFastForwardGrowth.Initialize</code> (line 30) and used in two places, lines 84 (depth penalty) and 88 (light source type). Reading the code top-to-bottom, the flag does what the docs say it does. Older patches reportedly had bypass bugs; current 1.22.x source doesn't show one.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-3">
                  <div className="section-eyebrow mb-2 text-forest-800">Flag off (default)</div>
                  <p className="text-xs">
                    Underground crops at Y=60 (50 below sea level): light penalty 50, sunlight 0. Growth factor clamps to 0. Crops never advance past stage 1, regardless of how many torches you place. This is the configured behavior, not a bug.
                  </p>
                </div>
                <div className="bg-amber-100/30 border border-amber-300/40 rounded p-3">
                  <div className="section-eyebrow mb-2 text-terra-700">Flag on</div>
                  <p className="text-xs">
                    Light from torches counts. Need light ≥19 for full speed. Paper lanterns (V=21) cover a 2-block radius. Large metal lanterns (V=20) cover only the cell directly under them. Crude torches (V=14) cap you at 50% growth speed.
                  </p>
                </div>
              </div>

              <p className="italic text-ink-500 text-xs">
                Moisture also matters underground: rain only adds moisture when sky-exposed. Without water within 4 blocks, growth stops on moisture (under 0.1 = "too dry"). Place water blocks adjacent to or inside the farm.
              </p>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.28}>
        <Card className="border-l-4 border-l-amber-400 bg-amber-100/15">
          <CardHeader
            eyebrow="Honesty notes"
            title="What this app doesn't model"
            subtitle="Stuff that affects your actual game but isn't in any number on these pages."
          />
          <CardBody>
            <ul className="space-y-2 text-sm text-ink-700">
              <li>
                <strong className="text-forest-800">Per-stage growth jitter.</strong>{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">BEFarmland.cs</code> rolls each stage transition against{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">0.9 + 0.2 × rand()</code>, so any one harvest can be ±10% from the expected day. Means are right; specific runs vary.
              </li>
              <li>
                <strong className="text-forest-800">Daily noise on temperature.</strong>{' '}
                <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">Temperature.cs</code> adds yearly noise (±3°C) and daily noise (±1°C) on top of the seasonal curve. The bundled CSV captures one realization; your actual day-to-day will differ.
              </li>
              <li>
                <strong className="text-forest-800">Mod-overridden values.</strong> Anything that loads JSON patches or replaces behaviors will diverge silently. Only Specialized Classes is modeled, and only for the stats listed in <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">specializedClasses.js</code>.
              </li>
              <li>
                <strong className="text-forest-800">Worldgen drift.</strong> The Scouting projection assumes vanilla worldgen. Mods like Wilderness or BetterClimate change the latitude-to-temperature mapping; predictions will be wrong on those servers. World config drift (polarEquatorDistance, globalTemperature) IS now modeled if you fill in Settings.
              </li>
              <li>
                <strong className="text-forest-800">Animal entity-specific yield variance.</strong> Drop quantities have <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">var</code> ranges (e.g. sheep meat avg 13, var 3). The herd calculator uses the avg only.
              </li>
              <li>
                <strong className="text-forest-800">Berry forageStatAffected on cultivated bushes.</strong> Source confirms the flag exists and gates whether class drop-rate buffs apply. Whether each cultivated bush blocktype sets it true wasn't in my decompile; the toggle on the Berries page lets you assume either way.
              </li>
              <li>
                <strong className="text-forest-800">Crop chains beyond two crops.</strong> The Decision page suggests two-crop sequences. Three-crop seasons exist on long calendars but aren't searched.
              </li>
              <li>
                <strong className="text-forest-800">Containers, transients, processed-food chains.</strong> Pickling, fruit pressing, milk to cheese, bread baking, all of which add satiety multipliers we don't trace through. The Decision page's "satiety mode" picks one downstream form per crop; the rest aren't modeled.
              </li>
              <li>
                <strong className="text-forest-800">Bee skeps and honey.</strong> Not modeled at all.
              </li>
              <li>
                <strong className="text-forest-800">Anything renamed or rebalanced after the source decompile.</strong> Source is from 1.22.1; patch notes have been spot-checked through 1.22.2. Silent JSON tweaks in patches can land without notes.
              </li>
            </ul>
            <p className="mt-4 text-xs text-ink-500 italic">
              When in doubt, the in-game handbook (H key) and your own server logs are more authoritative than this app. The point of this app is faster decisions when the answer's clear; for edge cases, verify.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.3}>
        <Card>
          <CardHeader title="Source citations" />
          <CardBody>
            <ul className="space-y-2 text-sm text-ink-700">
              <li><strong>Game version:</strong> <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">Vintage Story 1.22.2 stable</code> (1.22.2 released 03 May 2026)</li>
              <li><strong>Game source:</strong> <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">vssurvivalmod</code> (decompiled from VS 1.22.1; spot-checked against 1.22.2 patch notes)</li>
              <li><strong>Crop JSONs:</strong> <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">survival/blocktypes/plant/crop/*.json</code></li>
              <li><strong>Soil tiers:</strong> <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">BESoilNutrition.Fertilities</code></li>
              <li><strong>Growth/damage:</strong> <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">BlockEntityFastForwardGrowth.cs</code></li>
              <li><strong>Climate:</strong> User's server <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">/debug exptempplot</code> CSV</li>
              <li><strong className="text-amber-800">[MOD] Specialized Classes:</strong> mod identifier <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">specializedclasses</code>, file <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">SpecializedClasses.dll v2.2.2</code> (built for VS 1.22.x, IL decompiled with dnfile)</li>
              <li><strong className="text-amber-800">[MOD] NDL MushroomGrowth:</strong> mod identifier <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">ndlmushroomgrowth</code>, file <code className="font-mono text-xs bg-parchment-200/50 px-1 rounded">ndlmushroomgrowth.dll v2.0.2</code>. Soil tier to grow days dictionary extracted from the static constructor of the growntroughBE class. No temperature, NPK, or class dependency.</li>
            </ul>
            <div className="mt-4 text-xs text-ink-500 italic">
              When wiki and JSON values disagreed during initial extraction, JSONs won. The wiki occasionally lags game patches; cross-check anything that matters.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function Term({ term, def }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pb-3 border-b border-parchment-300/30 last:border-0">
      <dt className="font-display text-base text-forest-900 italic">{term}</dt>
      <dd className="md:col-span-3 text-ink-700 leading-relaxed">{def}</dd>
    </div>
  );
}

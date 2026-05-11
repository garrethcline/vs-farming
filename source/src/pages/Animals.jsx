// Animals (husbandry). Per-species reference + a herd calculator.
// All numbers come straight from the entity JSONs and behavior C# files.
// See data/animals.js for source citations.
import { useMemo, useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Flourish,
} from '../components/ui/Primitives.jsx';
import {
  ANIMALS_LIST, ANIMALS, FOOD_TAGS, TROUGH_FILLS, CROP_HARVEST_YIELDS,
  PORTIONS_PER_DAY, herdSummary, daysPerOffspring, avgLitter,
  portionsToFoodItemsPerWeek, feedPortionsToHarvests,
  WILD_RAIDERS_LIST,
} from '../data/animals.js';
import { useSettings } from '../lib/storage.js';
import { gameDaysToRealString } from '../lib/realTime.js';

export default function AnimalsPage() {
  const [settings] = useSettings();
  const dpm = settings.daysPerMonth || 9;
  const rhpm = settings.realHoursPerMonth || 16;
  const [counts, setCounts] = useState({
    chicken: 4, sheep: 2, goat: 0, pig: 1, elk: 0,
  });
  const [feedCrop, setFeedCrop] = useState('rye');
  const [portionsPerDay, setPortionsPerDay] = useState(PORTIONS_PER_DAY);

  const summary = useMemo(() => herdSummary(counts, portionsPerDay), [counts, portionsPerDay]);

  // Per-species crop-harvest needs at this feed
  const cropPlotsBySpecies = useMemo(() => {
    const out = {};
    for (const [key, portions] of Object.entries(summary.feedPortionsPerDayBySpecies)) {
      const a = ANIMALS[key];
      out[key] = feedPortionsToHarvests(portions, feedCrop, a.troughType);
    }
    return out;
  }, [summary, feedCrop]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§7 · Animals</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Husbandry <span className="heading-italic">guide</span> & calculator
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl">
            Per-species feed economy and yields. Every number comes straight from
            the entity JSONs and behavior C# files. Vanilla VS has only four
            domesticatable animals: chicken, sheep, goat, pig. There is no cow.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader
            eyebrow="Per-species reference"
            title="What they eat, what they give back"
            subtitle="Portions to multiply: how many feed-cycles the animal must complete to be eligible to breed. The portion economy replaces the satiety-per-day model used for player food."
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-parchment-300/60 text-left text-ink-500 text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 font-normal">Animal</th>
                    <th className="px-3 py-2 font-normal">Diet</th>
                    <th className="px-3 py-2 font-normal">Portions to breed</th>
                    <th className="px-3 py-2 font-normal">Pregnancy</th>
                    <th className="px-3 py-2 font-normal">Litter</th>
                    <th className="px-3 py-2 font-normal">Drops on slaughter</th>
                    <th className="px-3 py-2 font-normal">Milk</th>
                  </tr>
                </thead>
                <tbody>
                  {ANIMALS_LIST.map(a => {
                    const days = a.transport ? null : daysPerOffspring(a, portionsPerDay);
                    return (
                      <tr key={a.key} className="border-b border-parchment-200/40 hover:bg-parchment-100/30 align-top">
                        <td className="px-3 py-3">
                          <div className="font-medium text-forest-900 flex items-center gap-2">
                            <span className="text-lg">{a.icon}</span>
                            {a.name}
                            {a.transport && <span className="text-[9px] uppercase tracking-wider text-amber-700 bg-amber-100/40 px-1 py-0.5 rounded">transport</span>}
                          </div>
                          <div className="text-xs text-ink-600 italic mt-0.5">{a.note}</div>
                          <div className="text-xs text-ink-500 mt-1">
                            Adult in {(a.hoursToGrow / 24).toFixed(1)} game days <span className="text-ink-400" title={`${(a.hoursToGrow / 24).toFixed(1)} game days = ${gameDaysToRealString(a.hoursToGrow / 24, dpm, rhpm)} real-world (only counts time when a player is on the server)`}>(≈ {gameDaysToRealString(a.hoursToGrow / 24, dpm, rhpm)} real)</span> · {a.needsMaleNote}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <div className="text-ink-700 mb-1">{a.diet.foodCategories.join(', ')}</div>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(a.diet.weighted).sort(([,v1],[,v2]) => v2-v1).map(([tag, w]) => (
                              <span key={tag} className="px-1.5 py-0.5 rounded border border-forest-300/60 text-forest-800 text-[10px] bg-parchment-100" title={`weight ${w}`}>
                                {tag}&nbsp;<span className="tabular text-ink-500">{w.toFixed(1)}</span>
                              </span>
                            ))}
                          </div>
                          {a.diet.skipFoodTags.length > 0 && (
                            <div className="text-[10px] text-terra-700 mt-1">skips: {a.diet.skipFoodTags.join(', ')}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 tabular text-ink-700">
                          {a.transport
                            ? <span className="text-ink-400 italic text-xs">n/a</span>
                            : a.pregnancyDays === null
                              ? <><strong>{a.layPortions}</strong> per egg</>
                              : <strong>{a.portionsToMultiply}</strong>}
                          {a.eatAnyway && <div className="text-[10px] text-forest-700 italic">eatAnyway</div>}
                        </td>
                        <td className="px-3 py-3 tabular text-ink-700">
                          {a.transport
                            ? <span className="text-ink-400 italic text-xs">n/a</span>
                            : a.pregnancyDays === null
                              ? <span className="text-xs italic" title={`${a.sitDays} game days sitting + ${a.incubationDays} game days incubation. Real-world: ~${gameDaysToRealString(a.sitDays + a.incubationDays, dpm, rhpm)} total (player must be online).`}>{a.sitDays}d sit + {a.incubationDays}d incub.<div className="text-[10px] text-ink-500 not-italic">≈ {gameDaysToRealString(a.sitDays + a.incubationDays, dpm, rhpm)} real</div></span>
                              : <span title={`${a.pregnancyDays} game days. Real-world: ${gameDaysToRealString(a.pregnancyDays, dpm, rhpm)} (player must be online).`}>
                                  {a.pregnancyDays}d
                                  <div className="text-[10px] text-ink-500">≈ {gameDaysToRealString(a.pregnancyDays, dpm, rhpm)} real</div>
                                </span>}
                        </td>
                        <td className="px-3 py-3 tabular text-ink-700">
                          {a.transport
                            ? <span className="text-ink-400 italic text-xs">does not breed</span>
                            : <>
                                {a.pregnancyDays === null
                                  ? '1 egg/lay'
                                  : (a.litterMin === a.litterMax ? a.litterMin : `${a.litterMin}-${a.litterMax}`)}
                                <div className="text-[10px] text-ink-500 italic" title={`${days.toFixed(1)} game days per offspring (or per egg). At your server's ratio: ${gameDaysToRealString(days, dpm, rhpm)} of player-online time per offspring.`}>
                                  ~{(30 / days).toFixed(1)} cycles/mo
                                </div>
                                <div className="text-[10px] text-ink-500">≈ {gameDaysToRealString(days, dpm, rhpm)}/offspring real</div>
                              </>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {a.transport
                            ? <span className="text-ink-400 italic">none on tame</span>
                            : <div className="space-y-0.5">
                                {a.drops.map(d => (
                                  <div key={d.code} className="text-ink-700">
                                    <strong className="text-forest-800">{d.code}:</strong> {d.avg}{d.var ? `±${d.var}` : ''}
                                    {d.note && <span className="text-ink-500 italic"> ({d.note})</span>}
                                  </div>
                                ))}
                              </div>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {a.milkable
                            ? <>
                                <strong className="text-forest-800">{a.milkable.yieldLitres}L</strong>/milking
                                <div className="text-[10px] text-ink-500 italic">once/day for {a.milkable.lactatingDaysAfterBirth}d post-birth</div>
                              </>
                            : <span className="text-ink-500">none</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-ink-600 italic">
              Sources: <code className="font-mono">survival/entities/animal/.../adult.json</code> · BehaviorMultiplyBase.cs ·
              BehaviorMilkable.cs · AiTaskSeekBlockAndLay.cs · elk-tamed.json · elk-semitamed.json. Default <code className="font-mono">HoursPerDay</code> is 24
              (used for the "in-game days" conversion).
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.07}>
        <Card>
          <CardHeader
            eyebrow="🦌 Tamed elk"
            title="The one rideable mount in vanilla"
            subtitle="Acquired by taming wild elk, not bred. Different stat profile from livestock; gets its own card."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="section-eyebrow text-forest-800 mb-2">Gaits (movespeed, game-units)</div>
                <table className="text-xs tabular w-full">
                  <tbody>
                    {ANIMALS.elk.gaits.map(g => (
                      <tr key={g.code} className="border-b border-parchment-200/40">
                        <td className="py-1 text-ink-700 capitalize">{g.code}</td>
                        <td className="py-1 text-right font-medium text-forest-900">{g.movespeed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-ink-500 italic mt-2 leading-tight">
                  Player walk is around 0.04 game-units for reference. Sprint at 0.08 is roughly twice player walking speed; trot matches a casual player walk; canter is comparable to a player sprint.
                </p>
              </div>
              <div>
                <div className="section-eyebrow text-forest-800 mb-2">Taming chain</div>
                <ol className="text-xs text-ink-700 space-y-2 list-decimal pl-4">
                  <li><strong className="text-forest-800">Wild elk → semi-tamed:</strong> repeated treat-feeding (specific items + interactions, see in-game handbook).</li>
                  <li><strong className="text-forest-800">Semi-tamed → tamed:</strong> {ANIMALS.elk.tamingChain.saddleBreaksRequired.avg}±{ANIMALS.elk.tamingChain.saddleBreaksRequired.var} saddle-breaks at one attempt per game day. Expect roughly {ANIMALS.elk.tamingChain.saddleBreaksRequired.avg - ANIMALS.elk.tamingChain.saddleBreaksRequired.var} to {ANIMALS.elk.tamingChain.saddleBreaksRequired.avg + ANIMALS.elk.tamingChain.saddleBreaksRequired.var} in-game days from saddle-on to fully tamed.</li>
                  <li><strong className="text-forest-800">Tamed:</strong> rideable with saddle, controllable, attaches gear (sidebags, weapons, lanterns, etc.).</li>
                </ol>
                <p className="text-[11px] text-ink-500 italic mt-2 leading-tight">
                  Source: <code className="font-mono">elk-semitamed.json</code> rideable.saddleBreaksRequired = {`{ avg: ${ANIMALS.elk.tamingChain.saddleBreaksRequired.avg}, var: ${ANIMALS.elk.tamingChain.saddleBreaksRequired.var} }`}.
                </p>
              </div>
              <div>
                <div className="section-eyebrow text-forest-800 mb-2">Notes</div>
                <ul className="text-xs text-ink-700 space-y-1.5 list-disc pl-4">
                  <li>Tamed elk do not breed. To get more, tame more wild ones.</li>
                  <li>Tamed elk have no slaughter drops. <code className="font-mono text-[10px]">harvestable</code> behavior is registered but the entity drops nothing in tamed form.</li>
                  <li>Tamed elk are not milkable.</li>
                  <li>Diet matches sheep/goat with peanut(0.2) substituting for soybean(0.2). They WILL graze your crops if loose.</li>
                  <li>Mortally wounded below 6 HP rather than instant death; you have a chance to flee or finish the attacker.</li>
                  <li>Two visual variants: regular elk and albino elk (cosmetic only).</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.08}>
        <Card>
          <CardHeader
            eyebrow="Watch out"
            title="What the source surfaces but the wiki doesn't"
          />
          <CardBody>
            <ul className="space-y-2 text-sm text-ink-700">
              <li>
                <strong className="text-forest-800">Sheep don't make wool.</strong> The word "wool" only appears
                in the names of pre-made clothing items (e.g. "warm-woolen-pants"). Vanilla sheep drop redmeat,
                hide, and fat on slaughter, plus milk from females. That's it.
              </li>
              <li>
                <strong className="text-forest-800">No cow in vanilla.</strong> The largest source of milk is sheep or goat (10L/milking
                each, identical defaults). Tamed elk are rideable but not livestock; see the elk card above.
              </li>
              <li>
                <strong className="text-forest-800">Pigs out-breed everything.</strong> Litter of 2-6 piglets vs.
                a single lamb or kid. Despite a longer pregnancy (25d vs 20d), pigs produce roughly 3× more
                offspring per month per female.
              </li>
              <li>
                <strong className="text-forest-800">Goats have an "eatAnyway" flag.</strong> Unique to goats:
                they keep eating to fill their multiply meter even when full. They breed faster than sheep in
                practice despite identical multiply settings.
              </li>
              <li>
                <strong className="text-forest-800">Animals graze your immature crops.</strong> Stage-1 turnip,
                parsnip, carrot, spelt, peanut, and amaranth carry the <code className="font-mono text-xs">nibbleCrop</code>{' '}
                food tag. Sheep, goat, and pig will eat them straight off the field if they can reach. Fence
                anything you don't want trimmed.
              </li>
              <li>
                <strong className="text-forest-800">Milking has constraints.</strong> Stress level must be ≤ 0.1
                (no recent damage), within 21 days of giving birth, and once per game day. Stressed females
                produce nothing.
              </li>
            </ul>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card elevated>
          <CardHeader
            eyebrow="Herd calculator"
            title="Plan your livestock"
            subtitle={`Adjust the slider below if you think your animals eat more or less than the default 8 portions/day. The portion economy is real (the seekfoodandeat AI fires every 1-4 game hours and consumes one portion per cycle), but the realized portions/day depends on food density, crowding, and how often you refill troughs.`}
          />
          <CardBody>
            <div className="mb-6 bg-parchment-200/30 border border-parchment-300/60 rounded p-4">
              <label className="block text-xs text-ink-600 mb-2">
                Portions consumed per animal per day:{' '}
                <span className="font-medium text-forest-900 tabular">{portionsPerDay}</span>
                {portionsPerDay === PORTIONS_PER_DAY && (
                  <span className="text-[10px] text-ink-500 italic ml-2">(default)</span>
                )}
              </label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-500 tabular">4</span>
                <input
                  type="range"
                  min="4"
                  max="12"
                  step="1"
                  value={portionsPerDay}
                  onChange={e => setPortionsPerDay(parseInt(e.target.value, 10))}
                  className="flex-1"
                />
                <span className="text-xs text-ink-500 tabular">12</span>
                <button
                  type="button"
                  onClick={() => setPortionsPerDay(PORTIONS_PER_DAY)}
                  className="text-xs text-forest-700 underline hover:text-forest-900"
                >
                  reset
                </button>
              </div>
              <div className="text-[11px] text-ink-500 italic mt-2 leading-tight">
                Lower (4-6) = sparse feeding, slow breeding. Default (8) = troughs kept reasonably full. Higher (10-12) = troughs always topped off, animals eating at the AI's max rate. Breeding cycles, lay rates, and feed costs all scale with this.
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {ANIMALS_LIST.map(a => (
                <div key={a.key}>
                  <label className="block text-xs text-ink-600 mb-1">
                    <span className="text-base mr-1">{a.icon}</span>
                    {a.name}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={counts[a.key] || 0}
                    onChange={e => setCounts({ ...counts, [a.key]: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-2 py-1 text-sm tabular border border-parchment-300/60 rounded bg-parchment-100/40"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-forest-50/40 border border-forest-200/60 rounded p-4">
                <div className="section-eyebrow text-forest-800 mb-2">Feed required</div>
                <div className="font-display text-3xl text-forest-900 tabular">
                  {summary.feedPortionsPerDay}
                </div>
                <div className="text-xs text-ink-600 mt-1">portions / in-game day</div>
                <div className="mt-3 space-y-1 text-xs">
                  {Object.entries(summary.feedPortionsPerDayBySpecies).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-ink-700">
                      <span>{ANIMALS[k].icon} {ANIMALS[k].name}</span>
                      <span className="tabular">{v} portions</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-4">
                <div className="section-eyebrow text-forest-800 mb-2">Weekly yields (steady state)</div>
                <div className="space-y-1.5 text-sm">
                  {summary.eggsPerWeek > 0 && (
                    <div className="flex justify-between text-ink-700">
                      <span>🥚 Eggs (assuming rooster nearby)</span>
                      <span className="tabular font-medium" title={`${summary.eggsPerWeek.toFixed(1)} eggs per game week (7 game days). At ${dpm} d/m and ${rhpm} real-h/m, one game week = ${gameDaysToRealString(7, dpm, rhpm)} of player-online time, so this is ~${(summary.eggsPerWeek / (7 * (rhpm * 60 / dpm) / 60 / 24) || 0).toFixed(2)} eggs per real-world day someone is online.`}>{summary.eggsPerWeek.toFixed(1)}/week</span>
                    </div>
                  )}
                  {summary.weeklyMilkLitres > 0 && (
                    <div className="flex justify-between text-ink-700">
                      <span>🥛 Milk (avg over breeding cycle)</span>
                      <span className="tabular font-medium" title={`${summary.weeklyMilkLitres.toFixed(1)} L per game week. One game week = ${gameDaysToRealString(7, dpm, rhpm)} of player-online time.`}>{summary.weeklyMilkLitres.toFixed(1)} L/week</span>
                    </div>
                  )}
                  {Object.entries(summary.offspringPerMonthPerFemale).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-ink-700">
                      <span>{ANIMALS[k].icon} {ANIMALS[k].name} ♀ offspring</span>
                      <span className="tabular font-medium" title={`${v.toFixed(1)} offspring per game month. One game month = ${gameDaysToRealString(dpm, dpm, rhpm)} of player-online time.`}>{v.toFixed(1)}/month</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-ink-500 italic mt-3 leading-tight">
                  Steady-state per fed female. One game week = {gameDaysToRealString(7, dpm, rhpm)} real, one game month = {gameDaysToRealString(dpm, dpm, rhpm)} real, both assuming a player is online. Real game has variance from cooldown bounds, food availability, and stress.
                </p>
              </div>

              <div className="bg-parchment-200/30 border border-parchment-300/60 rounded p-4">
                <div className="section-eyebrow text-forest-800 mb-2">If you feed only this crop</div>
                <select
                  value={feedCrop}
                  onChange={e => setFeedCrop(e.target.value)}
                  className="text-sm w-full px-2 py-1 border border-parchment-300/60 rounded bg-parchment-100/40 mb-2"
                >
                  {Object.keys(CROP_HARVEST_YIELDS).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="space-y-1 mt-2 text-xs">
                  {Object.entries(cropPlotsBySpecies).map(([k, harvests]) => {
                    const a = ANIMALS[k];
                    const accepts = a.diet.foodCategories.length > 0;
                    const skipsThis = a.diet.skipFoodTags.includes(feedCrop);
                    if (!accepts || skipsThis || harvests === null) {
                      return (
                        <div key={k} className="flex justify-between text-ink-500 italic">
                          <span>{a.icon} {a.name}</span>
                          <span>{skipsThis ? 'skips this' : "won't eat"}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={k} className="flex justify-between text-ink-700">
                        <span>{a.icon} {a.name}</span>
                        <span className="tabular font-medium">{harvests} harvests/wk</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-ink-500 italic mt-3 leading-tight">
                  Skip warnings come from <code className="font-mono">skipFoodTags</code> in each entity. Sheep & goat skip rice and parsnip.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card>
          <CardHeader
            eyebrow="Trough fills"
            title="Items per portion, items per full trough"
            subtitle="One fill level = one portion. Trough holds 8 fill levels. Hay block and drygrass are the cheapest filler; pumpkin is the most space-efficient."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="section-eyebrow text-forest-800 mb-2">Large trough (sheep, goat, pig)</div>
                <table className="text-xs tabular w-full">
                  <thead className="text-ink-500 text-left">
                    <tr><th className="font-normal py-1">Food</th><th className="font-normal">Per portion</th><th className="font-normal">Full trough</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(TROUGH_FILLS.large).map(([key, cfg]) => (
                      <tr key={key} className="border-b border-parchment-200/40">
                        <td className="py-1 pr-3">{key}</td>
                        <td className="py-1 pr-3 font-medium">{cfg.itemsPerPortion}</td>
                        <td className="py-1">{cfg.itemsPerPortion * cfg.fillsPerTrough}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="section-eyebrow text-forest-800 mb-2">Small trough (chicken only)</div>
                <table className="text-xs tabular w-full">
                  <thead className="text-ink-500 text-left">
                    <tr><th className="font-normal py-1">Food</th><th className="font-normal">Per portion</th><th className="font-normal">Full trough</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(TROUGH_FILLS.small).map(([key, cfg]) => (
                      <tr key={key} className="border-b border-parchment-200/40">
                        <td className="py-1 pr-3">{key}</td>
                        <td className="py-1 pr-3 font-medium">{cfg.itemsPerPortion}</td>
                        <td className="py-1">{cfg.itemsPerPortion * cfg.fillsPerTrough}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-ink-500 italic mt-2 leading-tight">
                  Small trough <code className="font-mono">unsuitableFor</code> excludes deer, goat, bear, gazelle, hyena, pig, sheep, wolf. Chicken only.
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-600 italic">
              Source: <code className="font-mono">blocktypes/wood/trough-large.json</code>, <code className="font-mono">trough-small.json</code>.
              "Per portion" comes from the <code className="font-mono">quantityPerFillLevel</code> on each contentConfig entry.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="Food tags reference"
            title="What each tag covers and where to find it"
            subtitle="Source: itemtypes/food/*.json plus each entity's creatureDiet block."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(FOOD_TAGS).map(([key, f]) => (
                <div key={key} className={`border rounded p-3 ${f.skip ? 'bg-amber-50/40 border-amber-300/60' : 'bg-parchment-200/30 border-parchment-300/60'}`}>
                  <div className="flex justify-between items-baseline">
                    <div className="font-medium text-forest-900">{f.label}</div>
                    <code className="font-mono text-xs text-ink-600">{key}{f.skip ? ' (skipped)' : ''}</code>
                  </div>
                  {f.items && (
                    <div className="text-xs text-ink-700 mt-2"><strong>Items:</strong> {f.items}</div>
                  )}
                  {f.wild && (
                    <div className="text-xs text-ink-700 mt-1"><strong>Source:</strong> {f.wild}</div>
                  )}
                  {f.note && (
                    <div className="text-xs text-ink-600 italic mt-2">{f.note}</div>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.225}>
        <Card>
          <CardHeader
            eyebrow="Wild crop raiders"
            title="Animals that will eat your harvest"
            subtitle="Source: each entity's creatureDiet block. Diet rules are the same TAG-based system the livestock use; these animals just spawn wild and aren't tameable."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {WILD_RAIDERS_LIST.map(r => (
                <div key={r.name} className="bg-parchment-100/50 border border-parchment-300/60 rounded p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">{r.icon}</span>
                    <div className="font-medium text-forest-900">{r.name}</div>
                  </div>
                  <div className="text-xs text-ink-700 mb-2">
                    <strong>Eats:</strong> {r.foodCategories.join(', ')}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.entries(r.weighted).sort(([,a], [,b]) => b - a).map(([tag, w]) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded border border-forest-300/60 text-forest-800 text-[10px] bg-parchment-100" title={`weight ${w}`}>
                        {tag}&nbsp;<span className="tabular text-ink-500">{w.toFixed(1)}</span>
                      </span>
                    ))}
                  </div>
                  {r.skipFoodTags.length > 0 && (
                    <div className="text-[10px] text-terra-700 mb-2">skips: {r.skipFoodTags.join(', ')}</div>
                  )}
                  <div className="text-xs text-ink-700 mt-2">
                    <strong className="text-terra-700">Threat to:</strong>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5">
                      {r.threatTo.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                  <div className="text-xs text-ink-600 mt-2">
                    <strong>Won't touch:</strong> {r.notIn}
                  </div>
                  <div className="text-xs text-forest-700 mt-1.5 italic">
                    Defense: {r.defense}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 px-3 py-2 rounded border-l-4 border-l-amber-500 bg-amber-50/40 text-xs text-ink-700">
              <strong className="text-terra-800">Why fences matter:</strong> the <code className="font-mono">nibbleCrop</code> tag is on the actual crop block (not the harvested item). Hare, deer, gazelle, and moose can walk through unfenced fields and graze rows in-place at any growth stage. They prefer ripe stages but will eat earlier ones.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.25}><Flourish>※</Flourish></Reveal>
    </div>
  );
}

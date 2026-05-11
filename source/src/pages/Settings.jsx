// Settings. Global config (today, perk on/off, defaults). Reset button.
import { useState } from 'react';
import {
  Card, CardHeader, CardBody, Reveal, Toggle, ModPill, Flourish, Stat,
} from '../components/ui/Primitives.jsx';
import { useSettings, resetAll } from '../lib/storage.js';
import { useClimate, loadClimateFromFile, downloadClimateCSV } from '../lib/useClimate.js';
import { SOILS_PLANTABLE } from '../data/game.js';
import { dayLabel, dateParts, dayFromDate, daysPerYear, MONTH_NAMES, SEASON_START_DAY, SEASON_END_DAY, YEARLY_AVG_TEMP } from '../data/climate.js';
import {
  PLAYER_CLASSES, getPlayerClass, classStat, TRACKED_STATS, SC_MOD_INFO,
} from '../data/specializedClasses.js';
import { SATIETY_MODES } from '../data/crops.js';
import {
  WORLD_CONFIG_KEYS, defaultWorldConfig, parseWorldConfig, diffFromVanilla,
} from '../lib/worldConfig.js';

// Source: vsessentialsmod /Systems/CharacterExtraDialogs.cs lines 131-156.
// The game's character panel (press C) reads WorldgenRainfall (the chunk's
// annual average, not the current moment) and shows one of these 6 labels.
// Boundaries are strict greater-than, so 0.15 falls into the lower bucket.
const RAINFALL_FREQUENCIES = [
  { key: 'very_rare',     label: 'Very Rare',           range: '0 to 0.15',    value: 0.075, langKey: 'freq-veryrare',   note: 'Desert. Almost no rain top-up.' },
  { key: 'rarely',        label: 'Rarely',              range: '0.15 to 0.30', value: 0.225, langKey: 'freq-rarely',     note: 'Arid. Occasional showers.' },
  { key: 'uncommon',      label: 'Uncommon',            range: '0.30 to 0.45', value: 0.375, langKey: 'freq-uncommon',   note: 'Drier temperate. Below the trader-spawn desert cutoff at 0.4.' },
  { key: 'common',        label: 'Common',              range: '0.45 to 0.70', value: 0.575, langKey: 'freq-common',     note: 'Default temperate.' },
  { key: 'very_common',   label: 'Very Common',         range: '0.70 to 0.90', value: 0.80,  langKey: 'freq-verycommon', note: 'Wet temperate or jungle edge.' },
  { key: 'almost_always', label: 'Almost all the time', range: '0.90 to 1.0',  value: 0.95,  langKey: 'freq-allthetime', note: 'Rainforest. Moisture pinned high.' },
];

export default function SettingsPage() {
  const [settings, updateSettings] = useSettings();
  const yearLen = daysPerYear();

  return (
    <div className="space-y-8">
      <Reveal>
        <div>
          <div className="section-eyebrow text-forest-700">§9 · Settings</div>
          <h2 className="heading-display text-4xl md:text-5xl mt-2">
            Your <span className="heading-italic">world</span>, your config
          </h2>
          <p className="mt-3 text-ink-600 max-w-2xl">
            Stuff that applies everywhere on the site. Persists across tabs and survives page refreshes (stored in your browser).
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <Card>
          <CardHeader title="World state" subtitle="What 'today' means and how big the calendar is." />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field
                label="Today (game date)"
                hint={`In-game press C to see your current date. The dropdown is the month, the middle box is day-of-month (1 to ${settings.daysPerMonth}), the right box is the year (0+, matches in-game). Internal day number: ${settings.today}.`}
              >
                {(() => {
                  const dpm = settings.daysPerMonth || 9;
                  const parts = dateParts(settings.today, dpm) || { monthIdx: 0, dayOfMonth: 1, year: 0 };
                  return (
                    <div className="flex items-center gap-2">
                      <select
                        className="select-field flex-1"
                        value={parts.monthIdx + 1}
                        onChange={(e) => {
                          const month = parseInt(e.target.value);
                          updateSettings({ today: dayFromDate(month, parts.dayOfMonth, parts.year, dpm) });
                        }}
                      >
                        {MONTH_NAMES.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                      </select>
                      <input
                        type="number" min="1" max={dpm} className="input-field tabular w-20"
                        value={parts.dayOfMonth}
                        title={`Day of month (1 to ${dpm})`}
                        onChange={(e) => {
                          const dom = clamp(parseInt(e.target.value) || 1, 1, dpm);
                          updateSettings({ today: dayFromDate(parts.monthIdx + 1, dom, parts.year, dpm) });
                        }}
                      />
                      <input
                        type="number" min="0" max="999" className="input-field tabular w-20"
                        value={parts.year}
                        title="Year (0+, matches the in-game readout)"
                        onChange={(e) => {
                          const raw = e.target.value;
                          const y = raw === '' ? 0 : clamp(parseInt(raw) || 0, 0, 999);
                          updateSettings({ today: dayFromDate(parts.monthIdx + 1, parts.dayOfMonth, y, dpm) });
                        }}
                      />
                    </div>
                  );
                })()}
              </Field>
              <Field label="Days per month" hint={`Vintage Story default = 9. Your server config can be 1 to 60. Year = days/month × 12 = ${settings.daysPerMonth * 12} days.`}>
                <input type="number" min="1" max="60" className="input-field tabular"
                  value={settings.daysPerMonth}
                  onChange={(e) => updateSettings({ daysPerMonth: clamp(parseInt(e.target.value) || 9, 1, 60) })}
                />
              </Field>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card>
          <CardHeader title="Defaults" subtitle="Used as the baseline when you add new plots or open the Decision tab fresh." />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Default soil tier">
                <select className="select-field"
                  value={settings.defaultSoil}
                  onChange={(e) => updateSettings({ defaultSoil: parseInt(e.target.value) })}
                >
                  {SOILS_PLANTABLE.map(s => (<option key={s.key} value={s.val}>{s.name} ({s.val})</option>))}
                </select>
              </Field>
              <Field label="Default greenhouse?">
                <Toggle
                  checked={settings.defaultGreenhouse}
                  onChange={(v) => updateSettings({ defaultGreenhouse: v })}
                  label={settings.defaultGreenhouse ? 'On. New plots default to greenhouse' : 'Off. New plots are outdoor'}
                />
              </Field>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <ClassSection
          playerClass={settings.playerClass}
          onChange={(c) => updateSettings({ playerClass: c })}
        />
      </Reveal>

      <Reveal delay={0.18}>
        <Card>
          <CardHeader
            eyebrow="Scoring"
            title="How to value crop output"
            subtitle="Picks which satiety number drives the Decision score. The crop's other values stay visible in the per-row tooltip."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SATIETY_MODES.map(m => {
                const selected = (settings.satietyMode || 'auto') === m.key;
                return (
                  <label
                    key={m.key}
                    className={`block border-2 rounded-md p-3 cursor-pointer transition-colors satiety-card ${
                      selected
                        ? 'satiety-card-selected border-forest-700'
                        : 'border-parchment-300/60 hover:border-forest-300 hover:bg-parchment-200/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="satietyMode"
                      value={m.key}
                      checked={selected}
                      onChange={() => updateSettings({ satietyMode: m.key })}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-display text-base text-forest-900">{m.label}</div>
                      {selected && (
                        <span className="text-xs font-medium text-forest-700 tabular shrink-0">✓ selected</span>
                      )}
                    </div>
                    <div className="text-xs text-ink-500 mt-1 italic">{m.hint}</div>
                  </label>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="Biome conditions"
            title="Things that affect growth"
            subtitle="Rainfall and the underground flag both feed the score now. Per-plot overrides (water adjacency, underground/light) live on the Plots page."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field
                label="Rainfall frequency for this biome"
                hint="Press C in-game to see the label for your spot. The 6 buckets and thresholds are from vsessentialsmod CharacterExtraDialogs.cs lines 131-156. Boundaries are strict: rainfall = 0.30 is 'Rarely', not 'Uncommon'."
              >
                <select
                  className="select-field"
                  value={settings.rainfallFrequency || 'common'}
                  onChange={(e) => updateSettings({ rainfallFrequency: e.target.value })}
                >
                  {RAINFALL_FREQUENCIES.map(r => (
                    <option key={r.key} value={r.key}>{r.label} ({r.range})</option>
                  ))}
                </select>
                {(() => {
                  const cur = RAINFALL_FREQUENCIES.find(r => r.key === (settings.rainfallFrequency || 'common'));
                  if (!cur) return null;
                  return (
                    <div className="mt-2 text-xs text-ink-500">
                      <div className="tabular">Climate value: <strong className="text-forest-800">{cur.value}</strong> (midpoint of {cur.range}).</div>
                      <div className="italic mt-1">{cur.note}</div>
                    </div>
                  );
                })()}
              </Field>
              <Field
                label="allowUndergroundFarming flag"
                hint="The world config flag that gates underground farming. Default = false. If false, any plot marked 'underground' on the Plots page sits at stage 1 forever."
              >
                <Toggle
                  checked={!!settings.allowUndergroundFarming}
                  onChange={(v) => updateSettings({ allowUndergroundFarming: v })}
                  label={settings.allowUndergroundFarming
                    ? 'On. Underground plots use their light level setting.'
                    : 'Off (default). Underground plots get a 0x grow factor.'}
                />
                <p className="text-xs text-ink-500 mt-2 italic">
                  Check your serverconfig.json under worldConfig. Math is in BlockEntityFastForwardGrowth.cs:84-89, defaults from ModSystemFarming.cs:17-18.
                </p>
              </Field>
            </div>
            <div className="mt-4 px-4 py-3 rounded-md border-l-4 border-l-forest-500 bg-forest-100/30 text-xs text-ink-700">
              <strong>How rainfall feeds the score:</strong> 500k-hour Monte Carlo of the game's noise pipeline (WeatherSystemBase.cs) plus the moisture decay/recovery from BESoilNutrition.cs gives a steady-state grow-rate multiplier per bucket. Greenhouse plots and "water within 4 blocks" plots ignore this. The cliff between Uncommon (0.05x) and Common (1.04x) is real, it's the (rain-0.6)*2 offset in GetRainCloudness.
            </div>
            <div className="mt-2 px-4 py-3 rounded-md border-l-4 border-l-forest-500 bg-forest-100/30 text-xs text-ink-700">
              <strong>How light/depth feeds the score:</strong> factor = clamp(1 - (19 - (sunlight - depth)) * 0.1, 0, 1). Underground plots use the light level you enter (MaxLight, includes torches). Outdoor plots use sunlight=22 minus blocks below sea level. Multiplied independently into grow speed alongside moisture.
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.2}>
        <Card>
          <CardHeader
            eyebrow="Score tuning"
            title="Weight the factors that matter to you"
            subtitle="The score multiplies these factors. 1.0 leaves a factor as-is. 0 ignores it. >1 amplifies. Most players never touch these."
          />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <WeightSlider
                label="Food output (satiety/day)"
                hint="How much you value calories per plot-day. Lower this if you mostly need fiber, oil, or seeds."
                value={settings.weights?.satiety ?? 1.0}
                onChange={(v) => updateSettings({ weights: { ...settings.weights, satiety: v } })}
              />
              <WeightSlider
                label="Grow speed bonus"
                hint="Independent reward for fast-finishing crops. Useful when you need a quick second crop."
                value={settings.weights?.growSpeed ?? 1.0}
                onChange={(v) => updateSettings({ weights: { ...settings.weights, growSpeed: v } })}
              />
              <WeightSlider
                label="Frost safety"
                hint="How much risk you'll accept on long crops. 0 = ignore (you'll harvest manually before frost)."
                value={settings.weights?.frostSafety ?? 1.0}
                onChange={(v) => updateSettings({ weights: { ...settings.weights, frostSafety: v } })}
              />
              <WeightSlider
                label="Cold/heat damage"
                hint="How heavily temperature stunting penalizes the score."
                value={settings.weights?.damage ?? 1.0}
                onChange={(v) => updateSettings({ weights: { ...settings.weights, damage: v } })}
              />
              <WeightSlider
                label="Rotation discipline"
                hint="How much you care about alternating N/P/K axes. Set to 0 if you just want the best crop regardless of last harvest."
                value={settings.weights?.rotation ?? 1.0}
                onChange={(v) => updateSettings({ weights: { ...settings.weights, rotation: v } })}
              />
              <WeightSlider
                label="Follow-up planting"
                hint="Bonus for crops short enough that another can fit after them this season."
                value={settings.weights?.followUp ?? 1.0}
                onChange={(v) => updateSettings({ weights: { ...settings.weights, followUp: v } })}
              />
            </div>

            <div className="mt-6 pt-4 border-t border-parchment-300/50">
              <div className="section-eyebrow text-forest-700 mb-2">Food category boosts</div>
              <p className="text-xs text-ink-500 mb-3 italic">Bump a category if you're short on it (e.g. Protein 1.5 to favor soybean/peanut). 1.0 = no preference.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {['Vegetable','Fruit','Grain','Protein','Dairy','Spice'].map(cat => (
                  <WeightSlider
                    key={cat}
                    label={cat}
                    hint={null}
                    value={settings.categoryBoosts?.[cat] ?? 1.0}
                    onChange={(v) => updateSettings({ categoryBoosts: { ...settings.categoryBoosts, [cat]: v } })}
                    min={0} max={3} step={0.1}
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                className="btn-secondary !text-xs"
                onClick={() => updateSettings({
                  weights: { satiety: 1, growSpeed: 1, frostSafety: 1, rotation: 1, followUp: 1, damage: 1 },
                  categoryBoosts: { Vegetable: 1, Fruit: 1, Grain: 1, Protein: 1, Dairy: 1, Spice: 1 },
                })}
              >Reset to defaults</button>
              <span className="text-xs text-ink-500">All weights = 1.0 reproduces the standard score.</span>
            </div>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.22}>
        <ClimateSection daysPerMonth={settings.daysPerMonth} />
      </Reveal>

      <Reveal delay={0.24}>
        <Card className="border-l-4 border-l-amber-400 bg-amber-100/20">
          <CardHeader
            eyebrow="Experimental"
            title="Beta features"
            subtitle="Things we're trying out. Toggle on to enable; expect rough edges and assumptions noted in-page."
          />
          <CardBody>
            {/* Master toggle: enable/disable all betas at once */}
            <div className="mb-4 pb-4 border-b border-amber-300/40 flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-ink-700">
                <strong className="text-forest-900">Quick toggle:</strong> turn every beta on at once, or clear them all back to off.
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => updateSettings({
                    experimentalFeatures: {
                      climateScouting: true,
                      climateEstimator: true,
                      scCrafting: true,
                      forager: true,
                      mushrooms: true,
                    },
                  })}
                  className="btn-primary !py-1.5 !px-3 !text-xs"
                >
                  Enable all betas
                </button>
                <button
                  onClick={() => updateSettings({
                    experimentalFeatures: {
                      climateScouting: false,
                      climateEstimator: false,
                      scCrafting: false,
                      forager: false,
                      mushrooms: false,
                    },
                  })}
                  className="btn-secondary !py-1.5 !px-3 !text-xs"
                >
                  Disable all betas
                </button>
              </div>
            </div>
            <Field
              label="Climate scouting (beta)"
              hint="Adds a Scouting page that projects your bundled climate to nearby latitudes (within ±0.2). Uses vanilla worldgen math; mods that change the climate model will produce wrong predictions."
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={!!settings.experimentalFeatures?.climateScouting}
                  onChange={v => updateSettings({
                    experimentalFeatures: {
                      ...(settings.experimentalFeatures || {}),
                      climateScouting: v,
                    },
                  })}
                />
                <span className="text-sm text-ink-600">
                  {settings.experimentalFeatures?.climateScouting ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </Field>
            <Field
              label="Climate estimator (beta)"
              hint="Adds an Estimator page that builds a climate from a /debug exptempplot CSV, or from HUD readings + temperature snapshots. The CSV mode auto-detects daysPerMonth from the date format. Useful when the bundled climate doesn't match your spot."
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={!!settings.experimentalFeatures?.climateEstimator}
                  onChange={v => updateSettings({
                    experimentalFeatures: {
                      ...(settings.experimentalFeatures || {}),
                      climateEstimator: v,
                    },
                  })}
                />
                <span className="text-sm text-ink-600">
                  {settings.experimentalFeatures?.climateEstimator ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </Field>
            <Field
              label="SC Crafting (beta)"
              hint="Adds a Special Crafting page listing every Specialized Classes mod recipe relevant to farming. Soil tier-up (Farmhand), saltpeter from compost+lime (Spelunker), rot-doubling, and the perk-only fertilizer recipes."
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={!!settings.experimentalFeatures?.scCrafting}
                  onChange={v => updateSettings({
                    experimentalFeatures: {
                      ...(settings.experimentalFeatures || {}),
                      scCrafting: v,
                    },
                  })}
                />
                <span className="text-sm text-ink-600">
                  {settings.experimentalFeatures?.scCrafting ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </Field>
            <Field
              label="Forager (beta)"
              hint="Adds a Forager page that estimates how far you'd need to travel from your spot to find naturally-spawning crops, berry bushes, fruit-tree branches, or forest trees including bamboo. Climate-distance + density-distance combined."
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={!!settings.experimentalFeatures?.forager}
                  onChange={v => updateSettings({
                    experimentalFeatures: {
                      ...(settings.experimentalFeatures || {}),
                      forager: v,
                    },
                  })}
                />
                <span className="text-sm text-ink-600">
                  {settings.experimentalFeatures?.forager ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </Field>
            <Field
              label="Mushrooms (beta, mod-only)"
              hint="Adds a Mushrooms page covering the NDL Mushroom Growth mod (v2.0.2 by NateDoesLife). Documents the trough mechanics: soil tier sets grow time (3-10 days), cellar required, no temperature dependency. Lists all 45 species with toxicity flags and runs a throughput calculator. Only useful if the mod is installed on your server."
            >
              <div className="flex items-center gap-3">
                <Toggle
                  checked={!!settings.experimentalFeatures?.mushrooms}
                  onChange={v => updateSettings({
                    experimentalFeatures: {
                      ...(settings.experimentalFeatures || {}),
                      mushrooms: v,
                    },
                  })}
                />
                <span className="text-sm text-ink-600">
                  {settings.experimentalFeatures?.mushrooms ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </Field>
          </CardBody>
        </Card>
      </Reveal>

      <Reveal delay={0.245}>
        <WorldConfigSection
          worldConfig={settings.worldConfig}
          onChange={wc => updateSettings({ worldConfig: wc })}
        />
      </Reveal>

      <Reveal delay={0.25}>
        <Card>
          <CardHeader title="Storage" subtitle="All settings, plots, and activity logs are stored in your browser's localStorage. Nothing leaves your device." />
          <CardBody>
            <button
              className="btn-secondary !text-terra-700 !border-terra-300 hover:!bg-terra-300/15"
              onClick={() => {
                if (confirm('Reset everything. Settings, plots, and activity log. To defaults? This cannot be undone.')) {
                  resetAll();
                }
              }}
            >
              Reset all data
            </button>
          </CardBody>
        </Card>
      </Reveal>

      <Flourish>※</Flourish>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-500 mt-1 italic">{hint}</p>}
    </div>
  );
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// === Specialized Classes section ===

function ClassSection({ playerClass, onChange }) {
  const cls = getPlayerClass(playerClass);
  const isCommoner = cls.key === 'commoner';

  // The stats this class actually moves (non-zero deltas).
  const activeStats = TRACKED_STATS.filter(s => (cls.modifiers?.[s.key] ?? 0) !== 0);

  return (
    <Card className={`border-l-4 ${isCommoner ? 'border-l-parchment-400' : 'border-l-amber-500 bg-amber-100/20'}`}>
      <CardHeader
        eyebrow={<><ModPill /> <span className="ml-2">Mod compatibility</span></>}
        title="Specialized Classes"
        subtitle="Pick the class your character is on the server. Yield numbers in Decision and Plots adjust for the perks (and the penalties) that class actually carries."
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1">Your class</label>
            <select
              className="select-field"
              value={cls.key}
              onChange={(e) => onChange(e.target.value)}
            >
              {PLAYER_CLASSES.map(c => (
                <option key={c.key} value={c.key}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-ink-500 mt-2 italic">
              {cls.description}
            </p>
          </div>
          <div>
            <div className="section-eyebrow mb-2">Effective stat changes</div>
            {activeStats.length === 0 ? (
              <p className="text-sm text-ink-600">
                No farming or yield modifiers. All multipliers stay at 1.0, same as vanilla.
              </p>
            ) : (
              <p className="text-sm text-ink-600">
                {activeStats.length} stat{activeStats.length === 1 ? '' : 's'} changed from baseline. See table below.
              </p>
            )}
          </div>
        </div>

        {!isCommoner && (
          <div className="mt-2 border-t border-parchment-300/40 pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm tabular">
                <thead>
                  <tr className="text-left text-ink-500 border-b border-parchment-300/40">
                    <th className="py-2 pr-4 font-medium">Stat</th>
                    <th className="py-2 pr-4 font-medium">Delta</th>
                    <th className="py-2 pr-4 font-medium">Multiplier</th>
                    <th className="py-2 font-medium">What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStats.map(s => {
                    const delta = cls.modifiers[s.key];
                    const mul = 1 + delta;
                    const positive = delta > 0;
                    return (
                      <tr key={s.key} className="border-b border-parchment-300/20">
                        <td className="py-2 pr-4 text-ink-800">{s.label}</td>
                        <td className={`py-2 pr-4 ${positive ? 'text-forest-700' : 'text-terra-700'}`}>
                          {positive ? '+' : ''}{(delta * 100).toFixed(0)}%
                        </td>
                        <td className="py-2 pr-4 text-ink-700">{mul.toFixed(2)}x</td>
                        <td className="py-2 text-xs text-ink-500 italic">{s.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink-500 mt-3 italic">
              Stats that this class doesn't touch stay at 1.0x (vanilla baseline). For instance, an Archivist still gets normal animal loot and forage drops.
            </p>
          </div>
        )}

        <details className="mt-4 text-xs text-ink-600">
          <summary className="cursor-pointer text-forest-700 hover:text-forest-900 font-medium">
            How the planner uses this
          </summary>
          <div className="mt-3 pl-4 border-l-2 border-parchment-300/60 space-y-2">
            <p>
              The Decision tab and the Plots-based ranking apply the produce yield multiplier to each crop's base yield. Flax is special: it reads from <code className="font-mono">flaxFiberDropRate</code> instead of <code className="font-mono">cropProduceDropRate</code>, since the "yield" stored for flax is fiber count.
            </p>
            <p>
              Seed yield, immature seed chance, wild crops, and forage are all tracked in the data file but not yet wired into the score. Vintner's <code className="font-mono">forageDropRate +1.0</code> is the stat that wild berries fall under, but the planner doesn't model wild gathering yet.
            </p>
            <p>
              All stats use VS's <code className="font-mono">Stats.GetBlended(stat) ?? 1</code> convention, so deltas are added to a base of 1.0. Confirmed in BlockCrop.cs line 167 for <code className="font-mono">wildCropDropRate</code>; the other drop-rate stats follow the same pattern.
            </p>
          </div>
        </details>

        <div className="mt-4 text-xs text-ink-500 italic space-y-1">
          <p>
            Mod page: <a href={SC_MOD_INFO.url} target="_blank" rel="noopener" className="text-forest-700 underline">{SC_MOD_INFO.url}</a>. Only relevant if your server has it installed.
          </p>
          <p>
            <strong className="not-italic">Targets:</strong> Vintage Story 1.22.2 + Specialized Classes <strong className="not-italic">{SC_MOD_INFO.version}</strong> (mod identifier <code className="font-mono not-italic bg-parchment-200/50 px-1 rounded">{SC_MOD_INFO.identifier}</code>). Newer mod versions may rebalance stats; verify if you've updated.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

// === Climate CSV section ===

function ClimateSection({ daysPerMonth }) {
  const { climate, source, setCustom, reset } = useClimate();
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  const [filename, setFilename] = useState(null);

  const sourceLabel = {
    inline:  'Bundled (built-in fallback)',
    bundled: 'Bundled (./climate.csv)',
    custom:  'Custom (uploaded)',
  }[source] || source;

  const sourceColor = {
    inline:  'text-ink-500',
    bundled: 'text-forest-700',
    custom:  'text-amber-700',
  }[source] || 'text-ink-500';

  function onFileChange(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setError(null);
    setPending(true);
    setFilename(f.name);
    loadClimateFromFile(f, daysPerMonth)
      .then(arr => {
        setCustom(arr);
        setPending(false);
      })
      .catch(err => {
        setError(err.message || String(err));
        setPending(false);
      });
  }

  // Compute summary stats
  const stats = (() => {
    if (!climate || climate.length === 0) return null;
    const avgs = climate.map(c => c.avg);
    return {
      days: climate.length,
      yearAvg: avgs.reduce((a, b) => a + b, 0) / avgs.length,
      coldest: Math.min(...avgs),
      warmest: Math.max(...avgs),
    };
  })();

  return (
    <Card>
      <CardHeader
        eyebrow="Climate"
        title="Replace temperature data"
        subtitle="Upload your own server's temperature CSV to retune everything for your world."
      />
      <CardBody>
        {stats && stats.days !== daysPerMonth * 12 && (
          <div className="mb-4 px-4 py-3 rounded-md border-l-4 border-l-amber-500 bg-amber-100/40 text-sm text-ink-700">
            <strong className="text-amber-700">Mismatch:</strong>{' '}
            Your climate has <span className="tabular">{stats.days}</span> days but your config says{' '}
            <span className="tabular">{daysPerMonth}</span> days/month × 12 months ={' '}
            <span className="tabular">{daysPerMonth * 12}</span> days/year. Either upload a CSV that matches your server's day count, or change "Days per month" to <span className="tabular">{Math.round(stats.days / 12)}</span> if your year really is {stats.days} days.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <div className="section-eyebrow mb-2">Current source</div>
            <div className={`font-display text-xl ${sourceColor}`}>{sourceLabel}</div>
            {filename && source === 'custom' && (
              <div className="text-xs text-ink-500 mt-1 italic">from {filename}</div>
            )}
          </div>
          {stats && (
            <div>
              <div className="section-eyebrow mb-2">Summary</div>
              <div className="text-sm text-ink-700 space-y-0.5">
                <div>{stats.days} days · {YEARLY_AVG_TEMP.toFixed(2)}°C yearly avg</div>
                <div className="text-xs text-ink-500">
                  growing season days {SEASON_START_DAY}-{SEASON_END_DAY}
                  {' · '}
                  range {stats.coldest.toFixed(1)} to {stats.warmest.toFixed(1)}°C
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 mb-4">
          <label className="block">
            <span className="text-sm font-medium text-ink-700">Upload CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onFileChange}
              disabled={pending}
              className="block w-full mt-1 text-sm text-ink-700
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border file:border-forest-700
                file:text-sm file:font-medium
                file:bg-forest-50 file:text-forest-800
                hover:file:bg-forest-100
                file:cursor-pointer cursor-pointer
                disabled:opacity-50"
            />
          </label>
          {pending && <div className="text-sm text-ink-500 italic">Parsing…</div>}
          {error && (
            <div className="text-sm text-terra-700 bg-terra-300/15 border border-terra-300 rounded p-3">
              <strong>Couldn't parse CSV:</strong> {error}
              <div className="text-xs mt-1 text-terra-800">
                Expected either daily format (<code className="font-mono bg-parchment-200/50 px-1 rounded">day,avg,min,max</code> header)
                or hourly raw export from <code className="font-mono bg-parchment-200/50 px-1 rounded">/debug exptempplot</code>.
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            className="btn-secondary !py-1.5 !px-3 !text-xs"
            onClick={() => downloadClimateCSV(climate, 'climate.csv')}
          >
            ⬇ Download current as CSV
          </button>
          {source === 'custom' && (
            <button
              type="button"
              className="btn-secondary !py-1.5 !px-3 !text-xs !text-amber-800 !border-amber-400 hover:!bg-amber-100"
              onClick={() => { if (confirm('Clear your uploaded CSV and revert to the bundled climate?')) reset(); }}
            >
              Reset to bundled
            </button>
          )}
        </div>

        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-forest-700 hover:text-forest-900 font-medium">
            Accepted CSV formats
          </summary>
          <div className="mt-3 pl-4 border-l-2 border-parchment-300/60 text-ink-700 space-y-3">
            <div>
              <div className="text-xs font-medium text-ink-800 mb-1">Daily aggregated (recommended)</div>
              <pre className="bg-parchment-200/40 border border-parchment-300/60 p-2 rounded text-xs font-mono overflow-x-auto">{`day,avg,min,max
1,-17.01,-25.48,-8.45
2,-18.17,-27.55,-8.88
…
${daysPerMonth * 12},-19.92,-29.92,-10.40`}</pre>
              <p className="text-xs text-ink-500 mt-1">One row per game day. Easy to author by hand or edit a download. The current world has {daysPerMonth * 12} days/year (= {daysPerMonth} days × 12 months).</p>
            </div>
            <div>
              <div className="text-xs font-medium text-ink-800 mb-1">Hourly raw (auto-aggregated)</div>
              <pre className="bg-parchment-200/40 border border-parchment-300/60 p-2 rounded text-xs font-mono overflow-x-auto">{`1.1.1386 0:00;-21.741037
1.1.1386 1:00;-21.819
…`}</pre>
              <p className="text-xs text-ink-500 mt-1">
                Direct paste from <code className="font-mono">/debug exptempplot</code>.
                Lines: <code className="font-mono">D.M.YYYY H:MM;TEMPERATURE</code>, semicolon-delimited.
                Auto-aggregated to daily min/avg/max using {daysPerMonth} days/month.
              </p>
            </div>
          </div>
        </details>

        <div className="mt-4 text-xs text-ink-500 italic">
          Replacing the climate also retunes the growing-season window, frost analysis,
          all rankings, and every chart. Your uploaded CSV stays in your browser's
          localStorage and is not sent anywhere.
        </div>
      </CardBody>
    </Card>
  );
}

// Compact slider with current value chip. Used by the score-tuning card.
function WeightSlider({ label, hint, value, onChange, min = 0, max = 3, step = 0.1 }) {
  const v = value ?? 1.0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm text-ink-800">{label}</label>
        <span className={`tabular text-sm font-medium ${
          v === 1 ? 'text-ink-600' : v < 1 ? 'text-amber-700' : 'text-forest-800'
        }`}>{v.toFixed(1)}×</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-1 accent-forest-700"
      />
      {hint && <p className="text-xs text-ink-500 mt-0.5 italic leading-tight">{hint}</p>}
    </div>
  );
}

// === World config section ===
//
// Three input modes: paste full serverconfig.json, upload the file, or fill
// in the most important fields manually. All three converge on the same
// settings.worldConfig object, which feeds climate projection and the
// non-vanilla banner on Scouting.

function WorldConfigSection({ worldConfig, onChange }) {
  const [pasteText, setPasteText] = useState('');
  const [parseMsg, setParseMsg] = useState(null);
  const cfg = worldConfig || defaultWorldConfig();
  const nonVanilla = diffFromVanilla(cfg);

  function applyParse(text) {
    const result = parseWorldConfig(text);
    if (result.error) {
      setParseMsg({ kind: 'error', text: `Couldn't parse: ${result.error}` });
      return;
    }
    if (result.foundKeys.length === 0) {
      setParseMsg({ kind: 'warn', text: 'Parsed OK, but no recognized keys found.' });
      return;
    }
    onChange(result.config);
    const summary = `Imported ${result.foundKeys.length} key${result.foundKeys.length === 1 ? '' : 's'}` +
      (result.unknownKeys.length ? `, ignored ${result.unknownKeys.length} unknown` : '') + '.';
    setParseMsg({ kind: 'ok', text: summary });
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = String(ev.target?.result || '');
      setPasteText(text);
      applyParse(text);
    };
    reader.onerror = () => setParseMsg({ kind: 'error', text: 'File read failed.' });
    reader.readAsText(file);
  }

  function resetToVanilla() {
    if (!confirm('Reset world config to vanilla defaults?')) return;
    onChange(defaultWorldConfig());
    setPasteText('');
    setParseMsg({ kind: 'ok', text: 'Reset to vanilla.' });
  }

  // Sort keys: climate first, then farming. Within each axis, vanilla
  // ordering matches the WORLD_CONFIG_KEYS spec.
  const climateKeys = Object.entries(WORLD_CONFIG_KEYS).filter(([, s]) => s.axis === 'climate');
  const farmingKeys = Object.entries(WORLD_CONFIG_KEYS).filter(([, s]) => s.axis === 'farming');

  return (
    <Card>
      <CardHeader
        eyebrow="Server compatibility"
        title="World config"
        subtitle="If your server isn't running vanilla settings, tell the app here. The Scouting projection and damage models adjust to match."
      />
      <CardBody>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Paste serverconfig.json</label>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={4}
                className="w-full text-xs font-mono px-2 py-1.5 border border-parchment-300/60 rounded bg-parchment-100/40"
                placeholder='Paste the whole file or just the WorldConfig dict...'
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  className="btn-secondary text-xs"
                  onClick={() => applyParse(pasteText)}
                  disabled={!pasteText.trim()}
                >
                  Import from paste
                </button>
                <button
                  className="text-xs text-ink-500 hover:text-forest-700 underline"
                  onClick={() => { setPasteText(''); setParseMsg(null); }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Or upload the file</label>
              <input
                type="file"
                accept=".json,application/json,text/plain"
                onChange={handleFile}
                className="text-xs w-full"
              />
              <p className="text-xs text-ink-500 italic mt-1 leading-tight">
                Look in <code className="font-mono">VintagestoryData/serverconfig.json</code> or your savegame folder. Fields not present default to vanilla.
              </p>
              <button
                className="text-xs mt-2 text-terra-700 hover:text-terra-800 underline"
                onClick={resetToVanilla}
              >
                Reset to vanilla
              </button>
            </div>
          </div>

          {parseMsg && (
            <div className={`text-sm rounded p-2 ${
              parseMsg.kind === 'ok' ? 'bg-forest-50/40 border border-forest-200/60 text-forest-800' :
              parseMsg.kind === 'warn' ? 'bg-amber-50/40 border border-amber-200/60 text-amber-800' :
              'bg-red-50/40 border border-red-200/60 text-red-800'
            }`}>
              {parseMsg.text}
            </div>
          )}

          <div>
            <div className="section-eyebrow text-forest-800 mb-2">
              Climate axis {nonVanilla.filter(d => d.axis === 'climate').length > 0 && (
                <span className="ml-2 text-amber-700">({nonVanilla.filter(d => d.axis === 'climate').length} non-vanilla)</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {climateKeys.map(([key, spec]) => (
                <ConfigField
                  key={key}
                  configKey={key}
                  spec={spec}
                  value={cfg[key]}
                  onChange={v => onChange({ ...cfg, [key]: v })}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="section-eyebrow text-forest-800 mb-2">
              Farming axis {nonVanilla.filter(d => d.axis === 'farming').length > 0 && (
                <span className="ml-2 text-amber-700">({nonVanilla.filter(d => d.axis === 'farming').length} non-vanilla)</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {farmingKeys.map(([key, spec]) => (
                <ConfigField
                  key={key}
                  configKey={key}
                  spec={spec}
                  value={cfg[key]}
                  onChange={v => onChange({ ...cfg, [key]: v })}
                />
              ))}
            </div>
          </div>

          {nonVanilla.length === 0 && (
            <p className="text-xs text-ink-500 italic">All vanilla. Nothing else to do.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function ConfigField({ configKey, spec, value, onChange }) {
  const isNonVanilla = value !== spec.default;
  const inputClass = `w-full text-sm tabular px-2 py-1 border rounded bg-parchment-100/40 ${
    isNonVanilla ? 'border-amber-400/60' : 'border-parchment-300/60'
  }`;

  let input;
  if (spec.type === 'bool') {
    input = (
      <Toggle
        checked={!!value}
        onChange={onChange}
      />
    );
  } else if (configKey === 'worldClimate') {
    input = (
      <select
        value={value ?? spec.default}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      >
        <option value="realistic">realistic</option>
        <option value="patchy">patchy</option>
        <option value="lockedTo[0]">lockedTo[0]</option>
        <option value="lockedTo[0.5]">lockedTo[0.5]</option>
        <option value="lockedTo[1]">lockedTo[1]</option>
      </select>
    );
  } else if (spec.type === 'int') {
    input = (
      <input
        type="number"
        value={value ?? spec.default}
        onChange={e => onChange(parseInt(e.target.value, 10) || spec.default)}
        className={inputClass}
      />
    );
  } else if (spec.type === 'float') {
    input = (
      <input
        type="number"
        step="0.05"
        value={value ?? spec.default}
        onChange={e => onChange(parseFloat(e.target.value) || spec.default)}
        className={inputClass}
      />
    );
  } else {
    input = (
      <input
        type="text"
        value={value ?? spec.default}
        onChange={e => onChange(e.target.value)}
        className={inputClass}
      />
    );
  }

  return (
    <div>
      <label className="block text-xs font-medium text-ink-700 mb-1 flex items-baseline gap-1.5">
        <code className="font-mono">{configKey}</code>
        {isNonVanilla && (
          <span className="text-[10px] text-amber-700 italic">vanilla: {String(spec.default)}</span>
        )}
      </label>
      {input}
      <p className="text-[11px] text-ink-500 italic mt-0.5 leading-tight">{spec.hint}</p>
    </div>
  );
}

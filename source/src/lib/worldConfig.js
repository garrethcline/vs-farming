// World config parser. Handles three input shapes:
//
//   1. A full serverconfig.json object (wraps a WorldConfig dict)
//   2. The WorldConfig dict alone (string -> string)
//   3. A flat object with the keys we care about (manual entry)
//
// VS stores world config as string -> string in serverconfig.json. We
// coerce values to the right types here.

// Keys we read, with type and default. The defaults match VS vanilla
// behavior so an unset key is equivalent to "vanilla."
//
// Climate-axis keys (used by climate projection):
//   polarEquatorDistance: distance in blocks from equator to pole. Default
//     50000. The temperature-per-latitude slope scales as 50000 / value.
//   worldClimate: "realistic" | "patchy" | "lockedTo[Lat]". Only "realistic"
//     supports our projection; anything else disables it.
//   globalTemperature: flat temperature multiplier on worldgen baseline.
//     Default "1". 1.05 makes the world ~5% warmer baseline; 0.9 cooler.
//   globalPrecipitation: rainfall multiplier. Default "1".
//   seasons: "spawn" (cycles) | "off" | "winter" | "summer" etc.
//
// Farming-axis keys (already in our Settings, surfaced here for convenience):
//   cropGrowthRateMul: speeds up all crop growth. Default 1.
//   harshWinters: damage system on/off. Default true.
//   allowCropDeath: same. Default true.
//   processCrops: server-wide kill switch. Default true.
//   allowUndergroundFarming: lets you farm in caves. Default false.
//   daysPerMonth: server calendar.

export const WORLD_CONFIG_KEYS = {
  // Climate axis
  polarEquatorDistance:      { type: 'int',    default: 50000, axis: 'climate', label: 'Polar to equator distance', hint: 'Blocks. Smaller = faster latitude shifts in temperature.' },
  worldClimate:              { type: 'string', default: 'realistic', axis: 'climate', label: 'World climate model', hint: '"realistic" supports projection; "patchy" or other values disable it.' },
  globalTemperature:         { type: 'float',  default: 1.0,   axis: 'climate', label: 'Global temperature multiplier', hint: 'Default 1. Higher = warmer baseline everywhere.' },
  globalPrecipitation:       { type: 'float',  default: 1.0,   axis: 'climate', label: 'Global precipitation multiplier', hint: 'Default 1. Higher = wetter baseline.' },
  seasons:                   { type: 'string', default: 'spawn', axis: 'climate', label: 'Seasons mode', hint: '"spawn" cycles normally. "off" disables seasons.' },

  // Farming axis
  cropGrowthRateMul:         { type: 'float',  default: 1.0,   axis: 'farming', label: 'Crop growth rate multiplier', hint: 'Default 1. >1 speeds growth; <1 slows.' },
  harshWinters:              { type: 'bool',   default: true,  axis: 'farming', label: 'Harsh winters', hint: 'When false, crops take no cold or heat damage.' },
  allowCropDeath:            { type: 'bool',   default: true,  axis: 'farming', label: 'Allow crop death', hint: 'When false, accumulated damage is reset every tick.' },
  processCrops:              { type: 'bool',   default: true,  axis: 'farming', label: 'Process crops', hint: 'Server-wide kill switch for crop growth ticks.' },
  allowUndergroundFarming:   { type: 'bool',   default: false, axis: 'farming', label: 'Allow underground farming', hint: 'When true, torches/lanterns count as light for crops.' },
  daysPerMonth:              { type: 'int',    default: 9,     axis: 'farming', label: 'Days per month', hint: 'Calendar setting; the rest of the app already pulls this from your top-level setting.' },
};

const COERCE = {
  string: v => String(v),
  int:    v => parseInt(v, 10),
  float:  v => parseFloat(v),
  bool:   v => {
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  },
};

// Coerce one raw value into the configured type, falling back to default
// on garbage input. Returns { value, valid }.
function coerce(rawValue, spec) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: spec.default, valid: false };
  }
  try {
    const v = COERCE[spec.type](rawValue);
    if (spec.type === 'int' || spec.type === 'float') {
      if (Number.isNaN(v)) return { value: spec.default, valid: false };
    }
    return { value: v, valid: true };
  } catch {
    return { value: spec.default, valid: false };
  }
}

// Default world config object: every key set to its vanilla default.
export function defaultWorldConfig() {
  const out = {};
  for (const [key, spec] of Object.entries(WORLD_CONFIG_KEYS)) {
    out[key] = spec.default;
  }
  return out;
}

// Try to extract a WorldConfig dict from a parsed JSON object. Handles
// the three input shapes described at the top.
function findWorldConfigDict(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  // Shape 1: full serverconfig.json with a WorldConfig field
  // (case-insensitive lookup since the field name varies by VS version)
  for (const k of Object.keys(parsed)) {
    if (k.toLowerCase() === 'worldconfig' || k.toLowerCase() === 'worldconfiguration') {
      const v = parsed[k];
      if (v && typeof v === 'object') return v;
    }
  }
  // Shape 2 or 3: assume parsed itself is the dict if it has any
  // recognizable key
  for (const key of Object.keys(WORLD_CONFIG_KEYS)) {
    if (key in parsed) return parsed;
  }
  return null;
}

// Parse text input (raw JSON, or even a paste of the relevant excerpt).
// Returns { config, foundKeys, unknownKeys, error } where:
//   config       = full WORLD_CONFIG defaults, with parsed values overlaid
//   foundKeys    = which keys we actually pulled from the input
//   unknownKeys  = keys present in input that aren't in WORLD_CONFIG_KEYS
//                  (informational, not an error)
//   error        = string if JSON couldn't be parsed at all
export function parseWorldConfig(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { config: defaultWorldConfig(), foundKeys: [], unknownKeys: [], error: null };

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { config: defaultWorldConfig(), foundKeys: [], unknownKeys: [], error: err.message };
  }

  const dict = findWorldConfigDict(parsed);
  if (!dict) {
    return {
      config: defaultWorldConfig(),
      foundKeys: [],
      unknownKeys: [],
      error: 'Could not find a WorldConfig section. Paste either the full serverconfig.json or just the WorldConfig dict.',
    };
  }

  const config = defaultWorldConfig();
  const foundKeys = [];
  const unknownKeys = [];

  for (const [key, raw] of Object.entries(dict)) {
    const spec = WORLD_CONFIG_KEYS[key];
    if (!spec) {
      unknownKeys.push(key);
      continue;
    }
    const { value, valid } = coerce(raw, spec);
    if (valid) {
      config[key] = value;
      foundKeys.push(key);
    }
  }

  return { config, foundKeys, unknownKeys, error: null };
}

// Compare a parsed config against vanilla defaults. Returns the keys
// that differ. Useful for surfacing "your server is non-vanilla in N
// ways" in the UI.
export function diffFromVanilla(config) {
  const out = [];
  for (const [key, spec] of Object.entries(WORLD_CONFIG_KEYS)) {
    if (config[key] !== spec.default) {
      out.push({ key, value: config[key], default: spec.default, ...spec });
    }
  }
  return out;
}

// Whether this config is compatible with our climate projection model.
// The projection assumes "realistic" climate; other modes break the
// latitude-to-temperature mapping.
export function isProjectionSupported(config) {
  return config.worldClimate === 'realistic';
}

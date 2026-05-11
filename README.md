# Vintage Story Farming Dashboard

A static web app that plans crops, rotations, mushroom troughs, greenhouses, bees, animals, and forager routes for a Vintage Story playthrough. Built around mechanics traced from the survival mod source and the engine's decompiled `ChunkIlluminator`, so the numbers match the game rather than the wiki.

The companion spreadsheet (`farming_dashboard.xlsx`) carries the same data model in a Google-Sheets-compatible workbook for offline planning.

![Dashboard overview](screenshots/dashboard.png)

---

## Open the app

GitHub Pages serves this repo at the URL shown in your repo's Pages settings. The entry point is `index.html`. Open it directly, or hit the Pages URL in any browser.

Locally:

```
# any static server works. Two easy ones:
python3 -m http.server 8080      # then open http://localhost:8080
npx serve .                       # alternative
```

The single-file `index.html` already has the bundled climate inlined, so opening the file directly from disk (`file://...`) also works without a server. The hosted version uses the same path but also exposes `climate.csv` next to it for anyone who wants to grab the raw climate data.

---

## What you get

### Plantability across the whole year

Every crop scored against every day of the game year. Click a row for the per-day breakdown. The plant-day numbers in each cell are the earliest day of that month you can plant without risking frost death or running into autumn freeze before harvest.

![Calendar plantability matrix](screenshots/calendar.png)

### A scored decision helper

Each crop run through a scoring pipeline: productivity, frost safety, rotation factor, follow-up potential, speed bonus, category weights. Weights are tunable. Sorts top picks for "what should I plant right now", with the dangerous ones flagged separately.

![Decision helper page](screenshots/decision.png)

### Multi-tier vertical farm with cell-by-cell light verification

A 14×14×14 greenhouse holding 1071 farmland blocks across 7 tiers. The 18-shaft hex pattern keeps every cell within manhattan 3 of a sky column, so every farmland tile reads sunlight 19 or higher and grows at 100% speed. Source-cited formula, source-cited propagation rule, and a per-cell grid so you can see the actual distance map.

![Greenhouse multi-tier design](screenshots/greenhouse.png)

### Climate read straight from `/debug exptempplot`

The annual temperature curve, growing-season bounds, and crop-specific overlay come from your server's actual recorded temperatures. Frost analysis shows the last hard frost in spring and the first hard frost in autumn.

![Climate annual cycle](screenshots/climate.png)

### Mushroom throughput with the NDL mod

The NDL Mushroom Growth mod adds craftable troughs that grow mushrooms anywhere. Climate-independent, NPK-independent, light-independent. The page works through grow times per soil tier and throughput per real hour, with all 45 species listed.

![Mushrooms throughput page](screenshots/mushrooms.png)

The full screenshot set is in [screenshots/](screenshots/). 21 pages total, one PNG per tab.

---

## What's inside

```
.
├── index.html                 entry point, ~1 KB Vite shell
├── assets/                    bundled JS (~360 KB gzip) and CSS (~10 KB gzip)
├── climate.csv                240-day climate from /debug exptempplot
├── farming_dashboard.xlsx     spreadsheet equivalent (13 tabs, 2300+ formulas)
├── screenshots/               21 PNGs, one per tab, plus a README index
├── source/                    full source tree for transparency / forks
│   ├── src/                   React app
│   ├── public/                static assets
│   ├── scripts/capture.mjs    puppeteer screenshot script (regenerates the gallery)
│   ├── reference/             decompiled C# files this app's math was traced from
│   ├── package.json
│   └── vite.config.js
├── .nojekyll                  tells GitHub Pages not to Jekyll-process anything
└── README.md                  this file
```

---

## Pages in the app

| Tab | What it does |
|---|---|
| Dashboard | Top picks for today, frost-safety scores, warnings, the at-a-glance summary |
| Decision | Per-crop scoring with adjustable weights, follow-up chain analysis |
| Calendar | Plantability matrix (every crop × every day of year), per-day risk |
| Climate | Annual temperature curve with crop overlays, plantable-window per crop |
| Crops | Full crop table with cold/heat thresholds, yields, satiety |
| Plots | Per-plot harvest math, soil regen, follow-up suggestions |
| Simulator | Stage-by-stage growth projection for a specific (crop, date, soil) |
| Greenhouse | 14×14×14 multi-tier farm design with cell-by-cell light math |
| Mushrooms (beta) | NDL Mushroom Growth mod throughput and soil-tier grow times |
| Fertilizers | Slow-release pool dynamics, perk modifiers, application math |
| Bees | Skep production, scan radius, climate gates |
| Berries | Cultivated bush yields by climate and tier |
| Fruit Trees | Tree placement, climate windows, fruit yield |
| Animals | Chicken/sheep/cow/goat/pig productivity |
| Forager (beta) | Wild plant routes, mushroom spawns |
| Scouting (beta) | Where to look for what biome features |
| Estimator (beta) | Pre-server climate projection |
| SC Crafting (beta) | Specialized Classes crafting paths |
| Reference | Static lookup tables and conversions |
| Settings | Days per month, default soil, location, player class |
| Timer | In-game time calculator (real-time to game-time bridge) |

The app reads its climate from `climate.csv` (240 days, daily avg/min/max). The default bundled climate is from a specific server's `/debug exptempplot` output; you can replace it with your own CSV via the Settings tab.

---

## Source verification

Each game mechanic in the app is traced to a specific source location. The traced files are in `source/reference/`. Highlights:

| Mechanic | Source |
|---|---|
| Crop growth-rate vs nutrient | `BESoilNutrition.GetGrowthRate` (strict-greater thresholds) |
| Cold/heat damage accumulator | `BEFarmland.updateCropDamage` (leaky bucket, death at 48h) |
| Per-stage random ±10% | `BEFarmland` line 192 (`stageHours *= 0.9 + 0.2 * rand`) |
| Light vs growth speed | `BlockEntityFastForwardGrowth` line 89 |
| Light propagation (6-face manhattan) | `ChunkIlluminator.SpreadSunlightAt` (decompiled from `VintagestoryLib.dll`) |
| Moisture range | `BESoilNutrition.GetGrowthRate` moistFactor |
| Greenhouse +5°C bonus | `BlockEntityFastForwardGrowth` (decompiled) |
| Mushroom grow times | NDL Mushroom Growth mod v2.0.2 `.cctor` of `sporetroughBE` + post-2.0.2 changelog |
| Specialized Classes perks | SC mod DLL (decompiled, per-class) |

Wiki claims that aren't yet source-verified are marked inline in the relevant page.

---

## Spreadsheet

`farming_dashboard.xlsx` is the same data model in a Google-Sheets-compatible workbook. 13 tabs (Readme, Settings, Players, Crops, Fertilizers, Plot Templates, Calendar, Plots, Inventory, Rotation, Yield Estimator, Overview, Activity Log). 2,300+ formulas, 10 charts, named ranges throughout. Useful for offline planning or for sharing a planning state across a group on Google Drive.

---

## Building from source

```
cd source
npm install
npm run dev               # local dev server on http://localhost:5173
npm run build             # production build into source/dist
```

For a single-file build that opens directly from disk:

```
npx vite build --config vite.config.singlefile.js
# produces source/dist-single/index.html as a standalone artifact
```

To deploy a fresh build to this repo's root, replace `index.html`, `assets/`, and `climate.csv` with the new build output.

---

## Regenerating screenshots

The capture script at `source/scripts/capture.mjs` runs puppeteer against a local copy of the build and saves PNGs into `screenshots/`. From a fresh checkout:

```
cd source
npm install
npx vite build
node scripts/capture.mjs
# optional, recommended for repo size:
cd ../screenshots
for f in *.png; do pngquant --quality=70-90 --force --output "$f" "$f"; done
```

The script's `CHROME` constant points at the playwright-cached chromium location. If that path doesn't exist on your machine, edit it to point at any Chrome or Chromium binary. The script seeds `localStorage` to enable beta tabs before navigation, so all 21 captures are unique even though the beta pages are off by default.

---

## Replacing the bundled climate

The runtime tries `fetch('./climate.csv')` first, then falls back to a build-time copy embedded in the JS bundle. To use your own server's climate:

1. Run `/debug exptempplot` in-game, save the output CSV.
2. Drop your CSV at `climate.csv` (replace the existing one), keeping the daily `day,avg,min,max` format.
3. Re-run `npm run build` and ship the new bundle. Both runtime fetch and embedded fallback will then match your server.

Alternatively, upload a custom CSV through the app's Settings tab. That stores it in `localStorage` and takes precedence over both the fetched and embedded climates for your browser only.

---

## Known limitations

- The plantability calendar and decision scoring assume a typical surface plot (sea level or above, sky-exposed). Underground/cellar adjustments are made where the game source has them, but exotic placements may still need a per-tile override.
- Specialized Classes mod stats are baked in from v2.2.2. Other versions may differ.
- Mushroom grow times for the post-2.0.2 patch are from changelog text, not yet re-traced against the new mod DLL.
- Score weights and category boosts on the Decision tab are heuristics, not game rules. They're a planning aid, not a simulation.

---

## License

The app, spreadsheet, and source layout in this repo are personal-use material for a Vintage Story playthrough. The decompiled C# files in `source/reference/` and the embedded mod data are property of their respective authors (Anego Studios for vanilla, NDL for the mushroom mod, etc.). Inspect, modify, and share freely for non-commercial use.

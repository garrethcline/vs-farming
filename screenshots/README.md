# Screenshots

21 page captures, one per app tab. Generated at 1440px viewport, captured as full-page (the entire scroll height), then compressed with pngquant `--quality=70-90`.

## Included

| File | Tab | Approx height |
|---|---|---|
| `dashboard.png` | Dashboard, the at-a-glance summary | 3,418 px |
| `decision.png` | Decision Helper, ranked crop list with score breakdowns | 7,106 px |
| `plots.png` | Plots, per-plot harvest math (empty state) | 1,771 px |
| `calendar.png` | Calendar, plantability matrix | 2,093 px |
| `crops.png` | Crops, sortable full table | 3,434 px |
| `berries.png` | Berries, cultivated bush yields | 4,900 px |
| `fruittrees.png` | Fruit Trees, placement and windows | 4,411 px |
| `animals.png` | Animals, husbandry math | 6,015 px |
| `bees.png` | Bees, skep production and scan radius | 3,725 px |
| `greenhouse.png` | Greenhouse, multi-tier farm + LightMathCard | 6,749 px |
| `fertilizers.png` | Fertilizers, slow-release pool dynamics | 2,732 px |
| `climate.png` | Climate, annual temperature curve | 1,892 px |
| `simulator.png` | Simulator, stage-by-stage projection | 2,283 px |
| `timer.png` | Timer, real-time to game-time bridge | 2,115 px |
| `settings.png` | Settings, world config + experimental features | 5,461 px |
| `reference.png` | Reference, static lookup tables | 6,437 px |
| `mushrooms.png` | Mushrooms (beta), NDL trough throughput | beta |
| `forager.png` | Forager (beta), wild plant routes | beta |
| `scouting.png` | Scouting (beta), biome lookup | beta |
| `estimator.png` | Climate Estimator (beta) | beta |
| `sccrafting.png` | SC Crafting (beta) | beta |

## Regenerating

The capture script is at `source/scripts/capture.mjs`. It uses puppeteer to drive a headless Chromium, serves the build over a local HTTP server, walks every tab, and saves into this directory.

```
cd source
npm install
npx vite build                     # populates source/dist/
# point puppeteer at any chrome binary you have, edit CHROME at the
# top of capture.mjs if /opt/pw-browsers/... doesn't exist on your system
node scripts/capture.mjs
# re-compress (optional but recommended for repo size):
cd ../screenshots
for f in *.png; do pngquant --quality=70-90 --force --output "$f" "$f"; done
```

Some pages won't have meaningful content without local state, in particular `plots.png` (empty until you add plots). If you want a populated Plots screenshot, add a few plots in the app first, then re-run the capture script.

## Capture quirks worth knowing

- Beta tabs (`mushrooms`, `forager`, `scouting`, `estimator`, `sccrafting`) require `settings.experimentalFeatures` flags to be set. The capture script seeds these into localStorage and reloads before navigating, so they render correctly. If you regenerate manually without that step, you'll get duplicate copies of `decision.png` (which is the fallback when a beta page is requested but its flag is off).

- Greenhouse and Decision pages are tall (~7k px). Full-page capture covers the whole scroll height in one PNG. View at native size for legibility.

- The capture script enables every animation-on-scroll component by scrolling through the full page height in 8 steps before screenshotting, so cards that use Framer Motion's Reveal wrapper end up fully rendered. If a future page uses a different lazy-render trigger, you may need to extend the scroll loop in the script.

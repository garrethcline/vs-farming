// Headless capture for the GH Pages build.
// Uses the playwright-cached chromium at /opt/pw-browsers/ and serves
// /home/claude/work/vs-farming-dashboard/ over a local http server.
//
// Output: one PNG per tab into screenshots/.

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PKG_DIR = '/home/claude/work/vs-farming-dashboard';
const OUT_DIR = `${PKG_DIR}/screenshots`;
const PORT = 8765;
const BASE = `http://localhost:${PORT}`;

// All tabs from App.jsx PAGES + BETA_PAGES merged
const TABS = [
  'dashboard',
  'decision',
  'plots',
  'calendar',
  'crops',
  'berries',
  'fruittrees',
  'animals',
  'bees',
  'greenhouse',
  'fertilizers',
  'climate',
  'simulator',
  'timer',
  'settings',
  'reference',
  // beta pages, may require enabling in settings first
  'scouting',
  'estimator',
  'sccrafting',
  'mushrooms',
  'forager',
];

mkdirSync(OUT_DIR, { recursive: true });
if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}`);
  process.exit(1);
}

// 1. Start a python http server
console.log('Starting http server...');
const server = spawn('python3', ['-m', 'http.server', String(PORT)], {
  cwd: PKG_DIR,
  stdio: ['ignore', 'ignore', 'ignore'],
});
await new Promise(r => setTimeout(r, 1500));

// 2. Launch chromium
console.log('Launching headless chromium...');
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox',
    '--disable-gpu', '--disable-dev-shm-usage',
    '--font-render-hinting=none',
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  // Pre-enable beta tabs by seeding settings.experimentalFeatures into
  // localStorage before navigation. The app reads from key
  // 'vs-farming-dashboard-v1' inside useSettings, and the schema nests
  // user-facing settings under a `settings` key. Must reload after
  // seeding so the React state picks up the new flags before we navigate
  // to beta hashes.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const key = 'vs-farming-dashboard-v1';
    let s = {};
    try { s = JSON.parse(localStorage.getItem(key)) || {}; } catch {}
    s.settings = s.settings || {};
    s.settings.experimentalFeatures = {
      climateScouting: true, climateEstimator: true,
      scCrafting: true, forager: true, mushrooms: true,
    };
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.reload({ waitUntil: 'networkidle0' });

  for (const tab of TABS) {
    process.stdout.write(`  capturing ${tab}... `);
    await page.goto(`${BASE}/#${tab}`, { waitUntil: 'networkidle0', timeout: 15000 });
    // Let any entrance animations settle and charts render
    await new Promise(r => setTimeout(r, 1200));
    // Some pages animate on scroll-into-view via Framer Motion's Reveal.
    // Scroll all sections into view, then back to top, to trigger them.
    await page.evaluate(async () => {
      const h = document.body.scrollHeight;
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        window.scrollTo(0, (h * i) / steps);
        await new Promise(r => setTimeout(r, 150));
      }
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 400));
    });
    // fullPage: true captures the entire scrollable height
    const out = `${OUT_DIR}/${tab}.png`;
    await page.screenshot({ path: out, fullPage: true });
    process.stdout.write(`OK\n`);
  }
} finally {
  await browser.close();
  server.kill();
}

console.log('Done.');

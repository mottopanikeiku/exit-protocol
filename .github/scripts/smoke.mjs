// Browser smoke test for the deployed single-file build.
// Opens index.html from file:// (as the README promises), starts a campaign run,
// plays a few seconds and pauses. Fails on any script error, console error, or
// request that leaves the page (the README says the game makes no network requests).
// Usage: node .github/scripts/smoke.mjs   (needs the `playwright` package and its Chromium)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pageUrl = pathToFileURL(fileURLToPath(new URL('../../index.html', import.meta.url))).href;
const problems = [];

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console error: ${m.text()}`); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url === pageUrl || /^(data|blob):/.test(url)) return route.continue();
    problems.push(`network request: ${url}`);
    return route.abort();
  });

  const step = async (name, fn) => {
    try { await fn(); console.log(`ok   ${name}`); } catch (e) { problems.push(`${name}: ${e.message.split('\n')[0]}`); throw e; }
  };

  await page.goto(pageUrl);
  await step('title screen shows PRESS START', () => page.locator('#start').waitFor({ state: 'visible', timeout: 15000 }));
  await step('PRESS START opens the briefing call', async () => {
    await page.locator('#start').click();
    await page.locator('#phase-panel').waitFor({ state: 'visible', timeout: 15000 });
  });
  await step('Escape skips the call and starts the run', async () => {
    await page.keyboard.press('Escape');
    await page.locator('#hud').waitFor({ state: 'visible', timeout: 15000 });
  });
  await step('run survives 4 s of lane, jump and duck input', async () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'Space', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(500);
    }
  });
  await step('P pauses the run', async () => {
    await page.keyboard.press('KeyP');
    await page.locator('#modal-title', { hasText: 'PAUSED.' }).waitFor({ state: 'visible', timeout: 5000 });
  });
} catch {
  // The failing step is already recorded in `problems`.
} finally {
  await browser.close();
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nsmoke test passed');

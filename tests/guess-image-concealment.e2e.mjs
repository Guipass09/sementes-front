import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5194';
const image = color => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${color}"/></svg>`)}`;
const red = image('#ff0000');
const blue = image('#0000ff');
const game = {
  id: 90002, title: 'Concealment fixture', description: '', sessions_count: 2,
  created_by: { id: 7, name: 'Professional fixture', role: 'professional' },
  items: [1, 2].map(id => ({ id, position: id - 1, main_url: id === 1 ? red : blue, correct_url: red, wrong_url: blue })),
};
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });

async function samePixels(page, first, second) {
  if (first.equals(second)) return true;
  return page.evaluate(async ([first, second]) => {
    const pixels = async value => {
      const img = new Image();
      img.src = `data:image/png;base64,${value}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const context = canvas.getContext('2d');
      context.drawImage(img, 0, 0);
      return { width: img.width, height: img.height, data: context.getImageData(0, 0, img.width, img.height).data };
    };
    const a = await pixels(first), b = await pixels(second);
    // Fractional-DPR compositing can round a channel by one level on repaint.
    return a.width === b.width && a.height === b.height && a.data.every((value, index) => Math.abs(value - b.data[index]) <= 1);
  }, [first.toString('base64'), second.toString('base64')]);
}

async function open(config) {
  const context = await browser.newContext({ viewport: { width: config.width, height: 900 }, deviceScaleFactor: config.dpr, reducedMotion: 'reduce' });
  const user = { id: 7, name: 'Fixture', email: 'fixture@example.test', role: config.patient ? 'user' : 'professional', access: { jogos: true, atividades: true, horarios: true, relatorios: true }, blocked: false };
  await context.addInitScript(user => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', 'concealment-fixture');
  }, user);
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/api/me' ? user : path.endsWith('/guess-image-games/90002') ? game : { data: [] } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/jogos/acerte-imagem/90002${config.patient ? '?session=1&session_role=user&session_id=90003' : ''}`);
  const img = page.locator('img[alt="Imagem principal"]');
  await img.waitFor({ state: 'attached' });
  await img.evaluate(img => img.decode());
  await page.evaluate(() => document.fonts.ready);
  // Unsupported backdrop filters must never make the answer visible.
  await page.addStyleTag({ content: '* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }' });
  const stage = img.locator('..');
  const tiles = stage.locator(':scope > div[aria-hidden="true"] > div');
  return { context, page, img, stage, tiles, errors };
}

try {
  for (const config of [{ width: 1440, dpr: 1 }, { width: 390, dpr: 3 }, { width: 1365, dpr: 1.25 }]) {
    const { context, page, img, stage, tiles, errors } = await open(config);
    try {
      assert.equal(await img.evaluate(img => getComputedStyle(img).visibility), 'hidden');
      assert.equal(await tiles.count(), 120);
      // Before starting, opposite answers must produce exactly the same screen pixels.
      const hiddenRed = await stage.screenshot({ animations: 'disabled' });
      await img.evaluate(async (img, url) => { img.src = url; await img.decode(); }, blue);
      const hiddenBlue = await stage.screenshot({ animations: 'disabled' });
      assert.ok(await samePixels(page, hiddenRed, hiddenBlue), 'Opaque cover must render identical pixels regardless of the underlying answer');
      await page.clock.install();
      await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
      await page.clock.runFor(1800);
      await page.getByRole('button', { name: 'Pare!', exact: true }).click();
      const revealed = await tiles.evaluateAll(tiles => tiles.filter(tile => tile.style.opacity === '0').length);
      assert.ok(revealed > 0 && revealed < 120);
      await page.clock.runFor(1800);
      assert.equal(await tiles.evaluateAll(tiles => tiles.filter(tile => tile.style.opacity === '0').length), revealed, 'Pause must freeze the reveal');
      const coveredIndex = await tiles.evaluateAll(tiles => tiles.findIndex((tile, index) => tile.style.opacity === '1' && index > 12 && index < 108 && index % 12 > 0 && index % 12 < 11));
      const coveredTile = tiles.nth(coveredIndex);
      await coveredTile.scrollIntoViewIfNeeded();
      const tileBox = await coveredTile.boundingBox();
      const tileClip = { x: tileBox.x + 3, y: tileBox.y + 3, width: tileBox.width - 6, height: tileBox.height - 6 };
      const coveredBlue = await page.screenshot({ clip: tileClip, animations: 'disabled' });
      await img.evaluate(async (img, url) => { img.src = url; await img.decode(); }, red);
      assert.ok(await samePixels(page, await page.screenshot({ clip: tileClip, animations: 'disabled' }), coveredBlue), 'Unrevealed pieces must stay opaque after pause');
      await page.locator('button').filter({ has: page.locator('svg.lucide-rotate-ccw') }).click();
      assert.equal(await img.evaluate(img => getComputedStyle(img).visibility), 'hidden');
      assert.equal(await tiles.evaluateAll(tiles => tiles.filter(tile => tile.style.opacity === '1').length), 120);
      await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
      await page.clock.runFor(42_500);
      assert.equal(await tiles.evaluateAll(tiles => tiles.filter(tile => tile.style.opacity === '0').length), 120, 'Reveal must finish all pieces');
      await page.getByText('Qual', { exact: false }).waitFor();
      await page.locator('button').filter({ has: page.locator(`img[src="${red}"]`) }).click();
      await page.clock.runFor(1100);
      assert.equal(await img.getAttribute('src'), blue);
      assert.equal(await img.evaluate(img => getComputedStyle(img).visibility), 'hidden', 'Next round must start fully concealed');
      assert.deepEqual(errors, []);
      console.log(`PASS opaque pixels, fractional edges, reveal, pause, reset, next round (${config.width}px DPR ${config.dpr})`);
    } finally { await context.close(); }
  }

  const { context, page, img, tiles, errors } = await open({ width: 390, dpr: 3, patient: true });
  try {
    assert.equal(await img.evaluate(img => getComputedStyle(img).visibility), 'hidden');
    await page.clock.install();
    const remote = event => page.evaluate(event => window.postMessage({ type: 'SESSION_GAME_EVENT', event }, window.location.origin), event);
    await remote({ kind: 'start', index: 0 });
    await page.clock.runFor(1500);
    await remote({ kind: 'pause', index: 0 });
    await page.clock.runFor(1);
    const revealed = await tiles.evaluateAll(tiles => tiles.filter(tile => tile.style.opacity === '0').length);
    assert.ok(revealed > 0 && revealed < 120);
    await page.clock.runFor(1500);
    assert.equal(await tiles.evaluateAll(tiles => tiles.filter(tile => tile.style.opacity === '0').length), revealed);
    await remote({ kind: 'reset' });
    await page.clock.runFor(1);
    assert.equal(await img.evaluate(img => getComputedStyle(img).visibility), 'hidden');
    assert.deepEqual(errors, []);
    console.log('PASS patient mobile uses opaque cover and remote start/pause/reset');
  } finally { await context.close(); }
} finally { await browser.close(); }

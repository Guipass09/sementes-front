import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5194';
const out = '.local/mouth-demos/browser'; await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const user = { id: 9001, role: 'professional', name: 'Fono Teste', email: 'fono@example.test', blocked: false, professional_subscription_required: false, access: { atividades: true, horarios: true, relatorios: true } };
async function contextFor(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.addInitScript(u => {
    localStorage.setItem('token', 'mouth-demo-fixture'); localStorage.setItem('user', JSON.stringify(u));
    window.__mouthAudio = { starts: 0, stops: 0, active: 0, energy: 0 };
    const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__mouthAudio.starts++; window.__mouthAudio.active++; this.__testActive = true;
      const data = this.buffer?.getChannelData(0) || [];
      window.__mouthAudio.energy = Math.max(window.__mouthAudio.energy, data.reduce((n, v) => n + v * v, 0));
      this.addEventListener('ended', () => { if (this.__testActive) { window.__mouthAudio.active--; this.__testActive = false; } });
      return start.apply(this, args);
    };
    AudioBufferSourceNode.prototype.stop = function (...args) { window.__mouthAudio.stops++; if (this.__testActive) { window.__mouthAudio.active--; this.__testActive = false; } return stop.apply(this, args); };
  }, user);
  await context.route('**/api/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/me' ? user : { data: [], unread_count: 0 } }));
  return context;
}
try {
  for (const width of process.env.MOUTH_LIVE_ONLY ? [] : [1440, 390, 320]) {
    const context = await contextFor(width, width === 1440 ? 1000 : 844);
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/profissional/jogos/boca-3d`);
    await page.locator('.mouth3d-canvas canvas').waitFor();
    await page.getByText('Demonstrações com som', { exact: true }).click();
    assert.equal(await page.getByLabel('Escolha a demonstração', { exact: true }).locator('option').count(), 10);
    const lift = page.locator('#tongue-lift'); await lift.focus(); await lift.press('ArrowRight');
    const manual = await lift.inputValue();
    await page.getByRole('button', { name: 'Reproduzir', exact: true }).click();
    await page.waitForFunction(() => window.__mouthAudio.starts > 0);
    assert.ok((await page.evaluate(() => window.__mouthAudio)).energy > 0);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await page.waitForFunction(() => window.__mouthAudio.active === 0);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForFunction(() => window.__mouthAudio.starts > 1);
    const slowResponse = page.waitForResponse(r => r.url().endsWith('/trill-slow.mp3'));
    await page.getByLabel('Velocidade', { exact: true }).selectOption('0.5');
    await slowResponse;
    await page.getByRole('button', { name: 'Silenciar demonstração', exact: true }).click();
    await page.waitForFunction(() => window.__mouthAudio.active === 0);
    await page.getByRole('button', { name: 'Ativar som da demonstração', exact: true }).click();
    await page.getByRole('button', { name: 'Parar', exact: true }).click();
    assert.equal(await lift.inputValue(), manual, 'Animation never overwrites the manual pose');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${out}/studio-${width}.png`, fullPage: true });
    // Non-looping example ends and releases all audio; manual presets remain available.
    await page.getByLabel('Escolha a demonstração', { exact: true }).selectOption('ra');
    await page.getByLabel('Velocidade', { exact: true }).selectOption('1');
    await page.getByRole('button', { name: 'Reproduzir', exact: true }).click();
    await page.getByRole('button', { name: 'Pausar', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reproduzir', exact: true }).waitFor({ timeout: 15000 });
    await page.waitForFunction(() => window.__mouthAudio.active === 0);
    await page.getByRole('button', { name: 'Língua elevada', exact: true }).click();
    assert.equal(await lift.inputValue(), '91');
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${width}px: real 3D, decoded audio, pause/resume, speed, mute, stop, completion, manual controls and layout`);
  }
  const live = await contextFor(1440, 900);
  const call = await live.newPage(), liveErrors = []; call.on('pageerror', e => liveErrors.push(e.message));
  await call.goto(`${base}/tests/fixtures/mouth-demo-live.html`);
  const durations = await call.evaluate(async () => {
    const manifest = await (await fetch('/audio/mouth3d/manifest.json')).json();
    const decoder = new OfflineAudioContext(1, 1, 44100);
    return Promise.all(manifest.examples.map(async entry => {
      const buffer = await decoder.decodeAudioData(await (await fetch(`/audio/mouth3d/${entry.file}`)).arrayBuffer());
      return { file: entry.file, expected: entry.durationMs / 1000, actual: buffer.duration };
    }));
  });
  assert.ok(durations.every(d => Math.abs(d.expected - d.actual) < .005), JSON.stringify(durations));
  const fono = call.locator('[data-role=professional]'), child = call.locator('[data-role=patient]');
  await call.getByRole('button', { name: 'Preparar áudio do paciente', exact: true }).click();
  await fono.getByRole('button', { name: 'Movimentos da boca', exact: true }).click();
  await fono.getByText('Demonstrações com som', { exact: true }).click();
  await fono.getByRole('button', { name: 'Reproduzir', exact: true }).click();
  await call.waitForFunction(() => window.__mouthAudio.active === 2);
  await fono.locator('.mouth3d-canvas[data-demonstration=trill]').waitFor({ timeout: 1200 });
  await child.locator('.mouth3d-canvas[data-demonstration=trill]').waitFor({ timeout: 1200 });
  await fono.getByRole('button', { name: 'Pausar', exact: true }).click();
  await call.waitForFunction(() => window.__mouthAudio.active === 0);
  await child.getByText(/Pausado/).waitFor();
  await fono.getByRole('button', { name: 'Continuar', exact: true }).click();
  await call.waitForFunction(() => window.__mouthAudio.active === 2);
  await call.evaluate(() => window.__mouthTest.delivery(false));
  await child.getByText('Demonstração interrompida', { exact: true }).waitFor({ timeout: 10000 });
  await call.waitForFunction(() => window.__mouthAudio.active === 1);
  await call.evaluate(() => window.__mouthTest.delivery(true));
  // Fresh heartbeats with the old play ID cannot resume the patient after a safety stop.
  await call.waitForTimeout(2100);
  assert.equal((await call.evaluate(() => window.__mouthAudio)).active, 1);
  await fono.getByRole('button', { name: 'Pausar', exact: true }).click();
  await fono.getByRole('button', { name: 'Continuar', exact: true }).click();
  await call.waitForFunction(() => window.__mouthAudio.active === 2);
  await call.screenshot({ path: `${out}/live.png`, fullPage: true });
  await call.evaluate(() => window.__mouthTest.close());
  await call.waitForFunction(() => window.__mouthAudio.active === 0);
  assert.deepEqual(await call.evaluate(() => window.__mouthTest.contexts()), ['running', 'running']);
  assert.deepEqual(liveErrors, []); await live.close();
  console.log('PASS live overlay: both audio outputs, shared pause/resume, lease expiry, no stale restart, close stops sound and microphone contexts survive');
} finally { await browser.close(); }

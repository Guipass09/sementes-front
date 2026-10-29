import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5194';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const output = '.local/complete-sentence';
await fs.mkdir(output, { recursive: true });
const professional = { id: 9001, role: 'professional', name: 'Fono Teste', email: 'fono@example.test', blocked: false, professional_subscription_required: false, access: { atividades: true, horarios: true, relatorios: true } };
const patient = { ...professional, id: 9002, role: 'user', name: 'Paciente Teste' };
const labels = ['sapo', 'banana', 'gato', 'bola', 'sol', 'casa', 'pato'];
const emojis = ['🐸', '🍌', '🐱', '⚽', '☀️', '🏠', '🦆'];
const image = i => `${base}/test-sentence/${i}.svg`;
const choices = labels.map((label, i) => ({ id: `figure-${i}`, label, path: `games/round-assets/9001/${i}.png`, url: image(i), correct: false }));
const gameFixture = () => ({ id: 701, kind: 'sentence', title: 'Vamos completar as frases', description: 'Uma palavra por vez.', background_color: '#ffffff', background_path: null, background_url: null, thumbnail: { url: image(0) }, created_by: professional, assigned_to: [], can_edit: true, rounds: [
  { id: 'r1', prompt: 'O ___ comeu a ___.', blank_answers: ['figure-0', 'figure-1'], choices },
  { id: 'r2', prompt: 'O ___ brincou com a ___.', blank_answers: ['figure-2', 'figure-3'], choices: choices.slice(0, 4) },
] });

async function contextFor(user, viewport, game = gameFixture()) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const state = { game, saves: [], completed: 0, uploads: 0, requests: [] };
  await context.addInitScript(user => { localStorage.setItem('token', 'sentence-test'); localStorage.setItem('user', JSON.stringify(user)); }, user);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.pathname.startsWith('/api/') || url.pathname === '/sanctum/csrf-cookie') return route.continue();
    return route.abort();
  });
  await context.route('**/test-sentence/*.svg', route => {
    const i = Number(new URL(route.request().url()).pathname.match(/(\d+)\.svg/)[1]);
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#fff"/><text x="300" y="300" text-anchor="middle" font-size="230">${emojis[i % emojis.length]}</text></svg>` });
  });
  await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await context.route('**/api/**', route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    state.requests.push(path);
    if (path === '/api/me') return route.fulfill({ json: user });
    if (path === '/api/round-game-assets') {
      const i = state.uploads++;
      return route.fulfill({ status: 201, json: { path: `games/round-assets/9001/upload-${i}.png`, url: image(i) } });
    }
    if (path === '/api/round-games' && req.method() === 'POST' || path === '/api/round-games/701' && req.method() === 'PATCH') {
      const data = req.postDataJSON(); state.saves.push(data);
      state.game = { ...state.game, ...data, thumbnail: { url: data.rounds[0].choices[0].url }, background_url: data.background_path ? image(6) : null };
      return route.fulfill({ status: req.method() === 'POST' ? 201 : 200, json: state.game });
    }
    if (path === '/api/round-games/701') return route.fulfill({ json: state.game });
    if (path === '/api/round-games/701/progress') { state.completed++; return route.fulfill({ json: { success: true } }); }
    if (path === '/api/round-games') return route.fulfill({ json: { data: !url.searchParams.get('kind') || url.searchParams.get('kind') === 'sentence' ? [state.game] : [] } });
    return route.fulfill({ json: { data: [], unread_count: 0, success: true } });
  });
  return { context, state };
}

function watch(page) { const errors = []; page.on('pageerror', e => errors.push(e.message)); return errors; }
async function noOverflow(page) { assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow'); }

try {
  // Author through the real page, including upload, multiple blanks, preview and edit persistence.
  const { context, state } = await contextFor(professional, { width: 1440, height: 1000 });
  const page = await context.newPage(); const errors = watch(page);
  await page.goto(`${base}/profissional/jogos/complete-frase/novo`);
  await page.getByLabel('Nome do jogo', { exact: true }).fill('Frases do jardim');
  await page.getByLabel('Frase da rodada', { exact: true }).fill('O ');
  await page.getByRole('button', { name: 'Inserir lacuna', exact: true }).click();
  assert.equal(await page.getByLabel('Frase da rodada', { exact: true }).inputValue(), 'O ___');
  await page.getByLabel('Frase da rodada', { exact: true }).fill('O ___ comeu a ___.');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf7sAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Adicionar imagens', { exact: true }).setInputFiles(labels.slice(0, 3).map((_, i) => ({ name: `figure-${i}.png`, mimeType: 'image/png', buffer: png })));
  await page.getByLabel('Palavra da figura', { exact: true }).nth(2).waitFor();
  for (let i = 0; i < 3; i++) await page.getByLabel('Palavra da figura', { exact: true }).nth(i).fill(labels[i]);
  await page.getByLabel('Resposta da lacuna 1', { exact: true }).selectOption({ label: 'sapo' });
  await page.getByLabel('Resposta da lacuna 2', { exact: true }).selectOption({ label: 'banana' });
  await page.getByRole('button', { name: 'Prévia', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Frase da rodada', { exact: true }).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await noOverflow(page);
  await page.screenshot({ path: `${output}/editor-1440.png`, fullPage: true });
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.waitForURL('**/profissional/jogos/complete-frase');
  assert.equal(state.saves.length, 1);
  assert.equal(state.saves[0].kind, 'sentence');
  assert.equal(state.saves[0].rounds[0].blank_answers.length, 2);
  await page.goto(`${base}/profissional/jogos/complete-frase/701/editar`);
  assert.equal(await page.getByLabel('Frase da rodada', { exact: true }).inputValue(), 'O ___ comeu a ___.');
  assert.equal(await page.getByLabel('Resposta da lacuna 1', { exact: true }).inputValue(), state.saves[0].rounds[0].blank_answers[0]);
  assert.deepEqual(errors, []); await context.close();
  console.log('PASS authoring: upload, multiple blanks, answer mapping, preview, save and persisted edit');

  for (const width of [390, 320]) {
    const { context } = await contextFor(professional, { width, height: 844 });
    const page = await context.newPage(), errors = watch(page);
    await page.goto(`${base}/profissional/jogos/complete-frase/701/editar`);
    await page.getByLabel('Frase da rodada', { exact: true }).waitFor();
    await noOverflow(page);
    await page.screenshot({ path: `${output}/editor-${width}.png`, fullPage: true });
    await page.getByRole('tab', { name: 'Rodada 2', exact: true }).click();
    await page.getByRole('button', { name: 'Rodada', exact: true }).click();
    await page.getByRole('tab', { name: 'Rodada 3', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /Rodada 3/ }).waitFor();
    await noOverflow(page);
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${width}px editor: mobile layout, round navigation, add round and incomplete-round validation`);
  }

  for (const [width, height] of [[1440, 950], [768, 1024], [390, 844], [320, 700], [844, 390]]) {
    const { context, state } = await contextFor(patient, { width, height });
    const page = await context.newPage(), errors = watch(page);
    await page.goto(`${base}/jogos/complete-frase/701`);
    await page.getByRole('button', { name: 'sapo', exact: true }).waitFor();
    await noOverflow(page);
    const columns = await page.locator('.round-board__grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(columns, width >= 1024 ? 6 : width >= 768 ? 4 : width >= 480 ? 3 : 2);
    const cards = await page.locator('.round-choice').evaluateAll(els => els.map(e => ({ width: e.getBoundingClientRect().width, y: Math.round(e.getBoundingClientRect().y) })));
    assert.ok(cards.every(c => Math.abs(c.width - cards[0].width) < 2), 'Uniform card widths');
    assert.equal(new Set(cards.map(c => c.y)).size, Math.ceil(7 / columns));
    await page.screenshot({ path: `${output}/game-${width}x${height}.png`, fullPage: true });
    await page.getByRole('button', { name: 'banana', exact: true }).click();
    assert.equal(await page.locator('.sentence-blank--filled').count(), 0);
    await page.getByRole('button', { name: 'sapo', exact: true }).click();
    await page.getByLabel('Lacuna 1: sapo', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'banana', exact: true }).click();
    await page.getByText('Rodada 2 de 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'gato', exact: true }).click();
    await page.getByRole('button', { name: 'bola', exact: true }).click();
    await page.getByRole('dialog').getByText('Jogo concluído!', { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow') === '2');
    assert.equal(state.completed, 1, 'Patient completion recorded once');
    await page.getByRole('dialog').getByRole('button', { name: 'Jogar novamente', exact: true }).click();
    await page.getByText('Rodada 1 de 2', { exact: true }).waitFor();
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${width}x${height}: max-six grid, responsive rows, blanks, wrong/correct choices, auto advance, completion and replay`);
  }

  // Same-origin iframe relay exercises the same parent-message interface used by SessionCall.
  const { context: live, state: liveState } = await contextFor(professional, { width: 1440, height: 1000 });
  await live.route('**/sentence-live-harness', route => route.fulfill({ contentType: 'text/html', body: `<html><body style="margin:0;display:flex"><iframe id="professional" style="width:65vw;height:95vh"></iframe><iframe id="patient" style="width:35vw;height:95vh"></iframe><script>
    window.events=[];window.effects=[];
    addEventListener('message', e=>{if(e.origin!==location.origin)return;const frames=[professional,patient];const source=frames.find(f=>f.contentWindow===e.source);if(!source)return;
      if(e.data.type==='SESSION_GAME_EVENT'){events.push({source:source.id,event:e.data.event});frames.filter(f=>f!==source).forEach(f=>f.contentWindow.postMessage(e.data,location.origin));}
      if(e.data.type==='SESSION_GAME_SFX')effects.push({source:source.id,effect:e.data.effect});
    });
    professional.src='/jogos/complete-frase/701?session=1&session_id=555&session_role=admin&session_seed=123&session_content_id=live-1';
    patient.src='/jogos/complete-frase/701?session=1&session_id=555&session_role=user&session_seed=123&session_content_id=live-1';
  </script></body></html>` }));
  const call = await live.newPage(), liveErrors = watch(call);
  await call.goto(`${base}/sentence-live-harness`);
  const fono = call.frameLocator('#professional'), child = call.frameLocator('#patient');
  await child.getByRole('button', { name: 'sapo', exact: true }).waitFor();
  assert.equal(await child.getByRole('button', { name: 'sapo', exact: true }).isDisabled(), true);
  assert.equal(await child.locator('.is-pseudo-fullscreen').count(), 1);
  await call.evaluate(() => patient.contentWindow.postMessage({ type: 'SESSION_CONTROL', granted: true }, location.origin));
  await child.getByRole('button', { name: 'sapo', exact: true }).click();
  await fono.getByLabel('Lacuna 1: sapo', { exact: true }).waitFor();
  await fono.getByRole('button', { name: 'banana', exact: true }).click();
  await child.getByText('Rodada 2 de 2', { exact: true }).waitFor();
  await fono.getByText('Rodada 2 de 2', { exact: true }).waitFor();
  await child.getByRole('button', { name: 'gato', exact: true }).click();
  await child.getByRole('button', { name: 'bola', exact: true }).click();
  await child.getByRole('dialog').getByText('Jogo concluído!', { exact: true }).waitFor();
  await fono.getByRole('dialog').getByText('Jogo concluído!', { exact: true }).waitFor();
  const packets = await call.evaluate(() => ({ events, effects }));
  assert.equal(packets.events.filter(e => e.event.kind === 'next').length, 2, 'Exactly one advance per round');
  assert.ok(packets.events.filter(e => e.event.kind === 'next').every(e => e.source === 'professional'));
  for (const source of ['professional', 'patient']) {
    assert.ok(packets.effects.some(e => e.source === source && e.effect === 'correct'), `${source} receives click SFX`);
    assert.ok(packets.effects.some(e => e.source === source && e.effect === 'win'), `${source} receives completion music`);
  }
  assert.equal(liveState.completed, 0, 'Live sessions do not write standalone patient progress');
  assert.deepEqual(liveErrors, []); await live.close();
  console.log('PASS live iframe integration: control grant, patient/professional clicks, exactly-once advances, full screen, both SFX and celebration');
} finally { await browser.close(); }

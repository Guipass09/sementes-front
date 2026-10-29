import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5194';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
await fs.mkdir('.local/library-folders/browser', { recursive: true });
const user = { id: 9001, role: 'professional', name: 'Fono Teste', email: 'fono@example.test', blocked: false, professional_subscription_required: false, access: { atividades: true, horarios: true, relatorios: true } };
const memory = (id, title, owner = 9001) => ({ id, title, description: 'Encontre os pares', created_by: { id: owner, name: 'Fono', role: 'professional' }, pairs_count: 4, cards: [], assigned_to: [] });
const story = { id: 35, title: 'História completa', description: 'Sequência de atividades', is_story: true, created_by: { id: 9001, name: 'Fono' }, media: [], assigned_to: [], story_steps: [{ type: 'game', game_type: 'memory_game', game_id: 1, title: 'Memória na pasta', path: '/jogos/1' }] };

async function setup(width, role = "professional") {
  const actor = { ...user, role };
  const context = await browser.newContext({ viewport: { width, height: 1000 }, permissions: ['camera', 'microphone'], serviceWorkers: 'block' });
  await context.addInitScript(u => {
    localStorage.setItem('token', 'folder-test'); localStorage.setItem('user', JSON.stringify(u));
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d'); setInterval(() => { ctx.fillStyle = '#24ad71'; ctx.fillRect(0, 0, 320, 240); }, 60);
      const stream = canvas.captureStream(15), audio = new AudioContext(); await audio.resume();
      const oscillator = audio.createOscillator(), output = audio.createMediaStreamDestination();
      oscillator.connect(output); oscillator.start(); stream.addTrack(output.stream.getAudioTracks()[0]); return stream;
    };
  }, actor);
  const state = { folders: [{ id: 1, name: 'Zoológico' }, { id: 2, name: 'Animais' }], memberships: [{ folder_id: 2, resource_type: 'memory_game', resource_id: 1 }, { folder_id: 2, resource_type: 'memory_game', resource_id: 3 }, { folder_id: 2, resource_type: 'activity', resource_id: 35 }], commands: [], created: [] };
  await context.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname.replace("/api/admin/", "/api/professional/"), method = req.method();
    let json = { data: [] }, status = 200;
    if (path === '/api/me') json = actor;
    else if (path === '/api/library/folders' && method === 'GET') json = { folders: state.folders, memberships: state.memberships };
    else if (path === '/api/library/folders' && method === 'POST') { const body = req.postDataJSON(); const folder = { id: state.folders.length + 10, name: body.name }; state.folders.push(folder); json = folder; status = 201; }
    else if (/\/api\/library\/folders\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1));
      if (method === 'PATCH') { const folder = state.folders.find(f => f.id === id); folder.name = req.postDataJSON().name; json = folder; }
      if (method === 'DELETE') { state.folders = state.folders.filter(f => f.id !== id); state.memberships = state.memberships.filter(m => m.folder_id !== id); status = 204; }
    } else if (path === '/api/library/folder-items') {
      const body = req.postDataJSON();
      for (const item of body.items) { state.memberships = state.memberships.filter(m => m.resource_type !== item.type || m.resource_id !== item.id); if (body.folder_id) state.memberships.push({ folder_id: body.folder_id, resource_type: item.type, resource_id: item.id }); }
      json = { success: true };
    } else if (path === '/api/professional/activities') json = { data: [story] };
    else if (path === '/api/professional/activities/35') json = story;
    else if (path === '/api/professional/memory-games') json = { data: url.searchParams.get('variant') === 'v2' ? [] : [memory(1, 'Memória na pasta'), memory(2, 'Memória avulsa'), memory(3, 'Memória compartilhada', 9002)] };
    else if (path === '/api/round-games' && method === 'POST') { state.created.push(req.postDataJSON()); json = { ...req.postDataJSON(), id: 98 }; status = 201; }
    else if (path === '/api/video/join') json = { role: 'admin', token: 'test-call', sessionId: 99001, iceServers: [], epoch: 'folder-test', server_now: new Date().toISOString(), room: { epoch: 'folder-test', content: null } };
    else if (path === '/api/video/command' && method === 'POST') { state.commands.push(req.postDataJSON()); json = { ok: true }; }
    else if (path === '/api/video/command') json = { messages: [], next_cursor: 0 };
    else if (path.includes('notifications')) json = { data: [], unread_count: 0 };
    return route.fulfill(status === 204 ? { status } : { status, json });
  });
  // Content frame only. The call page and its catalog use the real application.
  await context.route('**/jogos/1?*', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Jogo da memória</body></html>' }));
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  return { context, page, state, errors };
}

try {
  for (const width of process.env.FOLDERS_LIVE_ONLY ? [] : [1440, 390, 320]) {
    const { context, page, state, errors } = await setup(width);
    await page.goto(`${base}/profissional/pastas`);
    await page.getByRole('heading', { name: 'Minha biblioteca', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Nova pasta', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome da pasta', exact: true }).fill('Linguagem');
    await page.getByRole('button', { name: 'Salvar pasta', exact: true }).click();
    await page.getByRole('heading', { name: 'Linguagem', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Renomear pasta', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome da pasta', exact: true }).fill('Vocabulário');
    await page.getByRole('button', { name: 'Salvar pasta', exact: true }).click();
    await page.getByRole('heading', { name: 'Vocabulário', exact: true }).waitFor();
    await page.goto(`${base}/profissional/jogos/memoria`);
    await page.getByRole('button', { name: 'Mover Memória avulsa para pasta', exact: true }).click();
    await page.locator('[role=dialog] select').selectOption('12');
    await page.getByRole('button', { name: 'Mover atividade', exact: true }).click();
    await page.locator('[role=dialog]').waitFor({ state: 'hidden' });
    assert.ok(state.memberships.some(m => m.folder_id === 12 && m.resource_id === 2));
    await page.goto(`${base}/profissional/pastas/12`);
    await page.getByRole('link', { name: 'Jogar Memória avulsa', exact: true }).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}px overflow`);
    await page.screenshot({ path: `.local/library-folders/browser/folder-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Excluir pasta', exact: true }).click();
    await page.getByRole('button', { name: 'Excluir somente a pasta', exact: true }).click();
    await page.getByRole('heading', { name: 'Minha biblioteca', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Jogar Memória avulsa', exact: true }).first().waitFor();
    assert.ok(!state.memberships.some(m => m.resource_id === 2));
    await page.goto(`${base}/profissional/jogos/sons-imagens/novo?pasta=2`);
    await page.getByText('Novas atividades serão salvas em').waitFor();
    await page.evaluate(async () => {
      const { request } = await import('/src/lib/laravel-api.ts');
      await request('/api/round-games', { method: 'POST', json: { kind: 'sound', title: 'Teste' } });
    });
    assert.equal(state.created[0].library_folder_id, 2);
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${width}px: create/rename folder, move existing game, delete without content loss, creation context, responsive layout`);
  }
  if (!process.env.FOLDERS_LIVE_ONLY) {
    const { context, page, errors } = await setup(1440, "admin");
    await page.goto(base + '/admin/pastas/2');
    await page.getByRole('heading', { name: 'Animais', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Mover Memória na pasta para pasta', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Renomear pasta', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Compartilhados', exact: true }).count(), 0);
    assert.deepEqual(errors, []); await context.close();
    console.log('PASS admin: personal folders, mixed resource cards and management actions');
  }
  const { context, page, state, errors } = await setup(1440);
  await page.goto(`${base}/sessao/99001/chamada`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Participar', exact: true }).click();
  await page.getByRole('button', { name: /Catálogo \(atividades\/jogos\)/ }).click();
  const catalog = page.getByRole('dialog', { name: 'Catálogo (atividades e jogos)', exact: true });
  await catalog.getByRole('button', { name: /Animais.*2 atividade/ }).waitFor();
  const folders = await catalog.locator('[aria-label="Pastas da biblioteca"] button[aria-expanded]').allTextContents();
  assert.ok(folders[0].startsWith('Animais') && folders[1].startsWith('Zoológico'));
  assert.equal(await catalog.getByText('Memória na pasta', { exact: true }).count(), 0);
  await catalog.getByRole('button', { name: /Animais.*2 atividade/ }).click();
  await catalog.getByText('Memória na pasta', { exact: true }).waitFor();
  assert.equal(await catalog.getByText('Memória compartilhada', { exact: true }).count(), 0);
  await catalog.getByRole('tab', { name: 'Compartilhados', exact: true }).click();
  await catalog.getByText('Memória compartilhada', { exact: true }).waitFor();
  assert.equal(await catalog.getByText('Memória na pasta', { exact: true }).count(), 0);
  await catalog.getByRole('tab', { name: 'Meu catálogo', exact: true }).click();
  await catalog.getByText('História completa', { exact: true }).click();
  await catalog.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !!document.querySelector('iframe'));
  assert.ok(state.commands.some(c => c.kind === 'content_select' && c.payload?.path === '/jogos/1' && c.payload?.story_id === 35));
  await page.getByRole('button', { name: /Catálogo \(atividades\/jogos\)/ }).click();
  await catalog.getByRole('button', { name: /Animais.*2 atividade/ }).click();
  await catalog.getByText('História completa', { exact: true }).waitFor();
  // Filed items are still available after opening and leaving a complete story.
  await catalog.getByRole('button', { name: /Jogo da Memória \(1\)/ }).click();
  await catalog.getByText('Memória avulsa', { exact: true }).waitFor();
  assert.equal(await catalog.getByText('Memória na pasta', { exact: true }).count(), 1);
  await page.screenshot({ path: '.local/library-folders/browser/live-catalog.png', fullPage: true });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await catalog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    assert.equal(await catalog.evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
    await page.screenshot({ path: `.local/library-folders/browser/live-catalog-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log('PASS real call catalog: alphabetical folders, own/shared isolation, no loose duplicates, complete-story launch and reopening preserves all games');
} finally { await browser.close(); }

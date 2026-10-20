import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5191';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9ioAAAAASUVORK5CYII=', 'base64');
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const user = { id: 5, name: 'Profissional Teste', role: 'professional', email: 'test@example.test', blocked: false, access: { atividades: true, horarios: true, relatorios: true }, professional_subscription_status: 'legacy' };
await context.addInitScript(user => { localStorage.setItem('token', 'test-token'); localStorage.setItem('user', JSON.stringify(user)); }, user);
let searchMode = 'success';
let slowImport = false;
let saved = null;
const fixture = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, tags: `casa desenho ${i + 1}`, author: 'Artista', page: 'https://pixabay.com/illustrations/example-1/', preview: process.env.TEST_PREVIEW_URL || `https://cdn.pixabay.com/test-${i}.png`, width: 1280, height: 960, token: `selection-${i + 1}` }));
await context.route('https://cdn.pixabay.com/test-*.png', route => route.fulfill({ contentType: 'image/png', body: png }));
await context.route('**/api/**', async route => {
  const request = route.request();
  const url = new URL(request.url());
  let data = { data: [] };
  if (url.pathname === '/api/me') data = user;
  else if (url.pathname === '/api/activity-images/search') {
    assert.equal(url.searchParams.has('key'), false);
    assert.equal(request.headers().authorization, 'Bearer test-token');
    if (searchMode === 'error') return route.fulfill({ status: 502, json: { message: 'Temporarily unavailable' } });
    data = { page: Number(url.searchParams.get('page')), total: searchMode === 'empty' ? 0 : 48, items: searchMode === 'empty' ? [] : fixture };
  } else if (url.pathname === '/api/activity-images/import') {
    if (slowImport) await new Promise(resolve => setTimeout(resolve, 700));
    assert.match(request.postDataJSON().token, /^selection-/);
    return route.fulfill({ contentType: 'image/png', body: png });
  } else if (url.pathname === '/api/professional/memory-games' && request.method() === 'POST') {
    saved = request.postDataBuffer().toString('latin1');
    data = { id: 900, title: 'Teste', cards: [] };
  } else if (/memory-games\/42$/.test(url.pathname)) data = { id: 42, title: 'Memória teste', description: 'Teste', pairs_count: 4, cards: [], assigned_to: [] };
  else if (/notifications/.test(url.pathname)) data = { data: [], unread_count: 0 };
  return route.fulfill({ json: data });
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await fs.mkdir('.local/image-search-artifacts', { recursive: true });
async function openPicker(index = 0) {
  await page.locator(`label[for="pair-image-${index}"]`).click();
  await page.getByRole('button', { name: 'Buscar imagens', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar imagem', exact: true }).fill('casa');
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await page.getByRole('button', { name: 'Selecionar casa desenho 1', exact: true }).waitFor();
}
try {
  await page.goto(`${base}/profissional/jogos/memoria/novo`);
  await page.locator('label[for="pair-image-0"]').waitFor();
  await page.locator('label[for="pair-image-0"]').click();
  const chooserEvent = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Upload do dispositivo' }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles({ name: 'device.png', mimeType: 'image/png', buffer: png });
  await page.getByAltText('Par 1', { exact: true }).waitFor();
  assert.equal(await page.locator('#pair-image-0').evaluate(input => input.files[0].name), 'device.png');
  console.log('PASS original device upload');

  await openPicker(2);
  await page.getByRole('button', { name: 'Selecionar casa desenho 1', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.image-search-tile img')?.naturalWidth > 0);
  await page.screenshot({ path: '.local/image-search-artifacts/desktop.png' });
  await page.getByRole('button', { name: 'Usar imagem', exact: true }).click();
  await page.getByAltText('Par 3', { exact: true }).waitFor();
  assert.equal(await page.locator('#pair-image-2').evaluate(input => input.files[0].name), 'pixabay-1.png');
  assert.equal(await page.locator('#pair-image-1').evaluate(input => input.files.length), 0);
  assert.equal(await page.locator('#pair-image-0').evaluate(input => input.files[0].name), 'device.png');
  console.log('PASS selection updates only intended field and preserves other images');

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await openPicker(1);
    await page.getByRole('button', { name: 'Selecionar casa desenho 2', exact: true }).click();
    const overflow = await page.locator('.image-search-dialog').evaluate(dialog => ({ scroll: dialog.scrollWidth, width: dialog.clientWidth, bounds: dialog.getBoundingClientRect().toJSON() }));
    assert.ok(overflow.scroll <= overflow.width + 1, JSON.stringify(overflow));
    assert.ok(overflow.bounds.x >= 0 && overflow.bounds.right <= width);
    await page.screenshot({ path: `.local/image-search-artifacts/mobile-${width}.png` });
    await page.getByRole('button', { name: 'Usar imagem', exact: true }).click();
    await page.getByAltText('Par 2', { exact: true }).waitFor();
  }
  console.log('PASS mobile 390/320 layout and direct image selection');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openPicker(3);
  await page.getByRole('button', { name: 'Próxima página', exact: true }).click();
  await page.getByText('2 / 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Selecionar casa desenho 3', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pair-image-3').evaluate(input => input.files.length), 0);
  console.log('PASS pagination and cancellation');

  await page.locator('label[for="pair-image-3"]').click();
  await page.getByRole('button', { name: 'Buscar imagens', exact: true }).click();
  searchMode = 'error';
  await page.getByRole('textbox', { name: 'Buscar imagem', exact: true }).fill('casa');
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Não foi possível' }).waitFor();
  searchMode = 'empty';
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await page.getByText('Nenhuma imagem encontrada.', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  searchMode = 'success';
  console.log('PASS errors, retry, and empty state');

  await openPicker(3);
  await page.getByRole('button', { name: 'Selecionar casa desenho 1', exact: true }).click();
  slowImport = true;
  await page.getByRole('button', { name: 'Usar imagem', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#pair-image-3').evaluate(input => input.files.length), 0);
  slowImport = false;
  console.log('PASS cancel during import cannot update form');

  for (const index of [3,4,5]) {
    await openPicker(index);
    await page.getByRole('button', { name: `Selecionar casa desenho ${index}`, exact: true }).click();
    await page.getByRole('button', { name: 'Usar imagem', exact: true }).click();
    await page.getByAltText(`Par ${index + 1}`, { exact: true }).waitFor();
  }
  await page.locator('#title').fill('Teste busca');
  await page.locator('#desc').fill('Descrição teste');
  await page.getByRole('button', { name: 'Criar e enviar', exact: true }).click();
  await page.waitForTimeout(300);
  assert.ok(saved?.includes('filename="pixabay-1.png"'));
  assert.ok(saved?.includes('filename="device.png"'));
  assert.equal((saved.match(/name="pair_images\[\]"/g) || []).length, 6);
  console.log('PASS existing multipart save receives all selected/native files');

  await page.goto(`${base}/profissional/jogos/memoria/42/editar`);
  await page.locator('label[for="pair-images"]').click();
  await page.getByRole('button', { name: 'Buscar imagens', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar imagem', exact: true }).fill('casa');
  await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
  for (const id of [1,2,3,4]) await page.getByRole('button', { name: `Selecionar casa desenho ${id}`, exact: true }).click();
  await page.getByRole('button', { name: 'Usar (4)', exact: true }).click();
  await page.getByText('4 arquivo(s) selecionado(s)', { exact: true }).waitFor();
  assert.equal(await page.locator('#pair-images').evaluate(input => input.files.length), 4);
  console.log('PASS multiple selections populate legacy bulk-edit input');
  assert.deepEqual(errors, []);
  console.log('PASS no runtime errors');
} finally { await browser.close(); }

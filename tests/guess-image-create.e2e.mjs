import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5194';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');

try {
  for (const role of ['professional', 'admin']) {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      try {
        const user = { id: 7, name: 'Creator fixture', email: 'fixture@example.test', role, blocked: false, professional_subscription_status: 'legacy', access: { atividades: true, horarios: true, relatorios: true } };
        const root = role === 'professional' ? '/profissional' : '/admin';
        const apiRoot = role === 'professional' ? '/api/professional' : '/api/admin';
        const games = [];
        const submissions = [];
        const errors = [];
        let failNext = role === 'professional' && width === 390;
        await context.addInitScript(user => {
          localStorage.setItem('token', 'create-fixture');
          localStorage.setItem('user', JSON.stringify(user));
        }, user);
        await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
        await context.route('**/api/**', async route => {
          const request = route.request();
          const path = new URL(request.url()).pathname;
          if (path === '/api/me') return route.fulfill({ json: user });
          if (path === `${apiRoot}/users`) return route.fulfill({ json: role === 'professional' ? { data: [] } : [] });
          if (path === `${apiRoot}/guess-image-games`) {
            if (request.method() === 'POST') {
              const body = request.postDataBuffer().toString('utf8');
              submissions.push(body);
              if (failNext) {
                failNext = false;
                return route.fulfill({ status: 422, json: { message: 'Creation fixture rejected' } });
              }
              const game = {
                id: 90005, title: 'Library fixture game', description: 'Fixture description', sessions_count: 1,
                assigned_to: [], assigned_count: 0, created_by: user,
                items: [{ id: 1, position: 0, main_url: '/IMG_8567.jpg', correct_url: '/IMG_8567.jpg', wrong_url: '/IMG_8567.jpg' }],
              };
              games.push(game);
              return route.fulfill({ status: 201, json: game });
            }
            return route.fulfill({ json: { data: games } });
          }
          return route.fulfill({ json: { data: [], unread_count: 0, success: true } });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        // Populate the library cache before creating, as in the real navigation flow.
        await page.goto(`${base}${root}/jogos/acerte-imagem`);
        await page.getByRole('button', { name: 'Novo jogo', exact: true }).click();
        const save = page.getByRole('button', { name: 'Criar jogo', exact: true });
        await save.last().waitFor();
        assert.equal(await save.count(), 2, 'Create must exist outside the recipient panel at both ends');
        assert.ok(await save.last().isDisabled());
        await page.getByLabel('Quantidade de sess', { exact: false }).fill('1');
        await page.getByLabel('Título', { exact: true }).fill('Library fixture game');
        await page.getByLabel('Descri', { exact: false }).fill('Fixture description');
        await page.waitForFunction(() => document.querySelectorAll('input[type=file]').length === 3);
        for (const id of ['main-0', 'correct-0', 'wrong-0']) {
          await page.locator(`input#${id}`).setInputFiles({ name: `${id}.png`, mimeType: 'image/png', buffer: png });
        }
        assert.ok(await save.last().isEnabled());
        await save.last().scrollIntoViewIfNeeded();
        const bounds = await save.last().boundingBox();
        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Create must fit the mobile viewport');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
        if (role === 'professional' && width === 390) {
          await save.last().click();
          await page.getByText('Creation fixture rejected', { exact: true }).waitFor();
          assert.ok(page.url().endsWith('/novo'));
          assert.equal(await page.locator('input#main-0').evaluate(input => input.files.length), 1);
        }
        await save.last().click();
        await page.waitForURL(`${base}${root}/jogos/acerte-imagem`);
        await page.getByRole('link', { name: 'Jogar Library fixture game', exact: true }).first().waitFor();
        const body = submissions.at(-1);
        assert.match(body, /name="assigned_to_json"\r\n\r\n\[\]/);
        assert.match(body, /name="sessions_count"\r\n\r\n1/);
        for (const field of ['main_images', 'correct_images', 'wrong_images']) assert.ok(body.includes(`name="${field}[]"`));
        assert.equal(games.length, 1);
        assert.deepEqual(errors, []);
        console.log(`PASS ${role} creates with no recipients and returns to populated library (${width}px)`);
      } finally { await context.close(); }
    }
  }
} finally { await browser.close(); }

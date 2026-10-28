import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5194';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
await fs.mkdir('.local/subscription-checkout', { recursive: true });

function fixture() {
  const user = { id: 9876, name: 'Fono Teste', email: 'fono@example.test', phone: '+5511999999999', role: 'professional', blocked: false, professional_subscription_status: 'inactive', professional_subscription_expires_on: null, professional_subscription: { status: 'pending', expires_at: null, server_now: new Date().toISOString(), period: null }, access: { atividades: true, horarios: true, relatorios: true } };
  return { user, registrations: [], operational: [], failSubscription: false };
}

async function contextFor(state, width, authenticated = true) {
  const context = await browser.newContext({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
  if (authenticated) await context.addInitScript(user => { localStorage.setItem('token', 'checkout-fixture'); localStorage.setItem('user', JSON.stringify(user)); }, state.user);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'pay.kiwify.com.br') return route.fulfill({ contentType: 'text/html', body: '<h1>Checkout fixture, no payment is made</h1>' });
    if (url.hostname === '127.0.0.1' || url.pathname.startsWith('/api/') || url.pathname === '/sanctum/csrf-cookie') return route.continue();
    return route.abort();
  });
  await context.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/me') return route.fulfill({ json: state.user });
    if (path === '/api/register-professional') { state.registrations.push(request.postDataJSON()); return route.fulfill({ status: 201, json: { token: 'checkout-fixture', user: state.user } }); }
    if (path === '/api/professional/subscription') return state.failSubscription ? route.fulfill({ status: 500, json: { message: 'Fixture outage' } }) : route.fulfill({ json: { subscription: state.user.professional_subscription, events: [], pagination: { page: 1, last_page: 1, total: 0 } } });
    if (path.startsWith('/api/professional/')) state.operational.push(path);
    return route.fulfill({ json: { data: [], unread_count: 0, success: true } });
  });
  return context;
}

try {
  for (const width of [1440, 390, 320]) {
    const state = fixture();
    const context = await contextFor(state, width);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/profissional/jogos/memoria`);
    await page.waitForURL('**/profissional/assinatura');
    const monthly = page.getByRole('article', { name: 'Plano Mensal', exact: true });
    await monthly.getByRole('link', { name: /Começar por R\$ 99,90/ }).waitFor();
    assert.equal(state.operational.length, 0, 'Inactive account must never mount protected resource pages');
    assert.equal(await page.getByRole('link', { name: /Solicitar ativa/ }).count(), 0);
    assert.equal(await page.locator('a[href*="wa.me"]').count(), 0);
    assert.equal(await page.getByText('7 dias de garantia', { exact: true }).count(), 3);
    for (const [name, code] of [['Mensal', 'S7a5Tfh'], ['Trimestral', 'dtzU5Sd'], ['Anual', 'fga1ut3']]) {
      const card = page.getByRole('article', { name: `Plano ${name}`, exact: true });
      const link = card.getByRole('link');
      assert.equal(await link.getAttribute('href'), `https://pay.kiwify.com.br/${code}`);
      const popupPromise = context.waitForEvent('page');
      await link.click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(popup.url(), `https://pay.kiwify.com.br/${code}`);
      await popup.close();
      assert.equal(new URL(page.url()).pathname, '/profissional/assinatura');
    }
    await page.getByRole('button', { name: 'Já paguei, verificar assinatura', exact: true }).click();
    await page.getByText(/Sua assinatura ainda não está ativa/).waitFor();
    assert.equal(state.user.professional_subscription_status, 'inactive', 'A checkout click cannot grant access');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
    await monthly.screenshot({ path: `.local/subscription-checkout/monthly-${width}.png` });
    if (width === 1440) await page.locator('#planos').screenshot({ path: '.local/subscription-checkout/plans-desktop.png' });
    state.user.professional_subscription_status = 'active';
    state.user.professional_subscription = { status: 'active', expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), server_now: new Date().toISOString(), period: { plan: 'monthly', quantity: 1, unit: 'month' } };
    await page.getByRole('button', { name: 'Já paguei, verificar assinatura', exact: true }).click();
    await page.getByText('Sua assinatura está ativa.', { exact: true }).waitFor();
    assert.equal(await page.locator('a[href*="pay.kiwify.com.br"]').count(), 0, 'Active account must not be asked to purchase twice');
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: inactive gate, 3 checkouts, safe return, status verification, activation and layout`);
    await context.close();
  }

  const state = fixture();
  const context = await contextFor(state, 390, false);
  const page = await context.newPage();
  await page.goto(base);
  const annual = page.locator('.lp-plan').filter({ has: page.getByRole('heading', { name: 'Anual', exact: true }) });
  await annual.getByRole('link').click();
  await page.waitForURL('**/cadastro?perfil=profissional&plano=annual');
  await page.locator('#name').fill('Fono Teste');
  await page.locator('#email').fill('fono@example.test');
  await page.locator('#phone').fill('11999999999');
  await page.locator('#professionalBirthdate').fill('1990-01-01');
  await page.locator('#professionalCrfa').fill('2-12345');
  await page.getByRole('checkbox').check();
  await page.locator('#password').fill('Fixture123!');
  await page.locator('#confirmPassword').fill('Fixture123!');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/profissional/assinatura?cadastro=concluido&plano=annual');
  assert.equal(state.registrations.length, 1);
  assert.equal(await page.getByRole('article', { name: 'Plano Anual', exact: true }).getByRole('link').getAttribute('href'), 'https://pay.kiwify.com.br/fga1ut3');
  console.log('PASS landing selected plan -> registration -> authenticated subscription checkout');
  await context.close();
} finally { await browser.close(); }

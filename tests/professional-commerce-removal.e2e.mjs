import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5194';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});

async function fixture(role, width, clinic = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const user = {
    id: 7, name: 'Professional fixture', email: 'fixture@example.test', role,
    blocked: false, access: { atividades: true, horarios: true, relatorios: true },
    professional_subscription_status: 'legacy', clinic_user_id: clinic ? 30 : null,
  };
  const requests = [];
  const errors = [];
  await context.addInitScript(user => {
    localStorage.setItem('token', 'commerce-test');
    localStorage.setItem('user', JSON.stringify(user));
    navigator.mediaDevices.getUserMedia = async () => {
      const audio = new AudioContext();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 320;
      canvas.getContext('2d').fillRect(0, 0, 320, 320);
      return new MediaStream([
        ...canvas.captureStream(5).getVideoTracks(),
        ...audio.createMediaStreamDestination().stream.getAudioTracks(),
      ]);
    };
  }, user);
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    requests.push(path);
    let json = { data: [], unread_count: 0 };
    if (path === '/api/me') json = user;
    if (path === '/api/professional/appointments') json = { data: [{
      id: 90001, user_id: 9, professional_name: user.name,
      session_date: '2099-01-20', session_time: '15:00', total_sessions: 1,
      status: 'active', user: { id: 9, name: 'Patient fixture', email: 'patient@example.test' },
    }] };
    if (path === '/api/user/appointments') json = {
      data: [{ id: 90001, date: '2026-01-20', time: '15:00', professional_name: user.name, status: 'completed' }],
      summary: { total_contracted: 1, used_sessions: 1, remaining_sessions: 0 }, upcoming: [],
    };
    if (path === '/api/professional/earnings') json = {
      month: '2026-10', earliest_year: 2026, total: 0,
      counts: { evaluation: 0, scheduled: 0 }, amounts: { evaluation: 0, scheduled: 0 },
    };
    if (path === '/api/video/join') json = {
      role: role === 'user' ? 'user' : 'admin', token: 'commerce-test', sessionId: 90001,
      epoch: 'commerce', iceServers: [], server_now: new Date().toISOString(),
      room: { appointment_id: 90001, content: null },
    };
    if (path === '/api/video/command') json = request.method() === 'GET'
      ? { messages: [], next_cursor: 0 } : { ok: true, id: 1 };
    await route.fulfill({ json });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, requests, errors };
}

try {
  for (const width of [1440, 390]) {
    for (const clinic of [false, true]) {
      const { context, page, requests, errors } = await fixture('professional', width, clinic);
      try {
        await page.goto(`${base}/profissional/horarios`);
        await page.getByText('Patient fixture', { exact: true }).first().waitFor();
        assert.equal(await page.getByRole('button', { name: /pagamento|pacotes/i }).count(), 0);
        assert.equal(await page.getByRole('dialog').count(), 0);
        assert.equal(requests.some(path => path.includes('payment-links')), false);
        assert.deepEqual(errors, []);
        console.log(`PASS professional schedules without payment controls (${width}px, clinic=${clinic})`);
      } catch (error) {
        console.error({ url: page.url(), body: (await page.locator('body').innerText()).slice(0, 1700), requests, errors });
        throw error;
      } finally { await context.close(); }
    }

    const { context, page, errors } = await fixture('user', width);
    try {
      await page.goto(`${base}/paciente/sessoes`);
      await page.getByText('Realizada', { exact: true }).waitFor();
      assert.equal(await page.locator('a[href="/paciente/pacotes"]').count(), 0);
      assert.deepEqual(errors, []);
      console.log(`PASS completed patient session has no purchase CTA (${width}px)`);
    } finally { await context.close(); }
  }

  for (const role of ['professional', 'admin']) {
    const { context, page, errors } = await fixture(role, 1440);
    try {
      await page.goto(`${base}/sessao/90001/chamada`);
      await page.getByRole('button', { name: 'Participar', exact: true }).click();
      await page.getByRole('button', { name: 'Boca 3D', exact: true }).waitFor();
      const packages = page.getByRole('button', { name: 'Pacotes', exact: true });
      assert.equal(await packages.count(), role === 'admin' ? 1 : 0);
      assert.equal(await page.getByRole('button', { name: /controle.*paciente/ }).count(), 1);
      if (role === 'admin') {
        await packages.click();
        await page.getByRole('heading', { name: /cat.logo de pre.os/ }).waitFor();
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${role} live call uses account role for package controls`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

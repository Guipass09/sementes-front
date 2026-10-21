import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5193';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const queues = { admin: [], user: [] };
const joins = { admin: 0, user: 0 };
const commands = [];
const pollCursors = { admin: 0, user: 0 };
let sequence = 0;
const errors = [];
const pages = [];
await fs.mkdir('.local/peer-recovery-artifacts', { recursive: true });

async function participant(role, viewport) {
  const context = await browser.newContext({ viewport, permissions: ['camera', 'microphone'], serviceWorkers: 'block' });
  const user = { id: role === 'admin' ? 1 : 2, role: role === 'admin' ? 'professional' : 'user', name: role === 'admin' ? 'Profissional teste' : 'Paciente teste',
    email: `${role}@example.test`, blocked: false, access: { atividades: true, horarios: true, relatorios: true }, professional_subscription_status: 'legacy' };
  await context.addInitScript(user => {
    localStorage.setItem('token', `test-${user.id}`); localStorage.setItem('user', JSON.stringify(user));
    window.__peers = []; window.__captures = 0;
    const NativePeer = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePeer { constructor(...args) { super(...args); window.__peers.push(this); } };
    navigator.mediaDevices.getUserMedia = async () => {
      window.__captures++;
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d');
      setInterval(() => { ctx.fillStyle = '#24ad71'; ctx.fillRect(0, 0, 320, 240); ctx.fillStyle = '#fff'; ctx.fillRect((Date.now() / 10) % 280, 40, 30, 120); }, 60);
      const stream = canvas.captureStream(15);
      const audio = new AudioContext(); await audio.resume();
      const oscillator = audio.createOscillator(); const output = audio.createMediaStreamDestination();
      oscillator.connect(output); oscillator.start(); stream.addTrack(output.stream.getAudioTracks()[0]);
      return stream;
    };
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d');
      setInterval(() => { ctx.fillStyle = '#e54b64'; ctx.fillRect(0, 0, 640, 360); ctx.fillStyle = '#fff'; ctx.fillRect((Date.now() / 20) % 600, 80, 35, 180); }, 60);
      return canvas.captureStream(15);
    };
  }, user);
  await context.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    let data = { data: [] };
    if (url.pathname === '/api/me') {
      // Updating the profile object must not register a second live-call identity.
      await new Promise(resolve => setTimeout(resolve, 4000));
      data = { ...user, name: `${user.name} atualizado` };
    } else if (url.pathname === '/api/video/join') {
      joins[role]++;
      data = { role, token: `local-${role}`, sessionId: 99001, iceServers: [], epoch: 'local-test', server_now: new Date().toISOString(), room: { epoch: 'local-test', content: { path: '/atividades/35', title: 'Atividade teste', kind: 'activity', share_id: 'test-active', seed: 1 } } };
    } else if (url.pathname === '/api/video/command' && request.method() === 'POST') {
      const value = request.postDataJSON();
      const message = { id: ++sequence, kind: value.kind, payload: value.payload, from: role, epoch: 'local-test', at: new Date().toISOString() };
      queues[role === 'admin' ? 'user' : 'admin'].push(message); commands.push(message);
      data = { ok: true, id: message.id };
    } else if (url.pathname === '/api/video/command') {
      const after = Number(url.searchParams.get('after_id') || 0);
      pollCursors[role] = after;
      const messages = queues[role].filter(message => message.id > after);
      data = { messages, next_cursor: messages.length ? messages.at(-1).id : after };
    } else if (url.pathname.includes('notifications')) data = { data: [], unread_count: 0 };
    return route.fulfill({ json: data });
  });
  await context.route('**/atividades/35*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><h1>Atividade teste</h1><script>window.testMount = Date.now();</script></body></html>' }));
  const page = await context.newPage();
  pages.push(page);
  page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
  await page.goto(`${base}/sessao/99001/chamada`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Participar', exact: true }).click();
  return { context, page, role };
}

async function state(page) {
  return page.evaluate(async () => {
    const pc = window.__peers.at(-1);
    const stats = pc ? await pc.getStats() : [];
    let video = 0; let audio = 0;
    stats.forEach(report => { if (report.type === 'inbound-rtp') { if (report.kind === 'video') video += report.framesDecoded || 0; if (report.kind === 'audio') audio += report.packetsReceived || 0; } });
    const rendered = [...document.querySelectorAll('video')].filter(element => !element.muted && element.srcObject instanceof MediaStream && element.videoWidth > 0 && !element.paused).length;
    return { connection: pc?.connectionState, signaling: pc?.signalingState, video, audio, rendered, peers: window.__peers.length, captures: window.__captures };
  });
}

async function expectMedia(page, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const current = await state(page);
    if (current.connection === 'connected' && current.video > 2 && current.audio > 2) return;
    await page.waitForTimeout(300);
  }
  assert.fail(`Media did not recover: ${JSON.stringify(await state(page))}`);
}

try {
  const professional = await participant('admin', { width: 1440, height: 1000 });
  const patient = await participant('user', { width: 390, height: 844 });
  const staff = professional.page; const child = patient.page;
  await expectMedia(staff); await expectMedia(child);
  await staff.waitForTimeout(4500);
  assert.deepEqual(joins, { admin: 1, user: 1 });
  assert.equal((await state(staff)).captures, 1); assert.equal((await state(child)).captures, 1);
  console.log('PASS real two-way audio/video and stable join after profile refresh');

  // Exercise replacement-camera routing through the actual ontrack handler.
  await staff.evaluate(() => {
    const pc = window.__peers.at(-1);
    const camera = pc.getTransceivers().find(item => item.receiver.track.kind === 'video');
    const clone = camera.receiver.track.clone();
    pc.ontrack({ track: clone, transceiver: camera, streams: [] });
    window.__replacementCameraId = clone.id;
  });
  await staff.waitForFunction(() => [...document.querySelectorAll('video')].some(video => !video.muted && video.srcObject?.getVideoTracks().some(track => track.id === window.__replacementCameraId)));
  console.log('PASS replacement camera stays in visible camera instead of screen-share stream');

  const beforeScreen = await state(child);
  await staff.getByTitle('Compartilhar a tela', { exact: true }).click();
  const screenDeadline = Date.now() + 10000;
  let screenVideos = 0;
  while (Date.now() < screenDeadline && screenVideos < 2) {
    screenVideos = await child.evaluate(async () => {
    const pc = window.__peers.at(-1); const stats = await pc.getStats(); let count = 0;
    stats.forEach(report => { if (report.type === 'inbound-rtp' && report.kind === 'video' && report.framesDecoded > 2) count++; });
    return count;
    });
    await child.waitForTimeout(200);
  }
  assert.ok(screenVideos >= 2);
  assert.equal((await state(child)).connection, 'connected');
  assert.ok((await state(child)).audio > beforeScreen.audio);
  console.log('PASS camera, screen sharing and microphone remain distinct');

  const staffBefore = await state(staff); const patientBefore = await state(child);
  await staff.evaluate(() => { const pc = window.__peers.at(-1); pc.close(); pc.dispatchEvent(new Event('connectionstatechange')); });
  await staff.waitForFunction(count => window.__peers.length > count, staffBefore.peers, { timeout: 30000 });
  await expectMedia(staff); await expectMedia(child);
  assert.ok((await state(child)).peers > patientBefore.peers);
  assert.equal((await state(staff)).captures, 1); assert.equal((await state(child)).captures, 1);
  assert.deepEqual(joins, { admin: 1, user: 1 });
  console.log('PASS closed professional peer rebuilds both sides without refresh or camera recapture');

  await staff.getByTitle('Parar compartilhamento de tela', { exact: true }).click();
  await child.waitForSelector('iframe');
  await child.waitForTimeout(1000);
  const activityFrame = child.frames().find(frame => frame.url().includes('/atividades/35'));
  assert.ok(activityFrame);
  const activityMount = await activityFrame.evaluate(() => window.testMount);

  await staff.waitForTimeout(11000);
  const patientBeforeFailure = await state(child);
  await child.evaluate(() => { const pc = window.__peers.at(-1); pc.close(); pc.dispatchEvent(new Event('connectionstatechange')); });
  await child.waitForFunction(count => window.__peers.length > count, patientBeforeFailure.peers, { timeout: 30000 });
  await expectMedia(child); await expectMedia(staff);
  assert.equal((await state(child)).captures, 1);
  console.log('PASS patient transport failure requests coordinated recovery');

  queues.user.push({ id: ++sequence, kind: 'webrtc_offer', from: 'admin', epoch: 'local-test', at: new Date().toISOString(), payload: { offer_id: 'invalid-test-offer', sdp: { type: 'offer', sdp: 'invalid SDP' } } });
  const invalidId = sequence;
  await child.waitForTimeout(5000);
  await expectMedia(child); await expectMedia(staff);
  assert.ok(pollCursors.user >= invalidId);
  assert.ok(commands.some(message => message.kind === 'webrtc_reconnect' && message.payload?.reset_peer === true));
  assert.deepEqual(joins, { admin: 1, user: 1 });
  console.log('PASS invalid SDP cannot trap polling in a replay loop');

  const beforeStall = await state(staff);
  await staff.evaluate(async () => {
    const pc = window.__peers.at(-1);
    const camera = pc.getReceivers().find(receiver => receiver.track.kind === 'video');
    const frozen = await camera.getStats();
    camera.getStats = async () => frozen;
  });
  await staff.waitForFunction(count => window.__peers.length > count, beforeStall.peers, { timeout: 90000 });
  await expectMedia(staff); await expectMedia(child);
  assert.equal(await activityFrame.evaluate(() => window.testMount), activityMount);
  assert.equal((await state(child)).captures, 1);
  console.log('PASS persistent frozen video rebuilds transport without restarting the activity');

  await staff.screenshot({ path: '.local/peer-recovery-artifacts/professional.png' });
  await child.screenshot({ path: '.local/peer-recovery-artifacts/patient-mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS no page runtime errors', { joins, commands: commands.length, staff: await state(staff), patient: await state(child) });
} catch (error) {
  console.log('FAILURE', errors);
  for (const page of pages) console.log((await page.locator('body').innerText()).slice(0, 2500));
  throw error;
} finally { await browser.close(); }

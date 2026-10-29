// Offline build tool only. The application ships MP3 files, not the synthesizer.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const modulePath = path.resolve(process.env.ESPEAK_MODULE || '.local/mouth-demos/toolchain/package/dist/espeak-ng.js');
globalThis.require = createRequire(import.meta.url);
globalThis.__dirname = path.dirname(modulePath);
const { default: ESpeak } = await import(pathToFileURL(modulePath).href);
const wasmBinary = fs.readFileSync(path.join(path.dirname(modulePath), 'espeak-ng.wasm'));
const temp = path.resolve('.local/mouth-demos/audio');
const output = path.resolve('public/audio/mouth3d');
fs.mkdirSync(temp, { recursive: true }); fs.mkdirSync(output, { recursive: true });
const inputs = { trill: '[[R:]]', ra: "[[R'a]]", tap: "[[a*'a]]", la: "[[l'a]]", ta: "[[t'a]]", da: "[[d'a]]", pa: "[[p'a]]", ba: "[[b'a]]", ma: "[[m'a]]", s: '[[s:]]' };
const manifest = { generator: 'eSpeak NG (espeak-ng WASM package 1.0.2)', voice: 'pt-br', phoneticInput: true, durationMs: 3000, source: 'https://github.com/espeak-ng/espeak-ng', examples: [] };
const run = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'pipe' });
for (const [preset, input] of Object.entries(inputs)) {
  const engine = await ESpeak({ wasmBinary, arguments: ['-v', 'pt-br', '-s', '145', '-p', '47', '-a', '110', '-w', '/sample.wav', input], print: () => {}, printErr: () => {} });
  const raw = path.join(temp, `${preset}-raw.wav`), unit = path.join(temp, `${preset}-unit.wav`);
  fs.writeFileSync(raw, engine.FS.readFile('/sample.wav'));
  const continuous = preset === 'trill' || preset === 's';
  let filter = 'silenceremove=start_periods=1:start_threshold=-55dB:start_duration=0.005:stop_periods=1:stop_threshold=-55dB:stop_duration=0.08,highpass=f=70';
  if (!continuous) filter += ',apad=whole_dur=0.80,atrim=duration=0.80,adelay=80,apad=whole_dur=1,atrim=duration=1';
  run(['-i', raw, '-af', filter, '-ar', '22050', '-ac', '1', unit]);
  for (const [speed, suffix] of [[1, 'normal'], [0.75, 'gentle'], [0.5, 'slow']]) {
    const file = `${preset}-${suffix}.mp3`, destination = path.join(output, file);
    const duration = 3 / speed;
    run(['-stream_loop', '-1', '-i', unit, '-af', `atrim=duration=3,atempo=${speed},apad=whole_dur=${duration},atrim=duration=${duration},loudnorm=I=-17:TP=-2:LRA=7,afade=t=in:d=0.008,afade=t=out:st=${duration - 0.025}:d=0.025`, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '96k', '-t', String(duration), destination]);
    manifest.examples.push({ preset, speed, input, file, durationMs: duration * 1000, bytes: fs.statSync(destination).size, sha256: createHash('sha256').update(fs.readFileSync(destination)).digest('hex') });
  }
  console.log(`Generated ${preset}: normal, gentle, slow`);
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

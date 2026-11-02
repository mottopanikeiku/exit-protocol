import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Builds the single-file game: src/shell.html with every /*__MARKER__*/ and
// <!--__PARTIAL:name__--> inlined. Art and voice are embedded as base64 so the
// output runs from file:// with no network.
// Usage: node build.mjs [--out path/to/index.html]   (default: public/index.html)
const root = new URL('./', import.meta.url);
const text = file => fs.readFileSync(new URL(file, root), 'utf8');
const base64 = file => fs.readFileSync(new URL(file, root)).toString('base64');
// Directory sections are concatenated in filename order.
const concatDir = (dir, ext) => fs.readdirSync(new URL(dir, root)).filter(f => f.endsWith(ext)).sort().map(f => text(dir + f)).join('');

const ART_KEYS = ['key', 'phase', 'agent', 'mask', 'composite', 'cover-depth', 'cover-fx', 'cover-portrait', 'cover-portrait-depth', 'cover-portrait-fx'];
const art = Object.fromEntries(ART_KEYS.map(k => [k, `data:image/webp;base64,${base64(`assets/art/${k}.webp`)}`]));
// Lore documents unlocked by collecting shards, embedded as the global DOSSIER.
const dossier = JSON.parse(text('assets/dossier/dossier.json'));
const signals = fs.existsSync(new URL('assets/signals/intercepts.json', root)) ? JSON.parse(text('assets/signals/intercepts.json')) : [];
// A real public-input driver recording, never a second simulation or canned video.
const drive = createRequire(import.meta.url)('./tools/route-check.cjs');
const driven = drive(undefined, 'hard', 0);
const attractTicks = Math.min(3600, driven.ticks);
const attract = {seed: driven.seed, options: driven.options, ticks: attractTicks, inputs: driven.inputs.filter(([tick]) => tick < attractTicks)};
// Compact, replay-derived instance rivals; generator enforces the 60 KB budget.
const rivals = createRequire(import.meta.url)('./tools/rivals.cjs').generate();

// lines.json is the single source of PHASEONE dialogue: id -> {speaker, title, text, ...}.
const lines = JSON.parse(text('assets/voice/lines.json'));
const voiced = Object.keys(lines).filter(id => fs.existsSync(new URL(`assets/voice/${id}.mp3`, root)));
const voice = Object.fromEntries(voiced.map(id => [id, base64(`assets/voice/${id}.mp3`)]));
if (voiced.length < Object.keys(lines).length) console.warn(`Voice: ${Object.keys(lines).length - voiced.length} of ${Object.keys(lines).length} lines have no MP3 (subtitles only).`);

// Game sections share one closure.
const game = concatDir('src/game/', '.js');
const fonts = [
  ['ETS Display', 'Oxanium', '300 800'],
  ['ETS Mono', 'ShareTechMono', '400'],
].map(([family, file, weight]) => `/* ${text(`assets/fonts/${file}-OFL.txt`)} */\n@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${base64(`assets/fonts/${file}.ttf`)}) format('truetype');font-style:normal;font-weight:${weight};font-display:swap;}`).join('\n');

const blocks = {
  CSS: fonts + '\n' + concatDir('src/css/', '.css'),
  ART: `const SandboxArt=Object.freeze(${JSON.stringify(art)});const DOSSIER=Object.freeze(${JSON.stringify(dossier)});const SIGNALS=Object.freeze(${JSON.stringify(signals)});const ATTRACT_TRACE=Object.freeze(${JSON.stringify(attract)});const RIVAL_DATA=Object.freeze(${JSON.stringify(rivals)});`,
  CAMPAIGN: text('src/campaign-data.js'),
  BENCHCORE: text('src/benchmark-core.js'),
  BENCHCLIENT: text('src/benchmark-client.js'),
  ENGINE: text('src/engine.js'),
  AUDIO: text('src/audio.js').replace('/*__VOICE_DATA__*/', () => `const PHASE_VOICE_DATA=${JSON.stringify(voice)};const PHASE_LINES=Object.freeze(${JSON.stringify(lines)});`),
  GAME: game,
};

let html = text('src/shell.html').replace(/<!--__PARTIAL:([a-z0-9-]+)__-->/g, (_, name) => text(`src/partials/${name}.html`));
for (const [key, value] of Object.entries(blocks)) {
  const marker = `/*__${key}__*/`;
  if (!html.includes(marker)) throw new Error(`Missing marker ${marker} in src/shell.html`);
  html = html.replace(marker, () => value);
}
const leftover = html.match(/\/\*__[A-Z_]+__\*\//);
if (leftover) throw new Error(`Unresolved source marker ${leftover[0]}`);

const outFlag = process.argv.indexOf('--out');
const outFile = outFlag > 0 ? path.resolve(process.argv[outFlag + 1]) : new URL('public/index.html', root).pathname;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`Built ${path.relative(process.cwd(), outFile) || outFile}: ${Buffer.byteLength(html).toLocaleString()} bytes, ${voiced.length} voice lines, ${ART_KEYS.length} art plates.`);

// 音（効果音とBGM）。iPhone でも音量が効くように、すべて Web Audio で鳴らす
// ファイルが無いときは何もしない（ゲームは止めない）
const SE = {
  select: 'se/select.mp3', hint: 'se/hint.mp3', card: 'se/card.mp3', kizuki: 'se/kizuki.mp3',
  glass: 'se/glass.mp3', cup: 'se/cup.mp3', chop: 'se/chop.mp3', shutter: 'se/shutter.mp3',
  clap: 'se/clap.mp3', step: 'se/step.mp3', fusuma: 'se/fusuma.mp3',
  bath: 'se/bath.mp3', perk: 'se/perk.mp3', knock: 'se/knock.mp3', match: 'se/match.mp3', walk1: 'se/walk1.mp3', walk2: 'se/walk2.mp3', box: 'se/box.mp3', cheer: 'se/cheer.mp3',
};
// 場面ごとの環境音（ループ）とBGM
const AMB = { garden: 'se/amb_garden.mp3', falls: 'se/amb_falls.mp3', morning: 'se/amb_morning.mp3', onsen: 'se/amb_onsen.mp3' };
const BGM = { title: 'bgm/title.mp3', dinner: 'bgm/dinner.mp3', night: 'bgm/night.mp3', morning: 'bgm/morning.mp3', photo: 'bgm/photo.mp3', ending: 'bgm/ending.mp3' };

let ctx = null, master = null, muted = false;
const buffers = new Map();
const loops = { amb: null, bgm: null };
let voiceNow = null;   // いま話している声（次のセリフに進んだら止める）
const BGM_VOL = 0.32, AMB_VOL = 0.14;   // BGM と環境音は控えめに（セリフが主役）
const DUCK = 0.3;                        // 声が出ている間は、BGM と環境音をここまで下げる
function duck(on) {
  if (!ctx) return;
  for (const k of ['bgm', 'amb']) { const l = loops[k]; if (l) l.gain.gain.setTargetAtTime(on ? l.vol * DUCK : l.vol, ctx.currentTime, on ? 0.12 : 0.5); }
}

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

async function load(url) {
  if (buffers.has(url)) return buffers.get(url);
  const p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((b) => ctx.decodeAudioData(b)).catch(() => null);
  buffers.set(url, p);
  return p;
}

export const audio = {
  // 最初のタップで呼ぶ（ブラウザは、人が触るまで音を出せない）
  unlock() { ensure(); },
  get muted() { return muted; },
  setMuted(v) {
    muted = v;
    if (master) master.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.05);
  },
  async se(name, vol = 0.7) {
    if (!ensure() || !SE[name]) return;
    const buf = await load(SE[name]);
    if (!buf) return;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(master); src.start();
  },
  async loop(kind, name, vol) {
    if (!ensure()) return;
    const table = kind === 'bgm' ? BGM : AMB;
    const cur = loops[kind];
    if (cur && cur.name === name) return;
    if (cur) { cur.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.6); const s = cur.src; setTimeout(() => { try { s.stop(); } catch { /* 止まっている */ } }, 2500); loops[kind] = null; }
    if (!name || !table[name]) return;
    const buf = await load(table[name]);
    if (!buf || (loops[kind] && loops[kind].name === name)) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g).connect(master); src.start();
    const v = vol ?? (kind === 'bgm' ? BGM_VOL : AMB_VOL);
    g.gain.setTargetAtTime(voiceNow ? v * DUCK : v, ctx.currentTime, 0.8);
    loops[kind] = { name, src, gain: g, vol: v };
  },
  // セリフの声。話している間は BGM を少し下げる
  async voice(url, vol = 1) {
    audio.stopVoice();
    if (!ensure() || !url) return;
    const token = {};
    voiceNow = token;
    const buf = await load(url);
    if (!buf || voiceNow !== token) return;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(g).connect(master); src.start();
    token.src = src;
    duck(true);
    src.onended = () => { if (voiceNow === token) { voiceNow = null; duck(false); } };
  },
  stopVoice() {
    const v = voiceNow; voiceNow = null;
    if (v?.src) { try { v.src.stop(); } catch { /* 止まっている */ } }
    duck(false);
  },
  preloadUrls(urls) { if (ensure()) urls.forEach((u) => u && load(u)); },
  // 使う音を先に読みこんでおく
  preload(names = Object.keys(SE)) { if (ensure()) names.forEach((n) => SE[n] && load(SE[n])); },
};

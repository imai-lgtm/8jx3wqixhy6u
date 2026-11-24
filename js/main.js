// 画面（ルールは logic.js）。2Dの場面は HTML、お出迎えと記念写真は3D
import { CONFIG, STORY, SCENES, PEOPLE, KIZUKI, PERKS, KITCHEN_Q, DRINK_TALK, PHOTO_SCENE, createGame, seededRandom, judgeFrame } from './logic.js';
import { BG, SIZE, CHARA, NOTICE, NOTICE_TEXT, GLASS, LEVEL, CAKE_AT, PEEK, PROPS, FAMILY, REAL } from './assets.js';
import { SETTINGS } from './config.js';
import { audio } from './audio.js';
import { VOICE } from './voice.js';

// テスト用の切りかえ：?ts=3（3倍速）?seed=1（毎回同じ）?scene=dinner（その場面から）?flags=seat,anniv
const params = new URLSearchParams(location.search);
const TIME_SCALE = Number(params.get('ts')) || 1;
const SEED = params.get('seed');
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const wide = () => innerWidth >= innerHeight;
const short = () => !wide() && innerHeight <= 720;
const later = (ms, fn) => setTimeout(fn, ms / TIME_SCALE);

const ui = {
  app: $('app'), bgA: $('bgA'), bgB: $('bgB'), chara: $('chara'), hud: $('hud'), clockT: $('clockT'), clockS: $('clockS'), clockArc: $('clockArc'),
  talk: $('talk'), box: $('box'), name: $('name'), line: $('line'), nextMark: $('nextMark'), choices: $('choices'), hint: $('hint'), hintText: $('hintText'),
  notice: $('notice'), found: $('found'), sceneCard: $('sceneCard'), scT: $('scT'), scP: $('scP'), panel: $('panel'),
  cardBtn: $('cardBtn'), cardModal: $('cardModal'), cardClose: $('cardClose'), mute: $('mute'), title: $('title'), start: $('start'), result: $('result'),
  perkBtn: $('perkBtn'), perkN: $('perkN'), perkCard: $('perkCard'), perkList: $('perkList'),
};

let look = 'f';
let photo = null;        // 記念写真の3D
let walk3d = null;       // お出迎えの3D
let shotImage = null;    // 撮った写真（ふり返りに出す）
let typing = null;       // 文字を1字ずつ出している途中
let uiLock = 0;          // 場面のはじめの、見せる間（この間はタップしても進まない）
let choiceHintTimer = null;
let pendingPerk = null;  // 先輩が話し終えたら出す「働く魅力カード」

const game = createGame({
  config: CONFIG,
  random: SEED ? seededRandom(Number(SEED)) : Math.random,
  on: { scene: onScene, beat: onBeat, flag: onFlag, perk: onPerk, finish: onFinish },
});

// ---------------- 背景 ----------------
// いまの場面と、進み具合（グラスをお出ししたか・席を変えたか・205号室の様子）から、出す背景を決める
function currentBg() {
  const id = game.sceneId;
  if (!id) return null;
  if (id === 'farewell') return bgName;                     // 記念写真は3D（背景はそのまま）
  if (id === 'welcome') return game.walk?.done ? `lobby_view_${look}` : 'walk';   // 光を抜けたら、窓の前で紅葉に見とれる4人
  if (id === 'lobby') return game.drink?.started ? 'lobby_family' : 'lobby_noglass';
  if (id === 'dinner') return game.flags.seat ? 'dinner_chair' : 'dinner';
  if (id === 'surprise') { const s = game.sur; return s?.stage === 'done' ? 'room205_joy' : s?.signal ? 'room205_sig' : s?.look ? 'room205_look' : 'room205_base'; }
  return SCENES[id].bg;
}
const imgCache = new Map();
function srcOf(key) { const b = BG[key] || {}; return wide() ? (b.w || b.p) : (b.p || b.w); }
function preload(src) { if (src && !imgCache.has(src)) { const i = new Image(); i.src = src; imgCache.set(src, i); } }
let bgFront = ui.bgA, bgName = null;
function setBg(key, instant = false) {
  if (!key) return;
  bgName = key;
  const b = BG[key] || {};
  const src = srcOf(key);
  const back = bgFront === ui.bgA ? ui.bgB : ui.bgA;
  back.className = 'bg';
  back.style.backgroundImage = '';
  back.dataset.label = '';
  back.dataset.key = key;
  if (src) {
    preload(src);
    back.style.backgroundImage = `url(${src})`;
    const img = imgCache.get(src);
    if (!img.complete) img.addEventListener('error', () => { if (back.dataset.key === key) { back.classList.add('ph'); back.dataset.label = `［${b.label}］の絵（準備中）`; } }, { once: true });
  } else if (b.label) { back.classList.add('ph'); back.dataset.label = `［${b.label}］の絵（準備中）`; }
  const smallPortrait = short() && b.pos;
  back.style.backgroundSize = smallPortrait ? 'auto 108%' : 'cover';
  back.style.backgroundPosition = smallPortrait ? '50% 0' : (b.pos || '50% 50%');
  const front = bgFront;
  bgFront = back;
  const go = () => {
    if (back.dataset.key !== key || bgFront !== back) return;   // 待っている間に、別の絵に切りかわった
    if (instant) { back.style.transition = front.style.transition = 'none'; }
    back.classList.remove('off');
    front.classList.add('off');
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => { ui.bgA.style.transition = ui.bgB.style.transition = ''; }));
    placeNotice();
  };
  // 大きな絵は、画面に出す前に読みこみと展開を終えておく（切りかえの瞬間にカクつかないように）
  const img = src && imgCache.get(src);
  if (!instant && img && img.decode) img.decode().then(go, go); else go();
}
// 絵の中の場所（u, v は 0〜1）が、画面のどこ（px）に出ているか
function bgPoint(u, v) {
  const size = SIZE[wide() ? 'w' : 'p'];
  const W = ui.app.clientWidth, H = ui.app.clientHeight;
  const bs = bgFront.style.backgroundSize;
  const s = bs.startsWith('auto') ? H * parseFloat(bs.split(' ')[1]) / 100 / size.H : Math.max(W / size.W, H / size.H);
  const [px, py] = (bgFront.style.backgroundPosition || '50% 50%').split(' ').map((x) => parseFloat(x) / 100);
  return { x: (W - size.W * s) * px + u * size.W * s, y: (H - size.H * s) * py + v * size.H * s };
}
addEventListener('resize', () => { if (game.sceneId) setBg(currentBg(), true); placeGlasses(); placeCake(); placeLevels(); });
// お出ししたグラスを、背景の絵の同じ場所に重ねる
const glassLayer = el('div', 'glass-layer');
ui.bgB.after(glassLayer);
function placeGlasses() {
  const k = wide() ? 'w' : 'p';
  for (const img of glassLayer.children) {
    const [x0, y0, x1, y1] = GLASS[img.dataset.who][k];
    const size = SIZE[k];
    const a = bgPoint(x0 / size.W, y0 / size.H), b = bgPoint(x1 / size.W, y1 / size.H);
    img.src = `img/glass_${img.dataset.who}_${k === 'w' ? 'wide' : 'p'}.webp`;
    Object.assign(img.style, { left: a.x + 'px', top: a.y + 'px', width: (b.x - a.x) + 'px', height: (b.y - a.y) + 'px' });
  }
}
// 205号室：お持ちしたケーキ（ろうそくの火つき）を、喜ぶ絵の机の上に置く
const cakeLayer = el('div', 'cake-layer', `<div class="cake-ov"><img src="${PROPS.cake}" alt="">${PROPS.flames.map((f) => `<img class="fl" src="${f}" alt="">`).join('')}</div>`);
cakeLayer.hidden = true;
glassLayer.after(cakeLayer);
function placeCake() {
  if (cakeLayer.hidden) return;
  const k = wide() ? 'w' : 'p', c = CAKE_AT[k], size = SIZE[k];
  const a = bgPoint((c.cx - c.w / 2) / size.W, c.bot / size.H), b = bgPoint((c.cx + c.w / 2) / size.W, c.bot / size.H);
  const w = b.x - a.x;
  Object.assign(cakeLayer.firstElementChild.style, { left: a.x + 'px', top: (a.y - w * 524 / 516) + 'px', width: w + 'px' });
}
function showCake(on) {
  if (cakeLayer.hidden === !on) return;
  cakeLayer.hidden = !on;
  if (on) { placeCake(); cakeLayer.classList.remove('in'); void cakeLayer.offsetWidth; cakeLayer.classList.add('in'); }
}
// ロビー：グラスのお茶が、飲んだぶんだけ減って見える（「半分」「空」の絵を重ねて、ゲージに合わせて濃さを変える）
const levelLayer = el('div', 'glass-layer level-layer');
levelLayer.hidden = true;
cakeLayer.before(levelLayer);
for (const who of ['father', 'mother', 'daughter']) for (const lvl of ['half', 'empty']) {
  const img = el('img', 'lv'); img.dataset.who = who; img.dataset.lvl = lvl; img.alt = ''; img.style.opacity = '0';
  levelLayer.appendChild(img);
}
function placeLevels() {
  if (levelLayer.hidden) return;
  const k = wide() ? 'w' : 'p', size = SIZE[k];
  for (const img of levelLayer.children) {
    const [x0, y0, x1, y1] = LEVEL[img.dataset.who][k];
    const a = bgPoint(x0 / size.W, y0 / size.H), b = bgPoint(x1 / size.W, y1 / size.H);
    const src = `img/glass_${img.dataset.who}_${img.dataset.lvl}_${k === 'w' ? 'wide' : 'p'}.webp`;
    if (!img.src.endsWith(src)) img.src = src;
    Object.assign(img.style, { left: a.x + 'px', top: a.y + 'px', width: (b.x - a.x) + 'px', height: (b.y - a.y) + 'px' });
  }
}
function updateLevels() {
  const on = game.sceneId === 'lobby' && !!game.drink?.started && bgName === 'lobby_family';
  if (levelLayer.hidden === on) { levelLayer.hidden = !on; if (on) placeLevels(); }
  if (!on) return;
  const r = game.drink.left / CONFIG.drink.seconds;
  const half = r >= 0.5 ? (1 - r) * 2 : 1, empty = r < 0.5 ? (0.5 - r) * 2 : 0;
  const key = `${half.toFixed(2)}|${empty.toFixed(2)}`;
  if (levelLayer.dataset.k === key) return;
  levelLayer.dataset.k = key;
  for (const img of levelLayer.children) img.style.opacity = (img.dataset.lvl === 'half' ? half : empty).toFixed(2);
}
function addGlass(who) {
  const img = el('img', 'glass-ov'); img.dataset.who = who; img.alt = '';
  glassLayer.appendChild(img);
  placeGlasses();
  requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('on')));
}

// ---------------- 場面 ----------------
const SCENE_SOUND = {
  handover: { bgm: 'title' }, welcome: { bgm: 'title' }, lobby: { bgm: 'title' },
  kitchen: { bgm: 'dinner' }, dinner: { bgm: 'dinner' }, surprise: { bgm: 'dinner' },
  night: { bgm: 'night' }, breakfast: { bgm: 'morning' }, farewell: { bgm: 'photo' },
};
// 環境音（鳥・水・湯の音）は、ずっとは鳴らさない。その場の様子を見せる操作の間だけ、小さく鳴らす
const BEAT_AMB = { serve: 'garden', drink: 'garden', bath: 'onsen', chopsticks: 'morning', photo: 'garden' };
// 次の場面の絵を先に読みこむ（電波が遅くても、切りかえで暗い画面が出ないように）
const SCENE_ORDER = STORY.filter((b) => b.t === 'scene').map((b) => b.id);
const SCENE_IMAGES = {
  welcome: () => [srcOf(`lobby_view_${look}`), srcOf('walk'), 'img/corridor_wide.webp', 'img/walk_wide.webp', ...[look, 'father', 'mother', 'daughter'].flatMap((n) => [`img/back_${n}.webp`, ...[0, 1, 2, 3].map((i) => `img/back_${n}_w${i}.webp`)])],
  lobby: () => [srcOf('lobby_noglass'), srcOf('lobby_family'), ...['father', 'mother', 'daughter'].flatMap((w) => ['half', 'empty'].map((l) => `img/glass_${w}_${l}_${wide() ? 'wide' : 'p'}.webp`))],
  dinner: () => [srcOf('dinner'), srcOf('dinner_chair')],
  surprise: () => ['base', 'sig', 'joy', 'look'].flatMap((s) => [srcOf(`room205_${s}`), `img/room205_${s}_wide.webp`]).concat(PROPS.cake, PROPS.flames),
  breakfast: () => [srcOf('breakfast'), PROPS.tray, PROPS.chop, PROPS.gift],
  farewell: () => ['img/bg_maruishi.webp', ...FAMILY.flatMap((f) => [f.base, f.smile, f.off])],
};
function preloadScene(id) { (SCENE_IMAGES[id] ? SCENE_IMAGES[id]() : [srcOf(SCENES[id].bg)]).forEach(preload); }
function sceneVoices(id) {
  const i = STORY.findIndex((b) => b.t === 'scene' && b.id === id);
  const out = [];
  for (let k = i + 1; k < STORY.length && STORY[k].t !== 'scene'; k++) if (VOICE[STORY[k].text]) out.push(VOICE[STORY[k].text]);
  return out;
}
function onScene(id) {
  preloadScene(id);
  audio.preloadUrls(sceneVoices(id));
  const next = SCENE_ORDER[SCENE_ORDER.indexOf(id) + 1];
  if (next) preloadScene(next);
  const s = SCENES[id];
  ui.clockT.textContent = s.clock;
  ui.clockS.textContent = s.place;
  ui.scT.textContent = s.clock; ui.scP.textContent = s.place;
  ui.sceneCard.hidden = true; void ui.sceneCard.offsetWidth; ui.sceneCard.hidden = false;
  later(2300, () => { ui.sceneCard.hidden = true; });
  setBg(currentBg());
  uiLock = performance.now() + 1100 / TIME_SCALE;
  const snd = SCENE_SOUND[id] || {};
  audio.loop('bgm', snd.bgm); audio.loop('amb', null);
  const idx = STORY.findIndex((b) => b.t === 'scene' && b.id === id);
  ui.clockArc.style.strokeDashoffset = String(94.2 * (1 - idx / STORY.length));
}

// ---------------- ビート ----------------
function clearBeatUi() {
  setFloatHint(null);
  ui.choices.innerHTML = '';
  ui.hint.hidden = true;
  ui.notice.hidden = true; ui.found.hidden = true; noticeId = null;
  ui.panel.hidden = true; ui.panel.className = 'panel'; ui.panel.innerHTML = '';
  ui.app.classList.remove('bathing');
  ui.app.querySelectorAll('.walk-top').forEach((x) => x.remove());
  clearTimeout(choiceHintTimer);
}
let charaWho = null;
function speaker(who, beat) {
  const c = CHARA[who];
  if (!c) { charaWho = null; ui.chara.innerHTML = ''; return; }
  const src = c.src(beat);
  const cur = ui.chara.querySelector('img');
  if (charaWho === who && cur) { if (!cur.src.endsWith(src)) cur.src = src; return; }   // 同じ人はポーズだけ変える
  charaWho = who;
  ui.chara.innerHTML = '';
  const img = el('img', `from-${c.side}`);
  img.src = src; img.alt = '';
  img.style.setProperty('--xp', c.x.p + '%'); img.style.setProperty('--xw', c.x.w + '%');
  img.onerror = () => img.remove();
  ui.chara.appendChild(img);
  requestAnimationFrame(() => requestAnimationFrame(() => img.classList.add('on')));
}
function finishTyping() { if (typing) { clearInterval(typing.id); ui.line.textContent = typing.text; typing = null; ui.nextMark.hidden = false; } }
function typeLine(text) {
  clearInterval(typing?.id);
  ui.line.textContent = '';
  ui.nextMark.hidden = true;
  let i = 0;
  const speed = 34 * TIME_SCALE;   // 1秒あたりの文字数
  typing = { text, id: setInterval(() => {
    i = Math.min(text.length, i + Math.max(1, Math.round(speed / 30)));
    ui.line.textContent = text.slice(0, i);
    if (i >= text.length) finishTyping();
  }, 1000 / 30) };
}
const GUESTS = ['father', 'mother', 'daughter', 'boy', 'girl'];
function showLine(who, text) {
  ui.talk.hidden = false; ui.box.hidden = false;
  ui.box.className = 'box' + (who === 'me' ? ' me' : GUESTS.includes(who) ? ' guest' : '');
  ui.name.textContent = PEOPLE[who]?.name || '';
  ui.name.hidden = !ui.name.textContent;
  typeLine(text);
}

function onBeat(b) {
  audio.stopVoice();
  ui.app.classList.toggle('in3d', b.t === 'walk' || b.t === 'photo');
  audio.loop('amb', BEAT_AMB[b.t] || null);
  clearBeatUi();
  ui.hud.hidden = false;
  ui.talk.hidden = false;
  if (b.t !== 'walk' && walk3d) arriveLobby();
  if (!['line', 'kitchen'].includes(b.t)) speaker(null);   // 操作する場面では立ち絵を下げる
  switch (b.t) {
    case 'line':
      speaker(b.who, b);
      showLine(b.who, b.text);
      ui.box.classList.toggle('voiced', !!VOICE[b.text]);
      if (VOICE[b.text]) audio.voice(VOICE[b.text]);
      if (b.notice) showNotice(b.notice);
      if (b.who === 'me') audio.se('select', 0.25);
      break;
    case 'card': ui.talk.hidden = true; openCard(true); break;
    case 'choice': return showChoice(b);
    case 'kitchen': return showKitchen();
    case 'walk': return showWalk();
    case 'serve': return showServe();
    case 'drink': return showDrink();
    case 'surprise': return showSurprise();
    case 'bath': return showBath();
    case 'gift': return showGift();
    case 'chopsticks': return showChop();
    case 'photo': return showPhoto();
  }
}

function onFlag(id) {
  const k = KIZUKI.find((x) => x.id === id);
  if (!k) return;
  const p = el('div', 'kizuki-pop', `気づき：${k.title}`);
  ui.app.appendChild(p);
  setTimeout(() => p.remove(), 2700);
  audio.se('kizuki', 0.5);
}

// ---------------- 働く魅力カード（先輩が話し終えたら「ピコン」と出る） ----------------
function onPerk(p) { pendingPerk = p; }
function showPerkCard(p) {
  const n = game.perks.indexOf(p.id) + 1;
  ui.perkCard.querySelector('.pc-n').textContent = `${n} / ${PERKS.length}`;
  ui.perkCard.querySelector('.pc-cat').textContent = p.cat;
  ui.perkCard.querySelector('.pc-title').textContent = p.title;
  ui.perkCard.querySelector('.pc-text').textContent = p.text;
  ui.perkCard.hidden = false;
  ui.perkCard.classList.remove('show'); void ui.perkCard.offsetWidth; ui.perkCard.classList.add('show');
  ui.perkCard.dataset.at = String(performance.now());
  audio.se('perk', 0.7);
  updatePerkCount();
}
function closePerkCard() {
  if (ui.perkCard.hidden || performance.now() - Number(ui.perkCard.dataset.at) < 450 / TIME_SCALE) return;
  ui.perkCard.hidden = true;
  ui.perkBtn.classList.remove('got'); void ui.perkBtn.offsetWidth; ui.perkBtn.classList.add('got');   // 右上のカード入れに入る
  game.tap();
}
ui.perkCard.addEventListener('click', closePerkCard);
function updatePerkCount() { ui.perkN.textContent = `${game.perks.length}/${PERKS.length}`; }
function perkListHtml(got) {
  return PERKS.map((p) => (got.includes(p.id)
    ? `<div class="pk"><span class="c">${p.cat}</span><b>${p.title}</b><p>${p.text}</p></div>`
    : '<div class="pk off"><span class="c">？</span><b>まだ見つけていない</b></div>')).join('');
}
ui.perkBtn.addEventListener('click', () => {
  ui.perkList.querySelector('.list').innerHTML = perkListHtml(game.perks);
  ui.perkList.hidden = false; audio.se('card', 0.5);
});
ui.perkList.addEventListener('click', () => { ui.perkList.hidden = true; });

// せりふを読む（タップ・Enter・スペース）
function advanceTap() {
  if (performance.now() < uiLock) return;
  if (!ui.perkCard.hidden) { closePerkCard(); return; }
  const b = game.beat;
  if (!b) return;
  if (b.t === 'drink') { drinkTap(); return; }
  if (!['line', 'gift', 'bath'].includes(b.t)) return;
  if (typing) { finishTyping(); return; }
  if (pendingPerk) { const p = pendingPerk; pendingPerk = null; showPerkCard(p); return; }
  game.tap();
}
ui.box.addEventListener('click', advanceTap);
ui.app.addEventListener('click', (e) => {
  if (e.target === ui.bgA || e.target === ui.bgB || e.target === ui.app || e.target === ui.chara || e.target.closest?.('.gift-ui, .bath-ui')) advanceTap();
});
addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && ui.title.hidden && ui.result.hidden) { e.preventDefault(); advanceTap(); } });

// ---------------- 気づきの印 ----------------
let noticeId = null;
function placeNotice() {
  if (!noticeId || ui.notice.hidden) return;
  const n = NOTICE[bgName];
  if (!n) return;
  const p = wide() ? n.w : short() && n.short ? n.short : n.p;
  if (p.u != null) {
    const q = bgPoint(p.u, p.v);
    const W = ui.app.clientWidth;
    Object.assign(ui.notice.style, { left: q.x + 'px', top: q.y + 'px' });
    Object.assign(ui.found.style, { left: Math.min(W - 90, Math.max(90, q.x)) + 'px', top: (q.y - 54) + 'px' });
  } else {
    Object.assign(ui.notice.style, { left: p.x + '%', top: p.y + '%' });
    Object.assign(ui.found.style, { left: p.fx + '%', top: p.fy + '%' });
  }
}
function showNotice(id) {
  noticeId = id;
  if (!NOTICE[bgName]) return;
  ui.found.textContent = '気づきの手がかり';
  ui.notice.hidden = false; ui.found.hidden = false;
  placeNotice();
  audio.se('hint', 0.35);
}
ui.notice.addEventListener('click', (e) => {
  e.stopPropagation();
  game.tapNotice(noticeId);
  ui.found.textContent = NOTICE_TEXT[noticeId] || '気づきの手がかり';
  audio.se('hint', 0.5);
});
addEventListener('resize', placeNotice);

// ---------------- 選ぶ ----------------
function showChoice(b) {
  ui.box.hidden = !b.prompt;
  if (b.prompt) { ui.box.className = 'box ask'; ui.name.hidden = true; finishTyping(); ui.line.textContent = b.prompt; ui.nextMark.hidden = true; }
  b.options.forEach((o, i) => {
    const btn = el('button', 'choice' + (o.good === undefined && b.id === 'explain' ? ' weak' : ''), `<span class="k">${o.tag}</span>${o.text}`);
    btn.addEventListener('click', () => {
      if (performance.now() < uiLock) return;
      audio.se('select', 0.5);
      game.choose(i);
    });
    ui.choices.appendChild(btn);
  });
  if (b.hint) choiceHintTimer = later(4000, () => { ui.hintText.textContent = b.hint; ui.hint.hidden = false; });
  if (b.id === 'cake') ui.cardBtn.classList.add('ping');
}

// ---------------- 担当カード ----------------
function openCard(first) {
  ui.cardModal.hidden = false;
  ui.cardModal.dataset.first = first ? '1' : '';
  audio.se('card', 0.6);
}
ui.cardBtn.addEventListener('click', () => { ui.cardBtn.classList.remove('ping'); openCard(false); });
ui.cardClose.addEventListener('click', () => {
  ui.cardModal.hidden = true;
  if (ui.cardModal.dataset.first && game.beat?.t === 'card') game.tap();
});

// ---------------- 調理場 ----------------
function showKitchen() {
  speaker('chef');
  ui.box.hidden = true;
  ui.panel.hidden = false;
  const wrap = el('div', 'sheet kitchen-ui');
  wrap.appendChild(el('h3', '', '料理長に、2つ聞ける'));
  wrap.appendChild(el('p', 's', 'お客さまに料理を出すとき、ひとこと添えられるように。'));
  const qs = el('div', 'qs');
  KITCHEN_Q.forEach((q) => {
    const btn = el('button', 'choice q', `<span class="k">聞く</span><span>${q.ask}<span class="a" hidden>「${q.answer}」</span></span>`);
    btn.addEventListener('click', () => {
      if (btn.classList.contains('asked') || qs.querySelectorAll('.asked').length >= 2) return;
      btn.classList.add('asked'); btn.querySelector('.a').hidden = false;
      audio.se('select', 0.5);
      const n = qs.querySelectorAll('.asked').length;
      if (n >= 2) qs.querySelectorAll('.choice:not(.asked)').forEach((x) => { x.disabled = true; });
      later(n >= 2 ? 1900 : 0, () => game.ask(q.id));
    });
    qs.appendChild(btn);
  });
  wrap.appendChild(qs);
  ui.panel.appendChild(wrap);
}

// ---------------- お出迎え（押している間だけ歩く。廊下→ロビー） ----------------
async function showWalk() {
  ui.box.hidden = true;
  ui.panel.hidden = false;
  const L = CONFIG.walk.length, M = CONFIG.walk.corridorEnd;
  const wrap = el('div', 'walk-ui');
  const meter = el('div', 'walk-meter', `<i class="track"></i><i class="zone"></i>
    <span class="area a1" style="width:calc(100% - 32px)">廊下 → 光の差すロビーへ</span>
    <span class="dot fa"><b>お父さま</b></span><span class="dot me"><b>あなた</b></span>`);
  const hold = el('button', 'hold', '押している間、歩く');
  // メーターは画面の上に（下に置くと、歩く人の足もとが隠れる）
  const top = el('div', 'walk-top'); top.appendChild(meter);
  ui.app.appendChild(top);
  wrap.append(hold);
  ui.panel.appendChild(wrap);
  let stepT = null;
  const on = (v) => (e) => {
    e.preventDefault(); game.hold(v); hold.classList.toggle('on', v);
    clearInterval(stepT);
    if (v) { audio.se('step', 0.22); stepT = setInterval(() => audio.se('step', 0.18), 560 / TIME_SCALE); }
  };
  hold.addEventListener('pointerdown', on(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => hold.addEventListener(t, on(false)));
  walkStopSteps = () => clearInterval(stepT);
  // 3D（絵が届いていれば）。準備のあいだに場面が進んでいたら、出さずに片づける
  try {
    const m = await import('./walk3d.js');
    if (game.beat?.t !== 'walk') return;
    const canvas = $('stage3d');
    const scene = await m.createWalkScene({ canvas, look, low: params.get('q') === 'low' });
    if (game.beat?.t !== 'walk') { scene.dispose(); return; }
    walk3d = scene;
    walkShownAt = performance.now();
    canvas.hidden = false;
    scene.resize();   // 隠していた間は大きさが0なので、出してから合わせる
  } catch { /* 3D が無いときは、下のメーターだけで遊べる */ }
}
let walkStopSteps = () => {};
// 廊下の奥の光：近づくほど画面がほのかに明るくなり、着いたら光に包まれて、ロビーの場面が現れる
const veil = el('div', 'light-veil');
ui.app.appendChild(veil);
function arriveLobby() {
  const w3 = walk3d; walk3d = null;
  uiLock = performance.now() + 2000 / TIME_SCALE;     // 光が引くまでは、タップしても進まない
  ui.talk.style.visibility = 'hidden';
  veil.style.transition = `opacity ${0.7 / TIME_SCALE}s ease-in`;
  veil.style.opacity = '1';
  audio.se('kizuki', 0.25);
  later(750, () => {
    $('stage3d').hidden = true; w3.dispose(); ui.app.classList.remove('in3d');
    setBg(currentBg(), true);                          // 光の向こうは、ロビーの窓ぎわの席
    veil.style.transition = `opacity ${1.5 / TIME_SCALE}s ease-out`;
    veil.style.opacity = '0';
    later(1000, () => { ui.talk.style.visibility = ''; });
  });
}
// 歩きはじめの数秒、お父さまの杖に「気づきの手がかり」の印を出す（スマホでも杖に目が行くように）
let walkShownAt = 0;
const caneMark = el('div', 'cane-mark', '<i></i><span>杖をついている……？</span>');
caneMark.hidden = true;
ui.app.appendChild(caneMark);
function updateCane() {
  const on = !!walk3d && game.beat?.t === 'walk' && performance.now() - walkShownAt < 5200 / TIME_SCALE;
  const q = on ? walk3d.canePoint() : null;
  caneMark.hidden = !q;
  if (q) { Object.assign(caneMark.style, { left: q.x + 'px', top: q.y + 'px' }); caneMark.classList.toggle('to-l', q.x > ui.app.clientWidth * 0.55); }   // 右に寄っていたら、文字は左に出す
}
// 操作のパネルが出ているときの先輩のヒント（パネルに隠れないよう、上に浮かせる）
const floatHint = el('div', 'float-hint', '<img src="img/senpai_face_w.webp" alt=""><p></p>');   // 声をかけるときは、心配そうな顔
floatHint.hidden = true;
ui.app.appendChild(floatHint);
function setFloatHint(text) {
  floatHint.hidden = !text;
  if (text && floatHint.querySelector('p').textContent !== text) { floatHint.querySelector('p').textContent = text; audio.se('hint', 0.35); }
  if (!text) floatHint.querySelector('p').textContent = '';
}
function updateWalk() {
  const w = game.walk;
  if (!w || game.beat?.t !== 'walk') { walkStopSteps(); if (!caneMark.hidden) caneMark.hidden = true; return; }
  if (walk3d) walk3d.update(w);   // 3Dは自分の描く回数で動く（ここでは位置を渡すだけ）
  setFloatHint(game.hint);
  // 画面の文字やメーターは、1秒に約15回だけ書きかえる（毎フレーム書きかえると、スマホでカクつく）
  const now = performance.now();
  if (now - (updateWalk.at || 0) < 66) return;
  updateWalk.at = now;
  updateCane();
  if (walk3d) {
    const o = (walk3d.nearDoor() * 0.32).toFixed(2);
    if (veil.dataset.o !== o) { veil.dataset.o = o; veil.style.transition = 'none'; veil.style.opacity = o; }
  }
  const meter = ui.app.querySelector('.walk-top .walk-meter');
  if (!meter) return;
  const L = CONFIG.walk.length;
  const track = meter.clientWidth - 32;
  const px = (x) => 16 + track * Math.max(0, Math.min(L, x)) / L;
  const key = `${Math.round(px(w.p))}|${Math.round(px(w.f))}`;
  if (meter.dataset.k === key) return;
  meter.dataset.k = key;
  const me = meter.querySelector('.me'), fa = meter.querySelector('.fa');
  me.style.transform = `translateX(${px(w.p)}px)`;
  fa.style.transform = `translateX(${px(w.f)}px)`;
  me.style.setProperty('--t', (Math.max(0, w.p) / L).toFixed(2)); fa.style.setProperty('--t', (Math.max(0, w.f) / L).toFixed(2));   // 名前の文字が、はしで切れないように
  fa.classList.toggle('far', w.p - w.f > CONFIG.walk.farGap);
  const zone = meter.querySelector('.zone');
  const z0 = px(Math.max(0, w.p - CONFIG.walk.goodGap));
  zone.style.transform = `translateX(${z0}px)`;
  zone.style.width = `${px(w.p) - z0}px`;
}

// ---------------- ロビー：ウェルカムドリンクをお出しする ----------------
const SERVE = [['father', 'お父さま'], ['mother', 'お母さま'], ['daughter', '娘さま']];
for (const w of ['father', 'mother', 'daughter']) for (const k of ['p', 'wide']) preload(`img/glass_${w}_${k}.webp`);
function showServe() {
  ui.box.hidden = true;
  ui.panel.hidden = false;
  const wrap = el('div', 'sheet serve-ui');
  wrap.appendChild(el('h3', '', 'ウェルカムドリンクをお出しする'));
  wrap.appendChild(el('p', 's', 'お盆のグラスを、お一人ずつテーブルへ。'));
  const row = el('div', 'serve-row');
  for (const [id, name] of SERVE) {
    const b = el('button', 'serve-btn', `<i class="gl"></i><span>${name}へ</span>`);
    b.addEventListener('click', () => {
      if (performance.now() < uiLock || b.classList.contains('done')) return;
      b.classList.add('done'); b.querySelector('span').innerHTML = `${name}<small>お出しした</small>`;
      audio.se('glass', 0.55);
      addGlass(id);
      game.serve(id);
    });
    row.appendChild(b);
  }
  wrap.appendChild(row);
  ui.panel.appendChild(wrap);
}

// ---------------- ロビー：飲み終えるまでの間（お話をして待ち、飲み終えたらご案内） ----------------
let drinkQueue = [];
let drinkDone = false;   // 「ごちそうさま」を言ったか
function drinkTopics() { return Object.keys(DRINK_TALK).filter((k) => (k !== 'drama' || SETTINGS.showDrama) && !game.drink.talked[k]); }
function showDrink() {
  drinkQueue = []; drinkDone = false;
  ui.panel.hidden = false;
  ui.panel.className = 'panel drink-panel';
  ui.panel.appendChild(el('div', 'sheet drink-ui', '<div class="glass"><i class="gl"></i><span class="lab">ご家族のグラス</span><span class="bar"><i></i></span><span class="lt"></span></div>'));
  showLine('daughter', 'このドリンク、おいしい……。お庭を見ながら飲めるなんて、ぜいたくだね。');
  renderDrinkChoices();
}
function renderDrinkChoices() {
  ui.choices.innerHTML = '';
  if (drinkQueue.length || game.beat?.t !== 'drink') return;
  const opts = drinkTopics().map((k) => ['話す', DRINK_TALK[k].label, () => drinkTalk(k)]);
  opts.push(['案内する', 'お部屋へご案内する', () => { audio.se('fusuma', 0.4); game.guide(); }]);
  for (const [tag, text, fn] of opts) {
    const b = el('button', 'choice' + (tag === '案内する' ? ' go' : ''), `<span class="k">${tag}</span>${text}`);
    b.addEventListener('click', () => { if (performance.now() < uiLock) return; audio.se('select', 0.5); fn(); });
    ui.choices.appendChild(b);
  }
}
function drinkTalk(k) {
  game.drinkTalk(k);
  drinkQueue = DRINK_TALK[k].lines.slice();
  ui.choices.innerHTML = '';
  nextDrinkLine();
}
function nextDrinkLine() {
  const t = drinkQueue.shift();
  if (t) { showLine(t[0], t[1]); return; }
  // 話しおえた：飲み終えていれば「ごちそうさま」を1度だけ、まだなら様子を見せる
  if (game.drink.left <= 0 && !drinkDone) sayDone();
  else showLine('me', game.drink.left > 0 ? '（皆さま、お庭をながめながら、ゆっくりグラスを傾けている）' : '（グラスは空になった。お部屋へご案内しよう）');
  renderDrinkChoices();
}
function sayDone() { drinkDone = true; showLine('daughter', 'ごちそうさまでした！ おいしかった。'); audio.se('glass', 0.45); }
function drinkTap() {
  if (typing) { finishTyping(); return; }
  if (drinkQueue.length || ui.choices.childElementCount === 0) nextDrinkLine();
}
function updateDrink() {
  const d = game.drink;
  if (!d || game.beat?.t !== 'drink') return;
  const g = ui.panel.querySelector('.glass');
  if (!g) return;
  const r = d.left / CONFIG.drink.seconds;
  const key = r.toFixed(3);
  if (g.dataset.k === key) return;
  g.dataset.k = key;
  g.querySelector('.bar i').style.width = `${r * 100}%`;
  g.querySelector('.gl').style.setProperty('--lv', r.toFixed(3));
  g.querySelector('.lt').textContent = r > 0.5 ? 'まだたっぷり' : r > 0 ? 'あと少し' : '飲み終えた';
  // 会話していないときに飲み終えたら、そこで「ごちそうさま」
  if (d.left <= 0 && !drinkDone && !drinkQueue.length) { sayDone(); renderDrinkChoices(); }
}

// ---------------- 205号室：お誕生日のケーキ ----------------
function showSurprise() {
  ui.box.hidden = true;
  ui.panel.hidden = false;
  const wrap = el('div', 'sheet sur-ui');
  wrap.innerHTML = `<h3 class="st">ろうそくに火をつける</h3><p class="s">ろうそくを1本ずつタップ</p>
    <div class="sample"><img src="img/sample_sig.webp" alt="合図の見本：中島さまのウインクとOKサイン"><span>これが<b>合図</b>！<br>中島さまの<br><b>ウインク＋OKサイン</b></span></div>
    <div class="sur-body"><div class="peek" aria-hidden="true"><span>ふすまのすき間から</span><b class="sig-tag">合図！</b><b class="look-tag">見られている！</b></div>
    <div class="cake"><img class="base" src="${PROPS.cake}" alt="お誕生日のケーキ">
    ${PROPS.flames.map((f, i) => `<img class="fl" data-i="${i}" src="${f}" alt="">`).join('')}
    ${PROPS.wicks.map((w, i) => `<button class="wick" data-i="${i}" style="left:${w.x}%;top:${w.y}%" aria-label="ろうそく${i + 1}"></button>`).join('')}</div></div>
    <button class="btn-teal bring" disabled>ケーキをお持ちする</button>`;
  ui.panel.appendChild(wrap);
  ui.panel.className = 'panel sur-panel';
  wrap.querySelectorAll('.wick').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.i);
    if (game.sur?.lit[i]) return;
    game.light(i);
    audio.se('match', 0.6);
    b.classList.add('lit');
    wrap.querySelector(`.fl[data-i="${i}"]`).classList.add('on');
    if (game.sur.stage === 'wait') {
      wrap.querySelector('.st').textContent = '中島さまの「合図」を待つ';
      wrap.querySelector('.s').innerHTML = '中島さまが <b>ウインクとOKサイン</b> をしたら、すぐに運ぼう';
      wrap.querySelector('.bring').disabled = false;
      wrap.querySelector('.bring').textContent = '合図を待っている……';
      wrap.classList.add('waiting');
    }
  }));
  wrap.querySelector('.bring').addEventListener('click', () => {
    if (game.sur?.stage !== 'wait') return;
    const ok = game.sur.signal;
    audio.se('knock', 0.6);
    later(350, () => audio.se('fusuma', 0.5));
    if (ok) later(900, () => audio.se('cheer', 0.55));
    game.bringCake();
  });
  updatePeek(true);
}
let peekKey = null;
function updatePeek(force) {
  const p = ui.panel.querySelector('.peek');
  if (!p) return;
  const key = currentBg();
  if (!force && key === peekKey && p.dataset.w === String(p.clientWidth)) return;
  peekKey = key; p.dataset.w = String(p.clientWidth);
  const s = p.clientWidth / PEEK.w;
  Object.assign(p.style, {
    backgroundImage: `url(img/${key}_wide.webp)`, backgroundSize: `${1536 * s}px auto`,
    backgroundPosition: `${-PEEK.x * s}px ${-PEEK.y * s}px`, height: `${PEEK.h * s}px`,
  });
  const sig = key === 'room205_sig';
  if (sig && !p.classList.contains('sig')) audio.se('hint', 0.4);   // 合図が出た瞬間に、小さな音
  p.classList.toggle('sig', sig);
  const look = key === 'room205_look';
  p.classList.toggle('look', look);
  const bring = ui.panel.querySelector('.sur-ui .bring');
  if (bring && game.sur?.stage === 'wait') {
    bring.textContent = sig ? '今だ！ ケーキをお持ちする' : look ? 'お連れさまが、こちらを見ている……' : '合図を待っている……';
    bring.classList.toggle('now', sig); bring.classList.toggle('danger', look);
  }
}
function updateSurprise() {
  if (game.sceneId !== 'surprise') return;
  const k = currentBg();
  if (k !== bgName) setBg(k, k !== 'room205_joy');   // 合図はすぐに見せる（ゆっくり切りかえると、見のがしてしまう）
  if (game.beat?.t === 'surprise') { updatePeek(false); setFloatHint(game.hint); }
}

// ---------------- 仕事のあとの温泉 ----------------
function showBath() {
  ui.box.hidden = false;
  ui.app.classList.add('bathing');
  ui.panel.hidden = false;
  ui.panel.className = 'panel bath-panel';
  ui.panel.appendChild(el('div', 'bath-ui', '<i class="steam s1"></i><i class="steam s2"></i><i class="steam s3"></i><p class="sfx">ちゃぽん……</p>'));
  showLine('me', '（湯船に、肩までつかる）');
  audio.se('bath', 0.8);
}

// ---------------- 朝食：お祝いの箸をお渡しする ----------------
function showGift() {
  ui.panel.hidden = false;
  ui.panel.className = 'panel gift-panel';
  ui.panel.appendChild(el('div', 'gift-ui', `<div class="gift-card"><p class="from">旅館から、お祝いの贈り物</p>
    <img src="${PROPS.gift}" alt="桐の箱に入った夫婦箸"><p class="what">夫婦箸<small class="yomi">めおとばし</small><small>桐の箱に、紅白の水引</small></p></div>`));
  showLine('me', 'ご結婚35周年、おめでとうございます。旅館からのお祝いの夫婦箸です。どうぞ、お持ち帰りください。');
  audio.se('box', 0.6);
}

// ---------------- 朝食：お箸を並べる ----------------
function showChop() {
  ui.box.hidden = true;
  ui.panel.hidden = false;
  const wrap = el('div', 'sheet chop-ui');
  wrap.appendChild(el('h3', '', '朝食のお膳に、お箸を並べる'));
  wrap.appendChild(el('p', 'legend', 'お箸は、ふつう<b>箸先を左</b>に向けて置きます（右手で取りやすいように）。お客さまに合わせて向きを変えるときは、お膳をタップ。'));
  const trays = el('div', 'trays');
  [['father', 'お父さま'], ['mother', 'お母さま'], ['daughter', '娘さま']].forEach(([id, name]) => {
    const t = el('button', 'tray', `<span class="who">${name}</span><span class="zen"><img class="ti" src="${PROPS.tray}" alt=""><img class="sticks" src="${PROPS.chop}" alt="お箸"></span><span class="dir">箸先：左</span>`);
    t.dataset.id = id;
    t.addEventListener('click', () => {
      game.flip(id);
      const f = game.chop.flipped[id];
      t.classList.toggle('flip', f);
      t.querySelector('.dir').textContent = f ? '箸先：右' : '箸先：左';
      audio.se('chop', 0.6);
    });
    trays.appendChild(t);
  });
  const done = el('button', 'btn-teal', '並べおわった');
  done.addEventListener('click', () => { audio.se('cup', 0.5); game.chopDone(); });
  wrap.append(trays, done);
  ui.panel.appendChild(wrap);
}
function updateChop() {
  if (game.beat?.t !== 'chopsticks') return;
  setFloatHint(game.hint);
}

// ---------------- 記念写真（3D） ----------------
async function showPhoto() {
  ui.talk.hidden = true;
  ui.panel.hidden = false;
  ui.panel.className = 'panel full';
  ui.panel.innerHTML = `
  <div class="photo-ui">
    <div class="top"><div class="hint"><img src="img/senpai_face.webp" alt=""><p>3人ともお顔がそろって、うしろに「円石」が入るといいね。家族円満の石だから。</p></div></div>
    <div class="finder" id="finder"><canvas id="pcanvas"></canvas><div class="grid"></div>
      <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      <div class="drag">指でなぞって向きを変える</div><div class="tags" id="ptags"></div></div>
    <div class="ctrl">
      <div class="row"><span class="lab">立ち位置</span><div class="spots"><button class="spot" data-i="0">左</button><button class="spot on" data-i="1">正面</button><button class="spot" data-i="2">右</button></div></div>
      <div class="row"><span class="lab">ズーム</span><span class="zl">引き</span><input id="pzoom" type="range" min="0" max="100" value="85" aria-label="ズーム（左で引き・右で寄り）"><span class="zl">寄り</span></div>
      <div class="shoot"><button class="call" id="pcall">声をかける</button><button class="shutter" id="pshutter" aria-label="シャッター"><i></i></button>
        <div class="mood">ご家族の様子<b id="pmood">円石を見ている</b></div></div>
    </div>
    <div class="print" id="pprint"><div class="paper"><img id="pshot" alt=""><p>10:08 円石の前にて</p></div><ul class="review" id="preview"></ul>
      <div class="btns2"><button class="again" id="pagain">撮りなおす</button><button class="keep" id="pkeep">この写真にする</button></div></div>
  </div>`;
  const { createPhotoScene } = await import('./photo3d.js');
  photo = await createPhotoScene({ canvas: $('pcanvas'), bg: 'img/bg_maruishi.webp', family: FAMILY, low: params.get('q') === 'low' });
  const finder = $('finder');
  let drag = null;
  finder.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; finder.setPointerCapture(e.pointerId); });
  finder.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = (photo.cam.fov * Math.PI / 180) / finder.clientHeight;
    photo.turn((e.clientX - drag.x) * k, (e.clientY - drag.y) * k);
    drag = { x: e.clientX, y: e.clientY };
  });
  finder.addEventListener('pointerup', () => { drag = null; });
  ui.panel.querySelectorAll('.spot').forEach((b) => b.addEventListener('click', () => {
    ui.panel.querySelectorAll('.spot').forEach((x) => x.classList.toggle('on', x === b));
    photo.setSpot(Number(b.dataset.i)); audio.se('step', 0.2);
  }));
  $('pzoom').addEventListener('input', (e) => photo.setZoom(Number(e.target.value) / 100));
  $('pcall').addEventListener('click', () => { game.photoCall(); audio.se('select', 0.4); });
  $('pshutter').addEventListener('click', () => {
    const shot = game.shoot(photo.view());
    if (!shot) return;
    photo.setMood(shot.mood, KIZUKI.filter((k) => game.flags[k.id]).length >= 4);
    audio.se('shutter', 0.8);
    shotImage = photo.capture();
    $('pshot').src = shotImage;
    const li = (ok, t) => `<li class="${ok ? 'g' : 'b'}">${ok ? '○' : '△'} ${t}</li>`;
    $('preview').innerHTML =
      li(shot.heads === 3, shot.heads === 3 ? '3人ともお顔が入った' : `お顔が入ったのは ${shot.heads}人`) +
      li(shot.stone, shot.stone ? 'うしろに家族円満の「円石」が入った' : '円石が入っていない') +
      li(shot.mood === 'smile', shot.mood === 'smile' ? '声をかけて、こちらを向いた瞬間' : shot.mood === 'blink' ? 'お父さまが目をつぶっていた' : 'まだ円石を見ている（声をかけてから撮ろう）') +
      li(shot.sizeOk, shot.size > CONFIG.photo.sizeMax ? '近すぎて窮屈' : shot.size < CONFIG.photo.sizeMin ? '人が小さい' : 'ちょうどよい大きさ');
    $('pprint').classList.add('show');
  });
  $('pagain').addEventListener('click', () => { $('pprint').classList.remove('show'); });
  $('pkeep').addEventListener('click', () => { audio.se('clap', 0.5); game.photoKeep(); });
}
function updatePhoto() {
  if (!photo || game.beat?.t !== 'photo' || $('pprint')?.classList.contains('show')) return;
  const mood = game.photoMood();
  photo.setMood(mood, KIZUKI.filter((k) => game.flags[k.id]).length >= 4);   // 変わったときだけ切りかわる
  // 文字と構図の印は、1秒に約10回・変わったときだけ書きかえる（3Dをなめらかに動かすため）
  const now = performance.now();
  if (now - (updatePhoto.at || 0) < 100) return;
  updatePhoto.at = now;
  const m = $('pmood'), mt = mood === 'off' ? '円石を見ている' : 'こちらを向いた';
  if (m && m.textContent !== mt) m.textContent = mt;
  const t = $('ptags');
  if (t) {
    const v = photo.view(), sp = PHOTO_SCENE.spots[v.spot];
    const j = judgeFrame({ ...sp, yaw: v.yaw, pitch: v.pitch, aspect: v.aspect, fov: PHOTO_SCENE.fov(v.zoom, v.aspect) });
    const key = `${j.heads}${j.stone}${j.feet}`;
    if (t.dataset.k !== key) {
      t.dataset.k = key;
      t.innerHTML = `<span class="tag ${j.heads === 3 ? 'ok' : ''}">お顔 ${j.heads}/3</span><span class="tag ${j.stone ? 'ok' : ''}">円石</span><span class="tag ${j.feet === 3 ? 'ok' : ''}">足もと</span>`;
    }
  }
}

// ---------------- ふり返り ----------------
function onFinish() {
  const r = game.result();
  if (photo) { photo.dispose(); photo = null; }
  audio.stopVoice();
  ui.panel.hidden = true; ui.talk.hidden = true; ui.hud.hidden = true; speaker(null);
  audio.loop('amb', null); audio.loop('bgm', 'ending');
  const letter = buildLetter(r);
  const senpai = buildSenpai(r);
  const finds = KIZUKI.map((k) => {
    const got = r.got.includes(k.id);
    return `<div class="find ${got ? '' : 'miss'}"><b>${got ? k.title : '？'}</b>${got ? k.done : 'まだ見つけていない'}</div>`;
  }).join('');
  const sur = r.surprise ? '205号室：合図ぴったりにケーキをお持ちできた' : '205号室：ケーキはお渡しできた（合図より少し早かった）';
  ui.result.innerHTML = `<div class="wrap">
    <div class="head"><p class="s">はじめての担当 ・ ふり返り</p><h2>おつかれさまでした</h2><div class="rule"></div></div>
    <div class="cols"><div class="c1">
      <div class="photo"><div class="pic shot">${shotImage ? `<img src="${shotImage}" alt="撮った写真">` : ''}</div><p>10:08 円石の前にて</p></div>
      <div class="letter"><span class="lab">お部屋に残されていた一筆</span><p>${letter}</p><p class="from">― 202号室 佐倉より</p></div>
      <a class="btn main early" href="${SETTINGS.internshipUrl}" target="_blank" rel="noopener">${SETTINGS.internshipLabel}</a>
    </div><div class="c2">
      <div class="sec"><h3>気づけたこと ${r.count} / ${KIZUKI.length}</h3><div class="finds">${finds}</div><p class="sur">${sur}</p>
      <div class="senpai"><img src="img/senpai_face.webp" alt=""><p>${senpai}</p></div></div>
      <div class="sec"><h3>集めた 働く魅力カード ${r.perks.length} / ${PERKS.length}</h3><div class="perks">${perkListHtml(r.perks)}</div></div>
    </div><div class="c3">
      <div class="sec"><h3>この仕事の、本当のこと</h3><ul class="facts">${SETTINGS.facts.map((f) => `<li>${f}</li>`).join('')}</ul></div>
      <div class="sec"><h3>募集要項（求人情報より）</h3><dl class="recruit">${SETTINGS.recruit.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl><p class="real-cap">${SETTINGS.recruitNote}</p></div>
      <div class="sec"><h3>本物の 宙 SORA</h3><div class="real">${REAL.map((x) => `<img src="${x.src}" alt="${x.alt}">`).join('')}</div>
      <p class="real-cap">ロビーから見る庭・掘りごたつの個室・家族円満の「円石」。ゲームの場所は実際にあります（公式サイトの写真）</p></div>
      <div class="btns"><a class="btn main" href="${SETTINGS.internshipUrl}" target="_blank" rel="noopener">${SETTINGS.internshipLabel}</a><button class="btn sub" id="retry">もう一度担当する</button></div>
    </div></div></div>`;
  ui.result.hidden = false;
  ui.result.scrollTop = 0;
  $('retry').addEventListener('click', () => { audio.se('select', 0.5); ui.result.hidden = true; startGame(); });
  audio.se('kizuki', 0.6);
}
function buildLetter(r) {
  const has = (k) => r.got.includes(k);
  const parts = ['担当の方へ。'];
  if (has('anniv')) parts.push('主人が「35年前と同じ紅葉だ」と、朝からずっとうれしそうでした。お祝いのお箸、大切に使います。');
  else parts.push('35年ぶりの修善寺、主人と紅葉を見ながら、昔の話をたくさんしました。');
  if (has('lefty')) parts.push('朝のお箸の向き、気づいてくださってありがとう。');
  if (has('seat') || has('pace')) parts.push('主人の足のことまで気にかけていただき、心強かったです。');
  parts.push(r.count >= 4 ? 'また3人で来ますね。' : 'また来たいと思います。');
  return parts.join('');
}
function buildSenpai(r) {
  const miss = KIZUKI.filter((k) => !r.got.includes(k.id));
  if (!miss.length) return '全部気づけたね！ 来たときより良い笑顔で、お見送りできたね。';
  const good = KIZUKI.find((k) => r.got.includes(k.id));
  const tips = {
    pace: '次は、杖のお父さまの速さに合わせて歩いてみよう。',
    seat: '足の悪い方には、椅子席の個室をおすすめできるよ。',
    drink: '次は、グラスを見て、飲み終えてからご案内してみよう。',
    anniv: 'お客さまの言葉には、ヒントがかくれているよ。',
    cake: '担当カードの「ご依頼」は、忘れずにね。',
    lefty: 'お母さまは左利き。夕食のとき、ご自分でお箸を置き直していたよ。左利きの方には、箸先を右に向けて置くと取りやすいんだ。',
  };
  return `${good ? `「${good.title}」、よく気づいたね。` : 'はじめての担当、おつかれさま。'}${tips[miss[0].id]}`;
}

// ---------------- はじめる ----------------
document.querySelectorAll('.title .av').forEach((b) => b.addEventListener('click', () => {
  look = b.dataset.look;
  document.querySelectorAll('.title .av').forEach((x) => x.classList.toggle('on', x === b));
  audio.unlock(); audio.se('select', 0.5);
}));
function startGame() {
  shotImage = null; pendingPerk = null; charaWho = null;
  ui.perkCard.hidden = true;
  ui.title.hidden = true;
  game.start(look);
  updatePerkCount();
  const to = params.get('scene');
  if (to) game.skipTo(to, Object.fromEntries((params.get('flags') || '').split(',').filter(Boolean).map((f) => [f, true])));
}
ui.start.addEventListener('click', () => { audio.unlock(); audio.preload(); audio.preloadUrls(sceneVoices('handover')); audio.se('select', 0.5); startGame(); });
ui.mute.addEventListener('click', () => { audio.setMuted(!audio.muted); ui.mute.classList.toggle('muted', audio.muted); });
audio.loop('bgm', null);

// ---------------- まわす ----------------
let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000; last = now;
  game.advance(dt * TIME_SCALE);
  if (game.sceneId === 'lobby' && currentBg() !== bgName) { setBg(currentBg()); setTimeout(() => { glassLayer.innerHTML = ''; }, 1200); }   // 3人にお出しし終えたら、グラスのある絵へ
  if (game.sceneId !== 'lobby' && glassLayer.childElementCount) glassLayer.innerHTML = '';
  if (game.sceneId === 'welcome' && game.walk?.done && currentBg() !== bgName) setBg(currentBg());
  showCake(game.sceneId === 'surprise' && game.sur?.stage === 'done');
  updateWalk(); updateDrink(); updateLevels(); updateSurprise(); updateChop(); updatePhoto();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 自動テスト・自動プレイ用の入口
window.__game = {
  CONFIG, STORY,
  get g() { return game; },
  get bgName() { return bgName; },
  get photoReady() { return !!photo; },
  photoView: () => photo && photo.view(),
  photoApi: () => photo,
  start: (l = 'f') => { look = l; startGame(); },
  skipTo: (id, flags) => game.skipTo(id, flags),
};

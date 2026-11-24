// お出迎えの3D：玄関から「廊下」を歩いて、奥の光の差す入口（ロビー）へ。
// 廊下の絵を床・壁・天井の「箱」の形に貼る。奥の入口から差す光は、近づくほど強くなる（着いたら、画面が光に包まれてロビーの場面へ）。
// スタッフとご家族はうしろ姿で、歩きの4コマで歩く。カメラはご家族のうしろからついていく。
import * as THREE from 'three';
import { CONFIG } from './logic.js';
import { autoQuality, wantAntialias } from './autoquality.js';

// 絵を描いた「目」（どちらも高さ1.5m）と、箱の大きさ
const EYE = 1.5;
const ROOMS = {
  // 廊下：幅3m・天井3m・奥行き12m。地平線は絵の上から46%
  corridor: { img: 'img/corridor_wide.webp', W: 1536, H: 1024, F: 1475, horizon: 0.46, half: 1.5, ceil: 3.0, back: -12, eyeZ: 0 },
};
// 奥の入口（絵の u .385〜.615・v .34〜.535）の、3Dでの位置と大きさ
const DOOR = { x: 0, y: 1.69, z: -11.9, w: 2.9, h: 1.65 };

function buildRoom(r, tex) {
  const ray = (u, v) => new THREE.Vector3((u - 0.5) * r.W / r.F, -(v - r.horizon) * r.H / r.F, -1);
  const hit = (u, v) => {
    const d = ray(u, v);
    let t = Infinity;
    if (d.y < 0) t = Math.min(t, -EYE / d.y);
    if (d.y > 0) t = Math.min(t, (r.ceil - EYE) / d.y);
    if (d.x < 0) t = Math.min(t, -r.half / d.x);
    if (d.x > 0) t = Math.min(t, r.half / d.x);
    t = Math.min(t, r.back / d.z);
    return d.multiplyScalar(t).add(new THREE.Vector3(0, EYE, r.eyeZ));
  };
  const NX = 160, NY = 110;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const u = i / NX, v = j / NY;
    const p = hit(u, v);
    pos.push(p.x, p.y, p.z); uv.push(u, 1 - v);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // 箱どうしは重なるので、奥行きでは比べず「描く順番」で重ねる（ロビー → 廊下 → 影 → 人）
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true }));
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(40,28,16,.5)'); g.addColorStop(1, 'rgba(40,28,16,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// 「あなた」の頭の上に出す名札（いつも画面の正面を向く）
function makeTag(text, scene) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 112;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(107,90,138,.95)';
  x.beginPath(); x.roundRect(8, 8, 240, 64, 32); x.fill();
  x.beginPath(); x.moveTo(110, 70); x.lineTo(146, 70); x.lineTo(128, 100); x.closePath(); x.fill();
  x.fillStyle = '#fff'; x.font = 'bold 38px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 128, 41);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(0.34, 0.15, 1); sp.renderOrder = 50;
  scene.add(sp);
  return sp;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 歩く道のり（logic の 0〜14m）を奥行き（z）に：z -4.6〜-10.4（奥の入口の手前まで）
const zOf = (p) => -4.6 - 5.8 * Math.min(1, Math.max(0, p) / CONFIG.walk.length);
// 横の位置。お母さまはお父さまの左、杖のある右側はあける
const XS = { me: 0.48, father: -0.08, mother: -0.68, daughter: 0.82 };
const xOf = (id) => XS[id];

// 入口から差す光（まん中が白く、まわりにやわらかく広がる）
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,253,244,1)'); g.addColorStop(0.45, 'rgba(255,244,214,.75)'); g.addColorStop(1, 'rgba(255,236,200,0)');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export async function createWalkScene({ canvas, look, low = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: wantAntialias(low), powerPreference: 'high-performance' });
  // 画面のきめ細かさは 1.5倍まで。重い端末では自動で下げる
  const aq = autoQuality(renderer, () => resize(), { start: Math.min(devicePixelRatio, low ? 1 : 1.5) });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a2e22);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);
  const loader = new THREE.TextureLoader();
  const load = (url) => new Promise((ok) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, () => ok(null)));

  const ct = await load(ROOMS.corridor.img);
  if (ct) { const m = buildRoom(ROOMS.corridor, ct); m.renderOrder = 0; scene.add(m); renderer.initTexture(ct); }
  // 奥の入口の光（近づくほど強く、大きく）
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w * 2.2, DOOR.h * 2.4),
    new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.15 }));
  glow.position.set(DOOR.x, DOOR.y, DOOR.z); glow.renderOrder = 1;
  scene.add(glow);
  const shadow = shadowTexture();
  // stride：1コマ進むのに歩く距離（m）。お父さまはひざが悪いので歩幅が小さい
  const who = [
    { id: 'me', src: `img/back_${look}`, h: 1.6, stride: look === 'f' ? 0.2 : 0.26 },
    { id: 'father', src: 'img/back_father', h: 1.69, stride: 0.15 },
    { id: 'mother', src: 'img/back_mother', h: 1.57, stride: 0.19 },
    { id: 'daughter', src: 'img/back_daughter', h: 1.63, stride: 0.26 },
  ];
  const sprites = {};
  for (const p of who) {
    // 歩きの4コマ（右足前・そろう・左足前・そろう）
    const cyc = await Promise.all([0, 1, 2, 3].map((i) => load(`${p.src}_w${i}.webp`)));
    const t0 = await load(`${p.src}.webp`);
    if (!t0) continue;
    const frames = cyc.every(Boolean) ? cyc : [t0, t0, t0, t0];   // 4コマが無いときは、立ち姿のまま
    const a = t0.image.width / t0.image.height;
    const mat = new THREE.MeshBasicMaterial({ map: t0, transparent: true, alphaTest: 0.03, depthTest: false, depthWrite: false, color: new THREE.Color(1, 0.97, 0.92) });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.h * a, p.h), mat);
    m.geometry.translate(0, p.h / 2, 0);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(p.h * a * 1.4, 0.55), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthTest: false, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.renderOrder = 2;
    scene.add(m, s);
    sprites[p.id] = { m, s, t0, frames, stride: p.stride, dist: 0, lastP: null, h: p.h, w: p.h * a };
    [t0, ...frames].forEach((t) => renderer.initTexture(t));   // 先に画面の部品へ送っておく（歩き出してからのカクつきを防ぐ）
    if (p.id === 'me') sprites.me.tag = makeTag('あなた', scene);
  }

  // 画面の形に合わせて、絵と同じ見え方にする（廊下の絵を基準。縦長は中央を切り出す）
  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    const r = ROOMS.corridor;
    const aspect = w / h;
    const half = Math.max(r.horizon, 1 - r.horizon) * r.H;
    const fullH = half * 2, offY = half - r.horizon * r.H;
    let vw = r.H * aspect, vh = r.H, vx = (r.W - vw) / 2, vy = offY;
    if (vw > r.W) { vw = r.W; vh = r.W / aspect; vx = 0; vy = offY + (r.H - vh) / 2; }
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(half / r.F));
    camera.aspect = r.W / fullH;
    camera.setViewOffset(r.W, fullH, vx, vy, vw, vh);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  let state = null;
  let running = true;
  const clock = new THREE.Clock();
  const v = new THREE.Vector3();
  camera.position.set(0, EYE, 0);
  function frame() {
    if (!running) return;
    const raw = clock.getDelta(), dt = Math.min(raw, 0.1), t = clock.elapsedTime;
    aq.tick(raw);
    if (state) {
      const pos = { me: state.p, father: state.f, mother: state.m, daughter: state.d };
      const order = [];
      for (const [id, sp] of Object.entries(sprites)) {
        const p = pos[id];
        const moved = sp.lastP == null ? 0 : Math.max(0, p - sp.lastP);
        sp.lastP = p;
        sp.dist += moved;
        if (moved > 0.0004) sp.movedAt = t;
        const walking = t - (sp.movedAt ?? -9) < 0.15;   // 描く回数とルールの刻みがずれても、ちらつかないように
        // 歩いた距離に合わせて4コマを順に出す（止まっているときは、ふつうの立ち姿）
        const k = Math.floor(sp.dist / sp.stride) % 4;
        const tex = walking ? sp.frames[k] : sp.t0;
        if (sp.m.material.map !== tex) sp.m.material.map = tex;   // 絵の入れかえだけ（作り直しはしない。重くなるため）
        const ph = sp.dist / (sp.stride * 2) * Math.PI;
        const bob = walking ? Math.abs(Math.sin(ph)) * 0.012 : 0;   // 足がそろうとき、少し高くなる
        const z = zOf(p), x = xOf(id);
        sp.m.position.set(x, bob, z);
        sp.s.position.set(x, 0.01, z + 0.05);
        sp.m.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z) * 0.35;
        sp.m.rotation.z = walking ? Math.sin(ph) * 0.012 : sp.m.rotation.z * 0.9;   // 歩くときの左右の体の小さなゆれ
        if (sp.tag) sp.tag.position.set(x, sp.h + 0.2 + bob + Math.sin(t * 3) * 0.02, z);
        order.push([z, sp]);
      }
      // 遠い人から描く（近い人が手前に重なる）
      order.sort((a, b) => a[0] - b[0]).forEach(([, sp], i) => { sp.m.renderOrder = 10 + i; });
      // 入口の光：はじめはほのかに、奥へ進むほど強く（ゆっくり息をするように少しゆらぐ）
      const near = smooth(4, CONFIG.walk.length, state.p);
      glow.material.opacity = 0.15 + 0.75 * near + Math.sin(t * 1.6) * 0.03;
      glow.scale.setScalar(1 + 0.5 * near);
      // カメラはお父さまのうしろからついていく
      const camZ = Math.min(0, zOf(state.f) + 3.6);
      camera.position.z += (camZ - camera.position.z) * (1 - Math.exp(-dt * 3));
    }
    camera.position.x = 0; camera.position.y = EYE + Math.sin(t * 1.3) * 0.004;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    update(w) { state = w; },
    hasPeople: () => Object.keys(sprites).length > 0,
    // 奥の入口にどれだけ近づいたか（0〜1。画面の光の幕に使う）
    nearDoor: () => (state ? smooth(8, CONFIG.walk.length, state.p) : 0),
    // お父さまの杖が、画面のどこ（px）にあるか（杖は絵の右はし・ひざの高さあたり）
    canePoint() {
      const sp = sprites.father;
      if (!sp) return null;
      v.set(sp.m.position.x + 0.21, 0.55, sp.m.position.z).project(camera);   // 杖は体の中心から右へ約21cm
      if (v.z > 1) return null;
      return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight };
    },
    resize,
    dispose() { running = false; removeEventListener('resize', resize); renderer.dispose(); },
  };
}

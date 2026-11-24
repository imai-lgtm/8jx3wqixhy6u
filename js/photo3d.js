// 記念写真の3D：本物の円石の写真を見本に描いた絵を、地面・石・垣根・木の奥行きに合わせた形に貼る
// 立ち位置・ズーム・向きを変えると、手前と奥がずれて見える（その場にいるように見える）
import * as THREE from 'three';
import { PHOTO_SCENE } from './logic.js';
import { autoQuality, wantAntialias } from './autoquality.js';

const IMG_W = 1536, IMG_H = 1024;
// 絵は、本物の写真と同じく低い所（目の高さ0.95m）から見た絵として奥行きを付ける（円石が高さ約1.6m・竹垣が約1.8mになる）
const PAINT_VFOV = 54, PAINT_PITCH = THREE.MathUtils.degToRad(-4), EYE = 0.95;
const F = (IMG_H / 2) / Math.tan(THREE.MathUtils.degToRad(PAINT_VFOV / 2));
const X_AXIS = new THREE.Vector3(1, 0, 0);
function rayDir(u, v) {
  return new THREE.Vector3((u - 0.5) * IMG_W / F, -(v - 0.5) * IMG_H / F, -1).normalize().applyAxisAngle(X_AXIS, PAINT_PITCH);
}
// 円石の場面の奥行き（手前は白い砂利、円石・立て札・青竹の垣根は立っている面、垣根の上は奥の木々）
const FENCE_BASE = 0.655, FENCE_TOP = 0.235;
const STONE = { u: 0.623, v: 0.47, ru: 0.195, rv: 0.215, base: 0.69 };
const SIGN = { u0: 0.818, u1: 0.886, v0: 0.6, v1: 0.715 };
const groundDist = (u, v) => { const d = rayDir(u, Math.min(v, 0.999)); return (EYE / -d.y) * -d.z; };
const inStone = (u, v) => ((u - STONE.u) / STONE.ru) ** 2 + ((v - STONE.v) / STONE.rv) ** 2 <= 1;
const inSign = (u, v) => u >= SIGN.u0 && u <= SIGN.u1 && v >= SIGN.v0 && v <= SIGN.v1;
export function pointAt(u, v) {
  const d = rayDir(u, v);
  let D;
  if (inStone(u, v)) D = groundDist(u, STONE.base);
  else if (inSign(u, v)) D = groundDist(u, SIGN.v1);
  else if (v >= FENCE_BASE) D = groundDist(u, v);
  else if (v >= FENCE_TOP) D = groundDist(u, FENCE_BASE);
  // 垣根より上の木々：垣根の上の端からなめらかに奥へ（段差をつけると、垣根の上の横木が引きのばされて太く見えるため）
  else D = groundDist(u, FENCE_BASE) + 40 * (FENCE_TOP - v) * EYE / 1.5;
  return d.multiplyScalar(D / -d.z).add(new THREE.Vector3(0, EYE, 0));
}

function buildBackdrop(tex) {
  const NX = 260, NY = 180, U0 = -0.06, U1 = 1.06, V0 = -0.04, V1 = 1.1;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const u = U0 + (U1 - U0) * i / NX, v = V0 + (V1 - V0) * j / NY;
    const p = pointAt(u, v);
    pos.push(p.x, p.y, p.z);
    uv.push(Math.min(Math.max(u, 0), 1), 1 - Math.min(Math.max(v, 0), 1));
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // ピントはご家族。奥ほど少しぼかす（写真らしく）
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, focus: { value: 3.2 } },
    vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vD=-mv.z; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; uniform float focus; varying vec2 vUv; varying float vD; void main(){ float blur=clamp((vD-focus-1.2)/9.,0.,1.)*1.7; gl_FragColor=texture2D(map,vUv,blur);\n#include <colorspace_fragment>\n}',
  });
  return new THREE.Mesh(g, mat);
}

// 足もとの影（丸いぼかし。絵ではなく光の表現）
function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(30,20,10,.55)'); g.addColorStop(1, 'rgba(30,20,10,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// container の中の canvas に描く。family: [{id, base, smile, off}]
export async function createPhotoScene({ canvas, bg, family, low = false }) {
  // 写真を写すときは、描いた直後に読み出すので、ふだんの描画を重くする設定（preserveDrawingBuffer）は使わない
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: wantAntialias(low), powerPreference: 'high-performance' });
  const aq = autoQuality(renderer, () => resize(), { start: Math.min(devicePixelRatio, low ? 1 : 1.5) });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a1c);
  const camera = new THREE.PerspectiveCamera(44, 0.8, 0.05, 200);
  const loader = new THREE.TextureLoader();
  const load = (url) => new Promise((ok) => loader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; ok(t); }, undefined, () => ok(null)));

  const bgTex = await load(bg);
  if (bgTex) scene.add(buildBackdrop(bgTex));
  const shadowTex = shadowTexture();
  const people = [];
  for (let i = 0; i < family.length; i++) {
    const f = family[i], P = PHOTO_SCENE.people[i];
    const [tb, ts, to, tbb, tsb] = await Promise.all([load(f.base), load(f.smile), load(f.off), f.blink ? load(f.blink) : null, f.smile_blink ? load(f.smile_blink) : null]);
    const img = (tb || ts || to)?.image;
    const a = img ? img.width / img.height : 0.37;
    const mk = (tex) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(P.h * a, P.h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.03, depthWrite: false, color: new THREE.Color(1, 0.96, 0.9), opacity: 0 }));
      m.geometry.translate(0, P.h / 2, 0); m.position.set(P.x, 0, P.z); scene.add(m); return m;
    };
    const layers = { base: tb && mk(tb), smile: ts && mk(ts), off: to && mk(to), base_blink: tbb && mk(tbb), smile_blink: tsb && mk(tsb) };
    const s = new THREE.Mesh(new THREE.PlaneGeometry(P.h * a * 1.3, 0.5), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    s.rotation.x = -Math.PI / 2; s.position.set(P.x, 0.01, P.z + 0.05); scene.add(s);
    people.push({ P, layers, want: 'off', phase: i * 2.1, idx: i, cur: null, prev: null, fade: 1 });
  }

  let lastMood = '';
  const cam = { spot: 1, pos: new THREE.Vector3(), yaw: -0.16, pitch: THREE.MathUtils.degToRad(-4), zoom: 0.85, fov: 30 };   // 最初はわざと寄りすぎ・左向き（自分で構図を決める）
  cam.ryaw = cam.yaw; cam.rpitch = cam.pitch;   // 画面に映す向き（cam.yaw / pitch に、なめらかに追いつく）
  cam.pos.copy(PHOTO_SCENE.spots[1]);
  const look = new THREE.Vector3();
  const clampView = () => {
    const aspect = camera.aspect;
    const fov = PHOTO_SCENE.fov(cam.zoom, aspect);
    const maxYaw = PHOTO_SCENE.maxYaw(fov, aspect);
    cam.yaw = Math.max(-maxYaw, Math.min(maxYaw, cam.yaw));
    const [lo, hi] = PHOTO_SCENE.pitchRange(fov);
    cam.pitch = Math.max(lo, Math.min(hi, cam.pitch));
    return fov;
  };

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.render(scene, camera);   // 大きさを変えると画面が消えるので、すぐ1枚描く
  }

  let running = true;
  const clock = new THREE.Clock();
  const tgt = new THREE.Vector3();
  function frame() {
    if (!running) return;
    const raw = clock.getDelta(), dt = Math.min(raw, 0.1), t = clock.elapsedTime;
    aq.tick(raw);
    const target = PHOTO_SCENE.spots[cam.spot];
    cam.pos.lerp(tgt.set(target.x, target.y, target.z), 1 - Math.exp(-dt * 4));
    const fov = clampView();
    cam.fov += (fov - cam.fov) * (1 - Math.exp(-dt * 8));
    camera.position.copy(cam.pos); camera.fov = cam.fov; camera.updateProjectionMatrix();
    const k = 1 - Math.exp(-dt * 16);
    cam.ryaw += (cam.yaw - cam.ryaw) * k; cam.rpitch += (cam.pitch - cam.rpitch) * k;
    look.set(Math.sin(cam.ryaw) * Math.cos(cam.rpitch), Math.sin(cam.rpitch), -Math.cos(cam.ryaw) * Math.cos(cam.rpitch)).add(cam.pos);
    camera.lookAt(look);
    for (const p of people) {
      const yaw = Math.atan2(camera.position.x - p.P.x, camera.position.z - p.P.z);
      // 表情の切りかえ：前の顔は「不透明のまま」下に残し、新しい顔をその上にふわっと重ねる。重なり終えたら前の顔を消す
      // （2枚とも半分ずつ透かすと、うしろの景色が透けて人が半透明に見えるため）。まばたきは一瞬で切りかえる
      const want = p.layers[p.want] ? p.want : 'base';
      if (want !== p.cur) {
        const blink = want.endsWith('_blink') || (p.cur || '').endsWith('_blink');
        p.prev = p.cur; p.cur = want; p.fade = blink ? 1 : 0;
      }
      p.fade = Math.min(1, (p.fade ?? 1) + dt / 0.18);
      for (const [k, m] of Object.entries(p.layers)) {
        if (!m) continue;
        m.rotation.y = yaw;
        const isCur = k === p.cur, isPrev = k === p.prev && p.fade < 1;
        m.material.opacity = isCur ? p.fade : isPrev ? 1 : 0;
        m.renderOrder = 10 + p.idx * 2 + (isCur ? 1 : 0);   // 新しい顔を上に
        m.visible = m.material.opacity > 0.001;
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  resize();
  addEventListener('resize', resize);
  requestAnimationFrame(frame);

  return {
    cam,
    // ご家族の様子：mood は 'off' / 'smile' / 'blink'（お父さまだけ目を閉じる）
    // mood：'off'（お母さま・娘さまは円石やバッグを見ている）／'smile'（こちらを向いた）／'blink'（お父さまだけまばたき）
    // big：気づきが多いときは大きな笑顔、少ないときはほほえみ（ふだんの顔）
    setMood(mood, big = true) {
      const key = mood + big;
      if (key === lastMood) return;   // 変わったときだけ
      lastMood = key;
      const face = big ? 'smile' : 'base';
      // まばたきは、いまの顔と同じ絵で目だけ閉じたもの（無いときは、ふだんの「よそ見」の絵）
      people.forEach((p, i) => { p.want = mood === 'smile' ? face : mood === 'blink' ? (i === 0 ? (p.layers[face + '_blink'] ? face + '_blink' : face) : face) : 'off'; });   // 声をかける前は、3人ともよそ見（お父さまは円石をながめている）
    },
    setSpot(i) { cam.spot = i; },
    setZoom(z) { cam.zoom = z; },
    turn(dyaw, dpitch) { cam.yaw += dyaw; cam.pitch += dpitch; clampView(); },
    // いまの向き（logic の判定に渡す）
    view() { return { spot: cam.spot, yaw: cam.yaw, pitch: cam.pitch, zoom: cam.zoom, aspect: camera.aspect }; },
    capture() {
      // 表情の入れかえを待たずに、いまの絵をすぐ写す
      for (const p of people) { const want = p.layers[p.want] ? p.want : 'base'; p.cur = want; p.prev = null; p.fade = 1; for (const [k, m] of Object.entries(p.layers)) if (m) { const on = k === want; m.material.opacity = on ? 1 : 0; m.visible = on; } }
      renderer.render(scene, camera);
      return canvas.toDataURL('image/jpeg', 0.9);
    },
    debug: () => people.map((p) => Object.fromEntries(Object.entries(p.layers).map(([k, m]) => [k, m && { o: +m.material.opacity.toFixed(2), v: m.visible, z: m.position.z, w: m.geometry.parameters.width }]))),
    resize,
    dispose() { running = false; removeEventListener('resize', resize); renderer.dispose(); },
  };
}

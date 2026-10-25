// 3D 畫面：把 sim.js 的 2D 物理世界畫成固定側面的 2.5D 立體場景
// 鏡頭用 off-axis 投影：z=0 平面跟 2D 座標一比一對齊（1 px = 0.01 單位），觸控直接換算，不用射線
import * as THREE from 'three';
import { loadKind, loadClip, makeActor, updateActor, turnTo } from './assets.js?v=1';

const SIM = window.SIM;
const W = 720, H = 1280;
export const BAND = 170;            // 關卡下面留給兔兔老師站的走道（px）
const U = 0.01;
const X = (x) => (x - W / 2) * U, Y = (y) => (H - y) * U;
const EYE_Y = 260, DIST = 22;       // 眼睛在關卡上半部、距離 22：看得到台子頂面，又不會歪得太誇張
const EXT = 1400;                   // 貼邊地形往外延伸多少（px）
const HERO_SCALE = 1.16, TU_SCALE = 1.42;
const TU_FEET = H + BAND - 8;      // 老師腳踩的高度（px）

let renderer, scene, camera, sun;
let levelG = null, dynG = null;     // 關卡靜態物件、每關會清掉的動態物件
const K = {}, MOVES = {}, SIG = {}, OVER = {};
let hero = null, tu = null;         // { actor, rig }
let L = null, S = null, scn = 'class';

// ---------- 小工具 ----------
let seed = 1;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const ramp = (() => { const t = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 196, 196, 196, 255, 255, 255, 255, 255]), 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const toon = (o) => new THREE.MeshToonMaterial({ gradientMap: ramp, ...o });
const INK = 0x1d1a16;               // 描邊色
const outlineMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

// ---------- 材質貼圖（程式畫，三個場景各一套） ----------
function speckle(g, w, h, n, cols, s0 = 1, s1 = 3) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[(rnd() * cols.length) | 0]; const s = s0 + rnd() * (s1 - s0); g.fillRect(rnd() * w, rnd() * h, s, s); }
}
function wood(base, grain, plank) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = grain; g.globalAlpha = 0.08 + rnd() * 0.22; g.lineWidth = 1 + rnd() * 2;
      const y0 = rnd() * h; g.beginPath(); g.moveTo(0, y0);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.03 + i) * 3 + (rnd() - 0.5) * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    if (plank) for (let y = 0; y < h; y += plank) {
      g.fillStyle = 'rgba(40,20,8,.55)'; g.fillRect(0, y, w, 3);
      g.fillStyle = 'rgba(255,235,200,.25)'; g.fillRect(0, y + 3, w, 2);
      const x = (rnd() * w) | 0; g.fillStyle = 'rgba(40,20,8,.45)'; g.fillRect(x, y, 3, plank);
    }
  });
}
function concrete(base, dots) {
  return canvasTex(256, 256, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); speckle(g, w, h, 1400, dots); });
}
function terrazzo(base) {   // 磨石子：學校走廊的地板
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 900, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.12)']);
    const chips = ['#efeadc', '#6f6a60', '#3d3a35', '#a7836a', '#d9cfb8', '#8c9a8a'];
    for (let i = 0; i < 260; i++) {
      g.fillStyle = chips[(rnd() * chips.length) | 0];
      const x = rnd() * w, y = rnd() * h, r = 1.5 + rnd() * 4.5;
      g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28 + rnd(); g.lineTo(x + Math.cos(a) * r * (0.6 + rnd() * 0.6), y + Math.sin(a) * r * (0.6 + rnd() * 0.6)); } g.fill();
    }
    g.strokeStyle = 'rgba(60,55,48,.5)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);   // 銅條分格
  });
}
function grass() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#78a84a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.strokeStyle = rnd() < 0.5 ? 'rgba(40,80,20,.35)' : 'rgba(190,230,120,.35)'; g.lineWidth = 1.5; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - 4 - rnd() * 6); g.stroke(); }
  });
}
function track() {   // 紅色 PU 跑道，中間一條白線
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b6553c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2200, ['rgba(0,0,0,.18)', 'rgba(255,200,170,.18)']);
    g.fillStyle = 'rgba(250,245,230,.9)'; g.fillRect(0, h * 0.5 - 4, w, 8);
  });
}
function cork() {
  return canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b07a48'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, ['#7b4f2a', '#d29c66', '#5e3a1d', '#c88c55'], 1, 4); });
}
let TEX = null;
function makeTex() {
  seed = 7;
  TEX = {
    class: { top: wood('#cf9f63', '#7a4a20', 0), side: wood('#b9844c', '#5e3614', 64), gTop: wood('#a9743f', '#4a2a10', 48), gSide: wood('#7d5230', '#3a200c', 64) },
    yard: { top: grass(), side: concrete('#c9c2b2', ['#9e978a', '#e6e0d3', '#8a8478']), gTop: track(), gSide: concrete('#b9b1a0', ['#8f8778', '#d8d0bf']) },
    dusk: { top: terrazzo('#cfcabb'), side: terrazzo('#aaa597'), gTop: terrazzo('#c3bdae'), gSide: terrazzo('#97928a') },
    cork: cork(),
  };
}
const MAT = new Map();
function texMat(t, color = 0xffffff) {
  const k = t.uuid + color;
  if (!MAT.has(k)) MAT.set(k, toon({ map: t, color }));
  return MAT.get(k);
}
// 方塊：貼圖依實際大小重複（TILE 單位一格），六個面各自的 UV 都換算
function boxGeo(w, h, d, tile = 1.2) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}
function outlined(mesh, pad = 0.022) {   // 方塊描邊：外面套一個稍大、只畫背面的深色殼
  const p = mesh.geometry.parameters;
  const o = new THREE.Mesh(new THREE.BoxGeometry(p.width + pad * 2, p.height + pad * 2, p.depth + pad * 2), outlineMat);
  mesh.add(o); return mesh;
}

// ---------- 初始化 ----------
export async function init(canvas, progress = () => {}) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();
  camera.position.set(0, Y(EYE_Y), DIST);
  scene.add(new THREE.HemisphereLight(0xfff8ec, 0x9a8a70, 1.7));
  sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
  sun.position.set(-3, 14, 12); sun.target.position.set(0, 5, 0); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 9, bottom: -9, near: 2, far: 40 }); sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.02;
  sun.shadow.camera.updateProjectionMatrix();
  makeTex();
  buildBand();
  const files = [['bian', 'bian_walk'], ['tu', 'tu_walk']];
  const moves = ['stumble', 'reach'], over = ['guard', 'handsup', 'hop'], sigs = ['bian', 'tu'];
  let n = 0; const all = files.length + moves.length + over.length + sigs.length;
  const tick = () => progress(++n / all);
  await Promise.all([
    ...files.map(async ([k, f]) => { K[k] = await loadKind(`models/${f}.glb`); tick(); }),
    ...moves.map(async (k) => { try { MOVES[k] = await loadClip(`models/moves/${k}.glb`); } catch (e) { console.warn(k, e); } tick(); }),
    ...over.map(async (k) => { try { OVER[k] = prepOver(await loadClip(`models/moves/${k}.glb`)); } catch (e) { console.warn(k, e); } tick(); }),
    ...sigs.map(async (k) => { try { SIG[k] = await loadClip(`models/sig/${k}.glb`); } catch (e) { console.warn(k, e); } tick(); }),
  ]);
  hero = makeChar('bian', HERO_SCALE);
  tu = makeChar('tu', TU_SCALE);
  scene.add(hero.actor.root, tu.actor.root);
  tu.actor.root.position.set(X(560), Y(TU_FEET), 0.35);
  buildFx();
}

function makeChar(key, scale) {
  const actor = makeActor(K[key], scale);
  actor.model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const bones = {}; actor.model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  return { key, actor, rig: { bones, ow: {}, ph: Math.random() * 3 }, mood: null };
}

// 畫面大小：SH＝舞台高（px），OY＝關卡往下移多少（長螢幕上面多出來的）
let viewSH = H, viewOY = 0;
export function resize(pxW, pxH, SW, SH, OY) {
  renderer.setPixelRatio(1);
  renderer.setSize(pxW, pxH, false);
  viewSH = SH; viewOY = OY;
  const n = 1, f = 80, ey = Y(EYE_Y);
  const top = Y(-OY), bot = Y(SH - OY);
  const hw = SW / 2 * U;   // 關卡中心 x=360 永遠在畫面正中間
  camera.projectionMatrix.makePerspective(-hw * n / DIST, hw * n / DIST, (top - ey) * n / DIST, (bot - ey) * n / DIST, n, f);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

// ---------- 老師走道（關卡下面）：木頭粉筆槽＋地板 ----------
function buildBand() {
  const g = new THREE.Group();
  const ledge = outlined(new THREE.Mesh(boxGeo(60, 0.16, 0.7, 0.8), texMat(wood('#c08a52', '#6a3c16', 0))));
  ledge.position.set(0, Y(H + 8), 0.2); ledge.receiveShadow = true; g.add(ledge);
  const floor = new THREE.Mesh(boxGeo(60, 0.6, 3, 1), texMat(wood('#8f603a', '#3e220c', 40)));
  floor.position.set(0, Y(TU_FEET) - 0.3, 0.4); floor.receiveShadow = true; g.add(floor);
  // 地板和粉筆槽之間：深綠色牆裙
  const wain = new THREE.Mesh(new THREE.PlaneGeometry(60, (TU_FEET - H) * U), toon({ color: 0x31483a }));
  wain.position.set(0, Y((H + TU_FEET) / 2), -1.0); g.add(wain);
  scene.add(g);
}

// ---------- 關卡 ----------
export function buildLevel(state, level) {
  S = state; L = level; scn = level.bg || 'class';
  if (levelG) { scene.remove(levelG); disposeTree(levelG); }
  if (dynG) { scene.remove(dynG); disposeTree(dynG); }
  levelG = new THREE.Group(); dynG = new THREE.Group(); scene.add(levelG, dynG);
  beeMeshes.length = 0; lineMesh = null; lineKey = ''; bookMeshes.length = 0; water.length = 0;
  const T = TEX[scn];
  for (const b of S.solids) {
    const d = b.def, ground = d.y + d.h / 2 >= H - 5;
    const depth = ground ? 1.2 : 1.0;
    const side = texMat(ground ? T.gSide : T.side), top = texMat(ground ? T.gTop : T.top);
    // 貼著畫面左右邊的地形，畫的時候往外延伸（寬螢幕兩邊看起來才接得上；物理不變）
    const [l, r] = d.a ? [0, 0] : [d.x - d.w / 2 <= 1 ? EXT : 0, d.x + d.w / 2 >= W - 1 ? EXT : 0];
    const m = outlined(new THREE.Mesh(boxGeo((d.w + l + r) * U, d.h * U, depth), [side, side, top, side, side, side]));
    m.position.set(X(d.x + (r - l) / 2), Y(d.y), 0); m.rotation.z = -(d.a || 0) * Math.PI / 180;
    m.receiveShadow = true; m.castShadow = !ground;
    levelG.add(m);
  }
  for (const b of S.hazards) levelG.add(b.def.kind === 'water' ? makePond(b.def) : makeTacks(b.def));
  for (const c of S.hives) levelG.add(makeHive(c));
  for (const b of S.boxes) { const m = makeBook(b.def); bookMeshes.push([b, m]); dynG.add(m); }
  // 蜂窩口附近不能畫：一圈粉筆點
  noDraw = S.hives.map((c) => { const p = dotRing(0.56, 20); p.position.set(X(c.mouth.x), Y(c.mouth.y), 0.05); dynG.add(p); return p; });
  hint = null;
  hero.mood = null; tu.mood = null;
  for (const c of [hero, tu]) { stopAll(c); }
  heroFall = 0; tuX = X(560); tuFace = 0;
  tu.actor.root.position.set(tuX, Y(TU_FEET), 0.35);
  placeHero();
}
function disposeTree(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && !Array.isArray(o.material) && o.material.userData.own) { o.material.map?.dispose(); o.material.dispose(); }
  });
}

// 生態池：半透明水體＋會動的水面＋幾片睡蓮葉
const water = [];
function makePond(d0) {
  const g = new THREE.Group(), d = { ...d0, w: d0.w + EXT * 2 };   // 池子也往兩邊延伸
  const body = new THREE.Mesh(new THREE.BoxGeometry(d.w * U, d.h * U, 1.6), new THREE.MeshBasicMaterial({ color: 0x3b8aa0, transparent: true, opacity: 0.62, depthWrite: false }));
  body.position.set(X(d.x), Y(d.y), 0); g.add(body);
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(d.w * U, 1.6, 48, 1), new THREE.MeshBasicMaterial({ color: 0x9fd3d8, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  surf.rotation.x = -Math.PI / 2; surf.position.set(X(d.x), Y(d.y - d.h / 2) - 0.02, 0); g.add(surf);
  water.push({ surf, base: surf.geometry.attributes.position.array.slice() });
  seed = 31;
  for (let i = 0; i < 5; i++) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.16 + rnd() * 0.08, 18, 0.5, 5.6), toon({ color: 0x5f9a45 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(X(d.x - d.w / 2 + 40 + rnd() * (d.w - 80)), Y(d.y - d.h / 2) + 0.01, -0.5 + rnd() * 1.1); g.add(pad);
  }
  return g;
}
// 圖釘區：軟木塞板上插滿往上的圖釘
function makeTacks(d) {
  const g = new THREE.Group();
  const topY = d.y - d.h / 2 + 12;
  const base = outlined(new THREE.Mesh(boxGeo(d.w * U, (d.y + d.h / 2 - topY) * U, 1.2, 0.8), texMat(TEX.cork)));
  base.position.set(X(d.x), Y((topY + d.y + d.h / 2) / 2), 0); base.receiveShadow = true; g.add(base);
  const n = Math.max(6, Math.round(d.w / 22));
  const cols = [0xd8322b, 0x2f6fc0, 0xf0c02c, 0x3a9a52];
  const headG = new THREE.CylinderGeometry(0.06, 0.07, 0.04, 12), pinG = new THREE.ConeGeometry(0.014, 0.13, 6);
  const pinM = toon({ color: 0xd8d8d8 });
  seed = 11;
  for (let r = 0; r < 3; r++) for (let i = 0; i < n; i++) {
    const x = d.x - d.w / 2 + (i + 0.5 + (r % 2) * 0.5) * d.w / (n + 0.5);
    const z = -0.4 + r * 0.4 + (rnd() - 0.5) * 0.1;
    const head = new THREE.Mesh(headG, toon({ color: cols[(rnd() * 4) | 0] }));
    head.position.set(X(x), Y(topY) + 0.02, z); head.castShadow = true;
    const pin = new THREE.Mesh(pinG, pinM); pin.position.set(X(x), Y(topY) + 0.105, z);
    g.add(head, pin);
  }
  return g;
}
// 蜂窩：一層一層的土黃色紙蜂窩，洞口朝 dir，另一頭插在樹枝上
const hiveTex = () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#c99a52'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 18) { g.fillStyle = 'rgba(90,55,20,.55)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,230,170,.35)'; g.fillRect(0, y + 4, w, 3); }
  speckle(g, w, h, 500, ['rgba(80,50,20,.3)', 'rgba(255,240,200,.25)']);
});
let hiveMap = null;
function makeHive(c) {
  hiveMap = hiveMap || hiveTex();
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, r = 0.44 * Math.pow(Math.sin(Math.PI * (0.06 + t * 0.94)), 0.75) * (1 + 0.06 * Math.abs(Math.sin(t * Math.PI * 5)));
    pts.push(new THREE.Vector2(Math.max(0.02, r), 0.5 - t * 1.08));
  }
  pts.push(new THREE.Vector2(0.001, -0.58));
  pts.reverse();   // 由下往上排，面才會朝外
  const geo = new THREE.LatheGeometry(pts, 28);
  const body = new THREE.Mesh(geo, toon({ map: hiveMap }));
  body.castShadow = true;
  const ol = new THREE.Mesh(geo, outlineMat); ol.scale.setScalar(1.05); body.add(ol);
  g.add(body);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), new THREE.MeshBasicMaterial({ color: 0x1a1008 }));
  hole.rotation.x = Math.PI / 2; hole.position.y = -0.585; g.add(hole);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 20), toon({ color: 0x8a5a26 }));
  lip.rotation.x = Math.PI / 2; lip.position.y = -0.57; g.add(lip);
  const stick = outlined(new THREE.Mesh(boxGeo(1.4, 0.09, 0.09, 1), toon({ color: 0x6e4a2a })), 0.018);
  stick.position.y = 0.5; stick.rotation.z = 0.08; g.add(stick);
  for (const s of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), toon({ color: 0x5f8f3e, side: THREE.DoubleSide })); leaf.scale.set(1.6, 0.8, 1); leaf.position.set(s * 0.55, 0.55, 0.06); leaf.rotation.z = s * 0.5; g.add(leaf); }
  const dir = SIM.MOUTH[c.def.dir || 'down'];
  g.rotation.z = Math.atan2(dir[0], -dir[1]) * 1;   // 本來洞口朝 -Y（下）
  g.rotation.z = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[c.def.dir || 'down'];
  g.position.set(X(c.def.x), Y(c.def.y), 0);
  g.userData.sway = rnd() * 6;
  hives.push(g);
  return g;
}
const hives = [];
// 作業簿：立著的書，封面寫科目
const BOOK_COL = { 國語: '#c8473a', 數學: '#2f6fb0', 自然: '#3c8f4f', 社會: '#d39a2a', 英語: '#7a4fa0' };
const bookMeshes = [];
function makeBook(d) {
  const w = (d.w || 44) * U, h = (d.h || 60) * U, ch = d.ch || '國語', col = BOOK_COL[ch] || '#c8473a';
  const cover = canvasTex(128, 176, (g, cw, chh) => {
    g.fillStyle = col; g.fillRect(0, 0, cw, chh);
    g.fillStyle = '#f6f0e1'; g.fillRect(14, 30, cw - 28, 70);
    g.fillStyle = '#2a2420'; g.font = '700 40px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, cw / 2, 66);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 10, chh);
  }, false);
  const cm = toon({ map: cover }); cm.userData.own = true;
  const side = toon({ color: new THREE.Color(col) }), pages = toon({ color: 0xf3ecd8 });
  const m = outlined(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.5), [pages, side, pages, pages, cm, side]), 0.018);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- 粉筆點（提示虛線、不能畫的圈、老師的魔法粉筆灰） ----------
const dotTex = canvasTex(64, 64, (g) => {
  const r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
}, false);
function dotsMat(color, size, opacity = 1) {
  return new THREE.PointsMaterial({ color, size, map: dotTex, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
}
let noDraw = [];
function dotRing(r, n) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, dotsMat(0xfff6dc, 0.3, 0.85));
}
let hint = null;
function makeHint() {
  const s = L.sol, pts = [];
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    if (i) acc += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    if (!i || acc >= 22) { pts.push(X(s[i][0]), Y(s[i][1]), 0.1); acc = 0; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  hint = new THREE.Points(g, dotsMat(0xf2c94c, 0.5));
  dynG.add(hint);
}
// 老師畫線時：從手上飄到筆尖的粉筆灰
let dust, dustPos, sparks, sparkPos, sparkV = [];
function buildFx() {
  dustPos = new Float32Array(36 * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dust = new THREE.Points(g, dotsMat(0xfffbea, 0.26, 0.8)); dust.visible = false; dust.frustumCulled = false; scene.add(dust);
  sparkPos = new Float32Array(90 * 3);
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparks = new THREE.Points(g2, dotsMat(0xffffff, 0.24, 0.9)); sparks.frustumCulled = false; scene.add(sparks);
  for (let i = 0; i < 90; i++) { sparkV.push({ life: 0, vx: 0, vy: 0 }); sparkPos[i * 3 + 1] = -99; }
  pen = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe27a, depthTest: false, transparent: true, opacity: 0.9 }));
  pen.renderOrder = 18;
  pen.visible = false; scene.add(pen);
}
let pen, sparkI = 0;
// 蜜蜂撞到粉筆線：噴一點粉筆灰（px 座標）
export function puff(x, y, n = 4) {
  for (let k = 0; k < n; k++) {
    const i = sparkI++ % 90, v = sparkV[i];
    v.life = 0.35 + Math.random() * 0.25; v.vx = (Math.random() - 0.5) * 2.4; v.vy = Math.random() * 2;
    sparkPos[i * 3] = X(x); sparkPos[i * 3 + 1] = Y(y); sparkPos[i * 3 + 2] = 0.2;
  }
}

// ---------- 粉筆線：3D 管子 ----------
const chalkTex = canvasTex(256, 32, (g, w, h) => {
  g.fillStyle = '#fbf8ef'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 500, ['rgba(150,140,120,.35)', 'rgba(255,255,255,.9)', 'rgba(120,110,95,.25)'], 1, 3);
});
const chalkMat = toon({ map: chalkTex, color: 0xffffff });
let lineMesh = null, lineKey = '';
function tube(pts) {   // pts：[{x,y}]（px，區域座標）→ 管子＋描邊＋兩頭圓頭
  const g = new THREE.Group(), R = SIM.T / 2 * U * 1.05;
  const v = pts.map((p) => new THREE.Vector3(p.x * U, -p.y * U, 0));
  if (v.length === 1) v.push(v[0].clone().add(new THREE.Vector3(0.001, 0, 0)));
  const curve = v.length > 2 ? new THREE.CatmullRomCurve3(v, false, 'centripetal') : new THREE.LineCurve3(v[0], v[1]);
  const seg = Math.min(360, Math.max(4, v.length * 2));
  const t1 = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, R, 8, false), chalkMat); t1.castShadow = true;
  const t2 = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, R + 0.022, 8, false), outlineMat);
  g.add(t1, t2);
  for (const e of [v[0], v[v.length - 1]]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(R, 10, 8), chalkMat); c.position.copy(e); c.castShadow = true;
    const o = new THREE.Mesh(new THREE.SphereGeometry(R + 0.022, 10, 8), outlineMat); o.position.copy(e);
    g.add(c, o);
  }
  return g;
}
function setLine(pts, body, a0) {
  const key = body ? 'body' : pts.length + ':' + (pts.length ? pts[pts.length - 1].x + ',' + pts[pts.length - 1].y : '');
  if (key !== lineKey) {
    if (lineMesh) { dynG.remove(lineMesh); disposeTree(lineMesh); lineMesh = null; }
    lineKey = key;
    if (pts.length) { lineMesh = tube(pts); dynG.add(lineMesh); }
  }
  if (!lineMesh) return;
  if (body) { lineMesh.position.set(X(body.position.x), Y(body.position.y), 0); lineMesh.rotation.z = -(body.angle - a0); }
  else lineMesh.position.set(X(0), Y(0), 0);
}

// ---------- 蜜蜂 ----------
const beeStripe = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a1e12'; for (const y of [30, 58, 86]) g.fillRect(0, y, w, 14);
}, false);
const beeBodyG = new THREE.SphereGeometry(0.15, 16, 12).rotateZ(Math.PI / 2);   // 兩極在 x 軸，條紋就是一圈一圈
const beeMat = toon({ map: beeStripe }), wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
const eyeMat = new THREE.MeshBasicMaterial({ color: 0x15100c });
const wingG = new THREE.CircleGeometry(0.11, 14).translate(0, 0.11, 0);
const beeMeshes = [];
function makeBee() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const b = new THREE.Mesh(beeBodyG, beeMat); b.scale.set(1.25, 1, 1); b.castShadow = true;
  const o = new THREE.Mesh(beeBodyG, outlineMat); o.scale.set(1.25 * 1.13, 1.13, 1.13);
  body.add(b, o);
  for (const z of [0.07, -0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), eyeMat); e.position.set(0.15, 0.04, z); body.add(e); }
  const sting = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), eyeMat); sting.rotation.z = Math.PI / 2; sting.position.x = -0.22; body.add(sting);
  const w1 = new THREE.Mesh(wingG, wingMat), w2 = new THREE.Mesh(wingG, wingMat);
  w1.position.set(0.02, 0.1, 0.04); w2.position.set(0.02, 0.1, -0.04);
  body.add(w1, w2);
  g.userData = { body, w1, w2, face: 1 };
  return g;
}
// 大力蜂：大一倍、橘一點、有兩隻握拳的粗手臂、生氣的眉毛和紅色運動頭帶；推的時候手往前伸
const bigStripe = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#f0a020'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#24170c'; for (const y of [24, 52, 80]) g.fillRect(0, y, w, 18);
}, false);
const bigMat = toon({ map: bigStripe }), armMat = toon({ color: 0x2a1c10 }), bandMat = toon({ color: 0xd8322b });
function makeBigBee() {
  const g = makeBee(), u = g.userData, k = SIM.STRONG.r / SIM.BEE_R;
  u.body.children[0].material = bigMat;
  u.body.scale.setScalar(1); g.scale.setScalar(k); u.k = k;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.022, 6, 16), bandMat);   // 頭帶（繞在前半段）
  band.rotation.y = Math.PI / 2; band.position.x = 0.12; band.scale.set(1, 1.05, 1); u.body.add(band);
  for (const z of [0.07, -0.07]) {   // 生氣的眉毛
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 0.014), eyeMat);
    brow.position.set(0.155, 0.085, z); brow.rotation.y = z > 0 ? -0.3 : 0.3; brow.rotation.z = -0.5; u.body.add(brow);
  }
  u.arms = [];
  for (const z of [0.12, -0.12]) {   // 粗手臂＋拳頭
    const arm = new THREE.Group(); arm.position.set(0.04, -0.03, z);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.13, 8), armMat); up.rotation.z = Math.PI / 2; up.position.x = 0.065;
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), armMat); fist.position.x = 0.14;
    const ofist = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), outlineMat); ofist.scale.setScalar(1.2); fist.add(ofist);
    arm.add(up, fist); u.body.add(arm); u.arms.push(arm);
  }
  u.big = true;
  return g;
}

// ---------- 角色動作（共用動作套在同一套骨架上，跟籃球遊戲一樣） ----------
const MOVE_WIN = { stumble: [0.2, 1.4], reach: [1.55, 2.2] };
const SIG_WIN = { tu: [0.2, 1.8], bian: [0.3, 1.9] };
const OVER_WIN = { guard: [0.4, 1.0], handsup: [0.9, 0.9], hop: [1.05, 1.35] };
const UPPER = ['Spine', 'Spine01', 'Spine02', 'neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'];
const _oq = new THREE.Quaternion();
function prepOver(clip) { return clip.tracks.filter((t) => t.name.endsWith('.quaternion') && UPPER.includes(t.name.split('.')[0])).map((t) => ({ bone: t.name.split('.')[0], it: t.createInterpolant() })); }
function overTime(name, t) { const [a, b] = OVER_WIN[name], d = b - a; if (d <= 0) return a; const u = ((t % (2 * d)) + 2 * d) % (2 * d); return a + (u < d ? u : 2 * d - u); }
function overlay(rig, tg, t, dt) {   // 上半身疊動作：rig.ow 每段權重慢慢淡入淡出
  const k = Math.min(1, dt * 10);
  for (const name in OVER_WIN) {
    const w = rig.ow[name] = (rig.ow[name] || 0) + ((tg === name ? 1 : 0) - (rig.ow[name] || 0)) * k;
    const tr = OVER[name]; if (!tr || w < 0.01) continue;
    const tm = overTime(name, t + rig.ph);
    for (const o of tr) { const b = rig.bones[o.bone]; if (b) b.quaternion.slerp(_oq.fromArray(o.it.evaluate(tm)), w); }
  }
}
function playClip(c, clip, [w0, w1], { loop = false, dur } = {}) {
  if (!clip) return;
  const a = c.actor, act = a.mixer.clipAction(clip);
  if (a.sig && a.sig !== act) a.sig.stop();
  act.reset(); act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce); act.clampWhenFinished = true;
  act.time = w0; act.timeScale = dur ? (w1 - w0) / dur : 1; act.setEffectiveWeight(a.sigW || 0); act.play();
  a.sig = act; a.sigOn = true; a.sigW = a.sigW || 0;
  c.sigT = loop ? 1e9 : (dur ?? (w1 - w0));
}
const playMove = (c, name, o) => playClip(c, MOVES[name], MOVE_WIN[name], o);
const playSig = (c, o) => playClip(c, SIG[c.key], o?.loop ? [0, SIG[c.key]?.duration || 1] : SIG_WIN[c.key], o);
function stopAll(c) { c.sigT = 0; if (c.actor.sig) { c.actor.sig.stop(); c.actor.sig = null; c.actor.sigW = 0; c.actor.sigOn = false; } c.rig.ow = {}; }

// ---------- 小編頭上的表情（粉筆字） ----------
const emoteCache = {};
function emoteTex(text, color) {
  const k = text + color;
  if (!emoteCache[k]) emoteCache[k] = canvasTex(256, 128, (g, w, h) => {
    g.font = '700 84px "LXGW WenKai TC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#1d1a16'; g.strokeText(text, w / 2, h / 2 + 4);
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4);
  }, false);
  return emoteCache[k];
}
let emote = null, emoteKey = '';
function setEmote(text, color) {
  const k = text ? text + color : '';
  if (k === emoteKey) return;
  emoteKey = k;
  if (!emote) { emote = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); emote.renderOrder = 20; emote.scale.set(1.1, 0.55, 1); scene.add(emote); }
  emote.visible = !!text;
  if (text) { emote.material.map = emoteTex(text, color); emote.material.needsUpdate = true; emote.userData.t0 = performance.now() / 1000; }
}
export function refreshFonts() { for (const k in emoteCache) { emoteCache[k].dispose(); delete emoteCache[k]; } emoteKey = ''; }

// ---------- 每格更新 ----------
let heroFall = 0, tuX = X(560), tuFace = 0, last = performance.now() / 1000;
function placeHero() {
  const b = S.hero;
  hero.actor.root.position.set(X(b.position.x), Y(b.position.y + SIM.HERO_R), 0);
}
// ui：{ pts, drawing, hint, a0 }
export function render(ui = {}) {
  const now = performance.now() / 1000, dt = Math.min(0.05, now - last); last = now;
  if (S) frame(ui, now, dt);
  renderer.render(scene, camera);
}
function frame(ui, t, dt) {
  // 靜態東西的小動作：蜂窩搖、水面起伏、不能畫的圈轉
  for (const h of hives) if (h.parent) h.children[0].rotation.y = Math.sin(t * 0.8 + h.userData.sway) * 0.15;
  for (const w of water) {
    const p = w.surf.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.array[i * 3 + 2] = w.base[i * 3 + 2] + Math.sin(w.base[i * 3] * 3 + t * 2.4) * 0.025 + Math.sin(w.base[i * 3] * 7 - t * 3.1) * 0.012;
    p.needsUpdate = true;
  }
  const drawPhase = S.state === 'draw';
  for (const r of noDraw) { r.visible = drawPhase; r.rotation.z = t * 0.6; }
  if (ui.hint && drawPhase) { if (!hint) makeHint(); hint.visible = true; hint.material.opacity = 0.55 + 0.45 * Math.sin(t * 5); } else if (hint) hint.visible = false;
  // 作業簿
  for (const [b, m] of bookMeshes) { m.position.set(X(b.position.x), Y(b.position.y), 0); m.rotation.z = -b.angle; }
  // 粉筆線
  if (S.line) setLine(S.line.local, S.line.body, S.line.a0);
  else setLine(ui.pts || [], null);
  const tip = ui.drawing && ui.pts && ui.pts.length ? ui.pts[ui.pts.length - 1] : null;
  pen.visible = !!tip; if (tip) pen.position.set(X(tip.x), Y(tip.y), 0.1);
  // 蜜蜂
  while (beeMeshes.length < S.bees.length) { const m = S.bees[beeMeshes.length].big ? makeBigBee() : makeBee(); beeMeshes.push(m); dynG.add(m); }
  S.bees.forEach((b, i) => {
    const m = beeMeshes[i], u = m.userData;
    m.position.set(X(b.position.x), Y(b.position.y), 0);
    if (b.wind > 0) m.position.x += Math.sin(t * 90) * 0.02;
    if (Math.abs(b.velocity.x) > 0.4) u.face = b.velocity.x > 0 ? 1 : -1;
    m.rotation.y += ((u.face > 0 ? -0.55 : Math.PI + 0.55) - m.rotation.y) * Math.min(1, dt * 10);
    u.body.rotation.z = Math.max(-0.6, Math.min(0.6, -b.velocity.y * 0.06 * u.face));
    const flap = Math.sin(t * 70 + i) * 0.9;
    u.w1.rotation.x = -0.4 - flap; u.w2.rotation.x = 0.4 + flap;
    const s = b.dash > 0 ? 1.15 : b.wind > 0 ? 0.88 : 1;
    u.body.scale.set(s * (b.dash > 0 ? 1.15 : 1), 1 / Math.sqrt(s), 1);
    if (u.big) {   // 推的時候：身體前傾、雙拳往前頂、抖一抖（用力）；平常手臂上下晃
      const pushing = b.push > 0;
      u.body.rotation.z += pushing ? -0.35 : 0;
      if (pushing) m.position.x += Math.sin(t * 50) * 0.01;
      u.arms.forEach((a, j) => { a.rotation.y = 0; a.rotation.z = pushing ? 0.15 : -0.9 + Math.sin(t * 8 + j * 3) * 0.3; a.position.x = pushing ? 0.12 : 0.04; });
    }
  });
  // 粉筆灰
  for (let i = 0; i < 90; i++) {
    const v = sparkV[i]; if (v.life <= 0) continue;
    v.life -= dt; v.vy -= 6 * dt;
    sparkPos[i * 3] += v.vx * dt; sparkPos[i * 3 + 1] += v.vy * dt;
    if (v.life <= 0) sparkPos[i * 3 + 1] = -99;
  }
  sparks.geometry.attributes.position.needsUpdate = true;
  updateHero(t, dt);
  updateTeacher(ui, tip, t, dt);
}

function updateHero(t, dt) {
  const c = hero, a = c.actor;
  let mood = 'idle';
  if (S.state === 'win') mood = 'win';
  else if (S.state === 'lose') mood = S.hit === 'bee' ? 'hurt' : S.hit === 'tack' ? 'hurt' : 'fall';
  else if (S.state === 'play' && S.scared < 260) mood = 'scared';
  if (mood !== c.mood) {
    const prev = c.mood; c.mood = mood;
    if (mood === 'win') playSig(c, { loop: true });
    else if (mood === 'hurt') playMove(c, 'stumble', { dur: 0.9 });
    else if (prev === 'win' || prev === 'hurt') { c.sigT = 0; if (a.sig) a.sigOn = false; }
  }
  c.sigT -= dt; if (c.sigT <= 0 && a.sig && a.sigOn) a.sigOn = false;
  placeHero();
  const root = a.root;
  // 看最近的蜜蜂那邊一點點，不要整個轉過去（臉要看得到）
  let face = 0;
  if (mood === 'scared') {
    let best = 1e9, bx = 0;
    for (const b of S.bees) { const d = Math.hypot(b.position.x - S.hero.position.x, b.position.y - S.hero.position.y); if (d < best) { best = d; bx = b.position.x - S.hero.position.x; } }
    face = Math.sign(bx) * 0.45;
    root.position.x += Math.sin(t * 60) * 0.012;   // 發抖
  }
  if (mood === 'win') root.position.y += Math.abs(Math.sin(t * 5)) * 0.05;
  if (mood === 'fall') heroFall += dt;
  turnTo(a, face, dt);
  a.speed = 0;
  updateActor(a, dt, t);
  overlay(c.rig, mood === 'scared' || mood === 'hurt' && c.sigT <= 0 ? 'guard' : null, t, dt);
  // 頭上的表情
  const E = { scared: ['!!', '#ff5a4a'], hurt: [S.hit === 'tack' ? '刺！' : '好痛', '#ff5a4a'], win: ['耶～', '#ffd65a'], fall: ['啊啊', '#9fd3ff'] };
  const e = E[mood];
  setEmote(e ? e[0] : '', e ? e[1] : '');
  if (emote && emote.visible) {
    const k = Math.min(1, (t - emote.userData.t0) * 6);
    emote.position.set(root.position.x + 0.1, root.position.y + 1.62 + (mood === 'scared' ? Math.sin(t * 12) * 0.03 : 0), 0.3);
    emote.scale.set(1.3 * k, 0.65 * k, 1);
  }
}

function updateTeacher(ui, tip, t, dt) {
  const c = tu, a = c.actor, root = a.root;
  let mood = 'idle';
  if (S.state === 'win') mood = 'win';
  else if (S.state === 'lose') mood = 'sad';
  else if (ui.drawing) mood = 'draw';
  if (mood !== c.mood) {
    const prev = c.mood; c.mood = mood;
    if (mood === 'win') playSig(c, { loop: true });
    else if (mood === 'sad') playMove(c, 'stumble', { dur: 1.0 });
    else if (prev === 'draw' && S.state === 'play') playMove(c, 'reach', { dur: 0.55 });   // 放開手指：往前一揮，線變成真的
    else if (prev === 'win') { c.sigT = 0; if (a.sig) a.sigOn = false; }
  }
  c.sigT -= dt; if (c.sigT <= 0 && a.sig && a.sigOn) a.sigOn = false;
  // 畫線時走到筆尖底下（偏旁邊一點，不要擋到線）
  let target = tuX;
  if (mood === 'draw' && tip) target = Math.max(-3.0, Math.min(3.0, X(tip.x) + (X(tip.x) > 0 ? -0.9 : 0.9)));
  const dx = target - root.position.x, step = Math.min(Math.abs(dx), 3.2 * dt);
  if (Math.abs(dx) > 0.05 && c.sigT <= 0) { root.position.x += Math.sign(dx) * step; a.speed = step / dt; tuFace = Math.sign(dx) * Math.PI / 2; }
  else { a.speed = 0; tuFace = tip ? Math.sign(X(tip.x) - root.position.x) * 0.5 : 0; }
  tuX = root.position.x;
  turnTo(a, tuFace, dt);
  updateActor(a, dt, t);
  overlay(c.rig, mood === 'draw' && a.speed === 0 ? 'handsup' : mood === 'idle' && S.state === 'play' && S.scared < 200 ? 'guard' : null, t, dt);
  // 粉筆灰：從老師手上飄到筆尖
  dust.visible = !!tip;
  if (tip) {
    const hx = root.position.x, hy = root.position.y + TU_SCALE * 1.02, ex = X(tip.x), ey = Y(tip.y);
    const cx = (hx + ex) / 2, cy = Math.max(hy, ey) + 0.8;
    for (let i = 0; i < 36; i++) {
      const u = (i / 36 + t * 0.9) % 1, v = 1 - u;
      dustPos[i * 3] = v * v * hx + 2 * v * u * cx + u * u * ex + Math.sin(i * 7 + t * 5) * 0.04;
      dustPos[i * 3 + 1] = v * v * hy + 2 * v * u * cy + u * u * ey + Math.cos(i * 5 + t * 4) * 0.04;
      dustPos[i * 3 + 2] = 0.4;
    }
    dust.geometry.attributes.position.needsUpdate = true;
  }
}

// 封面：小編站在地上發抖，三隻蜜蜂繞著飛，老師在旁邊
export function titleScene(state) {
  buildLevel(state, { bg: 'class', sol: [] });
  S.state = 'title';
}
export function titleFrame() {
  const t = performance.now() / 1000;
  S.bees.forEach((b, i) => {
    const a = t * 1.6 + i * 2.1;
    b.position.x = S.hero.position.x + Math.cos(a) * (110 + i * 18); b.position.y = S.hero.position.y - 40 + Math.sin(a * 1.3) * 70;
    b.velocity.x = -Math.sin(a) * 3; b.velocity.y = 0;
  });
}
export const debug = { get scene() { return scene; }, get camera() { return camera; }, get hero() { return hero; }, get tu() { return tu; } };

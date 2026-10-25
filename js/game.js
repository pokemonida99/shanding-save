// 流程、觸控畫線、介面；3D 畫面在 view3d.js，物理在 sim.js
import * as V from './view3d.js?v=3';

const { SIM: RL, LEVELS, AUD } = window;
const W = 720, H = 1280, PAD = 24;     // PAD：底部留給 iPhone 的橫條
const $ = (id) => document.getElementById(id);
const stage = $('stage'), cv = $('cv');
let scale = 1, dpr = 1, SW = W, SH = H, OX = 0, OY = 0;   // SW／SH：舞台寬高（螢幕比例不同就加寬或加長），OX／OY：關卡往右／往下移的量

// ---------- 存檔 ----------
let save = { stars: {} };
try { save = JSON.parse(localStorage.getItem('shanding-save') || '') || save; } catch (e) {}
const persist = () => { try { localStorage.setItem('shanding-save', JSON.stringify(save)); } catch (e) {} };
const unlocked = () => { let n = 0; while (save.stars[n + 1]) n++; return Math.min(LEVELS.length, n + 1); };

// ---------- 狀態 ----------
let S = null, li = 0, pts = [], drawing = false, ink = 0, hint = false, endAt = 0, shown = false, lastTick = -1;
let screen = 'loading', ready = false;

function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / W, vh / (H + V.BAND + PAD));
  // 螢幕比較矮（Safari 網址列、電腦橫螢幕）：舞台往兩邊加寬，不留黑邊；比較長：往上加長
  SW = Math.min(Math.round(vw / scale), 3200); OX = (SW - W) / 2;
  SH = Math.min(Math.round(vh / scale), 2000); OY = SH - PAD - V.BAND - H;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  stage.style.width = SW + 'px'; cv.style.width = SW + 'px';
  stage.style.height = SH + 'px'; cv.style.height = SH + 'px';
  stage.style.transform = `translate(${(vw - SW * scale) / 2}px, ${Math.max(0, (vh - SH * scale) / 2)}px) scale(${scale})`;
  if (ready) V.resize(Math.round(SW * scale * dpr), Math.round(SH * scale * dpr), SW, SH, OY);
}
window.addEventListener('resize', resize);

function setBg(name) { $('bg').style.backgroundImage = `url(art/bg-${name}.webp)`; }

function show(name) {
  screen = name;
  for (const id of ['title', 'select', 'loading']) $(id).classList.toggle('hide', name !== id);
  $('hud').classList.toggle('hide', name !== 'play');
  cv.classList.toggle('hide', name === 'select' || name === 'loading');
  if (name !== 'play') { $('tip').classList.add('hide'); $('result').classList.add('hide'); }
  AUD.music(name === 'play' ? 'play' : name === 'title' || name === 'select' ? 'title' : null);
  if (name !== 'play') { AUD.swarm(0); AUD.chalk(0); }
  if (name === 'select') buildGrid();
  if (name === 'title') titleScene();
}

// 封面：小編被三隻蜜蜂繞著飛、老師在下面
function titleScene() {
  S = RL.create({ solids: [{ x: 360, y: 1220, w: 720, h: 120 }], hives: [], hero: { x: 230, y: 1160 }, bees: 0 }, 1);
  V.titleScene(S);
  for (let i = 0; i < 3; i++) S.bees.push({ position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, dash: 0, wind: 0 });
  S.state = 'play'; S.scared = 120;
  setBg('class');
}

function buildGrid() {
  const g = $('grid'); g.innerHTML = '';
  const un = unlocked();
  let total = 0;
  LEVELS.forEach((L, i) => {
    const n = save.stars[i + 1] || 0; total += n;
    const b = document.createElement('button');
    b.className = 'cell' + (i + 1 > un ? ' lock' : '');
    b.style.setProperty('--r', `${((i * 37) % 7 - 3) * 0.5}deg`);
    b.innerHTML = `<b>${i + 1}</b><span>${L.name}</span><div class="mini">${[1, 2, 3].map((k) => `<i class="${k <= n ? '' : 'no'}">優</i>`).join('')}</div>`;
    if (i + 1 <= un) b.onclick = () => { AUD.SFX.click(); start(i); };
    g.appendChild(b);
  });
  $('selTotal').textContent = `優 ${total} / ${LEVELS.length * 3}`;
}

let SEAL_AT = [0, 0, 0];
function start(i, seed) {
  li = i;
  const L = LEVELS[i];
  S = RL.create(L, seed || (Date.now() & 0xffff) + 1);
  S.onCollide = onCollide;
  V.buildLevel(S, L);
  setBg(L.bg || 'class');
  pts = []; drawing = false; ink = L.ink; hint = false; shown = false; endAt = 0; lastTick = -1;
  $('lvNum').textContent = `第 ${i + 1} 關`;
  $('lvName').textContent = L.name;
  $('tipText').textContent = L.tip || '畫一條粉筆線護住小編';
  $('tip').classList.remove('hide');
  $('result').classList.add('hide');
  setTimer(S.time, 1);
  $('bHint').classList.remove('off', 'on');
  // 「優」章放在粉筆條上：粉筆剩比這個位置少就掉一顆
  const s3 = L.star3 || L.ink * 0.55, s2 = L.star2 || L.ink * 0.8;
  SEAL_AT = [0.035, 1 - s2 / L.ink, 1 - s3 / L.ink];
  let x0 = -1;   // 顯示位置：太近就往右推一點，章才不會疊在一起
  document.querySelectorAll('#inkSeals b').forEach((el, k) => { x0 = Math.max(SEAL_AT[k], x0 + 0.08); el.style.left = `${x0 * 100}%`; });
  inkUI();
  show('play');
}

function setTimer(left, frac) {
  $('timerN').textContent = left;
  $('timer').style.setProperty('--p', `${Math.max(0, frac) * 360}deg`);
  $('timer').classList.toggle('hurry', left <= 3 && S.state === 'play');
}
function inkUI() {
  const f = Math.max(0, ink / LEVELS[li].ink);
  $('inkBar').style.width = `${f * 100}%`;
  document.querySelectorAll('#inkSeals b').forEach((el, k) => el.classList.toggle('lost', k > 0 && f < SEAL_AT[k]));
}

function onCollide(pairs) {
  for (const p of pairs) {
    const a = p.bodyA.parent, b = p.bodyB.parent;
    const bee = a.label === 'bee' ? a : b.label === 'bee' ? b : null, o = bee === a ? b : a;
    if (bee && o.label === 'line') { AUD.SFX.thud(); V.puff(bee.position.x, bee.position.y, 3); }
  }
}

// ---------- 觸控畫線（照 2D 版：按在東西上也能開始、碰到東西貼邊停住） ----------
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * SW - OX, y: (e.clientY - r.top) / r.height * SH - OY };
}
let queued = [], drawnFrame = 0;   // pointermove 先收著，rAF 裡再加點（手機上一格只處理一次）
cv.addEventListener('pointerdown', (e) => {
  if (screen !== 'play' || !S || S.state !== 'draw') return;
  e.preventDefault();
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  drawing = true; pts = []; ink = LEVELS[li].ink; queued = [];
  $('tip').classList.add('hide');
  addPoint(toWorld(e));
});
cv.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  e.preventDefault();
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (list.length ? list : [e])) queued.push(toWorld(ev));
});
function flushPoints() {
  if (!queued.length) return;
  for (const p of queued) addPoint(p);
  queued = [];
  inkUI();
}
const up = () => {
  if (!drawing) return;
  flushPoints();
  drawing = false;
  if (pts.length >= 2 && RL.lineLen(pts) >= 12) {
    RL.commit(S, pts);
    AUD.SFX.commit();
    $('tip').classList.add('hide');
    $('bHint').classList.add('off'); $('bHint').classList.remove('on');
    hint = false;
  } else { pts = []; ink = LEVELS[li].ink; inkUI(); }
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);

function addPoint(p) {
  if (!pts.length) { if (RL.segOK(S, p, p)) pts.push(p); return; }   // 按在東西上：手指移到空地才開始畫
  const last = pts[pts.length - 1];
  let d = Math.hypot(p.x - last.x, p.y - last.y);
  if (d < 6 || ink <= 0) return;
  if (d > ink) { const k = ink / d; p = { x: last.x + (p.x - last.x) * k, y: last.y + (p.y - last.y) * k }; d = ink; }
  if (!RL.segOK(S, last, p)) {
    // 碰到東西：線貼著停在邊上，不會整段斷掉
    let lo = 0, hi = 1;
    for (let i = 0; i < 8; i++) {
      const m = (lo + hi) / 2, q = { x: last.x + (p.x - last.x) * m, y: last.y + (p.y - last.y) * m };
      if (RL.segOK(S, last, q)) lo = m; else hi = m;
    }
    p = { x: last.x + (p.x - last.x) * lo, y: last.y + (p.y - last.y) * lo };
    d = Math.hypot(p.x - last.x, p.y - last.y);
    if (d < 3) return;
  }
  pts.push(p); ink -= d; drawnFrame += d;
}

// ---------- 主迴圈 ----------
let acc = 0, prev = performance.now();
function loop(now) {
  const dt = Math.min(100, now - prev); prev = now;
  if (screen === 'play' && S) {
    if (drawing) flushPoints();
    AUD.chalk(drawing ? drawnFrame : 0); drawnFrame = 0;   // 粉筆摩擦聲：這一格畫越多越大聲
    if (S.state !== 'draw') {
      acc += dt;
      let n = 0;
      while (acc >= RL.DT && n++ < 4) { tick(); acc -= RL.DT; }
      if (n >= 4) acc = 0;
    }
  }
  if (ready && (screen === 'play' || screen === 'title')) {
    if (screen === 'title') V.titleFrame();
    V.render({ pts, drawing, hint });
  }
  requestAnimationFrame(loop);
}
function tick() {
  const before = S.bees.length, st = S.state;
  RL.step(S);
  if (S.bees.length > before) AUD.SFX.bee();
  // 蜂群嗡嗡：越多越近越大聲
  let buzz = 0; const hp = S.hero.position;
  if (S.state === 'play') for (const b of S.bees) buzz += Math.max(0, 1 - Math.hypot(b.position.x - hp.x, b.position.y - hp.y) / 700);
  AUD.swarm(buzz / 7);
  for (const b of S.bees) { if (b.dash > 0 && !b._d) AUD.SFX.lunge(); b._d = b.dash > 0; }
  if (st === 'play') {
    const left = Math.max(0, Math.ceil(S.time - S.t));
    setTimer(left, 1 - S.t / S.time);
    if (left !== lastTick && left <= 3 && left > 0) AUD.SFX.tick();
    lastTick = left;
  }
  if (S.state !== 'play' && !endAt) {
    endAt = S.t + (S.state === 'win' ? 1.3 : 1.6);
    if (S.state === 'win') AUD.SFX.win(); else { AUD.SFX.sting(S.hit); AUD.SFX.lose(); }
  }
  if (endAt && S.t >= endAt && !shown) result();
}

const WIN_LINES = ['小編今天一根汗毛都沒被叮到，給你一個優！', '粉筆線畫得很漂亮，蜜蜂一隻都進不來。', '下課鐘響了，小編平安下課～'];
const LOSE = {
  bee: ['小編被叮了一個大包，老師先帶你去保健室……', '蜜蜂從縫鑽進來了，線要畫得更密一點喔。'],
  water: ['小編掉進生態池了！快拿毛巾來。'],
  tack: ['踩到圖釘了！小編的腳好痛。'],
  fall: ['小編掉下去了……下次線要畫穩一點。'],
};
const LOSE_TITLE = { bee: '被叮了', water: '掉進池裡', tack: '踩到圖釘', fall: '掉下去了' };
function result() {
  shown = true;
  const win = S.state === 'win';
  const r = $('result');
  r.classList.remove('hide'); r.classList.toggle('lose', !win);
  $('rTitle').textContent = win ? '下課！' : (LOSE_TITLE[S.hit] || '被叮了');
  const d = new Date(); $('rDate').textContent = `${d.getMonth() + 1} 月 ${d.getDate()} 日・第 ${li + 1} 關`;
  const n = win ? RL.stars(S) : 0;
  $('rSeals').innerHTML = [1, 2, 3].map((k) => `<div class="seal ${k <= n ? 'pop' : 'no'}" style="animation-delay:${k * 0.18}s">優</div>`).join('');
  for (let k = 1; k <= n; k++) setTimeout(() => AUD.SFX.stamp(), k * 180 + 200);   // 蓋章聲跟著章落下
  const pool = win ? WIN_LINES : (LOSE[S.hit] || LOSE.bee);
  $('rLine').textContent = '兔兔老師：' + pool[Math.random() * pool.length | 0];
  const next = $('rNext'), alt = $('rRetry');
  alt.textContent = win ? '重來' : '選關';
  if (win) {
    save.stars[li + 1] = Math.max(save.stars[li + 1] || 0, n); persist();
    next.textContent = li + 1 < LEVELS.length ? '下一關' : '回課表';
    next.onclick = () => { AUD.SFX.click(); li + 1 < LEVELS.length ? start(li + 1) : show('select'); };
  } else {
    next.textContent = '再試一次';
    next.onclick = () => { AUD.SFX.click(); start(li); };
  }
}

// ---------- 全螢幕：Android／電腦按開始就進全螢幕（藏掉網址列）；iPhone Safari 不支援，提示加入主畫面 ----------
const fsOK = !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
function goFull() {
  const d = document, el = d.documentElement;
  if (!fsOK || d.fullscreenElement || d.webkitFullscreenElement) return;
  try { (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' })?.catch?.(() => {}); } catch (e) {}
}
const standalone = navigator.standalone || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
if (!fsOK && /iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone) $('iosTip').classList.remove('hide');

// ---------- 按鈕 ----------
const on = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); AUD.SFX.click(); fn(); });
on('bStart', () => { goFull(); start(Math.min(unlocked(), LEVELS.length) - 1); });
on('bSelect', () => { goFull(); show('select'); });
on('bBack', () => show('title'));
on('bMenu', () => show('select'));
on('bRetry', () => start(li));
on('rRetry', () => (S && S.state === 'lose' ? show('select') : start(li)));
on('bHint', () => { if (S && S.state === 'draw') { hint = !hint; $('bHint').classList.toggle('on', hint); } });
const muteUI = () => $('bMute').classList.toggle('muted', AUD.muted);
on('bMute', () => { AUD.setMute(!AUD.muted); muteUI(); });
muteUI();

// ---------- 擋放大、選取、長按 ----------
(function noZoomNoSelect() {
  const stop = (e) => e.preventDefault();
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'selectstart', 'dragstart', 'contextmenu'].forEach((ev) => document.addEventListener(ev, stop, { passive: false }));
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 || screen === 'play') e.preventDefault(); }, { passive: false });
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastEnd < 320 && !e.target.closest('button')) e.preventDefault();
    lastEnd = now;
  }, { passive: false });
  window.addEventListener('wheel', (e) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }, { passive: false });
  window.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });
})();

// ---------- 測試用（預覽分頁在背景時 rAF 不跑） ----------
window.dev = {
  start, show,
  sol() {   // 照解答畫線並放開
    pts = [];
    for (const [x, y] of LEVELS[li].sol) {
      const p = { x, y };
      if (!pts.length) { if (RL.segOK(S, p, p)) pts.push(p); } else if (RL.segOK(S, pts[pts.length - 1], p)) pts.push(p);
    }
    drawing = true; queued = []; up();
  },
  line(arr) { pts = arr.map(([x, y]) => ({ x, y })); drawing = true; queued = []; up(); },
  step(n = 60) { for (let i = 0; i < n; i++) if (S.state !== 'draw') tick(); V.render({ pts, drawing, hint }); return { state: S.state, hit: S.hit, t: +S.t.toFixed(2) }; },
  render() { V.render({ pts, drawing, hint }); },
  get S() { return S; }, V,
};

// ---------- 開機 ----------
resize();
requestAnimationFrame(loop);
(async () => {
  try {
    if (!document.createElement('canvas').getContext('webgl2')) throw new Error('這個瀏覽器開不了 3D 畫面（WebGL2），請用最新版的 Chrome 或 Safari 開。');
    const fonts = document.fonts ? Promise.race([document.fonts.load('700 40px "LXGW WenKai TC"', '國語數學自然社會英語好痛耶刺啊'), new Promise((r) => setTimeout(r, 4000))]) : null;
    await V.init(cv, (f) => { $('ldBar').style.width = `${Math.round(f * 100)}%`; });
    await fonts;
    V.refreshFonts();
    ready = true;
    resize();
    show('title');
  } catch (e) {
    console.error(e);
    $('ldText').textContent = e.message || '載入失敗，請重新整理再試一次。';
  }
})();

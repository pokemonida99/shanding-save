// 物理核心：瀏覽器與 node 驗證共用（tools/verify.js）
(function (root) {
  const M = root.Matter;
  const W = 720, H = 1280, DT = 1000 / 60;
  const T = 14;                 // 粉筆線粗細
  const HERO_R = 50;            // 小編的碰撞是一顆圓（不翻滾，3D 模型站在圓裡）
  const BEE_R = 15;
  // 大力蜂（下學期）：比較大隻、很重，撞到線不會彈開，會一直推、退一下再衝撞，能把線推倒
  const STRONG = Object.assign({ r: 40, density: 0.05, speed: 1.1, push: 0.8, pushK: 3, back: 0.3, lift: 0.6, smash: 1, smashUp: 1.2, maxV: 9, maxW: 0.06 }, root.STRONG);
  const MOUTH = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }

  function create(level, seed) {
    const engine = M.Engine.create({ positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = 1;
    const S = {
      level, engine, world: engine.world, W, H,
      solids: [], hazards: [], boxes: [], hives: [], bees: [], line: null, hero: null,
      t: 0, state: 'draw', hit: null, rand: rng(seed || 7), spawnLeft: 0, nextSpawn: 0, scared: 0,
      time: level.time || 10,
    };
    const add = [];
    for (const s of level.solids || []) {
      const b = M.Bodies.rectangle(s.x, s.y, s.w, s.h, {
        isStatic: true, angle: (s.a || 0) * Math.PI / 180, friction: 0.9, label: 'solid',
      });
      b.def = s; S.solids.push(b); add.push(b);
    }
    for (const z of level.hazards || []) {
      const b = M.Bodies.rectangle(z.x, z.y, z.w, z.h, { isStatic: true, isSensor: true, label: 'hazard' });
      b.def = z; S.hazards.push(b); add.push(b);
    }
    for (const t of level.books || []) {
      const b = M.Bodies.rectangle(t.x, t.y, t.w || 44, t.h || 60, {
        chamfer: { radius: 6 }, friction: 0.7, density: 0.0015, label: 'box', angle: (t.a || 0) * Math.PI / 180,
      });
      b.def = t; S.boxes.push(b); add.push(b);
    }
    for (const c of level.hives || []) {
      const b = M.Bodies.circle(c.x, c.y, 36, { isStatic: true, label: 'hive' });
      const d = MOUTH[c.dir || 'down'];
      b.def = c; b.mouth = { x: c.x + d[0] * 62, y: c.y + d[1] * 62 }; b.dirv = d;
      S.hives.push(b); add.push(b);
    }
    const r = level.hero;
    S.hero = M.Bodies.circle(r.x, r.y - HERO_R - 0.5, HERO_R, {
      friction: 0.8, frictionStatic: 1, density: 0.002, label: 'hero',
    });
    M.Body.setInertia(S.hero, Infinity);   // 頭不翻滾，表情才看得清楚
    add.push(S.hero);
    M.Composite.add(S.world, add);

    S.spawnLeft = level.bees || 12;
    S.spawned = 0;
    if (level.strong) {   // 第幾隻是大力蜂：平均分散在整群裡
      const N = S.spawnLeft;
      S.bigAt = new Set(Array.from({ length: level.strong }, (_, j) => Math.floor((j + 0.3) * N / level.strong)));
    }
    M.Events.on(engine, 'collisionStart', (e) => {
      for (const p of e.pairs) {
        const a = p.bodyA.parent, b = p.bodyB.parent;
        // 蜜蜂撞到東西會先彈開一下再衝（像叮一下），不然一大群一直壓著會把粉筆線擠走
        for (const [x, y] of [[a, b], [b, a]]) {
          if (x.label === 'bee' && y.label !== 'bee' && y.label !== 'hero') {
            if (!x.big) x.back = 0.16 + S.rand() * 0.18;
            else {
              // 衝撞：撞到粉筆線那一下直接把線撞飛（線越重飛越近；勾住或頂住的線靠支撐擋下來）
              if (y.label === 'line' && (x.smashCool || 0) <= 0) {
                const v = Math.hypot(x.velocity.x, x.velocity.y), J = x.mass * Math.max(v, 3) * STRONG.smash;
                const sx = S.hero.position.x > x.position.x ? 1 : -1;
                // 直接改線的速度（碰撞事件後 Matter 會清掉 force，applyForce 沒用）；撞在哪裡就順便轉一下
                const jx = sx * J, jy = -J * STRONG.smashUp, rx = x.position.x - y.position.x, ry = x.position.y - y.position.y;
                // 一次最多加 STRONG.maxV（px／格）、STRONG.maxW（弧度／格）：再快線會一格跳過蜜蜂（穿隧），蜜蜂就跑進線裡面了
                let ux = jx / y.mass, uy = jy / y.mass; const um = Math.hypot(ux, uy), cap = Math.min(1, STRONG.maxV / (um || 1));
                ux *= cap; uy *= cap;
                const dw = Math.max(-STRONG.maxW, Math.min(STRONG.maxW, (rx * jy - ry * jx) / y.inertia));
                M.Body.setVelocity(y, { x: y.velocity.x + ux, y: y.velocity.y + uy });
                M.Body.setAngularVelocity(y, y.angularVelocity + dw);
                x.smashCool = 0.5;
                S.smashes = (S.smashes || 0) + 1; S.lastSmash = { x: x.position.x, y: x.position.y, p: J };
              }
              if (!(x.push > 0) && !(x.back > 0)) { x.push = STRONG.push * (0.8 + S.rand() * 0.4); x.dash = 0; x.wind = 0; }
            }
          }
        }
        const o = a === S.hero ? b : b === S.hero ? a : null;
        if (!o || S.state !== 'play') continue;
        if (o.label === 'bee') { S.hit = S.hit || 'bee'; S.hitBy = S.hitBy || o; }
        if (o.label === 'hazard') S.hit = S.hit || o.def.kind;
      }
      if (S.onCollide) S.onCollide(e.pairs);
    });
    return S;
  }

  // 畫線時能不能接這一段（不能穿過物體、不能蓋住蜂窩口、不能出畫面）
  function blockers(S) {
    return [...S.solids, ...S.boxes, ...S.hives, S.hero];
  }
  function segOK(S, a, b) {
    if (b.y < 150 || b.y > H - 8 || b.x < 8 || b.x > W - 8) return false;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const hits = len < 0.5 ? M.Query.point(blockers(S), b) : M.Query.ray(blockers(S), a, b, T + 2);
    if (hits.length) return false;
    for (const c of S.hives) if (distSeg(c.mouth, a, b) < 58) return false;
    return true;
  }
  function distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }
  function lineLen(pts) {
    let n = 0;
    for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return n;
  }

  // 放開手指：粉筆線變成會掉落的剛體，開始計時
  function commit(S, pts) {
    const parts = [];
    const opt = { friction: 1, frictionStatic: 2, restitution: 0, density: 0.008 };
    if (pts.length === 1) parts.push(M.Bodies.circle(pts[0].x, pts[0].y, T / 2, opt));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.5) continue;
      parts.push(M.Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len + T * 0.5, T,
        Object.assign({ angle: Math.atan2(b.y - a.y, b.x - a.x) }, opt)));
      if (i % 2 === 0 && i < pts.length - 1) parts.push(M.Bodies.circle(b.x, b.y, T / 2, opt));
    }
    const body = parts.length === 1 ? parts[0] : M.Body.create({ parts, ...opt });
    if (parts.length > 1) {
      // Matter 算組合物體慣量時沒加平行軸項，粉筆線會轉得像紙片，這裡自己補
      let I = 0;
      for (const p of body.parts.slice(1)) {
        const dx = p.position.x - body.position.x, dy = p.position.y - body.position.y;
        I += p.inertia + p.mass * (dx * dx + dy * dy);
      }
      M.Body.setInertia(body, I);
    }
    body.label = 'line';
    M.Composite.add(S.world, body);
    const p0 = { x: body.position.x, y: body.position.y };
    S.line = { body, local: pts.map((p) => ({ x: p.x - p0.x, y: p.y - p0.y })), a0: body.angle, len: lineLen(pts) };
    S.state = 'play';
    S.t = 0;
    S.nextSpawn = 0.35;
  }

  // ---------- 蜜蜂尋路：格子地圖，從小編往外算距離，蜜蜂順著距離變小的方向飛就會找到縫 ----------
  const CELL = 16, GX = W / CELL, GY0 = -320, GY = Math.ceil((H + 40 - GY0) / CELL);
  const INF = BEE_R - 1;                       // 障礙物往外膨脹的量：比蜜蜂窄的縫就算堵住
  function cellOf(x, y) {
    const cx = Math.floor(x / CELL), cy = Math.floor((y - GY0) / CELL);
    return cx < 0 || cy < 0 || cx >= GX || cy >= GY ? -1 : cy * GX + cx;
  }
  function markPoly(bl, verts, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const v of verts) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); }
    const c0 = Math.max(0, Math.floor((x0 - pad) / CELL)), c1 = Math.min(GX - 1, Math.floor((x1 + pad) / CELL));
    const r0 = Math.max(0, Math.floor((y0 - pad - GY0) / CELL)), r1 = Math.min(GY - 1, Math.floor((y1 + pad - GY0) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * GX + c; if (bl[i]) continue;
      const p = { x: (c + 0.5) * CELL, y: GY0 + (r + 0.5) * CELL };
      if (M.Vertices.contains(verts, p)) { bl[i] = 1; continue; }
      for (let k = 0; k < verts.length; k++) if (distSeg(p, verts[k], verts[(k + 1) % verts.length]) < pad) { bl[i] = 1; break; }
    }
  }
  function buildFlow(S) {
    const bl = new Uint8Array(GX * GY);
    for (const b of [...S.solids, ...S.boxes]) for (const pt of (b.parts.length > 1 ? b.parts.slice(1) : [b])) markPoly(bl, pt.vertices, INF);
    const ends = [];
    if (S.line) {
      const b = S.line.body, ca = Math.cos(b.angle - S.line.a0), sa = Math.sin(b.angle - S.line.a0);
      const wp = S.line.local.map((q) => ({ x: b.position.x + q.x * ca - q.y * sa, y: b.position.y + q.x * sa + q.y * ca }));
      for (let i = 1; i < wp.length; i++) markPoly(bl, [wp[i - 1], wp[i]], T / 2 + INF);
      if (wp.length === 1) markPoly(bl, [wp[0], wp[0]], T / 2 + INF);
      ends.push(wp[0], wp[wp.length - 1]);
      S.lineMid = wp[wp.length >> 1];
    }
    const dist = new Int16Array(GX * GY).fill(-1), q = new Int32Array(GX * GY);
    let qh = 0, qt = 0;
    const rp = S.hero.position;
    for (let r = 0; r < GY; r++) for (let c = 0; c < GX; c++) {
      const x = (c + 0.5) * CELL, y = GY0 + (r + 0.5) * CELL;
      if (Math.hypot(x - rp.x, y - rp.y) < HERO_R + 6) { const i = r * GX + c; dist[i] = 0; q[qt++] = i; }
    }
    while (qh < qt) {
      const i = q[qh++], r = (i / GX) | 0, c = i - r * GX, d = dist[i] + 1;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= GY || cc >= GX) continue;
        const j = rr * GX + cc;
        if (dist[j] >= 0 || bl[j]) continue;
        if (dr && dc && (bl[r * GX + cc] || bl[rr * GX + c])) continue;   // 斜角不能穿牆角
        dist[j] = d; q[qt++] = j;
      }
    }
    // 外面（蜂窩口）到得了小編嗎？
    let open = false;
    for (const c of S.hives) { const i = cellOf(c.mouth.x, c.mouth.y); if (i >= 0 && dist[i] > 0) open = true; }
    if (!S.hives.length) open = dist[cellOf(20, 200)] > 0;
    S.flow = { dist, bl, open, ends };
  }
  // 順著尋路距離下降的方向
  function flowDir(S, b) {
    const f = S.flow, i = cellOf(b.position.x, b.position.y);
    if (i < 0 || f.dist[i] < 0) return null;
    if (f.dist[i] <= 3) return null;                          // 很近了，直接衝
    const r = (i / GX) | 0, c = i - r * GX;
    let best = f.dist[i], bx = 0, by = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= GY || cc >= GX) continue;
      const d = f.dist[rr * GX + cc];
      if (d >= 0 && d < best) { best = d; bx = dc; by = dr; }
    }
    if (!bx && !by) return null;
    const n = Math.hypot(bx, by);
    return [bx / n, by / n];
  }

  function spawnBee(S, hive, big) {
    const r = S.rand;
    const m = hive.mouth, d = hive.dirv;
    const b = M.Bodies.circle(m.x + (r() - 0.5) * 20, m.y + (r() - 0.5) * 20, big ? STRONG.r : BEE_R, {
      frictionAir: 0.02, friction: big ? 0.3 : 0, restitution: big ? 0 : 0.2, density: big ? STRONG.density : 0.0005, label: 'bee', slop: 1,
      // 大力蜂跟小蜜蜂互相穿過：不然大力蜂會把小蜜蜂硬擠穿粉筆線
      collisionFilter: big ? { category: 0x4, mask: 0xffff & ~0x2 } : { category: 0x2, mask: 0xffff & ~0x4 },
    });
    const sp = S.level.speed || 5;
    b.big = !!big; b.push = 0;
    b.spd = sp * 1.35 * (0.8 + r() * 0.4) * (big ? STRONG.speed : 1);
    b.phase = r() * 6.28;
    b.wob = 0.35 + r() * 0.5;
    b.pry = r() < 0.6;          // 封死時：六成去撞線頭把線撬起來，其他的從上面猛撞
    b.stuck = 0; b.around = 0; b.back = 0; b.wind = 0; b.dash = 0; b.cool = 0.4 + r() * 0.8; b.side = r() < 0.5 ? 1 : -1;
    M.Body.setVelocity(b, { x: d[0] * 6 + (r() - 0.5) * 3, y: d[1] * 6 + (r() - 0.5) * 3 });
    M.Composite.add(S.world, b);
    S.bees.push(b);
  }

  function step(S) {
    if (S.state === 'draw') return;
    S.t += DT / 1000;
    const g = S.engine.gravity;
    // 蜂窩輪流吐蜜蜂
    if (S.state === 'play' && S.spawnLeft > 0 && S.t >= S.nextSpawn) {
      const c = S.hives[S.spawnLeft % S.hives.length];
      spawnBee(S, c, S.bigAt && S.bigAt.has(S.spawned));
      S.spawned++;
      S.spawnLeft--;
      S.nextSpawn = S.t + (S.level.gap || 0.16);
    }
    const rp = S.hero.position;
    let near = 1e9;
    const k = 0.07 / (DT * DT);
    if (S.state === 'play' && (!S.flow || (S.flowTick = (S.flowTick || 0) + 1) % 10 === 0)) buildFlow(S);
    for (const b of S.bees) {
      let tx = rp.x - b.position.x, ty = rp.y - b.position.y;
      const dist = Math.hypot(tx, ty) || 1;
      near = Math.min(near, dist);
      tx /= dist; ty /= dist;
      // 目標方向：有縫就順著尋路鑽；封死了就去撞線頭
      let lunge = dist < 330;
      if (S.flow && S.state === 'play') {
        const fd = S.flow.open ? flowDir(S, b) : null;
        if (fd) { tx = fd[0]; ty = fd[1]; lunge = false; }
        else if (!S.flow.open && b.pry && S.flow.ends.length) {
          const e = S.flow.ends, m = S.lineMid || e[0];
          const end = Math.hypot(e[0].x - b.position.x, e[0].y - b.position.y) < Math.hypot(e[1].x - b.position.x, e[1].y - b.position.y) ? e[0] : e[1];
          let ox = end.x - m.x, oy = end.y - m.y; const on = Math.hypot(ox, oy) || 1; ox /= on; oy /= on;
          const sx = end.x + ox * 60, sy = Math.min(end.y + oy * 60, end.y + 10);       // 線頭外側
          const ds = Math.hypot(sx - b.position.x, sy - b.position.y);
          if (ds > 40) { tx = (sx - b.position.x) / ds; ty = (sy - b.position.y) / ds; lunge = false; }
          else { // 到了線頭外面：往內、往上頂
            let ix = -ox, iy = -0.9; const inn = Math.hypot(ix, iy); tx = ix / inn; ty = iy / inn; lunge = true;
          }
        }
      }
      let dx, dy, sp = b.spd, kk = k;
      const st = DT / 1000;
      b.cool -= st;
      if (b.big) b.smashCool = (b.smashCool || 0) - st;
      if (S.state === 'win') { dx = -tx * 0.4; dy = -1; sp *= 1.4; }
      else if (b.push > 0) {
        // 大力蜂：貼著東西用力推，推完退一下再衝撞
        // 往小編那邊「橫著」推、稍微往上抬，線才會被推倒（往下壓只會把線壓得更穩）
        b.push -= st; dx = rp.x > b.position.x ? 1 : -1; dy = -STRONG.lift; kk = k * STRONG.pushK;
        if (b.push <= 0) b.back = STRONG.back;
      } else if (b.back > 0) {
        // 撞到東西彈開，彈完立刻再撲
        b.back -= st; dx = -tx; dy = -ty; sp *= 0.5;
        if (b.back <= 0) { b.dash = 0.3; b.wind = 0; }
      } else if (b.wind > 0) {
        // 蓄力：往後縮一下
        b.wind -= st; dx = -tx; dy = -ty; sp *= 0.35; kk = k * 2;
        if (b.wind <= 0) b.dash = 0.32;
      } else if (b.dash > 0) {
        // 撲過去
        b.dash -= st; dx = tx; dy = ty; sp *= 1.8; kk = k * 1.6;
        if (b.dash <= 0) b.cool = 0.7 + S.rand() * 0.9;
      } else if (lunge && b.cool <= 0) {
        b.wind = 0.16 + S.rand() * 0.08; dx = tx; dy = ty;
      } else {
        // 卡在東西上太久就往旁邊繞
        const v = Math.hypot(b.velocity.x, b.velocity.y);
        if (b.around > 0) b.around -= DT / 1000;
        else if (v < sp * 0.35) { b.stuck += DT / 1000; if (b.stuck > 0.5) { b.around = 0.7; b.stuck = 0; b.side = -b.side; } }
        else b.stuck = 0;
        const w = b.around > 0 ? b.side * 1.6 : Math.sin(S.t * 5 + b.phase) * b.wob;
        dx = tx - ty * w; dy = ty + tx * w;
      }
      const n = Math.hypot(dx, dy) || 1;
      const fx = (dx / n * sp - b.velocity.x) * b.mass * kk;
      const fy = (dy / n * sp - b.velocity.y) * b.mass * kk - b.mass * g.y * g.scale;
      b.force.x += fx; b.force.y += fy;
    }
    S.scared = near;
    M.Engine.update(S.engine, DT);
    if (S.state === 'play') {
      if (rp.y > H + 80 || rp.x < -80 || rp.x > W + 80) S.hit = S.hit || 'fall';
      if (S.hit) S.state = 'lose';
      else if (S.t >= S.time) S.state = 'win';
    }
  }

  function stars(S) {
    const L = S.level, used = S.line ? S.line.len : 0;
    const s3 = L.star3 || L.ink * 0.55, s2 = L.star2 || L.ink * 0.8;
    return used <= s3 ? 3 : used <= s2 ? 2 : 1;
  }

  root.SIM = { create, segOK, commit, step, stars, lineLen, W, H, T, HERO_R, BEE_R, DT, MOUTH, STRONG };
})(typeof window !== 'undefined' ? window : globalThis);

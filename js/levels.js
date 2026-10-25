// 關卡資料：畫面 720×1280，y 往下。hero.y 是小編腳踩的地面高度。
// sol 是驗證用的解（tools/verify.js 會實跑），也是「老師示範」顯示的虛線。
(function (root) {
  // 半橢圓拱：從 from 度畫到 to 度（270＝正上方）
  function ell(cx, cy, rx, ry, from = 180, to = 360, n = 28) {
    const p = [];
    for (let i = 0; i <= n; i++) {
      const a = (from + (to - from) * i / n) * Math.PI / 180;
      p.push([Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a))]);
    }
    return p;
  }
  function seg(...pts) { // 把折線切細
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 14));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) out.push([Math.round(ax + (bx - ax) * j / n), Math.round(ay + (by - ay) * j / n)]);
    }
    return out;
  }
  const GROUND = { x: 360, y: 1220, w: 720, h: 120 };          // 頂面 1160
  const POND = (top) => ({ kind: 'water', x: 360, y: (top + 1280) / 2, w: 720, h: 1280 - top });

  const LEVELS = [
    { // 1 教學
      name: '第一堂課', bg: 'class', tip: '按住畫面畫一條粉筆線，把小編圍起來，撐過 10 秒',
      ink: 1100, bees: 8, speed: 4.2,
      solids: [GROUND], hives: [{ x: 150, y: 330 }], hero: { x: 360, y: 1160 },
      sol: ell(360, 1150, 120, 200),
    },
    { // 2 浮台＋生態池
      name: '生態池', bg: 'yard', tip: '粉筆線放開後會往下掉，要讓它落在台子上',
      ink: 1000, bees: 10, speed: 4.5,
      solids: [{ x: 360, y: 900, w: 320, h: 36 }], hazards: [POND(1120)],
      hives: [{ x: 590, y: 300 }], hero: { x: 360, y: 882 },
      sol: ell(360, 874, 140, 165),
    },
    { // 3 牆角
      name: '靠牆站好', bg: 'class', tip: '牆壁也能拿來靠：從牆邊斜斜畫到小積木旁',
      ink: 800, star3: 480, star2: 620, bees: 12, speed: 4.8,
      solids: [GROUND, { x: 40, y: 760, w: 80, h: 800 }, { x: 352, y: 1142, w: 28, h: 36 }], hives: [{ x: 560, y: 360 }],
      hero: { x: 200, y: 1160 },
      sol: ell(90, 1150, 228, 330, 270, 360, 18),
    },
    { // 4 兩個蜂窩
      name: '左右夾擊', bg: 'class', ink: 1100, bees: 14, speed: 5,
      solids: [GROUND], hives: [{ x: 120, y: 330 }, { x: 600, y: 330 }], hero: { x: 360, y: 1160 },
      sol: ell(360, 1150, 115, 205),
    },
    { // 5 坑洞：蓋蓋子
      name: '躲進沙坑', bg: 'yard', tip: '粉筆不多，想想最省的畫法',
      ink: 420, star3: 220, star2: 320, bees: 14, speed: 5,
      solids: [GROUND, { x: 145, y: 1050, w: 290, h: 220 }, { x: 575, y: 1050, w: 290, h: 220 }],
      hives: [{ x: 360, y: 330 }], hero: { x: 360, y: 1160 },
      sol: seg([262, 932], [458, 932]),
    },
    { // 6 高柱
      name: '升旗台上', bg: 'yard', tip: '台子太窄放不住，粉筆線要拉到地上',
      ink: 1900, star3: 1350, star2: 1600, bees: 12, speed: 5,
      solids: [GROUND, { x: 360, y: 1000, w: 90, h: 320 }], hives: [{ x: 130, y: 300 }],
      hero: { x: 360, y: 840 },
      sol: ell(360, 1150, 165, 540, 180, 360, 40),
    },
    { // 7 圖釘
      name: '小心圖釘', bg: 'class', tip: '別把小編推到圖釘上',
      ink: 1000, bees: 14, speed: 5.2,
      solids: [{ x: 230, y: 1220, w: 460, h: 120 }, { x: 680, y: 1220, w: 80, h: 120 }],
      hazards: [{ kind: 'tack', x: 570, y: 1185, w: 140, h: 70 }],
      hives: [{ x: 600, y: 320 }], hero: { x: 300, y: 1160 },
      sol: ell(300, 1150, 112, 200),
    },
    { // 8 V 形谷
      name: '溜滑梯', bg: 'yard', tip: '粉筆不多，找個地方把線架起來', ink: 600, star3: 360, star2: 460, bees: 14, speed: 5.2,
      solids: [GROUND, { x: 170, y: 1030, w: 340, h: 40, a: 45 }, { x: 550, y: 1030, w: 340, h: 40, a: -45 }],
      hives: [{ x: 160, y: 320 }, { x: 560, y: 320 }], hero: { x: 360, y: 1160 },
      sol: seg([190, 1010], [530, 1010]),
    },
    { // 9 作業簿
      name: '作業簿塔', bg: 'class', tip: '作業簿會被撞倒',
      ink: 1100, bees: 14, speed: 5.2,
      solids: [GROUND], books: [
        { x: 560, y: 1130, ch: '國語' }, { x: 560, y: 1070, ch: '數學' }, { x: 560, y: 1010, ch: '自然' },
        { x: 640, y: 1130, ch: '社會' }, { x: 640, y: 1070, ch: '英語' },
      ],
      hives: [{ x: 600, y: 330 }], hero: { x: 300, y: 1160 },
      sol: ell(300, 1150, 115, 205),
    },
    { // 10 下方蜂窩
      name: '腳下來襲', bg: 'dusk', tip: '蜜蜂也會從下面飛上來',
      ink: 1000, bees: 14, speed: 5.2,
      solids: [{ x: 360, y: 780, w: 280, h: 36 }, { x: 110, y: 1240, w: 220, h: 80 }, { x: 610, y: 1240, w: 220, h: 80 }],
      hives: [{ x: 110, y: 1120, dir: 'up' }, { x: 610, y: 1120, dir: 'up' }], hero: { x: 360, y: 762 },
      sol: ell(360, 754, 120, 190),
    },
    { // 11 窄浮台
      name: '小板凳', bg: 'yard', star3: 660, tip: '台子太小站不穩？把線繞到台子底下勾住', ink: 1000, bees: 15, speed: 5.4,
      solids: [{ x: 360, y: 840, w: 170, h: 36 }], hazards: [POND(1140)],
      hives: [{ x: 130, y: 300 }, { x: 590, y: 300 }], hero: { x: 360, y: 822 },
      sol: [[318, 876], [266, 872], ...ell(360, 840, 100, 190, 180, 360, 26).slice(1, -1), [454, 872], [402, 876]],
    },
    { // 12 牆架
      name: '置物架', bg: 'dusk', ink: 800, bees: 15, speed: 5.4,
      solids: [{ x: 690, y: 640, w: 60, h: 1000 }, { x: 560, y: 760, w: 220, h: 30 }, { x: 462, y: 732, w: 20, h: 26 }], hazards: [POND(1150)],
      hives: [{ x: 160, y: 420, dir: 'right' }], hero: { x: 570, y: 745 },
      sol: ell(652, 734, 170, 260, 180, 272, 16),
    },
    { // 13 三個蜂窩
      name: '蜂擁而至', bg: 'dusk', ink: 1200, bees: 18, speed: 5.4, gap: 0.12,
      solids: [GROUND], hives: [{ x: 110, y: 340 }, { x: 360, y: 260 }, { x: 610, y: 340 }],
      hero: { x: 360, y: 1160 },
      sol: ell(360, 1150, 120, 210),
    },
    { // 14 圖釘海中的台子
      name: '圖釘海', bg: 'dusk', tip: '蜜蜂撲得猛，粉筆線最好勾住台子', ink: 1000, star3: 820, star2: 930, bees: 16, speed: 5.6,
      solids: [{ x: 360, y: 1000, w: 230, h: 40 }, { x: 360, y: 1240, w: 720, h: 80 }],
      hazards: [{ kind: 'tack', x: 360, y: 1170, w: 720, h: 60 }],
      hives: [{ x: 130, y: 360 }, { x: 600, y: 360 }], hero: { x: 360, y: 980 },
      sol: [[320, 1036], [222, 1030], ...ell(360, 1000, 138, 200, 180, 360, 26).slice(1, -1), [498, 1030], [400, 1036]],
    },
    { // 15 終章
      name: '放學前的蜂王', bg: 'dusk', ink: 1300, bees: 22, speed: 6, gap: 0.1, time: 12,
      solids: [GROUND, { x: 360, y: 960, w: 200, h: 36 }],
      hazards: [], hives: [{ x: 110, y: 330 }, { x: 610, y: 330 }, { x: 110, y: 1090, dir: 'right' }],
      hero: { x: 360, y: 942 },
      sol: [[318, 996], [252, 990], ...ell(360, 960, 112, 200, 180, 360, 26).slice(1, -1), [468, 990], [402, 996]],
    },
  ];
  LEVELS.forEach((L) => { L.term = 1; });

  // ---------- 下學期：大力蜂來了（strong＝這關有幾隻大力蜂，平均混在蜂群裡） ----------
  // 大力蜂大力到不像蜜蜂：會把線撞飛，靠柱子、勾台子都擋不住；要把線繞台子一圈「扣住」才撞不走
  // 解答＝繞台子＋小編一圈的圓角框（tools/verify.js 實跑）；底部中間留一點點縫，不用畫到接死
  function wrap(x0, y0, x1, y1, r = 55, gap = 14, step = 14) {
    const P = [[Math.round((x0 + x1) / 2 + gap / 2), y1]], cx = (x0 + x1) / 2;
    const arc = (ax, ay, a0, a1) => { const n = Math.max(3, Math.round(Math.abs(a1 - a0) * r / step)); for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; P.push([Math.round(ax + r * Math.cos(a)), Math.round(ay + r * Math.sin(a))]); } };
    const to = (bx, by) => { const [ax, ay] = P[P.length - 1]; const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / step)); for (let i = 1; i <= n; i++) P.push([Math.round(ax + (bx - ax) * i / n), Math.round(ay + (by - ay) * i / n)]); };
    to(x0 + r, y1); arc(x0 + r, y1 - r, Math.PI / 2, Math.PI);
    to(x0, y0 + r); arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
    to(x1 - r, y0); arc(x1 - r, y0 + r, Math.PI * 1.5, Math.PI * 2);
    to(x1, y1 - r); arc(x1 - r, y1 - r, 0, Math.PI / 2);
    to(cx - gap / 2, y1);
    return P;
  }
  const P = (w, y) => ({ x: 360, y, w, h: 36 });
  // 小編站在台子上；線＝台子外面留 24、頭上留 145 的框；墨水、蓋章門檻照解答的長度給
  function T2(d) {
    const pl = d.solids.find((q) => q.h === 36), hy = pl.y - 18;
    const sol = wrap(pl.x - pl.w / 2 - 24, hy - 145, pl.x + pl.w / 2 + 24, pl.y + 18 + 24);
    let len = 0; for (let i = 1; i < sol.length; i++) len += Math.hypot(sol[i][0] - sol[i - 1][0], sol[i][1] - sol[i - 1][1]);
    return { ink: Math.round(len * 1.6 / 50) * 50, star3: Math.round(len * 1.08), star2: Math.round(len * 1.3), ...d, hero: { x: 360, y: hy }, sol };
  }
  const TERM2 = [
    T2({ name: '大力蜂來了', bg: 'yard', tip: '大力蜂大力到不像蜜蜂，會把線撞飛！把線繞台子一圈扣住', bees: 10, speed: 4.6, strong: 1,
      solids: [P(240, 840)], hazards: [POND(1140)], hives: [{ x: 140, y: 300 }] }),
    T2({ name: '繞一圈', bg: 'yard', tip: '從台子底下開始，繞過小編頭上再繞回來', bees: 12, speed: 4.8, strong: 2,
      solids: [P(200, 820)], hazards: [POND(1140)], hives: [{ x: 130, y: 300 }, { x: 590, y: 300 }] }),
    T2({ name: '下面也來', bg: 'dusk', bees: 14, speed: 5, strong: 2,
      solids: [P(260, 760), { x: 110, y: 1240, w: 220, h: 80 }, { x: 610, y: 1240, w: 220, h: 80 }], hives: [{ x: 110, y: 1120, dir: 'up' }, { x: 610, y: 1120, dir: 'up' }] }),
    T2({ name: '圖釘海', bg: 'class', bees: 14, speed: 5.2, strong: 2,
      solids: [P(230, 960), { x: 360, y: 1240, w: 720, h: 80 }], hazards: [{ kind: 'tack', x: 360, y: 1170, w: 720, h: 60 }], hives: [{ x: 130, y: 360 }, { x: 600, y: 360 }] }),
    T2({ name: '窄窄板凳', bg: 'yard', bees: 14, speed: 5.2, strong: 2,
      solids: [P(150, 820)], hazards: [POND(1140)], hives: [{ x: 120, y: 520, dir: 'right' }, { x: 600, y: 300 }] }),
    T2({ name: '高高在上', bg: 'dusk', bees: 15, speed: 5.2, strong: 3,
      solids: [P(220, 640), { x: 110, y: 1240, w: 220, h: 80 }, { x: 610, y: 1240, w: 220, h: 80 }], hazards: [POND(1180)], hives: [{ x: 600, y: 280 }, { x: 110, y: 1120, dir: 'up' }] }),
    T2({ name: '小板凳', bg: 'yard', bees: 15, speed: 5.4, strong: 3,
      solids: [P(170, 840)], hazards: [POND(1140)], hives: [{ x: 130, y: 300 }, { x: 590, y: 300 }] }),
    T2({ name: '生態池', bg: 'yard', bees: 15, speed: 5.4, strong: 3,
      solids: [P(320, 900)], hazards: [POND(1120)], hives: [{ x: 590, y: 300 }] }),
    T2({ name: '蜂擁而至', bg: 'dusk', bees: 18, speed: 5.4, strong: 3, gap: 0.12,
      solids: [P(220, 880)], hazards: [POND(1140)], hives: [{ x: 110, y: 340 }, { x: 360, y: 260 }, { x: 610, y: 340 }] }),
    T2({ name: '蜂王的保鑣', bg: 'dusk', bees: 22, speed: 6, strong: 5, gap: 0.1, time: 12,
      solids: [GROUND, P(200, 960)], hives: [{ x: 110, y: 330 }, { x: 610, y: 330 }, { x: 110, y: 1090, dir: 'right' }] }),
  ];
  TERM2.forEach((L) => { L.term = 2; });
  LEVELS.push(...TERM2);
  root.LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);

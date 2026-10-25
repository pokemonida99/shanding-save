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
  // 大力蜂會把線橫著推走，空曠地上單獨一個拱罩不住；線要靠著柱子、牆，或勾住台子、卡進坑裡
  const post = (x, h = 130, w = 40) => ({ x, y: 1160 - h / 2, w, h });
  const again = (i, over) => ({ ...LEVELS[i], tip: undefined, ...over, term: 2 });
  const TERM2 = [
    { name: '大力蜂來了', bg: 'class', tip: '大力蜂很壯，會把線推走！讓線靠著兩邊的柱子',
      ink: 1000, bees: 10, speed: 4.4, strong: 1,
      solids: [GROUND, post(212), post(508)], hives: [{ x: 150, y: 330 }], hero: { x: 360, y: 1160 },
      sol: ell(360, 1150, 114, 205) },
    again(2, { name: '靠牆別動', strong: 2, tip: '線頂住牆和小積木，大力蜂就推不動' }),
    { name: '兩根柱子', bg: 'class', ink: 1000, bees: 14, speed: 5, strong: 2,
      solids: [GROUND, post(212, 150), post(508, 150)], hives: [{ x: 120, y: 330 }, { x: 600, y: 330 }], hero: { x: 360, y: 1160 },
      sol: ell(360, 1150, 114, 205) },
    again(4, { name: '沙坑防守', strong: 2, tip: '線卡在坑口兩邊，推也推不走' }),
    again(5, { name: '升旗台', strong: 2 }),
    again(7, { name: '溜滑梯下', strong: 3 }),
    again(10, { name: '小板凳', strong: 3, tip: '把線勾到台子底下，大力蜂就推不掉' }),
    again(11, { name: '置物架', strong: 3 }),
    again(13, { name: '圖釘海', strong: 3 }),
    again(14, { name: '蜂王的保鑣', strong: 5 }),
  ];
  TERM2.forEach((L) => { L.term = 2; });
  LEVELS.push(...TERM2);
  root.LEVELS = LEVELS;
})(typeof window !== 'undefined' ? window : globalThis);

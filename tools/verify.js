// node tools/verify.js [關卡號]：每關用 sol 實跑 5 個亂數種子，並確認不畫線會輸
globalThis.Matter = require('../vendor/matter.min.js');
require('../js/sim.js');
require('../js/levels.js');
const { SIM: RL, LEVELS } = globalThis;

function draw(S, sol, ink) {
  const pts = [];
  let used = 0, skipped = 0;
  for (const [x, y] of sol) {
    const p = { x, y };
    if (!pts.length) { if (RL.segOK(S, p, p)) pts.push(p); else skipped++; continue; }
    const last = pts[pts.length - 1];
    const d = Math.hypot(x - last.x, y - last.y);
    if (used + d > ink) break;
    if (RL.segOK(S, last, p)) { pts.push(p); used += d; } else skipped++;
  }
  return { pts, used, skipped };
}

function run(L, seed, withLine) {
  const S = RL.create(L, seed);
  let info = { used: 0, skipped: 0 };
  if (withLine) { info = draw(S, L.sol, L.ink); RL.commit(S, info.pts); }
  else RL.commit(S, [{ x: 20, y: 200 }]);
  let n = 0;
  while (S.state === 'play' && n++ < 60 * 20) RL.step(S);
  return { state: S.state, hit: S.hit, t: S.t.toFixed(1), stars: RL.stars(S), ...info };
}

const only = process.argv[2] ? [+process.argv[2] - 1] : LEVELS.map((_, i) => i);
let bad = 0;
for (const i of only) {
  const L = LEVELS[i];
  const N = +(process.env.SEEDS || 5);
  const rs = Array.from({ length: N }, (_, s) => run(L, (s + 1) * 7919, true));
  const base = run(L, 99, false);
  const wins = rs.filter((r) => r.state === 'win').length;
  const r0 = rs[0];
  const ok = wins === N && base.state === 'lose' && r0.skipped === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'XX '} ${String(i + 1).padStart(2)} ${L.name.padEnd(6, '　')} 勝 ${wins}/${N} ` +
    `墨 ${Math.round(r0.used)}/${L.ink} 星${r0.stars} 跳點${r0.skipped} ` +
    `| 失敗原因 ${rs.filter((r) => r.state !== 'win').map((r) => r.hit + '@' + r.t).join(',') || '-'} ` +
    `| 不畫線 ${base.state}${base.hit ? '(' + base.hit + '@' + base.t + ')' : ''}`);
}
process.exit(bad ? 1 : 0);

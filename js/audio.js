// 程式合成配樂與音效（不用音檔）：木琴旋律＋撥弦低音＋烏克麗麗刷和弦＋木魚沙鈴；過關是下課鐘
// iPhone 要在觸控事件裡解鎖；iOS 17+ 設 audioSession=playback，靜音開關打開也聽得到
(function () {
  let ac = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('shanding-save-mute') === '1'; } catch (e) {}
  const lastAt = {};

  function unlock() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ac.destination);
      master = ac.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(comp);
      musicBus = ac.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
      const n = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      if (want) startMusic(want);
    }
    if (ac.state === 'suspended' && !away) ac.resume();
  }
  ['touchstart', 'touchend', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  // 跳出遊戲（切 App、鎖螢幕、切分頁）就把聲音整個停掉，回來再接著放
  let away = false;
  function awayChange(h) {
    away = h;
    if (!ac) return;
    if (h) ac.suspend(); else ac.resume();
  }
  document.addEventListener('visibilitychange', () => awayChange(document.hidden));
  window.addEventListener('pagehide', () => awayChange(true));
  window.addEventListener('pageshow', () => awayChange(document.hidden));
  window.addEventListener('blur', () => { if (document.hidden) awayChange(true); });

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function osc(type, f, t, dur, out, vol = 1) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.value = vol;
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function noise(t, dur, out, { type = 'bandpass', f = 1000, q = 1, vol = 0.2, a = 0.002 } = {}) {
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    s.connect(fl); fl.connect(g); g.connect(out); env(g, t, a, dur, vol);
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05); return fl;
  }
  function limit(key, ms) {
    const now = performance.now();
    if (lastAt[key] && now - lastAt[key] < ms) return false;
    lastAt[key] = now; return true;
  }

  // ---------- 樂器 ----------
  function marimba(m, t, vol = 0.2, out = musicBus) {   // 基音＋四倍泛音快速衰減＋一點敲擊聲
    const f = mtof(m), g = ac.createGain(); g.connect(out); env(g, t, 0.003, 0.55, vol);
    osc('sine', f, t, 0.6, g); osc('sine', f * 4, t, 0.1, g, 0.25); osc('triangle', f * 2, t, 0.2, g, 0.12);
  }
  function glock(m, t, vol = 0.14, out = musicBus) {   // 鐵琴：清亮、尾巴長
    const f = mtof(m), g = ac.createGain(); g.connect(out); env(g, t, 0.002, 1.3, vol);
    osc('sine', f, t, 1.4, g); osc('sine', f * 2.76, t, 0.5, g, 0.3); osc('sine', f * 5.4, t, 0.2, g, 0.1);
  }
  function bass(m, t, dur = 0.4, vol = 0.22) {
    const f = mtof(m), g = ac.createGain(), fl = ac.createBiquadFilter();
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(f * 8, t); fl.frequency.exponentialRampToValueAtTime(f * 2, t + dur);
    fl.connect(g); g.connect(musicBus); env(g, t, 0.006, dur, vol);
    osc('triangle', f, t, dur, fl); osc('sine', f / 2, t, dur, fl, 0.5);
  }
  function strum(notes, t, vol = 0.05) {   // 烏克麗麗刷一下（反拍）
    notes.forEach((m, i) => {
      const tt = t + i * 0.012, f = mtof(m), g = ac.createGain(), fl = ac.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = 2600; fl.connect(g); g.connect(musicBus); env(g, tt, 0.003, 0.16, vol);
      osc('triangle', f, tt, 0.2, fl); osc('sawtooth', f, tt, 0.12, fl, 0.15);
    });
  }
  function kick(t, vol = 0.32, out = musicBus) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    o.connect(g); g.connect(out); env(g, t, 0.003, 0.18, vol); o.start(t); o.stop(t + 0.25);
  }
  function wood(t, f = 1500, vol = 0.12, out = musicBus) {   // 木魚／響板
    const g = ac.createGain(); g.connect(out); env(g, t, 0.001, 0.06, vol);
    osc('sine', f, t, 0.08, g); osc('triangle', f * 1.48, t, 0.04, g, 0.4);
  }
  const shaker = (t, vol = 0.035) => noise(t, 0.045, musicBus, { type: 'highpass', f: 6500, vol, a: 0.008 });

  // ---------- 配樂 ----------
  const CH = { C: [60, 64, 67], Am: [57, 60, 64], F: [57, 60, 65], G: [55, 59, 62], Dm: [57, 62, 65], Em: [55, 59, 64] };
  const ROOT = { C: 36, Am: 45, F: 41, G: 43, Dm: 38, Em: 40 };
  const _ = -1;
  const SONGS = {
    // 遊戲中：輕快的 C 大調，16 小節循環
    play: {
      bpm: 116,
      chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm|G', 'C', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
      mel: [
        76, _, 79, 76, 72, _, 74, 76, 72, _, 69, _, 72, 74, 76, _, 77, _, 76, 74, 72, _, 69, _, 71, 72, 74, _, 79, _, _, _,
        76, _, 79, 76, 72, _, 74, 76, 81, _, 79, 76, 72, _, 76, _, 74, _, 77, _, 79, 77, 76, 74, 72, _, 67, _, 72, _, _, _,
        72, _, 74, _, 77, _, 76, 74, 74, _, 71, _, 67, _, _, _, 71, _, 72, _, 74, _, 76, 79, 76, _, _, 72, 69, _, _, _,
        77, 76, 77, _, 81, _, 77, _, 79, 77, 76, _, 74, _, 71, _, 72, _, 76, _, 79, _, 84, _, _, _, _, _, _, _, _, _,
      ],
      bar(step, t, chord, s8) {
        const i = step % 8, last = Math.floor(step / 8) % 16 === 15;
        if (i === 0 || i === 4) kick(t, 0.26);
        if (i === 2 || i === 6) { wood(t, 1700, 0.07); strum(CH[chord], t); }
        if (last && i >= 4) wood(t, 1300 + i * 120, 0.09);
        shaker(t + s8 * 0.5, i % 2 ? 0.03 : 0.018);
        const r = ROOT[chord];
        if (i === 0) bass(r, t, 0.34); if (i === 3) bass(r + 7, t, 0.2, 0.15); if (i === 4) bass(r + 12, t, 0.3, 0.16); if (i === 6) bass(r + 7, t, 0.25, 0.16);
      },
      lead: (m, t) => marimba(m, t, 0.17),
    },
    // 封面、選關：慢一點，鐵琴彈下課鐘的旋律，木琴分解和弦
    title: {
      bpm: 92,
      chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F|G', 'C'],
      mel: [
        76, _, _, _, 72, _, _, _, 74, _, _, _, 67, _, _, _, 67, _, _, _, 74, _, _, _, 76, _, _, _, 72, _, _, _,
        76, _, 74, _, 72, _, 74, _, 79, _, _, _, 74, _, _, _, 72, _, 74, _, 76, _, 74, _, 72, _, _, _, _, _, _, _,
      ],
      bar(step, t, chord) {
        const i = step % 8, c = CH[chord];
        marimba([c[0], c[1], c[2], c[1] + 12][i % 4] - 12, t, 0.06);
        if (i === 0) bass(ROOT[chord], t, 0.8, 0.16); if (i === 4) bass(ROOT[chord] + 7, t, 0.5, 0.1);
        if (i === 2 || i === 6) shaker(t, 0.016);
      },
      lead: (m, t) => glock(m, t, 0.13),
    },
  };
  let want = null, song = null, timer = null, next = 0, step = 0;
  function startMusic(name) {
    song = SONGS[name]; step = 0; next = ac.currentTime + 0.12;
    clearInterval(timer); timer = setInterval(schedule, 40);
  }
  function schedule() {
    if (!song || !ac) return;
    const s8 = 60 / song.bpm / 2;
    while (next < ac.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % song.chords.length, i = step % 8;
      const cs = song.chords[bar].split('|'), chord = cs.length > 1 && i >= 4 ? cs[1] : cs[0];
      song.bar(step, next, chord, s8);
      const m = song.mel[step % song.mel.length];
      if (m > 0) song.lead(m, next);
      next += s8; step++;
    }
  }
  function music(name) {
    if (name === want) return;
    want = name;
    if (!ac) { if (name) unlock(); if (!ac) return; }
    if (!name) { clearInterval(timer); timer = null; song = null; return; }
    startMusic(name);
  }
  // 過關／失敗音效時配樂先壓低
  function duck(dur = 2.6, to = 0.12) {
    if (!ac) return; const t = ac.currentTime, g = musicBus.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + 0.08);
    g.setValueAtTime(to, t + dur); g.linearRampToValueAtTime(0.42, t + dur + 0.8);
  }

  // ---------- 持續的聲音：粉筆摩擦、蜂群嗡嗡 ----------
  let chalkG = null, swarmG = null;
  function chalk(speed) {   // 畫線時每格呼叫，speed＝這一格畫了幾 px
    if (!ac) return;
    if (!chalkG) {
      const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), hp = ac.createBiquadFilter();
      s.buffer = noiseBuf; s.loop = true; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7; hp.type = 'highpass'; hp.frequency.value = 900;
      chalkG = ac.createGain(); chalkG.gain.value = 0; s.connect(bp); bp.connect(hp); hp.connect(chalkG); chalkG.connect(sfxBus); s.start();
      chalkG.bp = bp;
    }
    const t = ac.currentTime, v = Math.min(0.16, speed * 0.006) * (0.75 + Math.random() * 0.5);
    chalkG.gain.setTargetAtTime(v, t, speed > 0 ? 0.02 : 0.05);
    chalkG.bp.frequency.setTargetAtTime(2000 + Math.min(2500, speed * 60), t, 0.05);
  }
  function swarm(level) {   // 0～1：蜜蜂越多越近越大聲
    if (!ac) return;
    if (!swarmG) {
      swarmG = ac.createGain(); swarmG.gain.value = 0;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.9;
      const trem = ac.createGain(); trem.gain.value = 0.7;
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 27; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(trem.gain); lfo.start();
      for (const f of [178, 183.5, 241]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(bp); o.start(); }
      bp.connect(trem); trem.connect(swarmG); swarmG.connect(sfxBus);
    }
    swarmG.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.055, ac.currentTime, 0.15);
  }

  // ---------- 音效 ----------
  const SFX = {
    commit() {   // 粉筆敲一下＋魔法鐵琴往上刷
      if (!ac) return; const t = ac.currentTime;
      wood(t, 900, 0.18, sfxBus); noise(t, 0.05, sfxBus, { f: 3000, vol: 0.12 });
      [84, 88, 91, 96].forEach((m, i) => glock(m, t + 0.04 + i * 0.05, 0.08, sfxBus));
    },
    bee(big) {   // 飛出蜂窩：短短一聲嗡；大力蜂低沉很多、還「哼！」一聲
      if (big && ac) {
        const t = ac.currentTime, g = ac.createGain(), bp = ac.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 1.1; bp.connect(g); g.connect(sfxBus); env(g, t, 0.03, 0.5, 0.16);
        const o = osc('sawtooth', 96, t, 0.55, bp); o.frequency.linearRampToValueAtTime(120, t + 0.5);
        osc('sawtooth', 98.5, t, 0.55, bp, 0.7);
        kick(t + 0.05, 0.22, sfxBus);
        return;
      }
      if (!ac || !limit('bee', 120)) return;
      const t = ac.currentTime, g = ac.createGain(), bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4; bp.connect(g); g.connect(sfxBus); env(g, t, 0.02, 0.22, 0.06);
      const o = osc('sawtooth', 220 + Math.random() * 60, t, 0.26, bp);
      o.frequency.linearRampToValueAtTime(260 + Math.random() * 60, t + 0.24);
    },
    lunge() {   // 蓄力撲過來：嗡聲往上衝
      if (!ac || !limit('lunge', 160)) return;
      const t = ac.currentTime, g = ac.createGain(), bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.5; bp.connect(g); g.connect(sfxBus); env(g, t, 0.01, 0.16, 0.05);
      const o = osc('sawtooth', 280, t, 0.2, bp); o.frequency.exponentialRampToValueAtTime(620, t + 0.15);
    },
    thud(big) {   // 蜜蜂撞到粉筆線：叩；大力蜂是「碰！」
      if (big && ac && limit('thudBig', 120)) { const t = ac.currentTime; kick(t, 0.34, sfxBus); noise(t, 0.12, sfxBus, { type: 'lowpass', f: 900, vol: 0.22 }); return; }
      if (!ac || !limit('thud', 70)) return; const t = ac.currentTime;
      noise(t, 0.04, sfxBus, { f: 1400, q: 2, vol: 0.13 }); osc('sine', 340 + Math.random() * 80, t, 0.05, sfxBus, 0.05);
    },
    sting(kind) {   // 小編中招
      if (!ac) return; const t = ac.currentTime;
      if (kind === 'water') {   // 撲通
        const f = noise(t, 0.5, sfxBus, { type: 'lowpass', f: 2200, vol: 0.3, a: 0.01 }); f.frequency.exponentialRampToValueAtTime(260, t + 0.5);
        for (let i = 0; i < 5; i++) { const o = osc('sine', 500 + Math.random() * 600, t + 0.15 + i * 0.07, 0.06, sfxBus, 0.05); o.frequency.exponentialRampToValueAtTime(1400, t + 0.2 + i * 0.07); }
        return;
      }
      if (kind === 'tack') glock(96, t, 0.12, sfxBus);
      const g = ac.createGain(); g.connect(sfxBus); env(g, t, 0.002, 0.18, 0.16);
      const o = osc('square', 1900, t, 0.2, g); o.frequency.exponentialRampToValueAtTime(500, t + 0.16);
      kick(t, 0.3, sfxBus);
    },
    tick() { if (!ac) return; wood(ac.currentTime, 2300, 0.14, sfxBus); },   // 時鐘滴答
    win() {   // 下課鐘：Mi Do Re Sol ／ Sol Re Mi Do
      if (!ac) return; const t = ac.currentTime; duck(3.4);
      [64, 60, 62, 55, 55, 62, 64, 60].forEach((m, i) => glock(m + 12, t + i * 0.34 + (i >= 4 ? 0.2 : 0), 0.2, sfxBus));
    },
    lose() {   // 哇哇哇哇～（滑音＋最後顫音）
      if (!ac) return; const t = ac.currentTime; duck(2.6);
      [67, 66, 65, 64].forEach((m, i) => {
        const tt = t + 0.25 + i * 0.36, dur = i === 3 ? 0.95 : 0.3, g = ac.createGain(), fl = ac.createBiquadFilter();
        fl.type = 'lowpass'; fl.frequency.setValueAtTime(400, tt); fl.frequency.linearRampToValueAtTime(1500, tt + 0.08); fl.frequency.linearRampToValueAtTime(500, tt + dur);
        fl.connect(g); g.connect(sfxBus); env(g, tt, 0.03, dur, 0.13);
        const o = osc('sawtooth', mtof(m - 12), tt, dur + 0.05, fl);
        if (i === 3) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6; lg.gain.value = 5; l.connect(lg); lg.connect(o.frequency); l.start(tt); l.stop(tt + dur); }
      });
    },
    stamp() { if (!ac) return; const t = ac.currentTime; kick(t, 0.26, sfxBus); noise(t, 0.06, sfxBus, { type: 'lowpass', f: 700, vol: 0.2 }); },   // 蓋章
    click() { if (!ac) return; wood(ac.currentTime, 1250, 0.13, sfxBus); },
  };
  function setMute(m) {
    muted = m;
    try { localStorage.setItem('shanding-save-mute', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = m ? 0 : 0.9;
  }
  window.AUD = { SFX, music, chalk, swarm, setMute, get muted() { return muted; }, unlock };
})();

// Animated battle replay: plays each turn's event timeline (steps, swings, shots, spells, damage)
// with class sprites, projectiles, bursts, floating numbers and a follow camera.
import { drawCharacter, SPELL_COL } from './sprites.js';
import { getMap } from '../engine/index.js';

const CELL = 40, WW = 960, WH = 640;
// the view keeps a margin above the top row (heads, hp bars, floating numbers) and a little below the bottom
const TOP = 44, BOT = 12, VH = WH + TOP + BOT;
const RANGED_W = new Set(['longbow', 'shortbow', 'lightxbow', 'javelin', 'dart']);
const BOW_W = new Set(['longbow', 'shortbow', 'lightxbow']);
const PROJECTILE_SPELLS = new Set(['fireBolt', 'produceFlame', 'magicMissile', 'scorchingRay', 'guidingBolt', 'eldritchBlast']);
const THEME = { open: 'grass', forest: 'forest', ruins: 'dirt', pillars: 'stone', choke: 'grass', room: 'dungeon' };

// ---------------------------------------------------------------- terrain (pre-rendered once per map)
const terrainCache = {};
function terrainCanvas(mapId) {
  if (terrainCache[mapId]) return terrainCache[mapId];
  const map = getMap(mapId);
  const cv = document.createElement('canvas'); cv.width = WW * 2; cv.height = WH * 2;
  const g = cv.getContext('2d'); g.scale(2, 2);
  const theme = THEME[mapId] || 'grass';
  let seed = 99; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const base = { grass: ['#4b6b3a', '#527440', '#466536'], forest: ['#35502c', '#3b5731', '#30492a'], dirt: ['#6e5b40', '#75614a', '#665438'], stone: ['#4a4652', '#504b58', '#45424d'], dungeon: ['#3f3a44', '#45404a', '#3a3640'] }[theme];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    g.fillStyle = base[(x * 7 + y * 13) % 3]; g.fillRect(x * CELL, y * CELL, CELL, CELL);
    if (theme === 'stone' || theme === 'dungeon') { g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.strokeRect(x * CELL + 0.5, y * CELL + 0.5, CELL - 1, CELL - 1); if ((x + y) % 2) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.moveTo(x * CELL, y * CELL + 20); g.lineTo(x * CELL + 40, y * CELL + 20); g.stroke(); } }
    else for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(${theme === 'dirt' ? '40,30,15' : '20,40,10'},${0.15 + rnd() * 0.2})`; g.fillRect(x * CELL + rnd() * 38, y * CELL + rnd() * 38, 2, 2 + rnd() * 3); }
    if (theme === 'dirt' && rnd() < 0.3) { g.fillStyle = 'rgba(80,110,50,.5)'; g.beginPath(); g.ellipse(x * CELL + rnd() * 40, y * CELL + rnd() * 40, 6 + rnd() * 6, 3 + rnd() * 3, 0, 0, 7); g.fill(); }
  }
  // subtle grid
  g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
  for (let x = 0; x <= map.w; x++) { g.beginPath(); g.moveTo(x * CELL, 0); g.lineTo(x * CELL, WH); g.stroke(); }
  for (let y = 0; y <= map.h; y++) { g.beginPath(); g.moveTo(0, y * CELL); g.lineTo(WW, y * CELL); g.stroke(); }
  // features
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
    const ch = map.cells[y][x], px = x * CELL, py = y * CELL;
    if (ch === '#') {
      const wall = theme === 'dungeon' ? '#25222a' : '#6a6370';
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(px + 4, py + 6, CELL, CELL);
      g.fillStyle = shade(wall, 0.75); g.fillRect(px, py, CELL, CELL);
      g.fillStyle = wall; g.fillRect(px, py - 6, CELL, CELL - 2);
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
      for (let r = 0; r < 3; r++) { g.beginPath(); g.moveTo(px, py - 6 + r * 12 + 12); g.lineTo(px + CELL, py - 6 + r * 12 + 12); g.stroke(); g.beginPath(); g.moveTo(px + (r % 2 ? 12 : 26), py - 6 + r * 12); g.lineTo(px + (r % 2 ? 12 : 26), py - 6 + r * 12 + 12); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(px, py - 6, CELL, 3);
    }
    if (ch === '+') {
      for (let k = 0; k < 5; k++) { const sx = px + 5 + rnd() * 28, sy = py + 10 + rnd() * 20, r = 4 + rnd() * 5; g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(sx + 2, sy + 3, r, r * 0.6, 0, 0, 7); g.fill(); g.fillStyle = ['#8a8070', '#7a7062', '#958a78'][k % 3]; g.beginPath(); g.ellipse(sx, sy, r, r * 0.7, rnd(), 0, 7); g.fill(); }
    }
    if (ch === '"') {
      for (let k = 0; k < 9; k++) { const sx = px + 3 + rnd() * 34, sy = py + 8 + rnd() * 30; g.strokeStyle = ['#5f8a3a', '#6e9a44', '#4f7a30'][k % 3]; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + (rnd() - 0.5) * 6, sy - 6, sx + (rnd() - 0.5) * 8, sy - 11); g.stroke(); }
    }
  }
  cv._trees = [];
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.cells[y][x] === 'T') cv._trees.push([x, y, rnd()]);
  terrainCache[mapId] = cv;
  return cv;
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); return `rgb(${((n >> 16) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`; }
function drawTree(g, x, y, r0) {
  const px = x * CELL + 20, py = y * CELL + 20;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(px + 4, py + 14, 16, 6, 0, 0, 7); g.fill();
  g.fillStyle = '#5a3d24'; g.fillRect(px - 3, py, 6, 15);
  for (const [dx, dy, r, c] of [[0, -6, 17, '#2f5a2e'], [-7, -2, 11, '#376b35'], [7, -4, 12, '#3a7038'], [0, -14, 11, '#458241'], [-3, -12, 5, '#5a9a52']]) { g.fillStyle = c; g.beginPath(); g.arc(px + dx + r0 * 2, py + dy, r, 0, 7); g.fill(); }
}

// ---------------------------------------------------------------- the player
export function createReplay(el) {
  const cv = el.canvas, ctx = cv.getContext('2d');
  let R = null, k = 0;               // result, current frame index
  let clock = 0, last = 0, playing = false, single = false;
  let sched = [], schedEnd = 0;      // items for the current frame
  let units = {}, fx = [], persistent = { auras: [], zones: [], sw: [] };
  let cam = { x: WW / 2, y: WH / 2, z: 1 }, zoomOn = true;
  let raf = 0;

  const speed = () => +el.speed.value || 1;
  const pos = (u) => [u.x * CELL + 20, u.y * CELL + 20];

  function syncFrame(i) {
    const f = R.frames[i];
    for (const s of f.units) {
      const u = units[s.id] || (units[s.id] = { id: s.id, cls: R.byId[s.id].cls, team: R.byId[s.id].team, maxHp: R.byId[s.id].maxHp, face: R.byId[s.id].team === 0 ? 1 : -1, walk: 0 });
      Object.assign(u, { x: s.x, y: s.y, hp: s.hp, dead: s.dead, cond: s.cond, conc: s.conc, raging: s.raging, tween: null, atk: null });
      u.lyingTarget = s.dead || s.hp === 0 || s.cond.includes('prone') ? 1 : 0;
      if (u.lying == null) u.lying = u.lyingTarget;
    }
    persistent = { auras: f.auras || [], zones: f.zones || [], sw: f.sw || [] };
  }

  // how long each event holds the timeline (ms at 1x)
  function block(e, at) {
    const dist = (a, b) => { const A = units[a], B = units[b]; return A && B ? Math.hypot(A.x - B.x, A.y - B.y) : 4; };
    switch (e.k) {
      case 'step': return 125;
      case 'swing': return 520;
      case 'shot': return 260 + Math.max(110, dist(e.a, e.t) * 32);
      case 'bolt': return PROJECTILE_SPELLS.has(e.spell) ? 240 + Math.max(110, dist(e.a, e.t) * 26) : 380;
      case 'area': return 300 + (e.spell === 'fireball' ? 300 : 0) + 420;
      case 'cast': return e.spell === 'fireball' || e.spell === 'shatter' || e.spell === 'callLightning' ? 0 : 260;
      case 'heal': return 380;
      case 'spirit': return 460;
      case 'blink': return 320;
      case 'rage': return 380;
      case 'down': return 360;
      case 'dead': return 200;
      case 'aura': return 260;
      case 'saved': case 'cond': return 160;
      default: return 0;
    }
  }

  function startFrame(i) {
    k = i;
    syncFrame(Math.max(0, i - 1));
    const f = R.frames[i];
    sched = []; let c = 0;
    for (const e of f.fx || []) { sched.push({ at: c, e, done: false }); c += block(e, c); }
    schedEnd = c + (f.fx && f.fx.length ? 350 : 60);
    clock = 0; fx = fx.filter((x) => x.persist);
    logTo(i);
    el.scrub.value = i;
    el.round.textContent = f.round ? `Round ${f.round}` : 'Start';
  }

  // ------------------------------------------------ applying events
  function apply(item) {
    const e = item.e, t0 = item.at;
    const A = e.a != null ? units[e.a] : null, T = e.t != null ? units[e.t] : null;
    const face = (u, v) => { if (u && v && v.x !== u.x) u.face = v.x > u.x ? 1 : -1; };
    switch (e.k) {
      case 'step': {
        const u = units[e.id]; if (!u) break;
        if (e.x !== u.x) u.face = e.x > u.x ? 1 : -1;
        u.tween = { fx: u.x, fy: u.y, t0, dur: 125 };
        u.x = e.x; u.y = e.y; break;
      }
      case 'swing': {
        face(A, T);
        A.weapon = e.w === 'unarmed' ? null : e.w; A.atk = { kind: A.cls === 'monk' ? 'punch' : 'melee', t0, dur: 480 };
        if (!e.hit) fx.push({ kind: 'text', t0: t0 + 260, dur: 700, at: T, txt: 'miss', col: '#ddd' });
        else fx.push({ kind: 'slash', t0: t0 + 230, dur: 220, at: T, col: e.crit ? '#ffe27a' : '#fff', face: A.face });
        break;
      }
      case 'shot': {
        face(A, T);
        const bow = BOW_W.has(e.w); A.weapon = e.w; A.atk = { kind: bow ? 'bow' : 'throw', t0, dur: 300 };
        fx.push({ kind: 'missile', t0: t0 + 240, dur: block(e) - 240, from: A, to: T, miss: !e.hit, style: e.w });
        if (!e.hit) fx.push({ kind: 'text', t0: t0 + block(e), dur: 700, at: T, txt: 'miss', col: '#ddd' });
        break;
      }
      case 'bolt': {
        face(A, T);
        A.atk = { kind: 'cast', t0, dur: 360 };
        const col = SPELL_COL[e.spell] || '#fff';
        if (PROJECTILE_SPELLS.has(e.spell)) fx.push({ kind: 'spellshot', t0: t0 + 220, dur: block(e) - 220, from: A, to: T, miss: !e.hit, spell: e.spell, col });
        else fx.push({ kind: 'onTarget', t0: t0 + 150, dur: 520, at: T, spell: e.spell, col });
        if (!e.hit) fx.push({ kind: 'text', t0: t0 + block(e), dur: 700, at: T, txt: 'miss', col: '#ddd' });
        break;
      }
      case 'area': {
        if (A) { A.atk = { kind: 'cast', t0, dur: 380 }; if (e.x !== A.x) A.face = e.x > A.x ? 1 : -1; }
        const col = SPELL_COL[e.spell] || '#fff';
        if (e.spell === 'fireball' && A) fx.push({ kind: 'spellshot', t0: t0 + 200, dur: 300, from: A, to: { x: e.x, y: e.y }, spell: 'fireball', col });
        fx.push({ kind: 'burst', t0: t0 + (e.spell === 'fireball' ? 500 : 250), dur: 620, x: e.x, y: e.y, r: e.r, round: e.round, spell: e.spell, col });
        break;
      }
      case 'cast': {
        if (A) { A.atk = { kind: 'cast', t0, dur: 360 }; face(A, T); }
        if (T && T !== A) fx.push({ kind: 'onTarget', t0: t0 + 160, dur: 520, at: T, spell: e.spell, col: SPELL_COL[e.spell] || '#fff' });
        else if (A) fx.push({ kind: 'ring', t0: t0 + 100, dur: 500, at: A, col: SPELL_COL[e.spell] || '#fff' });
        break;
      }
      case 'heal': {
        if (A && A !== T) { A.atk = { kind: 'cast', t0, dur: 340 }; face(A, T); }
        fx.push({ kind: 'sparkle', t0: t0 + 120, dur: 650, at: T, col: SPELL_COL[e.spell] || '#7ee08a' });
        break;
      }
      case 'spirit': fx.push({ kind: 'spirit', t0, dur: 440, x: e.x, y: e.y, at: T, team: A ? A.team : 0 }); if (!e.hit) fx.push({ kind: 'text', t0: t0 + 300, dur: 700, at: T, txt: 'miss', col: '#ddd' }); break;
      case 'blink': { const u = units[e.id]; fx.push({ kind: 'puff', t0, dur: 420, x: u.x, y: u.y }); u.x = e.x; u.y = e.y; u.tween = null; fx.push({ kind: 'puff', t0: t0 + 120, dur: 420, x: e.x, y: e.y }); break; }
      case 'rage': { const u = units[e.id]; u.raging = true; u.atk = { kind: 'cast', t0, dur: 300 }; fx.push({ kind: 'ring', t0, dur: 450, at: u, col: '#ff5a3a' }); fx.push({ kind: 'text', t0, dur: 900, at: u, txt: 'RAGE!', col: '#ff6a4a', big: true }); break; }
      case 'dmg': {
        if (!T) break;
        T.hp = e.hp; T.hurt = t0;
        if (e.amt > 0) fx.push({ kind: 'text', t0, dur: 900, at: T, txt: String(e.amt), col: e.crit ? '#ffe27a' : '#ff6b5e', big: e.crit });
        else if (e.fail) fx.push({ kind: 'text', t0, dur: 900, at: T, txt: `✖${e.fail}`, col: '#aaa' });
        break;
      }
      case 'healed': if (T) { T.hp = e.hp; if (e.up) { T.lyingTarget = 0; fx.push({ kind: 'text', t0: t0 + 120, dur: 900, at: T, txt: 'UP!', col: '#9fe0a8', big: true }); } if (e.amt) fx.push({ kind: 'text', t0, dur: 900, at: T, txt: '+' + e.amt, col: '#7ee08a' }); } break;
      case 'down': { const u = units[e.id]; u.lyingTarget = 1; u.hp = 0; break; }
      case 'dead': { const u = units[e.id]; u.dead = true; u.lyingTarget = 1; fx.push({ kind: 'text', t0, dur: 1000, at: u, txt: '☠', col: '#ddd', big: true }); break; }
      case 'aura': if (T) fx.push({ kind: 'ring', t0, dur: 300, at: T, col: SPELL_COL[e.spell] || '#f2d27a' }); break;
      case 'saved': if (T) fx.push({ kind: 'text', t0, dur: 700, at: T, txt: 'saved', col: '#cfe3ff' }); break;
      case 'cond': if (T) fx.push({ kind: 'onTarget', t0, dur: 520, at: T, spell: e.spell, col: SPELL_COL[e.spell] || '#fff' }); break;
    }
  }

  // ------------------------------------------------ drawing
  function unitScreen(u, now) {
    let x = u.x, y = u.y;
    if (u.tween) {
      const p = Math.min(1, (now - u.tween.t0) / u.tween.dur);
      x = u.tween.fx + (u.x - u.tween.fx) * p; y = u.tween.fy + (u.y - u.tween.fy) * p;
      if (p >= 1) u.tween = null;
    }
    return [x * CELL + 20, y * CELL + 20];
  }
  const anchor = (o, now) => (o && o.id != null && units[o.id] ? unitScreen(units[o.id], now) : [o.x * CELL + 20, o.y * CELL + 20]);

  function draw(now, dt) {
    const W = cv.width, H = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#121016'; ctx.fillRect(0, 0, W, H);
    // camera: fit everyone who is not dead (with a margin), so nobody is ever off screen
    let tx = WW / 2, ty = WH / 2, zt = 1;
    if (zoomOn) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const u of Object.values(units)) {
        if (u.dead) continue;
        const [ux, uy] = unitScreen(u, now);
        x0 = Math.min(x0, ux); x1 = Math.max(x1, ux); y0 = Math.min(y0, uy); y1 = Math.max(y1, uy);
      }
      if (x1 >= x0) {
        const pad = 70;                       // room for sprites, hp bars and floating numbers
        const bw = Math.max(240, x1 - x0 + pad * 2), bh = Math.max(160, y1 - y0 + pad * 2 + 30);
        zt = Math.max(1, Math.min(2.4, Math.min(WW / bw, VH / bh)));
        tx = (x0 + x1) / 2; ty = (y0 + y1) / 2 - 12;
      }
    }
    const lerp = Math.min(1, dt / 500);
    cam.z += (zt - cam.z) * lerp; cam.x += (tx - cam.x) * lerp; cam.y += (ty - cam.y) * lerp;
    const s = (W / WW) * cam.z;
    const hw = W / s / 2, hh = H / s / 2;
    const cx = Math.max(hw, Math.min(WW - hw, cam.x));
    const cy = hh * 2 >= VH ? (WH + BOT - TOP) / 2 : Math.max(-TOP + hh, Math.min(WH + BOT - hh, cam.y));
    ctx.setTransform(s, 0, 0, s, W / 2 - cx * s, H / 2 - cy * s);

    const terr = terrainCanvas(R.map);
    ctx.drawImage(terr, 0, 0, WW, WH);
    // margins above and below the map: continue the ground, dimmed, so heads at the edge have room
    ctx.drawImage(terr, 0, 0, WW * 2, TOP * 2, 0, -TOP, WW, TOP);
    ctx.drawImage(terr, 0, WH * 2 - BOT * 2, WW * 2, BOT * 2, 0, WH, WW, BOT);
    ctx.fillStyle = 'rgba(10,8,14,.45)'; ctx.fillRect(0, -TOP, WW, TOP); ctx.fillRect(0, WH, WW, BOT);

    // persistent spell areas
    for (const z of persistent.zones) {
      const g = ctx.createLinearGradient(0, (z.y - z.r) * CELL - 60, 0, (z.y + z.r + 1) * CELL);
      g.addColorStop(0, 'rgba(244,244,210,0)'); g.addColorStop(1, 'rgba(244,244,210,.35)');
      ctx.fillStyle = g; ctx.fillRect((z.x - z.r) * CELL, (z.y - z.r) * CELL - 60, (2 * z.r + 1) * CELL, (2 * z.r + 1) * CELL + 60);
    }
    for (const a of persistent.auras) {
      const c = units[Object.keys(units).find((id) => units[id].x === a.x && units[id].y === a.y)] || null;
      const [px, py] = c ? unitScreen(c, now) : [a.x * CELL + 20, a.y * CELL + 20];
      ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#f2d27a'; ctx.beginPath(); ctx.arc(px, py, (a.r + 0.5) * CELL, 0, 7); ctx.fill(); ctx.restore();
      for (let m = 0; m < 9; m++) { const ang = now / 900 + m * Math.PI * 2 / 9; const rr = (a.r + 0.2) * CELL * (0.75 + 0.25 * Math.sin(now / 400 + m)); dot(px + Math.cos(ang) * rr, py + Math.sin(ang) * rr * 0.6, 3, '#ffe9a0', 0.85); }
    }

    // units + trees, depth sorted
    const items = [];
    for (const u of Object.values(units)) { const [x, y] = unitScreen(u, now); items.push({ y, draw: () => drawUnit(u, x, y, now) }); }
    for (const [tx2, ty2, r0] of terr._trees) items.push({ y: ty2 * CELL + 20.5, draw: () => drawTree(ctx, tx2, ty2, r0) });
    for (const sw of persistent.sw) items.push({ y: sw.y * CELL + 21, draw: () => spectralMace(sw.x * CELL + 30, sw.y * CELL + 8 + Math.sin(now / 300) * 2, 0, sw.team) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // transient effects
    fx = fx.filter((e) => now < e.t0 + e.dur || e.t0 > now);
    for (const e of fx) if (now >= e.t0) drawFx(e, (now - e.t0) / e.dur, now);
  }

  function dot(x, y, r, c, a = 1) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }

  function drawUnit(u, x, y, now) {
    // lying eases toward target
    u.lying = u.lying == null ? u.lyingTarget : u.lying + (u.lyingTarget - u.lying) * 0.18;
    const moving = !!u.tween;
    if (moving) u.walk += 0.35;
    const atk = u.atk && now < u.atk.t0 + u.atk.dur && now >= u.atk.t0 ? { kind: u.atk.kind, t: (now - u.atk.t0) / u.atk.dur } : null;
    const hurt = u.hurt != null && now - u.hurt < 260 && now >= u.hurt ? 1 - (now - u.hurt) / 260 : 0;
    ctx.save(); ctx.translate(x, y);
    const cond = u.cond || [];
    if (cond.includes('hidden')) ctx.globalAlpha = 0.5;
    if (u.dead) { ctx.globalAlpha = 0.55; ctx.filter = 'grayscale(1)'; }
    if (u.raging && !u.dead) { ctx.save(); ctx.globalAlpha = 0.25 + 0.1 * Math.sin(now / 120); ctx.fillStyle = '#ff4a2a'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 19, 0, 0, 7); ctx.fill(); ctx.restore(); }
    if (cond.includes('blessed')) { ctx.save(); ctx.strokeStyle = 'rgba(255,233,160,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, -24, 7, 2.2, 0, 0, 7); ctx.stroke(); ctx.restore(); }
    if (cond.includes('faerie')) for (let m = 0; m < 4; m++) dot(Math.cos(now / 300 + m * 1.6) * 11, -6 + Math.sin(now / 250 + m) * 12, 1.6, '#d9a8ff', 0.8);
    ctx.save(); ctx.scale(u.face, 1);
    drawCharacter(ctx, u.cls, u.team, { walk: u.walk, moving, atk, hurt, lying: u.lying > 0.02 ? u.lying : 0, weapon: weaponFor(u, atk), time: now });
    ctx.restore();
    if (hurt) { ctx.save(); ctx.globalAlpha = hurt * 0.5; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 17, 0, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.filter = 'none';
    // condition overlays
    if (cond.includes('stunned')) for (let m = 0; m < 3; m++) { const a = now / 250 + m * 2.1; star(Math.cos(a) * 9, -24 + Math.sin(a) * 2.5); }
    if (cond.includes('paralyzed')) { ctx.save(); ctx.strokeStyle = '#8fd0ff'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.ellipse(0, 0, 12, 5, 0, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, -9, 10, 4, 0, 0, 7); ctx.stroke(); ctx.restore(); }
    if (cond.includes('hypnotized')) { ctx.save(); ctx.strokeStyle = '#d38cff'; ctx.lineWidth = 1.4; ctx.beginPath(); for (let a = 0; a < 12; a += 0.3) { const r = a * 0.7; ctx.lineTo(Math.cos(a + now / 200) * r, -26 + Math.sin(a + now / 200) * r * 0.5); } ctx.stroke(); ctx.restore(); }
    if (cond.includes('restrained')) { ctx.save(); ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 2; for (let m = -1; m <= 1; m++) { ctx.beginPath(); ctx.moveTo(m * 6, 17); ctx.quadraticCurveTo(m * 10, 8, m * 3, 2); ctx.stroke(); } ctx.restore(); }
    if (cond.includes('hasted')) { ctx.save(); ctx.strokeStyle = 'rgba(159,242,200,.8)'; ctx.lineWidth = 1.2; for (let m = 0; m < 3; m++) { ctx.beginPath(); ctx.moveTo(-u.face * 12, -8 + m * 7); ctx.lineTo(-u.face * 20, -8 + m * 7); ctx.stroke(); } ctx.restore(); }
    // hp bar + concentration pip
    if (!u.dead) {
      const fr = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(-13, -33, 26, 4);
      ctx.fillStyle = fr > 0.5 ? '#6fbf73' : fr > 0.25 ? '#d9a441' : '#e0574f'; ctx.fillRect(-13, -33, 26 * fr, 4);
      if (u.conc) { ctx.fillStyle = '#f2d27a'; ctx.beginPath(); ctx.arc(15, -31, 2.4, 0, 7); ctx.fill(); }
    }
    ctx.restore();
  }
  function weaponFor(u, atk) {
    if (atk && (atk.kind === 'melee' || atk.kind === 'bow' || atk.kind === 'throw')) return u.weapon || null;
    // archers who drew steel keep it out; everyone else goes back to their signature weapon
    if ((u.cls === 'rogue' || u.cls === 'ranger') && u.weapon && !RANGED_W.has(u.weapon)) return u.weapon;
    return null;
  }
  function star(x, y) { ctx.save(); ctx.fillStyle = '#ffe27a'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 1.4 : 3.4, a = i * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.fill(); ctx.restore(); }
  function spectralMace(x, y, rot, team) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = 0.85; ctx.shadowColor = '#ffe27a'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-1.5, -2, 3, 16); ctx.beginPath(); ctx.arc(0, -4, 5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawFx(e, p, now) {
    p = Math.max(0, Math.min(1, p));
    switch (e.kind) {
      case 'text': {
        const [x, y] = anchor(e.at, now);
        ctx.save(); ctx.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4;
        ctx.font = `bold ${e.big ? 16 : 12}px system-ui`; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(e.txt, x, y - 36 - p * 22);
        ctx.fillStyle = e.col; ctx.fillText(e.txt, x, y - 36 - p * 22); ctx.restore(); break;
      }
      case 'slash': {
        const [x, y] = anchor(e.at, now);
        ctx.save(); ctx.globalAlpha = 1 - p; ctx.strokeStyle = e.col; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x - e.face * 4, y - 6, 14, -1.2 + p * 0.6, 0.6 + p * 0.6); ctx.stroke(); ctx.restore(); break;
      }
      case 'missile': {
        const [ax, ay] = anchor(e.from, now), [bx0, by0] = anchor(e.to, now);
        const bx = bx0 + (e.miss ? 18 * Math.sign(bx0 - ax || 1) : 0), by = by0 + (e.miss ? -10 : 0);
        const x = ax + (bx - ax) * p, y = ay - 8 + (by - ay) * p - Math.sin(p * Math.PI) * (e.style === 'javelin' ? 26 : 8);
        const ang = Math.atan2(by - ay - Math.cos(p * Math.PI) * (e.style === 'javelin' ? 26 : 8) * Math.PI * 0.4, bx - ax);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        const len = e.style === 'javelin' ? 22 : e.style === 'dart' ? 7 : 14;
        ctx.strokeStyle = e.style === 'javelin' ? '#8a6a45' : '#c9a77a'; ctx.lineWidth = e.style === 'javelin' ? 2 : 1.4;
        ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.fillStyle = '#dfe5ea'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(4, 0); ctx.lineTo(0, 2); ctx.fill();
        if (e.style !== 'javelin' && e.style !== 'dart') { ctx.fillStyle = '#e8e2d0'; ctx.fillRect(-len, -1.6, 3, 3.2); }
        ctx.restore(); break;
      }
      case 'spellshot': {
        const [ax, ay] = anchor(e.from, now), [bx0, by0] = anchor(e.to, now);
        const bx = bx0 + (e.miss ? 20 * Math.sign(bx0 - ax || 1) : 0), by = by0 - 6 + (e.miss ? -12 : 0);
        if (e.spell === 'eldritchBlast' || e.spell === 'scorchingRay' || e.spell === 'guidingBolt') {
          // beams: crackle from hand to target
          ctx.save(); ctx.globalAlpha = p < 0.8 ? 1 : (1 - p) / 0.2; ctx.strokeStyle = e.col; ctx.shadowColor = e.col; ctx.shadowBlur = 10; ctx.lineWidth = e.spell === 'guidingBolt' ? 4 : 2.5;
          const reach = Math.min(1, p * 2.2);
          ctx.beginPath(); ctx.moveTo(ax, ay - 8);
          for (let s = 1; s <= 8; s++) { const q = (s / 8) * reach; ctx.lineTo(ax + (bx - ax) * q + (Math.random() - 0.5) * (e.spell === 'eldritchBlast' ? 6 : 2), ay - 8 + (by - ay + 8) * q + (Math.random() - 0.5) * (e.spell === 'eldritchBlast' ? 6 : 2)); }
          ctx.stroke(); ctx.restore();
          if (reach >= 1 && !e.miss) dot(bx, by, 7 * (1 - p) + 2, e.col, 0.7);
        } else if (e.spell === 'magicMissile') {
          for (let m = 0; m < 3; m++) { const off = (m - 1) * 26; const q = Math.min(1, p * 1.1 - m * 0.05); if (q < 0) continue; const x = ax + (bx - ax) * q, y = ay - 8 + (by - ay + 8) * q - Math.sin(q * Math.PI) * off; dot(x, y, 3.2, e.col); dot(x, y, 6, e.col, 0.3); }
        } else {
          const x = ax + (bx - ax) * p, y = ay - 8 + (by - ay + 8) * p - Math.sin(p * Math.PI) * (e.spell === 'fireball' ? 30 : 4);
          for (let tr = 1; tr <= 5; tr++) { const q = Math.max(0, p - tr * 0.04); dot(ax + (bx - ax) * q, ay - 8 + (by - ay + 8) * q - Math.sin(q * Math.PI) * (e.spell === 'fireball' ? 30 : 4), 4 - tr * 0.6, e.col, 0.5 - tr * 0.08); }
          dot(x, y, e.spell === 'fireball' ? 6 : 4.5, '#fff3c0'); dot(x, y, e.spell === 'fireball' ? 10 : 7, e.col, 0.6);
        }
        break;
      }
      case 'burst': {
        const cx = e.x * CELL + 20, cy = e.y * CELL + 20, R0 = (e.r + 0.5) * CELL;
        ctx.save();
        if (e.spell === 'fireball') {
          const r = R0 * Math.min(1, p * 2.5);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(255,245,200,${1 - p})`); g.addColorStop(0.4, `rgba(255,150,40,${0.85 * (1 - p)})`); g.addColorStop(1, `rgba(200,40,10,${0.5 * (1 - p)})`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
          for (let m = 0; m < 10; m++) { const a = m * 0.63; dot(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9 - p * 20, 5 * (1 - p), '#5a4a40', 0.5 * (1 - p)); }
        } else if (e.spell === 'callLightning') {
          ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#e8f6ff'; ctx.shadowColor = '#8fd0ff'; ctx.shadowBlur = 14; ctx.lineWidth = 3;
          ctx.beginPath(); let x = cx + 30, y = cy - 220; ctx.moveTo(x, y); while (y < cy) { y += 22; x += (Math.random() - 0.5) * 26; ctx.lineTo(y >= cy ? cx : x, Math.min(y, cy)); } ctx.stroke();
          ctx.fillStyle = `rgba(190,230,255,${0.4 * (1 - p)})`; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
        } else if (e.spell === 'shatter' || e.spell === 'thunderwave') {
          ctx.strokeStyle = e.col; ctx.globalAlpha = 1 - p; ctx.lineWidth = 4 * (1 - p) + 1;
          for (let m = 0; m < 3; m++) { const r = R0 * Math.min(1, p * 1.6 - m * 0.15); if (r > 0) { ctx.beginPath(); e.round ? ctx.arc(cx, cy, r, 0, 7) : ctx.rect(cx - r, cy - r, r * 2, r * 2); ctx.stroke(); } }
        } else if (e.spell === 'hypnoticPattern') {
          for (let m = 0; m < 14; m++) { const a = m * 0.9 + p * 5; const rr = R0 * (0.3 + 0.7 * ((m * 37) % 10) / 10); dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 4, `hsl(${(m * 40 + p * 360) % 360},90%,70%)`, 0.8 * (1 - p)); }
          ctx.globalAlpha = 0.25 * (1 - p); ctx.fillStyle = '#d38cff'; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
        } else if (e.spell === 'entangle') {
          ctx.strokeStyle = '#4f9a3a'; ctx.lineWidth = 2.5; ctx.globalAlpha = Math.min(1, (1 - p) * 2);
          for (let m = 0; m < 16; m++) { const x = cx - R0 + ((m * 53) % 100) / 100 * R0 * 2, y = cy - R0 + ((m * 31) % 100) / 100 * R0 * 2; ctx.beginPath(); ctx.moveTo(x, y + 10); ctx.quadraticCurveTo(x + 8, y, x + 2, y - 12 * Math.min(1, p * 3)); ctx.stroke(); }
        } else {
          ctx.globalAlpha = 0.45 * (1 - p); ctx.fillStyle = e.col; ctx.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
          for (let m = 0; m < 12; m++) dot(cx - R0 + ((m * 47) % 100) / 100 * R0 * 2, cy - R0 + ((m * 29) % 100) / 100 * R0 * 2 - p * 14, 2.2, '#fff', 1 - p);
        }
        ctx.restore(); break;
      }
      case 'onTarget': {
        const [x, y] = anchor(e.at, now);
        ctx.save(); ctx.globalAlpha = 1 - p;
        if (e.spell === 'sacredFlame' || e.spell === 'moonbeam') {
          const g = ctx.createLinearGradient(0, y - 120, 0, y + 16); g.addColorStop(0, 'rgba(255,250,210,0)'); g.addColorStop(1, e.col);
          ctx.fillStyle = g; ctx.fillRect(x - 10, y - 120, 20, 136);
        } else if (e.spell === 'holdPerson') {
          ctx.strokeStyle = e.col; ctx.lineWidth = 2; ctx.setLineDash([3, 2]);
          for (let m = 0; m < 3; m++) { ctx.beginPath(); ctx.ellipse(x, y + 10 - m * 10, 13 - p * 2, 4, 0, 0, 7); ctx.stroke(); }
        } else if (e.spell === 'viciousMockery' || e.spell === 'dissonantWhispers') {
          ctx.font = 'bold 13px system-ui'; ctx.fillStyle = e.col; ctx.textAlign = 'center'; ctx.fillText(e.spell === 'viciousMockery' ? '#@!%' : '~ ~ ~', x, y - 30 - p * 10);
          ctx.strokeStyle = e.col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - 6, 8 + p * 14, 0, 7); ctx.stroke();
        } else {
          for (let m = 0; m < 8; m++) { const a = m * 0.8 + p * 3; dot(x + Math.cos(a) * 12, y - 6 + Math.sin(a) * 12 - p * 10, 2.2, e.col); }
        }
        ctx.restore(); break;
      }
      case 'ring': { const [x, y] = anchor(e.at, now); ctx.save(); ctx.globalAlpha = 1 - p; ctx.strokeStyle = e.col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y + 4, 8 + p * 16, 4 + p * 8, 0, 0, 7); ctx.stroke(); ctx.restore(); break; }
      case 'sparkle': { const [x, y] = anchor(e.at, now); for (let m = 0; m < 8; m++) { const xx = x + ((m * 37) % 22) - 11, yy = y + 10 - p * 34 - (m % 3) * 6; ctx.save(); ctx.globalAlpha = 1 - p; ctx.fillStyle = e.col; ctx.fillRect(xx - 0.8, yy - 3, 1.6, 6); ctx.fillRect(xx - 3, yy - 0.8, 6, 1.6); ctx.restore(); } break; }
      case 'puff': { const x = e.x * CELL + 20, y = e.y * CELL + 20; for (let m = 0; m < 8; m++) { const a = m * 0.785; dot(x + Math.cos(a) * p * 18, y + Math.sin(a) * p * 12, 5 * (1 - p), '#c8b6ff', 0.7); } break; }
      case 'spirit': {
        const [x, y] = anchor(e.at, now);
        const sx = x + 16, sy = y - 22;
        spectralMace(sx, sy, -1.2 + p * 2.2, e.team); break;
      }
    }
  }

  // ------------------------------------------------ loop
  function loop(ts) {
    const dt = last ? Math.min(100, ts - last) : 16; last = ts;
    if (R) {
      if (playing) {
        clock += dt * speed();
        for (const it of sched) if (!it.done && clock >= it.at) { it.done = true; apply(it); }
        if (clock >= schedEnd) {
          if (k < R.frames.length - 1 && !single) { startFrame(nextFrame(k)); }
          else { // end of a single step, or end of the fight
            syncFrame(k); playing = false; single = false; el.play.textContent = '▶︎';
          }
        }
      }
      draw(clock, dt);
    }
    raf = requestAnimationFrame(loop);
  }
  function nextFrame(i) { let n = i + 1; while (n < R.frames.length - 1 && !(R.frames[n].fx || []).length && !R.frames[n].text.length) n++; return n; }

  function logTo(n) {
    const box = el.log; box.innerHTML = '';
    for (let j = Math.max(0, n - 40); j <= n; j++) for (const line of R.frames[j].text) { const d = document.createElement('div'); d.className = j === n ? 'cur' : 'old'; d.textContent = line; box.append(d); }
    box.scrollTop = box.scrollHeight;
  }

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || 360;
    cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr * (VH / WW));
  }
  window.addEventListener('resize', resize);

  el.play.addEventListener('click', () => {
    if (!R) return;
    if (playing) { playing = false; el.play.textContent = '▶︎'; return; }
    if (k >= R.frames.length - 1 && clock >= schedEnd) { units = {}; startFrame(1); }
    playing = true; single = false; el.play.textContent = '❚❚';
  });
  el.step.addEventListener('click', () => {
    if (!R) return;
    if (playing && single) return;
    const n = clock >= schedEnd ? nextFrame(k) : k;
    if (n !== k || clock >= schedEnd) startFrame(Math.min(n, R.frames.length - 1));
    playing = true; single = true; el.play.textContent = '❚❚';
  });
  el.scrub.addEventListener('input', () => {
    const n = +el.scrub.value; playing = false; el.play.textContent = '▶︎';
    k = n; syncFrame(n); for (const u of Object.values(units)) u.lying = u.lyingTarget;
    sched = []; schedEnd = 0; clock = 0; fx = []; logTo(n);
    el.round.textContent = R.frames[n].round ? `Round ${R.frames[n].round}` : 'Start';
  });
  if (el.zoom) {
    const label = () => (el.zoom.textContent = zoomOn ? '⤢ Whole map' : '⤡ Fit fighters');
    label();
    el.zoom.addEventListener('click', () => { zoomOn = !zoomOn; label(); });
  }

  return {
    load(r) {
      R = r; R.byId = Object.fromEntries(r.units.map((u) => [u.id, u]));
      units = {}; fx = [];
      resize(); terrainCanvas(r.map);
      el.scrub.max = r.frames.length - 1;
      syncFrame(0); for (const u of Object.values(units)) u.lying = u.lyingTarget;
      cam = { x: WW / 2, y: (WH + BOT - TOP) / 2, z: 1 };
      startFrame(Math.min(1, r.frames.length - 1));
      playing = true; single = false; el.play.textContent = '❚❚';
      if (!raf) raf = requestAnimationFrame(loop);
    },
  };
}

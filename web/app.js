import { Battle, CLASSES, CLASS_IDS, buildSheet, SPELLS, MAP_IDS, MAP_INFO, getMap, PRESETS, PRESET_IDS, TRAITS, TARGET_MODES } from '../engine/index.js';

// ------------------------------------------------------------ tiny DOM helpers
const $ = (s) => document.querySelector(s);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const pct = (v) => (v * 100).toFixed(0) + '%';
const ABBR = { barbarian: 'Bb', bard: 'Bd', cleric: 'Cl', druid: 'Dr', fighter: 'Fi', monk: 'Mo', paladin: 'Pa', ranger: 'Ra', rogue: 'Ro', sorcerer: 'So', warlock: 'Wl', wizard: 'Wz' };
const TEAM_COL = ['#5b8def', '#e0574f'];
const clsName = (c) => CLASSES[c].name;

// ------------------------------------------------------------ worker pool (one worker, queued jobs)
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let jobId = 0; const jobs = new Map();
worker.onmessage = (ev) => {
  const j = jobs.get(ev.data.id); if (!j) return;
  if ('progress' in ev.data) return j.onProgress && j.onProgress(ev.data.progress);
  jobs.delete(ev.data.id);
  ev.data.error ? j.reject(new Error(ev.data.error)) : j.resolve(ev.data.result);
};
function runJob(type, args, onProgress) {
  return new Promise((resolve, reject) => { const id = ++jobId; jobs.set(id, { resolve, reject, onProgress }); worker.postMessage({ id, type, args }); });
}

// ------------------------------------------------------------ personalities (presets + custom, saved in this browser)
const LS = 'partybots.personalities';
let customs = [];
try { customs = JSON.parse(localStorage.getItem(LS) || '[]'); } catch { customs = []; }
const saveCustoms = () => { try { localStorage.setItem(LS, JSON.stringify(customs)); } catch {} };
const allPers = () => [...PRESET_IDS.map((id) => ({ id, ...PRESETS[id] })), ...customs];
const persById = (id) => allPers().find((p) => p.id === id) || { id: 'balanced', ...PRESETS.balanced };
const persSpec = (id) => (PRESETS[id] ? id : { ...persById(id) }); // what the engine gets
function fillPersSelect(sel, value) {
  sel.innerHTML = '';
  for (const p of allPers()) sel.append(el('option', { value: p.id }, p.name + (PRESETS[p.id] ? '' : ' ★')));
  sel.value = value && persById(value).id === value ? value : 'balanced';
}
const specTeam = (team) => team.map((m) => ({ cls: m.cls, personality: persSpec(m.personality) }));

// ------------------------------------------------------------ tabs
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('main > section').forEach((s) => (s.hidden = s.id !== b.dataset.tab));
  if (b.dataset.tab === 'rules') renderRules();
}));

function fillMapSelect(sel, withAll) {
  sel.innerHTML = '';
  if (withAll) sel.append(el('option', { value: 'all' }, 'All maps'));
  for (const id of MAP_IDS) sel.append(el('option', { value: id }, MAP_INFO[id].name));
}

// ------------------------------------------------------------ battle tab
const COMP_PRESETS = [
  { name: 'Classic', members: ['fighter', 'cleric', 'rogue', 'wizard'] },
  { name: 'Holy order', members: ['paladin', 'cleric', 'bard', 'druid'] },
  { name: 'Artillery', members: ['wizard', 'sorcerer', 'warlock', 'ranger'] },
  { name: 'Brutes', members: ['barbarian', 'fighter', 'paladin', 'monk'] },
  { name: 'Skirmishers', members: ['monk', 'rogue', 'ranger', 'bard'] },
  { name: 'Tank & cannon', members: ['paladin', 'barbarian', 'cleric', 'wizard'] },
  { name: 'Nature', members: ['druid', 'ranger', 'barbarian', 'monk'] },
  { name: 'Pact & steel', members: ['warlock', 'paladin', 'fighter', 'bard'] },
];
const state = {
  A: COMP_PRESETS[0].members.map((cls) => ({ cls, personality: 'balanced' })),
  B: COMP_PRESETS[2].members.map((cls) => ({ cls, personality: 'balanced' })),
};

function renderTeam(side) {
  const box = $('#team' + side); box.innerHTML = '';
  state[side].forEach((m, i) => {
    const cs = el('select', { onchange: (e) => { m.cls = e.target.value; } });
    for (const c of CLASS_IDS) cs.append(el('option', { value: c }, clsName(c)));
    cs.value = m.cls;
    const ps = el('select', { class: 'persSel', onchange: (e) => { m.personality = e.target.value; } });
    fillPersSelect(ps, m.personality);
    const rm = el('button', { title: 'Remove', onclick: () => { if (state[side].length > 1) { state[side].splice(i, 1); renderTeam(side); } } }, '✕');
    box.append(el('div', { class: 'member' }, cs, ps, rm));
  });
}
for (const side of ['A', 'B']) {
  $(`[data-add=${side}]`).addEventListener('click', () => { if (state[side].length < 6) { state[side].push({ cls: 'fighter', personality: 'balanced' }); renderTeam(side); } });
  const q = $(`[data-quick=${side}]`);
  q.append(el('option', { value: '' }, 'Quick fill…'));
  for (const c of COMP_PRESETS) q.append(el('option', { value: 'p:' + c.name }, `${c.name}: ${c.members.map(clsName).join(', ')}`));
  for (const c of CLASS_IDS) q.append(el('option', { value: 'm:' + c }, `4 × ${clsName(c)}`));
  q.addEventListener('change', () => {
    const v = q.value; if (!v) return;
    const pers = state[side][0] ? state[side][0].personality : 'balanced';
    const list = v.startsWith('p:') ? COMP_PRESETS.find((c) => c.name === v.slice(2)).members : Array(4).fill(v.slice(2));
    state[side] = list.map((cls) => ({ cls, personality: pers }));
    q.value = ''; renderTeam(side);
  });
}
fillMapSelect($('#mapSel'));
const showBlurb = () => ($('#mapBlurb').textContent = MAP_INFO[$('#mapSel').value].blurb);
$('#mapSel').addEventListener('change', showBlurb);

$('#fightBtn').addEventListener('click', () => {
  const seed = +$('#seed').value || 1;
  const r = new Battle({ teams: [specTeam(state.A), specTeam(state.B)], map: $('#mapSel').value, seed, record: true }).run();
  replay.load(r);
  $('#seed').value = seed + 1;
});

$('#sim200').addEventListener('click', async () => {
  const card = $('#simCard'); card.hidden = false;
  card.innerHTML = '';
  const prog = el('i'); card.append(el('div', {}, 'Simulating 200 fights…'), el('div', { class: 'progress' }, prog));
  const btn = $('#sim200'); btn.disabled = true;
  try {
    const r = await runJob('matchup', { a: specTeam(state.A), b: specTeam(state.B), map: $('#mapSel').value, n: 200, seed: 1 }, (p) => (prog.style.width = pct(p)));
    renderMatchup(card, r);
  } catch (e) { card.append(el('pre', {}, e.message)); }
  btn.disabled = false;
});

function winBar(a, d, b) {
  return el('div', { class: 'winbar' },
    el('div', { style: `width:${a * 100}%;background:${TEAM_COL[0]}` }, a > 0.08 ? 'Blue ' + pct(a) : ''),
    el('div', { style: `width:${d * 100}%;background:#555` }, d > 0.08 ? 'draw' : ''),
    el('div', { style: `width:${b * 100}%;background:${TEAM_COL[1]}` }, b > 0.08 ? 'Red ' + pct(b) : ''));
}

function renderMatchup(card, r) {
  card.innerHTML = '';
  card.append(el('h3', {}, `${r.n} fights on ${MAP_INFO[$('#mapSel').value].name}`), winBar(r.winsA / r.n, r.draws / r.n, r.winsB / r.n));
  card.append(el('div', { class: 'row muted' }, `Average length ${r.rounds.toFixed(1)} rounds · Blue survivors ${(r.survA / r.n).toFixed(2)} · Red survivors ${(r.survB / r.n).toFixed(2)}`));
  const rows = Object.values(r.byUnit).sort((p, q) => (p.side > q.side ? 1 : -1));
  const t = el('table', {}, el('tr', {}, ...['Unit', 'Mind', 'Dmg/fight', 'Taken', 'Healed', 'Kills+downs', 'Dropped', 'Survived', 'Hit %'].map((h) => el('th', {}, h))));
  for (const u of rows) t.append(el('tr', {},
    el('td', { class: u.side === 'A' ? 'b' : 'r' }, clsName(u.cls)), el('td', {}, persById(u.personality).name || u.personality),
    el('td', {}, (u.dmg / u.count).toFixed(1)), el('td', {}, (u.taken / u.count).toFixed(1)), el('td', {}, (u.heal / u.count).toFixed(1)),
    el('td', {}, ((u.downs) / u.count).toFixed(2)), el('td', {}, (u.downed / u.count).toFixed(2)), el('td', {}, pct(u.survived / u.count)),
    el('td', {}, u.attacks ? pct(u.hits / u.attacks) : '—')));
  card.append(el('div', { class: 'table-wrap' }, t), el('div', { class: 'muted' }, 'Per unit of that class+mind, averaged over every fight. Kills+downs counts every time it dropped a foe to 0 HP.'));
}

// ------------------------------------------------------------ replay
const replay = (() => {
  const cv = $('#board'), ctx = cv.getContext('2d');
  const CELL = 40;
  let R = null, i = 0, playing = false, timer = null, anim = null;
  const scrub = $('#pScrub');

  function terrain(map) {
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const ch = map.cells[y][x];
      const px = x * CELL, py = y * CELL;
      ctx.fillStyle = (x + y) % 2 ? '#211d27' : '#1e1a24'; ctx.fillRect(px, py, CELL, CELL);
      if (ch === '#') { ctx.fillStyle = '#4a4352'; ctx.fillRect(px, py, CELL, CELL); ctx.strokeStyle = '#5d5566'; ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4); }
      if (ch === 'T') { ctx.fillStyle = '#2f5a35'; ctx.beginPath(); ctx.arc(px + 20, py + 20, 15, 0, 7); ctx.fill(); ctx.fillStyle = '#3d7445'; ctx.beginPath(); ctx.arc(px + 16, py + 16, 7, 0, 7); ctx.fill(); }
      if (ch === '+') { ctx.fillStyle = '#5e4a35'; ctx.fillRect(px + 4, py + 14, CELL - 8, 12); }
      if (ch === '"') { ctx.fillStyle = '#34452f'; for (let k = 0; k < 5; k++) ctx.fillRect(px + 5 + k * 7, py + 10 + (k % 2) * 12, 3, 9); }
    }
  }
  function unitPos(f, id) { return f.units.find((u) => u.id === id); }
  function draw(t = 1) {
    if (!R) return;
    const f = R.frames[i], prev = R.frames[Math.max(0, i - 1)];
    const map = getMap(R.map);
    ctx.clearRect(0, 0, cv.width, cv.height);
    terrain(map);
    for (const z of f.auras) { ctx.fillStyle = 'rgba(217,164,65,.10)'; ctx.fillRect((z.x - z.r) * CELL, (z.y - z.r) * CELL, (2 * z.r + 1) * CELL, (2 * z.r + 1) * CELL); }
    for (const z of f.zones) { ctx.fillStyle = 'rgba(235,235,190,.18)'; ctx.fillRect((z.x - z.r) * CELL, (z.y - z.r) * CELL, (2 * z.r + 1) * CELL, (2 * z.r + 1) * CELL); }
    for (const s of f.sw) { ctx.fillStyle = TEAM_COL[s.team]; ctx.save(); ctx.translate(s.x * CELL + 20, s.y * CELL + 20); ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -6, 12, 12); ctx.restore(); }
    // units, interpolated from previous frame
    for (const u of f.units) {
      const p = unitPos(prev, u.id) || u;
      const x = (p.x + (u.x - p.x) * t) * CELL + 20, y = (p.y + (u.y - p.y) * t) * CELL + 20;
      const c = R.byId[u.id];
      const col = TEAM_COL[c.team];
      ctx.globalAlpha = u.dead ? 0.35 : u.hp === 0 ? 0.55 : 1;
      if (f.actor === u.id) { ctx.strokeStyle = '#d9a441'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 19, 0, 7); ctx.stroke(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill();
      if (u.raging) { ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 2; ctx.stroke(); }
      if (u.conc) { ctx.setLineDash([3, 3]); ctx.strokeStyle = '#f2d27a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 17.5, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.dead ? '✕' : ABBR[c.cls], x, y + 1);
      // hp bar
      const fr = Math.max(0, u.hp / c.maxHp);
      ctx.fillStyle = '#000a'; ctx.fillRect(x - 16, y + 17, 32, 4);
      ctx.fillStyle = fr > 0.5 ? '#6fbf73' : fr > 0.25 ? '#d9a441' : '#e0574f'; ctx.fillRect(x - 16, y + 17, 32 * fr, 4);
      const tags = u.cond.filter((k) => ['stunned', 'paralyzed', 'hypnotized', 'restrained', 'prone', 'hasted', 'blessed', 'faerie', 'hidden'].includes(k));
      if (tags.length) { ctx.font = '10px system-ui'; ctx.fillStyle = '#f2d27a'; ctx.fillText(tags.map((k) => COND_GLYPH[k]).join(''), x, y - 22); }
      ctx.globalAlpha = 1;
    }
    // effects of this frame
    if (t >= 0.6) for (const e of f.fx || []) {
      const a = e.a != null ? unitPos(f, e.a) : null, b = e.t != null ? unitPos(f, e.t) : null;
      if (e.k === 'area') {
        const col = e.spell === 'fireball' ? 'rgba(255,120,40,.35)' : e.spell === 'hypnoticPattern' ? 'rgba(200,120,255,.3)' : e.spell === 'callLightning' ? 'rgba(140,200,255,.35)' : 'rgba(255,255,255,.18)';
        ctx.fillStyle = col;
        if (e.round) { ctx.beginPath(); ctx.arc(e.x * CELL + 20, e.y * CELL + 20, (e.r + 0.5) * CELL, 0, 7); ctx.fill(); }
        else ctx.fillRect((e.x - e.r) * CELL, (e.y - e.r) * CELL, (2 * e.r + 1) * CELL, (2 * e.r + 1) * CELL);
      } else if (a && b) {
        ctx.strokeStyle = e.k === 'heal' ? '#6fbf73' : e.hit ? (e.k === 'bolt' ? '#ffb347' : '#fff') : '#fff6';
        ctx.lineWidth = e.k === 'swing' ? 3 : 1.5; ctx.setLineDash(e.hit || e.k === 'heal' ? [] : [4, 4]);
        ctx.beginPath(); ctx.moveTo(a.x * CELL + 20, a.y * CELL + 20); ctx.lineTo(b.x * CELL + 20, b.y * CELL + 20); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    $('#pRound').textContent = f.round ? `Round ${f.round}` : 'Start';
  }
  const COND_GLYPH = { stunned: '★', paralyzed: '❄', hypnotized: '◎', restrained: '⌇', prone: '↓', hasted: '»', blessed: '✚', faerie: '✧', hidden: '◌' };
  $('#boardLegend').innerHTML = Object.entries(COND_GLYPH).map(([k, g]) => `<span style="--c:transparent">${g} ${k}</span>`).join('') + '<span style="--c:#f2d27a">concentrating (dashed ring)</span>';

  function logTo(n) {
    const box = $('#log'); box.innerHTML = '';
    for (let k = Math.max(0, n - 40); k <= n; k++) for (const line of R.frames[k].text) box.append(el('div', { class: k === n ? 'cur' : 'old' }, line));
    box.scrollTop = box.scrollHeight;
  }
  function go(n, animate) {
    i = Math.max(0, Math.min(R.frames.length - 1, n)); scrub.value = i; logTo(i);
    cancelAnimationFrame(anim);
    if (!animate) return draw(1);
    const t0 = performance.now(), dur = Math.min(450, +$('#pSpeed').value * 0.6);
    const step = (now) => { const t = Math.min(1, (now - t0) / dur); draw(t); if (t < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  }
  function tick() {
    if (!playing) return;
    if (i >= R.frames.length - 1) { stop(); return; }
    // skip frames where nothing happened
    let n = i + 1; while (n < R.frames.length - 1 && !R.frames[n].text.length) n++;
    go(n, true);
    timer = setTimeout(tick, +$('#pSpeed').value);
  }
  function stop() { playing = false; clearTimeout(timer); $('#pPlay').textContent = '▶︎'; }
  $('#pPlay').addEventListener('click', () => { if (playing) return stop(); if (i >= R.frames.length - 1) go(0); playing = true; $('#pPlay').textContent = '❚❚'; tick(); });
  $('#pStep').addEventListener('click', () => { stop(); go(i + 1, true); });
  scrub.addEventListener('input', () => { stop(); go(+scrub.value); });
  return {
    load(r) {
      stop(); R = r; R.byId = Object.fromEntries(r.units.map((u) => [u.id, u]));
      $('#replayCard').hidden = false; scrub.max = r.frames.length - 1; go(0);
      fightStats(r);
      playing = true; $('#pPlay').textContent = '❚❚'; tick();
      $('#replayCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };
})();

function fightStats(r) {
  const box = $('#fightStats'); box.innerHTML = '';
  const res = r.winner === -1 ? 'Draw' : r.winner === 0 ? 'Blue wins' : 'Red wins';
  box.append(el('h3', {}, `${res} in ${r.rounds} round${r.rounds > 1 ? 's' : ''}`));
  const t = el('table', {}, el('tr', {}, ...['Unit', 'Mind', 'HP', 'Dmg', 'Taken', 'Healed', 'Drops', 'Hit %'].map((h) => el('th', {}, h))));
  for (const u of r.units) t.append(el('tr', {},
    el('td', { class: u.team === 0 ? 'b' : 'r' }, u.name), el('td', {}, persById(u.personality).name || u.personality),
    el('td', {}, u.dead ? 'dead' : `${u.hp}/${u.maxHp}`), el('td', {}, u.dmg), el('td', {}, u.taken), el('td', {}, u.heal), el('td', {}, u.downs),
    el('td', {}, u.attacks ? pct(u.hits / u.attacks) : '—')));
  box.append(el('div', { class: 'table-wrap' }, t));
}

$('#toTourney').addEventListener('click', () => {
  for (const [side, nm] of [['A', 'Blue'], ['B', 'Red']]) {
    const members = state[side].map((m) => ({ ...m }));
    comps.push({ name: `${nm}: ${members.map((m) => ABBR[m.cls]).join(' ')}`, members, on: true, custom: true });
  }
  renderComps();
  document.querySelector('[data-tab=comps]').click();
});

// ------------------------------------------------------------ class matrix
fillMapSelect($('#mxMap'), true);
function heatColor(v) {
  // diverging: red (0) -> neutral (0.5) -> blue (1)
  const d = (v - 0.5) * 2;
  const a = Math.min(1, Math.abs(d)) * 0.85;
  return d >= 0 ? `rgba(91,141,239,${a})` : `rgba(224,87,79,${a})`;
}
$('#mxRun').addEventListener('click', async () => {
  const btn = $('#mxRun'); btn.disabled = true; $('#mxOut').innerHTML = '';
  const args = { classes: CLASS_IDS, map: $('#mxMap').value, n: +$('#mxN').value, size: +$('#mxSize').value, personality: persSpec($('#mxPers').value), seed: 1 };
  try {
    const res = await runJob('matrix', args, (p) => ($('#mxProg').style.width = pct(p)));
    renderMatrix(res, args);
  } catch (e) { $('#mxOut').append(el('pre', {}, e.message)); }
  btn.disabled = false;
});
function renderMatrix(list, args) {
  const out = $('#mxOut');
  // ranking across maps
  const avg = CLASS_IDS.map((c, i) => ({ c, i, per: list.map((r) => r.avg[i]), all: list.reduce((s, r) => s + r.avg[i], 0) / list.length })).sort((p, q) => q.all - p.all);
  const t = el('table', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Class'), ...(list.length > 1 ? list.map((r) => el('th', {}, MAP_INFO[r.map].name)) : []), el('th', {}, 'Win rate'), el('th', { style: 'width:30%' }, '')));
  avg.forEach((r, k) => t.append(el('tr', {}, el('td', {}, k + 1), el('td', {}, clsName(r.c)),
    ...(list.length > 1 ? r.per.map((v) => el('td', { style: `background:${heatColor(v)}` }, pct(v))) : []),
    el('td', {}, pct(r.all)), el('td', {}, el('div', { class: 'bar' }, el('i', { style: `width:${r.all * 100}%` }))))));
  out.append(el('div', { class: 'card' }, el('h3', {}, `Ranking — ${args.size}v${args.size} mono-class, ${persById(typeof args.personality === 'string' ? args.personality : args.personality.id).name} minds`), el('div', { class: 'table-wrap' }, t),
    el('div', { class: 'muted' }, `Average win rate against the other 11 classes. ${args.n} fights per pairing per map.`)));
  for (const r of list) {
    const h = el('table', { class: 'heat' }, el('tr', {}, el('th', {}, ''), ...CLASS_IDS.map((c) => el('th', { title: clsName(c) }, ABBR[c]))));
    r.M.forEach((row, i) => h.append(el('tr', {}, el('th', { class: 'rowh' }, clsName(CLASS_IDS[i])),
      ...row.map((v, j) => el('td', { style: i === j ? 'background:#2a2630' : `background:${heatColor(v)}`, title: `${clsName(CLASS_IDS[i])} vs ${clsName(CLASS_IDS[j])}: ${pct(v)}, ~${r.rounds[i][j].toFixed(1)} rounds` }, i === j ? '' : Math.round(v * 100))))));
    const det = el('details', { open: list.length === 1 ? '' : false }, el('summary', {}, `${MAP_INFO[r.map].name} — head to head`), el('div', { class: 'table-wrap' }, h),
      el('div', { class: 'muted' }, 'Row class win % vs column class. Blue = row wins, red = row loses. Tap a cell for rounds.'));
    out.append(el('div', { class: 'card' }, det));
  }
}

// ------------------------------------------------------------ comps tournament
let comps = [
  ...COMP_PRESETS.map((c) => ({ name: c.name, members: c.members.map((cls) => ({ cls, personality: 'balanced' })), on: true })),
  ...CLASS_IDS.map((c) => ({ name: `4 × ${clsName(c)}`, members: Array(4).fill(0).map(() => ({ cls: c, personality: 'balanced' })), on: true, mono: true })),
];
function renderComps() {
  const p = $('#compPresets'); p.innerHTML = '';
  p.append(el('button', { onclick: () => { comps.forEach((c) => (c.on = true)); renderComps(); } }, 'All'),
    el('button', { onclick: () => { comps.forEach((c) => (c.on = !c.mono)); renderComps(); } }, 'Mixed only'),
    el('button', { onclick: () => { comps.forEach((c) => (c.on = !!c.mono)); renderComps(); } }, 'Mono only'),
    el('button', { onclick: () => { for (let k = 0; k < 4; k++) { const pick = CLASS_IDS.slice().sort(() => Math.random() - 0.5).slice(0, 4); comps.push({ name: 'Random ' + pick.map((c) => ABBR[c]).join(' '), members: pick.map((cls) => ({ cls, personality: 'balanced' })), on: true, custom: true }); } renderComps(); } }, '+ 4 random mixes'));
  const box = $('#compList'); box.innerHTML = '';
  const wrap = el('div', { class: 'grid2' });
  comps.forEach((c, i) => {
    const cb = el('input', { type: 'checkbox', onchange: (e) => (c.on = e.target.checked) }); cb.checked = c.on;
    wrap.append(el('label', { class: 'row', style: 'margin:2px 0' }, cb, el('span', {}, c.name), ...c.members.map((m) => el('span', { class: 'pill' }, ABBR[m.cls] + (m.personality !== 'balanced' ? '·' + (persById(m.personality).name || '').slice(0, 3) : ''))),
      c.custom ? el('button', { style: 'padding:2px 7px', onclick: () => { comps.splice(i, 1); renderComps(); } }, '✕') : null));
  });
  box.append(wrap, el('div', { class: 'muted' }, `${comps.filter((c) => c.on).length} parties selected. Cost grows with the square — 20 parties × 6 maps × 12 fights is ~13,000 fights.`));
}
renderComps();
$('#tRun').addEventListener('click', async () => {
  const sel = comps.filter((c) => c.on);
  if (sel.length < 2) return;
  const btn = $('#tRun'); btn.disabled = true; $('#tOut').innerHTML = '';
  try {
    const res = await runJob('tournament', { comps: sel.map((c) => ({ name: c.name, mono: !!c.mono || new Set(c.members.map((m) => m.cls)).size === 1, members: specTeam(c.members) })), maps: $('#tMaps').value, n: +$('#tN').value, seed: 1 }, (p) => ($('#tProg').style.width = pct(p)));
    renderTourney($('#tOut'), res, 'Party');
  } catch (e) { $('#tOut').append(el('pre', {}, e.message)); }
  btn.disabled = false;
});
function renderTourney(out, res, label) {
  const t = el('table', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, label), el('th', {}, 'Members'), el('th', {}, 'Win rate'), el('th', { style: 'width:28%' }, '')));
  res.rank.forEach((r, k) => t.append(el('tr', {}, el('td', {}, k + 1), el('td', {}, r.name),
    el('td', { style: 'text-align:left' }, r.members.map((m) => ABBR[m.cls]).join(' ')), el('td', {}, pct(r.winRate)),
    el('td', {}, el('div', { class: 'bar' }, el('i', { style: `width:${r.winRate * 100}%` }))))));
  const mono = res.rank.filter((r) => r.mono), mixed = res.rank.filter((r) => !r.mono);
  const avg = (l) => (l.length ? l.reduce((s, r) => s + r.winRate, 0) / l.length : NaN);
  const summary = mono.length && mixed.length
    ? el('div', { class: 'row' }, el('span', { class: 'big' }, pct(avg(mixed))), el('span', { class: 'muted' }, 'average for mixed parties vs'), el('span', { class: 'big' }, pct(avg(mono))), el('span', { class: 'muted' }, 'for single-class parties'))
    : null;
  out.append(el('div', { class: 'card' }, el('h3', {}, `Standings — ${res.maps.length > 1 ? 'all maps' : MAP_INFO[res.maps[0]].name}, ${res.n} fights per pairing per map`), summary, el('div', { class: 'table-wrap' }, t)));
}

// ------------------------------------------------------------ personality duel + editor
const pdComp = $('#pdComp');
for (const c of COMP_PRESETS) pdComp.append(el('option', { value: c.name }, `${c.name}: ${c.members.map(clsName).join(', ')}`));
for (const c of CLASS_IDS) pdComp.append(el('option', { value: 'm:' + c }, `4 × ${clsName(c)}`));
fillMapSelect($('#pdMap'), true);
$('#pdRun').addEventListener('click', async () => {
  const v = pdComp.value;
  const classes = v.startsWith('m:') ? Array(4).fill(v.slice(2)) : COMP_PRESETS.find((c) => c.name === v).members;
  const minds = allPers();
  const list = minds.map((p) => ({ name: p.name, mono: false, members: classes.map((cls) => ({ cls, personality: persSpec(p.id) })) }));
  const btn = $('#pdRun'); btn.disabled = true; $('#pdOut').innerHTML = '';
  try {
    const res = await runJob('tournament', { comps: list, maps: $('#pdMap').value, n: +$('#pdN').value, seed: 3 }, (p) => ($('#pdProg').style.width = pct(p)));
    renderTourney($('#pdOut'), res, 'Personality');
  } catch (e) { $('#pdOut').append(el('pre', {}, e.message)); }
  btn.disabled = false;
});

const ed = { base: 'balanced', vals: { ...PRESETS.balanced } };
function renderEditor() {
  const box = $('#edSliders'); box.innerHTML = '';
  for (const [k, help] of Object.entries(TRAITS)) {
    const out = el('span', {}, ed.vals[k].toFixed(2));
    const r = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: ed.vals[k], oninput: (e) => { ed.vals[k] = +e.target.value; out.textContent = ed.vals[k].toFixed(2); } });
    box.append(el('label', { title: help }, el('span', {}, k), r, out), el('div', { class: 'muted', style: 'margin:-4px 0 6px 118px' }, help));
  }
  const ts = $('#edTarget'); ts.innerHTML = '';
  for (const [k, v] of Object.entries(TARGET_MODES)) ts.append(el('option', { value: k }, `${k} — ${v}`));
  ts.value = ed.vals.target; ts.onchange = () => (ed.vals.target = ts.value);
  $('#edName').value = PRESETS[ed.base] ? '' : persById(ed.base).name;
}
$('#edBase').addEventListener('change', (e) => { ed.base = e.target.value; ed.vals = { ...persById(ed.base) }; renderEditor(); });
$('#edSave').addEventListener('click', () => {
  const name = $('#edName').value.trim(); if (!name) { $('#edName').focus(); return; }
  const id = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const p = { id, name, blurb: 'Custom', ...Object.fromEntries(Object.keys(TRAITS).map((k) => [k, ed.vals[k]])), target: ed.vals.target };
  customs = customs.filter((c) => c.id !== id).concat(p); saveCustoms();
  ed.base = id; refreshPersSelects();
});
$('#edDel').addEventListener('click', () => {
  if (PRESETS[ed.base]) return;
  customs = customs.filter((c) => c.id !== ed.base); saveCustoms(); ed.base = 'balanced'; ed.vals = { ...PRESETS.balanced }; refreshPersSelects(); renderEditor();
});
function refreshPersSelects() {
  document.querySelectorAll('select.persSel').forEach((s) => fillPersSelect(s, s.value));
  $('#edBase').value = ed.base;
  renderTeam('A'); renderTeam('B');
}

// ------------------------------------------------------------ rules
let rulesDone = false;
function renderRules() {
  if (rulesDone) return; rulesDone = true;
  const out = $('#rulesOut');
  out.append(el('div', { class: 'card' }, el('h3', {}, 'Ground rules'), el('ul', { html: `
    <li>All characters are level 5 humans: standard array +1 to every score, the level-4 ASI into the main stat, average hit points, one SRD subclass each. Proficiency +3.</li>
    <li>5-ft grid, 24×16 cells (120×80 ft). Diagonals cost 5 ft. Difficult terrain costs double. Ranges and areas use grid distance; Fireball and Shatter use a round burst.</li>
    <li>Initiative, attack rolls, advantage/disadvantage, crits (Champion on 19–20), saving throws, half/full cover (terrain <em>and</em> creatures in the way), opportunity attacks, prone, death saves, instant death from massive damage, concentration checks.</li>
    <li>A party loses when nobody on it is conscious. 20-round cap → draw.</li>
    <li>Reactions: opportunity attacks, Shield, Uncanny Dodge, Deflect Missiles, Cutting Words. Bonus actions: Rage, Frenzy, Flurry of Blows, Cunning Action (disengage/hide), Second Wind, Bardic Inspiration, Healing Word, Spiritual Weapon, Hunter's Mark, Hex, Misty Step, Quickened Spell.</li>
    <li>The bonus-action spell rule is enforced: a bonus-action spell means the action can only be a cantrip, and vice versa.</li>` })));
  out.append(el('div', { class: 'card' }, el('h3', {}, 'Simplifications'), el('ul', { html: `
    <li>One fight, full resources, no short rests. Wizards spend one 1st-level slot on Mage Armor before the fight; warlocks have Armor of Shadows.</li>
    <li>Cubes are approximated as squares on the grid (Faerie Fire, Entangle, Hypnotic Pattern 5×5; Thunderwave 3×3 next to the caster). Spiritual Weapon strikes anything within 25 ft of where it sits.</li>
    <li>Hiding succeeds automatically when no enemy has a clear, uncovered line of sight. No Stealth or Perception rolls.</li>
    <li>Cutting Words and Bardic Inspiration are used after the roll, when they would matter (a mild rules bend in the users' favour).</li>
    <li>Moonbeam damages creatures that start their turn in it or walk into it — moving the beam onto someone does not hurt them on its own (RAW).</li>
    <li>Druid Wild Shape and other out-of-combat features are not modelled.</li>` })));
  // class sheets
  const g = el('div', { class: 'grid2' });
  for (const id of CLASS_IDS) {
    const s = buildSheet(id);
    const w = s.weapons.map((x) => `${x.name} +${x.hit} (${x.dice[0]}d${x.dice[1]}${x.dmgBonus >= 0 ? '+' : ''}${x.dmgBonus}${x.gwf ? ', GWF' : ''})`).join(' · ');
    const spells = [...s.cantrips, ...s.spells].map((k) => SPELLS[k].name).join(', ');
    const slots = s.pact ? `${s.pact.slots} pact slots (3rd)` : s.slots.slice(1).map((n, k) => (n ? `${n}×L${k + 1}` : '')).filter(Boolean).join(' ');
    g.append(el('div', { class: 'card sheet' }, el('h4', {}, `${s.name} — ${s.sub}`),
      el('div', { class: 'muted' }, `AC ${s.ac} · HP ${s.maxHp} · Speed ${s.speed * 5} ft · Attacks ${s.attacks}${s.cantrips.length || s.spells.length ? ` · DC ${s.spellDC}, +${s.spellHit} to hit` : ''}`),
      el('div', {}, w),
      el('ul', {}, el('li', {}, [...s.feats].join(', ') || '—'), spells ? el('li', {}, spells + (slots ? ` (${slots})` : '')) : null)));
  }
  out.append(el('h3', {}, 'The twelve'), g);
  // maps
  const mg = el('div', { class: 'grid2' });
  const COL = { '.': '#25212b', '#': '#5a5262', T: '#2f5a35', '+': '#6b5236', '"': '#3a4a33' };
  for (const id of MAP_IDS) {
    const m = getMap(id);
    const th = el('div', { class: 'mapthumb' });
    for (const row of m.cells) for (const ch of row) th.append(el('i', { style: `background:${COL[ch]}` }));
    mg.append(el('div', { class: 'card' }, el('h4', {}, m.name), el('div', { class: 'muted' }, MAP_INFO[id].blurb), th));
  }
  out.append(el('h3', {}, 'Battlefields'), mg);
  const pt = el('table', {}, el('tr', {}, el('th', {}, 'Mind'), ...Object.keys(TRAITS).map((k) => el('th', {}, k.slice(0, 5))), el('th', {}, 'targets')));
  for (const p of allPers()) pt.append(el('tr', {}, el('td', { title: p.blurb }, p.name), ...Object.keys(TRAITS).map((k) => el('td', {}, (+p[k]).toFixed(2))), el('td', {}, p.target)));
  out.append(el('h3', {}, 'Personalities'), el('div', { class: 'card table-wrap' }, pt));
}

// ------------------------------------------------------------ boot
renderTeam('A'); renderTeam('B'); showBlurb();
document.querySelectorAll('select.persSel').forEach((s) => fillPersSelect(s, 'balanced'));
renderEditor();

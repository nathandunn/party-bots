// Combat engine: SRD 5.1 rules on a 5-ft grid. Mechanics only — decisions live in ai.js.
import { makeRng, avgDice } from './dice.js';
import { buildSheet } from './classes.js';
import { SPELLS } from './spells.js';
import { getMap, spawnCells, W, H } from './maps.js';
import { resolvePersonality } from './personalities.js';
import { takeTurn, hitHooks } from './ai.js';

export const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const idx = (x, y) => y * W + x;

// rough damage-per-round, used only to weigh who is worth killing / protecting
export const BASE_DPR = { barbarian: 19, bard: 9, cleric: 13, druid: 11, fighter: 20, monk: 18, paladin: 21, ranger: 19, rogue: 15, sorcerer: 15, warlock: 16, wizard: 15 };
const FRONT = new Set(['barbarian', 'fighter', 'paladin', 'monk', 'cleric']);

// terrain line-of-sight cache per map: lines between cell centres, endpoints excluded
const lineCache = new Map();
function lineBetween(map, a, b) {
  const key = map.id + ':' + (a * 4096 + b);
  let L = lineCache.get(key);
  if (L) return L;
  const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
  const cells = []; let blocked = false, cover = false;
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  for (let i = 1; i < n; i++) {
    const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n);
    const ci = idx(x, y);
    if (cells[cells.length - 1] === ci) continue;
    cells.push(ci);
    if (map.blocksSight(x, y)) blocked = true;
    if (map.cover(x, y)) cover = true;
  }
  L = { cells, blocked, cover };
  lineCache.set(key, L);
  return L;
}

export class Battle {
  constructor({ teams, map = 'open', seed = 1, record = false, maxRounds = 20 }) {
    this.rng = makeRng(seed);
    this.map = getMap(map);
    this.record = record;
    this.maxRounds = maxRounds;
    this.round = 0;
    this.cs = [];
    this.lines = [];
    this.frames = [];
    this.fx = [];
    this.focus = [null, null];
    teams.forEach((team, side) => {
      const roles = team.map((m) => (FRONT.has(m.cls) ? 'front' : 'back'));
      const cells = spawnCells(this.map, side, roles);
      team.forEach((m, i) => this.cs.push(this.makeCreature(m, side, i, cells[i])));
    });
  }

  makeCreature(spec, team, i, cell) {
    const s = buildSheet(spec.cls);
    const c = {
      id: this.cs.length, team, cls: spec.cls, s, p: resolvePersonality(spec.personality),
      name: spec.name || `${s.name}`, x: cell[0], y: cell[1],
      hp: s.maxHp, maxHp: s.maxHp, temp: 0, slots: [...s.slots], pact: s.pact ? { ...s.pact } : null,
      res: { ...s.res }, cond: {}, conc: null, dead: false, stable: false, ds: { s: 0, f: 0 },
      reaction: true, dpr: BASE_DPR[spec.cls] || 12, sw: null, raging: 0, turn: null,
      st: { dmg: 0, taken: 0, heal: 0, kills: 0, downs: 0, downed: 0, attacks: 0, hits: 0, spells: 0, revived: 0 },
    };
    // how far this creature can hurt you from: best cantrip / ranged weapon / damaging spell
    c.reachRange = Math.max(1, ...s.weapons.map((w) => (w.ranged ? w.range : 1)), ...s.cantrips.map((id) => SPELLS[id].range),
      ...s.spells.filter((id) => SPELLS[id].dice || SPELLS[id].cond).map((id) => SPELLS[id].range + (SPELLS[id].area ? SPELLS[id].area.r : 0)));
    c.name = spec.name || `${s.name}${'ABCDEF'[i] ? ' ' + 'ABCDEF'[i] : ''}`;
    return c;
  }

  // ---------- logging ----------
  log(msg) { if (this.record) this.lines.push(msg); }
  ev(o) { if (this.record) this.fx.push(o); }
  snapshot(actor) {
    if (!this.record) return;
    this.frames.push({
      round: this.round, actor: actor ? actor.id : null, text: this.lines.splice(0), fx: this.fx.splice(0),
      units: this.cs.map((c) => ({
        id: c.id, x: c.x, y: c.y, hp: c.hp, temp: c.temp, dead: c.dead,
        conc: c.conc ? SPELLS[c.conc.spell].name : null,
        cond: Object.keys(c.cond).filter((k) => c.cond[k]),
        raging: c.raging > 0,
      })),
      zones: this.cs.filter((c) => c.conc && c.conc.zone).map((c) => ({ ...c.conc.zone, team: c.team, spell: c.conc.spell })),
      auras: this.cs.filter((c) => c.conc && c.conc.spell === 'spiritGuardians' && this.up(c)).map((c) => ({ x: c.x, y: c.y, r: 3, team: c.team })),
      sw: this.cs.filter((c) => c.sw).map((c) => ({ x: c.sw.x, y: c.sw.y, team: c.team })),
    });
  }

  // ---------- state queries ----------
  up(c) { return !c.dead && c.hp > 0; }
  incapacitated(c) { const k = c.cond; return !this.up(c) || !!(k.stunned || k.paralyzed || k.hypnotized); }
  canAct(c) { return !this.incapacitated(c); }
  enemiesOf(c) { return this.cs.filter((o) => o.team !== c.team && this.up(o)); }
  alliesOf(c, incSelf = true) { return this.cs.filter((o) => o.team === c.team && this.up(o) && (incSelf || o !== c)); }
  downedAllies(c) { return this.cs.filter((o) => o.team === c.team && !o.dead && o.hp === 0); }
  at(x, y) { return this.cs.find((o) => !o.dead && o.x === x && o.y === y); }
  dist(a, b) { return cheb(a.x, a.y, b.x, b.y); }
  speedOf(c) { let s = c.s.speed; if (c.cond.hasted) s *= 2; return s; }
  acOf(c) { return c.s.ac + (c.cond.shielded ? 5 : 0) + (c.cond.hasted ? 2 : 0); }

  sight(ax, ay, bx, by) {
    const L = lineBetween(this.map, idx(ax, ay), idx(bx, by));
    if (L.blocked) return { los: false, cover: 0 };
    let cover = L.cover;
    if (!cover) for (const ci of L.cells) {
      const o = this.at(ci % W, (ci / W) | 0);
      if (o && this.up(o)) { cover = true; break; }
    }
    return { los: true, cover: cover ? 2 : 0 };
  }
  los(ax, ay, bx, by) { return !lineBetween(this.map, idx(ax, ay), idx(bx, by)).blocked; }

  // Dijkstra over the grid. enemies block, allies and bodies can be passed but not ended on.
  reach(c, budget, fromX = c.x, fromY = c.y) {
    const N = W * H;
    const dist = new Int16Array(N).fill(-1), prev = new Int16Array(N).fill(-1);
    const block = new Uint8Array(N), occ = new Uint8Array(N);
    for (const o of this.cs) {
      if (o === c || o.dead) continue;
      occ[idx(o.x, o.y)] = 1;
      if (o.team !== c.team && this.up(o)) block[idx(o.x, o.y)] = 1;
    }
    const start = idx(fromX, fromY);
    dist[start] = 0;
    const buckets = [[start]];
    for (let d = 0; d <= budget; d++) {
      const q = buckets[d]; if (!q) continue;
      for (let qi = 0; qi < q.length; qi++) {
        const cur = q[qi]; if (dist[cur] !== d) continue;
        const cx = cur % W, cy = (cur / W) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (this.map.blocksMove(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (block[ni]) continue;
          const nd = d + this.map.cost(nx, ny);
          if (nd > budget) continue;
          if (dist[ni] === -1 || nd < dist[ni]) { dist[ni] = nd; prev[ni] = cur; (buckets[nd] || (buckets[nd] = [])).push(ni); }
        }
      }
    }
    const cells = [];
    for (let i = 0; i < N; i++) if (dist[i] >= 0 && (!occ[i] || i === start)) cells.push(i);
    return { dist, prev, cells, start };
  }
  pathTo(R, cell) {
    const out = []; let cur = cell;
    while (cur !== R.start && cur !== -1) { out.push(cur); cur = R.prev[cur]; }
    return out.reverse();
  }

  // ---------- movement ----------
  // walk a path step by step: opportunity attacks, aura/zone triggers, stops if dropped
  walk(c, path, { disengage = false, forced = false } = {}) {
    let spent = 0;
    const trail = [[c.x, c.y]];
    for (const ci of path) {
      if (!this.up(c)) break;
      const nx = ci % W, ny = (ci / W) | 0;
      if (!forced) {
        const cost = this.map.cost(nx, ny);
        if (spent + cost > c.turn.move) break;
        spent += cost;
      }
      const ox = c.x, oy = c.y;
      if (!disengage && !c.turn.disengaged) {
        for (const e of this.enemiesOf(c)) {
          if (!e.reaction || this.incapacitated(e)) continue;
          if (cheb(e.x, e.y, ox, oy) <= 1 && cheb(e.x, e.y, nx, ny) > 1) this.opportunity(e, c);
          if (!this.up(c)) break;
        }
      }
      if (!this.up(c) || (!forced && !this.canAct(c))) break;
      c.x = nx; c.y = ny;
      trail.push([nx, ny]);
      this.ev({ k: 'step', id: c.id, x: nx, y: ny });
      this.zoneEnter(c);
    }
    // you may pass through an ally's space but never end there: back up to the last free square
    while (trail.length > 1 && this.cs.some((o) => o !== c && !o.dead && o.x === c.x && o.y === c.y)) {
      trail.pop();
      const [bx, by] = trail[trail.length - 1];
      c.x = bx; c.y = by;
      this.ev({ k: 'step', id: c.id, x: bx, y: by });
    }
    if (!forced) c.turn.move -= spent;
  }

  moveTo(c, cell, opts = {}) {
    if (cell == null || cell === idx(c.x, c.y)) return;
    const R = this.reach(c, c.turn.move);
    if (R.dist[cell] < 0) return;
    if (opts.disengage) c.turn.disengaged = true;
    const from = [c.x, c.y];
    this.walk(c, this.pathTo(R, cell), opts);
    if (from[0] !== c.x || from[1] !== c.y) this.log(`${c.name} moves (${from}) → (${c.x},${c.y})`);
  }

  teleport(c, x, y) { this.log(`${c.name} mists to (${x},${y})`); c.x = x; c.y = y; this.ev({ k: 'blink', id: c.id, x, y }); this.zoneEnter(c); }

  push(src, t, cells) {
    const dx = Math.sign(t.x - src.x), dy = Math.sign(t.y - src.y);
    for (let i = 0; i < cells; i++) {
      const nx = t.x + dx, ny = t.y + dy;
      if (this.map.blocksMove(nx, ny) || this.at(nx, ny)) break;
      t.x = nx; t.y = ny;
      this.ev({ k: 'step', id: t.id, x: nx, y: ny, shove: true });
    }
  }

  // ---------- dice-level mechanics ----------
  advOnAttack(a, t, { melee, ranged, reckless }) {
    let adv = 0, dis = 0;
    const d = this.dist(a, t);
    const k = t.cond;
    if (k.prone) { if (melee && d <= 1) adv++; else dis++; }
    if (k.stunned || k.paralyzed || k.restrained || t.hp === 0) adv++;
    if (k.faerie || k.guided || k.reckless) adv++;
    if (a.cond.hidden) adv++;
    if (reckless) adv++;
    if (a.cond.prone || a.cond.restrained || a.cond.mocked) dis++;
    if (k.dodging && this.canAct(t)) dis++;
    if (ranged && this.enemiesOf(a).some((e) => this.dist(a, e) <= 1 && this.canAct(e))) dis++;
    return adv && dis ? 0 : adv ? 1 : dis ? -1 : 0;
  }

  // returns {hit, crit, nat}
  attackRoll(a, t, { bonus, melee = false, ranged = false, critOn = 20, reckless = false, spell = false, weaponRanged = false }) {
    const adv = this.advOnAttack(a, t, { melee, ranged: ranged || (spell && !melee), reckless });
    let cover = 0;
    if (!melee) cover = this.sight(a.x, a.y, t.x, t.y).cover;
    const nat = this.rng.d20(adv);
    let total = nat + bonus;
    if (a.cond.blessed) total += this.rng.die(4);
    // one-shot conditions are spent by the roll
    if (t.cond.guided) delete t.cond.guided;
    if (a.cond.mocked) delete a.cond.mocked;
    if (a.cond.hidden) delete a.cond.hidden;
    a.st.attacks++;
    let ac = this.acOf(t) + cover;
    if (nat === 1) return { hit: false, crit: false, nat };
    let crit = nat >= critOn;
    let hit = crit || total >= ac;
    if (!hit && a.cond.inspired && total + 8 >= ac) {
      total += this.rng.die(8); delete a.cond.inspired;
      hit = total >= ac;
      if (hit) this.log(`  ${a.name} uses Bardic Inspiration`);
    }
    // defender reactions that change the hit
    if (hit && !crit && t.reaction && this.canAct(t) && this.hasShield(t) && total < ac + 5) {
      this.spendSlot(t, 1); t.reaction = false; t.cond.shielded = true; ac += 5;
      this.log(`  ${t.name} casts Shield`);
      hit = total >= ac;
    }
    if (hit && !crit) {
      const bard = this.cs.find((o) => o.team === t.team && o.cls === 'bard' && this.up(o) && o.reaction && this.canAct(o) && o.res.bi > 0 && this.dist(o, a) <= 12);
      if (bard && total - ac < 5) {
        bard.reaction = false; bard.res.bi--;
        total -= this.rng.die(8);
        hit = total >= ac;
        this.log(`  ${bard.name} uses Cutting Words${hit ? '' : ' — miss'}`);
      }
    }
    if (hit && melee && this.dist(a, t) <= 1 && (t.cond.paralyzed || t.hp === 0)) crit = true;
    if (hit) a.st.hits++;
    return { hit, crit, nat };
  }

  hasShield(c) { return c.s.spells.includes('shield') && this.slotAvail(c, 1) > 0; }

  saveBonus(t, abil) { return t.s.saves[abil]; }
  saveAdv(t, abil) {
    let adv = 0, dis = 0;
    if (abil === 'dex') {
      if (t.cond.dodging && this.canAct(t)) adv++;
      if (t.s.feats.has('dangerSense') && this.canAct(t)) adv++;
      if (t.cond.restrained) dis++;
    }
    if (abil === 'str' && t.raging > 0) adv++;
    return adv && dis ? 0 : adv ? 1 : dis ? -1 : 0;
  }
  autoFail(t, abil) { return (abil === 'str' || abil === 'dex') && (t.hp === 0 || t.cond.stunned || t.cond.paralyzed); }
  save(t, abil, dc, cover = 0) {
    if (this.autoFail(t, abil)) return false;
    let r = this.rng.d20(this.saveAdv(t, abil)) + this.saveBonus(t, abil) + (abil === 'dex' ? cover : 0);
    if (t.cond.blessed) r += this.rng.die(4);
    return r >= dc;
  }

  // ---------- damage / healing ----------
  // amt may be a number or a list of [amount, type] parts (weapon + smite etc.)
  damage(a, t, amt, type, { crit = false, melee = false, attack = false, weaponRanged = false } = {}) {
    const parts = Array.isArray(amt) ? amt : [[amt, type]];
    amt = parts.reduce((s, p) => s + p[0], 0);
    if (t.dead || amt <= 0) return 0;
    if (t.hp === 0) { // hitting a downed creature: failed death saves
      t.ds.f += crit ? 2 : 1;
      this.ev({ k: 'dmg', t: t.id, amt: 0, hp: 0, crit, fail: t.ds.f });
      this.log(`  ${t.name} (down) takes a hit: ${t.ds.f} failed saves`);
      if (t.ds.f >= 3) this.kill(t, a);
      return 0;
    }
    if (attack && t.reaction && this.canAct(t)) {
      if (weaponRanged && t.s.feats.has('deflectMissiles')) {
        const red = this.rng.die(10) + t.s.mods.dex + 5; t.reaction = false;
        amt = Math.max(0, amt - red); this.log(`  ${t.name} deflects the missile (-${red})`);
      } else if (t.s.feats.has('uncannyDodge') && amt >= 6) {
        t.reaction = false; amt = Math.floor(amt / 2); this.log(`  ${t.name} uses Uncanny Dodge`);
      }
    }
    if (t.raging > 0) {
      const scale = parts.length ? amt / parts.reduce((s, p) => s + p[0], 0) : 1;
      amt = Math.floor(parts.reduce((s, p) => s + (['bludgeoning', 'piercing', 'slashing'].includes(p[1]) ? p[0] / 2 : p[0]), 0) * scale);
    }
    if (amt <= 0) return 0;
    let dealt = amt;
    if (t.temp > 0) { const ab = Math.min(t.temp, amt); t.temp -= ab; amt -= ab; }
    const before = t.hp;
    t.hp = Math.max(0, t.hp - amt);
    a.st.dmg += before - t.hp; t.st.taken += before - t.hp;
    this.ev({ k: 'dmg', t: t.id, amt: dealt, hp: t.hp, temp: t.temp, crit });
    if (t.cond.hypnotized) { delete t.cond.hypnotized; }
    if (t.hp === 0) {
      if (amt - before >= t.maxHp) { this.kill(t, a); return dealt; }
      this.down(t, a);
    } else if (t.conc) {
      const dc = Math.max(10, Math.floor(amt / 2));
      if (!this.save(t, 'con', dc)) { this.log(`  ${t.name} loses concentration`); this.breakConc(t); }
    }
    return dealt;
  }

  down(t, a) {
    t.hp = 0; t.ds = { s: 0, f: 0 }; t.stable = false; t.cond.prone = true;
    t.st.downed++; if (a) a.st.downs++;
    for (const k of ['hypnotized', 'stunned', 'paralyzed', 'hidden', 'dodging']) delete t.cond[k];
    if (t.conc) this.breakConc(t);
    if (t.raging) t.raging = 0;
    this.log(`  ${t.name} drops!`);
    this.ev({ k: 'down', id: t.id });
    if (a && a.s.feats.has('darkOnesBlessing') && a.team !== t.team) {
      const th = a.s.mods.cha + 5; if (th > a.temp) a.temp = th;
    }
  }
  kill(t, a) {
    t.dead = true; t.hp = 0;
    if (t.conc) this.breakConc(t);
    if (a && a.team !== t.team) a.st.kills++;
    t.sw = null;
    this.log(`  ${t.name} dies.`);
    this.ev({ k: 'dead', id: t.id });
  }

  heal(src, t, amt) {
    if (t.dead || amt <= 0) return;
    const wasDown = t.hp === 0;
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + amt);
    src.st.heal += t.hp - before;
    this.ev({ k: 'healed', t: t.id, amt: t.hp - before, hp: t.hp, up: wasDown && t.hp > 0 });
    if (wasDown && t.hp > 0) { t.ds = { s: 0, f: 0 }; t.stable = false; t.st.revived++; this.log(`  ${t.name} is back up (${t.hp} hp)`); }
  }

  // ---------- resources ----------
  slotAvail(c, lvl) {
    if (c.pact) return c.pact.slots > 0 && lvl <= c.pact.level ? c.pact.level : 0;
    for (let l = lvl; l < c.slots.length; l++) if (c.slots[l] > 0) return l;
    return 0;
  }
  spendSlot(c, lvl) {
    if (c.pact) { c.pact.slots--; return c.pact.level; }
    const l = this.slotAvail(c, lvl); if (l) c.slots[l]--;
    return l;
  }

  // ---------- concentration ----------
  startConc(c, spell, data = {}) {
    if (c.conc) this.breakConc(c);
    c.conc = { spell, ...data };
  }
  breakConc(c) {
    const C = c.conc; if (!C) return;
    c.conc = null;
    for (const o of this.cs) {
      for (const k of Object.keys(o.cond)) {
        const v = o.cond[k];
        if (v && typeof v === 'object' && v.by === c.id && v.conc) {
          delete o.cond[k];
          if (k === 'hasted' && this.up(o)) o.cond.lethargic = true;
        }
      }
    }
  }

  // ---------- zones & auras ----------
  zoneEnter(c) {
    if (!c.turn) return;
    for (const o of this.cs) {
      if (!o.conc) continue;
      if (o.conc.spell === 'spiritGuardians' && o.team !== c.team && this.dist(o, c) <= 3) this.auraHit(o, c);
      if (o.conc.zone && cheb(o.conc.zone.x, o.conc.zone.y, c.x, c.y) <= o.conc.zone.r) this.auraHit(o, c);
    }
  }
  auraHit(src, t) {
    if (!this.up(t) || !t.turn) return;
    const key = 'aura' + src.id;
    if (t.turn[key]) return;
    t.turn[key] = true;
    const sp = SPELLS[src.conc.spell];
    const lvl = src.conc.lvl || sp.lvl;
    const n = sp.dice[0] + (lvl - sp.lvl) * (sp.upDice || 0);
    let dmg = this.rng.dice(n, sp.dice[1]);
    const ok = this.save(t, sp.abil, src.s.spellDC);
    if (ok) dmg = Math.floor(dmg / 2);
    this.ev({ k: 'aura', a: src.id, t: t.id, spell: src.conc.spell });
    this.log(`  ${t.name} is caught by ${sp.name}: ${dmg}`);
    this.damage(src, t, dmg, sp.type);
  }

  // ---------- turn lifecycle ----------
  startTurn(c) {
    c.reaction = true;
    for (const k of ['dodging', 'reckless', 'shielded']) delete c.cond[k];
    c.turn = { action: true, bonus: true, move: this.speedOf(c), sneak: false, colossus: false, disengaged: false, leveled: false, bonusSpell: false, attacked: false };
    if (c.hp === 0) {
      if (c.stable) return false;
      const r = this.rng.die(20);
      if (r === 20) { c.hp = 1; c.ds = { s: 0, f: 0 }; this.log(`${c.name} rolls a 20 and gets up!`); }
      else if (r === 1) c.ds.f += 2; else if (r >= 10) c.ds.s++; else c.ds.f++;
      if (c.ds.f >= 3) this.kill(c, null);
      else if (c.ds.s >= 3) { c.stable = true; this.log(`${c.name} stabilises`); }
      if (c.hp === 0) return false;
    }
    // start-of-turn damage
    for (const o of this.cs) {
      if (!o.conc) continue;
      if (o.conc.spell === 'spiritGuardians' && this.up(o) && o.team !== c.team && this.dist(o, c) <= 3) {
        this.auraHit(o, c); c.turn.move = Math.floor(c.turn.move / 2);
      }
      if (o.conc.zone && cheb(o.conc.zone.x, o.conc.zone.y, c.x, c.y) <= o.conc.zone.r) this.auraHit(o, c);
    }
    if (!this.up(c)) return false;
    if (c.cond.lethargic) { delete c.cond.lethargic; this.log(`${c.name} is lethargic and loses the turn`); return false; }
    if (!this.canAct(c)) return false;
    if (c.cond.prone) { delete c.cond.prone; c.turn.move -= Math.ceil(this.speedOf(c) / 2); }
    if (c.cond.restrained) c.turn.move = 0;
    c.turn.move = Math.max(0, c.turn.move);
    return true;
  }

  endTurn(c) {
    // repeat saves
    const k = c.cond;
    if (k.paralyzed && this.up(c) && this.save(c, 'wis', k.paralyzed.dc)) { delete k.paralyzed; this.log(`  ${c.name} breaks free of Hold Person`); }
    // ticking conditions owned by this creature
    for (const o of this.cs) for (const key of Object.keys(o.cond)) {
      const v = o.cond[key];
      if (v && typeof v === 'object' && v.ttlBy === c.id) { v.ttl--; if (v.ttl < 0) delete o.cond[key]; }
    }
    if (c.raging > 0) c.raging--;
    if (c.sw) { c.sw.left--; if (c.sw.left <= 0) c.sw = null; }
    c.turn = null;
  }

  // ---------- main loop ----------
  run() {
    const init = this.cs.map((c) => ({ c, r: this.rng.die(20) + c.s.mods.dex + this.rng() * 0.01 }));
    init.sort((a, b) => b.r - a.r);
    this.order = init.map((i) => i.c);
    this.snapshot(null);
    let winner = null;
    for (this.round = 1; this.round <= this.maxRounds && winner === null; this.round++) {
      for (const c of this.order) {
        if (c.dead) continue;
        if (!c.dead) this.log(`— ${c.name} (${c.hp}/${c.maxHp})${c.hp === 0 ? ' — down' : ''}`);
        if (this.startTurn(c)) {
          takeTurn(this, c);
        } else if (!c.dead && c.hp > 0) {
          const why = c.cond.paralyzed ? 'paralyzed' : c.cond.stunned ? 'stunned' : c.cond.hypnotized ? 'entranced' : 'loses the turn';
          this.log(`  ${c.name} is ${why}`);
        }
        if (!c.dead && c.turn) this.endTurn(c); else c.turn = null;
        this.snapshot(c);
        winner = this.checkWinner();
        if (winner !== null) break;
      }
    }
    if (winner === null) winner = -1;
    this.lines.push(winner === -1 ? 'Draw — time ran out.' : `Team ${winner === 0 ? 'Blue' : 'Red'} wins.`);
    this.snapshot(null);
    return this.result(winner);
  }

  checkWinner() {
    const alive = [0, 1].map((t) => this.cs.some((c) => c.team === t && this.up(c)));
    if (alive[0] && alive[1]) return null;
    if (!alive[0] && !alive[1]) return -1;
    return alive[0] ? 0 : 1;
  }

  result(winner) {
    return {
      winner, rounds: Math.min(this.round, this.maxRounds),
      units: this.cs.map((c) => ({
        id: c.id, team: c.team, cls: c.cls, name: c.name, personality: c.p.id,
        hp: c.hp, maxHp: c.maxHp, dead: c.dead, up: this.up(c), ...c.st,
      })),
      frames: this.record ? this.frames : null,
      map: this.map.id,
    };
  }
}

export { idx, W, H, avgDice };

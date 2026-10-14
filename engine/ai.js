// Utility AI. Every turn: score (option x target x destination), add personality, pick the best.
// Values are in "damage-equivalent" points so killing, healing, buffing and control compare on one scale.
import { SPELLS } from './spells.js';
import { pAtLeast, pCrit, avgDieGWF } from './dice.js';

const GW = 24;
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const cx = (ci) => ci % GW, cy = (ci) => (ci / GW) | 0;
const MELEE_CLS = new Set(['barbarian', 'fighter', 'paladin', 'monk']);
const RANGED_ROLES = new Set(['ranged', 'caster', 'support']);

// ---------------------------------------------------------------- hooks used by the engine
export function hitHooks(b, a) {
  const h = {};
  if (a.s.feats.has('divineSmite')) h.smite = (t, r, dmg) => smiteChoice(b, a, t, r, dmg);
  if (a.s.feats.has('stunningStrike')) h.afterHit = (t) => monkAfterHit(b, a, t);
  return h;
}

function smiteChoice(b, a, t, r, dmg) {
  if (!b.slotAvail(a, 1) || t.hp === 0) return 0;
  const P = a.p;
  const top = b.slotAvail(a, 2) || 1;
  if (r.crit) return top;
  if (t.hp > dmg && t.hp <= dmg + 9) return 1;          // smite for the kill
  if (t.hp <= dmg) return 0;                             // already dead, save it
  const want = 0.15 + P.nova * 0.65 + (t.dpr > 18 ? 0.1 : 0);
  return b.rng() < want ? 1 : 0;
}

function monkAfterHit(b, a, t) {
  if (!b.up(t)) return;
  if (a.turn && a.turn.flurry && !t.cond.prone) {
    if (!b.save(t, 'dex', a.s.spellDC)) { t.cond.prone = true; b.log(`  ${t.name} is knocked prone (Open Hand)`); }
  }
  if (a.res.ki > 0 && !t.cond.stunned && !t.cond.paralyzed) {
    const pFail = 1 - pAtLeast(a.s.spellDC, t.s.saves.con, 0);
    const keen = a.p.nova * 0.6 + (t.dpr / 25) * 0.4 + (a.p.target === 'squishy' && t.s.role !== 'melee' ? 0.2 : 0);
    if (pFail > 0.3 && b.rng() < keen + 0.15) {
      a.res.ki--;
      if (!b.save(t, 'con', a.s.spellDC)) { t.cond.stunned = { ttlBy: a.id, ttl: 1 }; b.log(`  ${t.name} is STUNNED`); }
      else b.log(`  ${t.name} shrugs off Stunning Strike`);
    }
  }
}

// ---------------------------------------------------------------- estimates
function noise(b, c) { return 1 + (b.rng() - 0.5) * c.p.randomness * 0.9; }
function slotCost(c, lvl) { return lvl * 5 * (1.15 - c.p.nova); }

function targetWeight(b, c, t) {
  const P = c.p; let w;
  switch (P.target) {
    case 'threat': w = 0.6 + (t.dpr / 20) * 0.8; break;
    case 'weakest': w = 0.6 + (1 - t.hp / t.maxHp) * 0.8 + (t.hp < 15 ? 0.3 : 0); break;
    case 'nearest': w = 1.4 - Math.min(1, b.dist(c, t) / 12) * 0.8; break;
    case 'squishy': w = 0.6 + Math.max(0, (19 - t.s.ac) / 6) * 0.4 + Math.max(0, (50 - t.maxHp) / 18) * 0.4; break;
    default: w = 1;
  }
  if (b.focus[c.team] === t.id) w *= 1 + P.focus * 0.6;
  if (t.cond.paralyzed || t.cond.stunned || t.cond.hypnotized) w *= t.cond.hypnotized ? 0.3 : 1.1; // don't wake the hypnotized
  return w;
}

// value of expected damage dmg dealt to living enemy t
function dmgValue(b, c, t, dmg, physical = false) {
  if (dmg <= 0) return 0;
  if (physical && t.raging > 0) dmg /= 2;
  const pool = t.hp + t.temp;
  const eff = Math.min(dmg, pool);
  let v = eff * targetWeight(b, c, t);
  if (dmg >= pool) v += t.dpr * (0.6 + c.p.focus);
  else v += (eff / t.maxHp) * t.dpr * 0.5 * c.p.focus;
  return v;
}

function healValue(b, c, a, amt) {
  if (a.dead) return 0;
  if (!b.enemiesOf(c).length) return 0;
  if (a.hp === 0) return (12 + a.dpr * 1.2) * (0.5 + c.p.teamwork);
  const frac = a.hp / a.maxHp;
  if (frac > 0.65) return 0;
  let v = Math.min(amt, a.maxHp - a.hp) * (1.2 - frac) * (0.3 + c.p.teamwork * 0.9);
  if (a === c) v *= 0.6 + c.p.caution;
  return v;
}

function advEst(b, a, t, { melee, ranged, x, y, reckless }) {
  let adv = 0, dis = 0; const k = t.cond;
  const d = cheb(x, y, t.x, t.y);
  if (k.prone) { if (melee && d <= 1) adv++; else dis++; }
  if (k.stunned || k.paralyzed || k.restrained || t.hp === 0 || k.faerie || k.guided || k.reckless) adv++;
  if (a.cond.hidden || reckless) adv++;
  if (a.cond.restrained || a.cond.mocked) dis++;
  if (k.dodging && b.canAct(t)) dis++;
  if (ranged) for (const e of b.enemiesOf(a)) if (cheb(e.x, e.y, x, y) <= 1 && b.canAct(e)) { dis++; break; }
  return adv && dis ? 0 : adv ? 1 : dis ? -1 : 0;
}

const diceAvg = (d, gwf) => d[0] * (gwf ? avgDieGWF(d[1]) : (d[1] + 1) / 2);

function wantsReckless(c) { return c.s.feats.has('reckless') && c.p.aggression > 0.3; }

// expected value of n weapon attacks with w from (x,y) on t
function evWeapon(b, c, w, t, x, y, n) {
  const melee = !w.ranged;
  const reckless = melee && wantsReckless(c);
  const adv = advEst(b, c, t, { melee, ranged: !!w.ranged, x, y, reckless });
  const cover = melee ? 0 : b.sight(x, y, t.x, t.y).cover;
  if (!melee && !b.los(x, y, t.x, t.y)) return -1;
  const ac = b.acOf(t) + cover;
  const p = pAtLeast(ac, w.hit + (c.cond.blessed ? 2.5 : 0), adv, true);
  let pc = pCrit(c.s.critOn, adv);
  if (t.hp === 0) {
    if (c.p.ruthless < 0.15) return 0;
    const fails = melee && cheb(x, y, t.x, t.y) <= 1 ? 2 : 1;
    return c.p.ruthless * p * fails * (6 + t.dpr * 0.5) * Math.min(n, 2) * 0.5;
  }
  if (melee && (t.cond.paralyzed) && cheb(x, y, t.x, t.y) <= 1) pc = p;
  const dAvg = diceAvg(w.dice, w.gwf);
  let per = dAvg + w.dmgBonus + ((c.raging > 0 || (c.s.feats.has('rage') && c.res.rage > 0)) && melee && w.abil === 'str' ? 2 : 0);
  if (c.conc && c.conc.mark === t.id) per += 3.5;
  let dmg = n * (p * per + pc * dAvg);
  const pAny = 1 - Math.pow(1 - p, n);
  if (c.s.feats.has('sneakAttack') && !c.turn.sneak && (w.finesse || w.ranged)) {
    const ok = adv > 0 || (adv === 0 && b.cs.some((o) => o.team === c.team && o !== c && b.up(o) && b.canAct(o) && b.dist(o, t) <= 1));
    if (ok) dmg += pAny * 10.5;
  }
  if (c.s.feats.has('colossusSlayer') && !c.turn.colossus && t.hp < t.maxHp) dmg += pAny * 4.5;
  if (c.s.feats.has('divineSmite') && melee && b.slotAvail(c, 1)) dmg += pAny * 9 * (0.3 + c.p.nova * 0.5);
  return dmgValue(b, c, t, dmg, true);
}

function pFailSave(b, t, abil, dc) {
  if (b.autoFail(t, abil)) return 1;
  const adv = b.saveAdv(t, abil);
  return 1 - pAtLeast(dc, t.s.saves[abil] + (t.cond.blessed ? 2.5 : 0), adv);
}

function spellDice(sp, lvl) { return sp.dice ? (sp.dice[0] + (lvl - sp.lvl) * (sp.upDice || 0)) * (sp.dice[1] + 1) / 2 : 0; }

function teamDPR(b, c) { return b.alliesOf(c).reduce((s, a) => s + a.dpr, 0); }

// value of a spell affecting creature t (one creature's share)
function spellOnOne(b, c, sp, lvl, t, x, y) {
  if (t.dead) return 0;
  const ally = t.team === c.team;
  const dc = c.s.spellDC;
  if (t.hp === 0) {
    if (!sp.dice) return 0;
    return ally ? -(10 + t.dpr) * (0.5 + c.p.teamwork) : c.p.ruthless * 6;
  }
  const pf = pFailSave(b, t, sp.abil, dc);
  let v = 0;
  if (sp.dice) {
    const avg = spellDice(sp, lvl);
    const dmg = pf * avg + (1 - pf) * (sp.half ? avg / 2 : 0);
    v += ally ? -dmg * (1.2 + c.p.teamwork) - (dmg >= t.hp ? (10 + t.dpr) * (0.5 + c.p.teamwork) : 0) : dmgValue(b, c, t, dmg);
  }
  const enemyCount = Math.max(1, (ally ? b.alliesOf(c).length : b.enemiesOf(c).length));
  const pressure = ally ? b.enemiesOf(c).reduce((s, e) => s + e.dpr, 0) : teamDPR(b, c);
  switch (sp.cond) {
    case 'faerie': v += (ally ? -1 : 1) * pf * (pressure / enemyCount) * 0.22 * 3; break;
    case 'restrained': v += (ally ? -1 : 1) * pf * (t.dpr * 0.45 + (pressure / enemyCount) * 0.22) * 2; break;
    case 'hypnotized': if (!t.cond.hypnotized) v += (ally ? -1.5 : 1) * pf * t.dpr * 2.2; break;
    case 'paralyzed': if (!ally && !t.cond.paralyzed) {
      const rounds = Math.min(3, 1 / Math.max(0.25, 1 - pf));
      const meleeNear = b.alliesOf(c).filter((a) => MELEE_CLS.has(a.cls) && b.dist(a, t) <= 6).length;
      v += pf * (t.dpr * rounds * 0.8 + meleeNear * 7);
    } break;
    case 'mocked': if (!ally) v += pf * t.dpr * 0.25; break;
    case 'flee': if (!ally) v += pf * b.alliesOf(c).filter((a) => b.dist(a, t) <= 1 && a.reaction).length * 7; break;
  }
  if (sp.recast && !ally && sp.dice) v *= 1.6;   // call lightning keeps striking for free
  if (sp.push && !ally && pf > 0) v += pf * (MELEE_CLS.has(t.cls) ? 2 : 0.5);
  return v;
}

// ---------------------------------------------------------------- positioning
function dangerAt(b, c, x, y, enemies) {
  let d = 0;
  for (const e of enemies) {
    if (!b.canAct(e)) continue;
    const dist = cheb(e.x, e.y, x, y);
    const melee = MELEE_CLS.has(e.cls) || e.cls === 'rogue' && e.p.aggression > 0.6;
    if (dist <= 1) d += e.dpr;
    else if (melee && dist <= e.s.speed + 1) d += e.dpr * 0.45;
    else if (dist <= e.reachRange + e.s.speed && b.los(e.x, e.y, x, y)) d += e.dpr * (dist <= e.reachRange ? 0.3 : 0.12);
    if (e.conc && e.conc.spell === 'spiritGuardians' && dist <= 3) d += 10;
  }
  for (const o of b.cs) if (o.conc && o.conc.zone && cheb(o.conc.zone.x, o.conc.zone.y, x, y) <= o.conc.zone.r) d += 8;
  return d;
}

function canDisengageCheap(b, c) {
  return c.turn.bonus && (c.s.feats.has('cunningAction') || (c.s.feats.has('stepOfTheWind') && c.res.ki > 0));
}

function cellScores(b, c, R) {
  const enemies = b.enemiesOf(c);
  const P = c.p;
  const ranged = RANGED_ROLES.has(c.s.role) || (c.cls === 'rogue' && P.aggression < 0.6);
  const want = ranged ? 4 + P.caution * 5 : 1;
  const startAdj = enemies.filter((e) => b.dist(e, c) <= 1 && e.reaction && b.canAct(e));
  const cheapDis = canDisengageCheap(b, c);
  // fear of fireballs: count enemy casters still holding area damage, then avoid bunching up
  let aoe = 0;
  for (const e of enemies) if (b.canAct(e) && e.s.spells.some((id) => SPELLS[id].area && SPELLS[id].dice && b.slotAvail(e, SPELLS[id].lvl))) aoe++;
  const friends = aoe ? b.alliesOf(c, false) : [];
  const scores = new Map();
  for (const ci of R.cells) {
    const x = cx(ci), y = cy(ci);
    let nd = 99; for (const e of enemies) nd = Math.min(nd, cheb(e.x, e.y, x, y));
    let s = -dangerAt(b, c, x, y, enemies) * (0.12 + P.caution * 0.55) * (ranged ? 1 : 0.35);
    if (ranged && nd < want) s -= (want - nd) * (1 + P.caution * 2);
    if (!ranged && P.aggression > 0.5) s -= nd * 0.15 * P.aggression;  // eager to close
    s -= R.dist[ci] * 0.04;
    if (aoe) for (const f of friends) { const d = cheb(f.x, f.y, x, y); if (d <= 3) s -= (4 - d) * Math.min(2, aoe) * (0.4 + P.caution * 1.2); }
    for (const e of startAdj) if (cheb(e.x, e.y, x, y) > 1) s -= cheapDis ? 0.5 : e.dpr * 0.5 * (1 - P.aggression * 0.6) * (0.5 + P.caution);
    scores.set(ci, s);
  }
  return scores;
}

// ---------------------------------------------------------------- option generation
function actionOptions(b, c, noLeveled) {
  const o = [];
  const s = c.s;
  const attacks = s.attacks;
  for (const w of s.weapons) o.push({ kind: 'weapon', w, range: w.ranged ? w.range : 1, melee: !w.ranged, n: attacks, tgt: 'enemy' });
  for (const id of s.cantrips) o.push({ kind: 'spell', id, sp: SPELLS[id], lvl: 0, range: SPELLS[id].range, tgt: 'enemy' });
  if (!noLeveled && !c.turn.bonusSpell) for (const id of s.spells) {
    const sp = SPELLS[id];
    if (sp.cast !== 'action') continue;
    const lvl = b.slotAvail(c, sp.lvl); if (!lvl) continue;
    if (sp.conc && c.conc && c.conc.spell === id) continue;
    let tgt = 'enemy';
    if (sp.kind === 'heal') tgt = 'ally';
    else if (sp.kind === 'buff') tgt = 'ally';
    else if (sp.kind === 'aura' || (sp.area && sp.area.cube)) tgt = 'self';
    else if (sp.area || sp.kind === 'zone') tgt = 'area';
    o.push({ kind: 'spell', id, sp, lvl, range: sp.range, tgt, leveled: true });
  }
  // free re-uses of a held spell
  if (c.conc && c.conc.spell === 'callLightning') o.push({ kind: 'spell', id: 'callLightning', sp: SPELLS.callLightning, lvl: c.conc.lvl, range: 24, tgt: 'area', free: true });
  if (c.conc && c.conc.spell === 'moonbeam') o.push({ kind: 'spell', id: 'moonbeam', sp: SPELLS.moonbeam, lvl: c.conc.lvl, range: 24, tgt: 'area', free: true });
  if (s.feats.has('layOnHands') && c.res.layOnHands > 0) o.push({ kind: 'layOnHands', range: 1, tgt: 'ally' });
  if (s.feats.has('preserveLife') && c.res.channel > 0) o.push({ kind: 'preserveLife', range: 0, tgt: 'self' });
  if (c.cond.restrained) o.push({ kind: 'escape', range: 0, tgt: 'self' });
  o.push({ kind: 'dodge', range: 0, tgt: 'self' });
  return o;
}

function concCost(b, c, opt) {
  if (!opt.sp || !opt.sp.conc || opt.free || !c.conc) return 0;
  const C = c.conc;
  if (C.mark != null) return b.cs[C.mark] && b.up(b.cs[C.mark]) ? 8 : 0;
  if (C.zone) return 8;
  if (C.spell === 'spiritGuardians') return 14;
  if (C.spell === 'callLightning') return 10;
  const held = b.cs.some((o) => Object.values(o.cond).some((v) => v && v.by === c.id && v.conc));
  return held ? 16 : 0;
}

function optCost(b, c, opt) {
  let k = concCost(b, c, opt);
  if (opt.leveled && !opt.free) k += c.pact ? slotCost(c, 3) : slotCost(c, opt.lvl);
  if (opt.kind === 'preserveLife') k += 4;
  return k;
}

// returns value of opt from cell ci against target t (or self/area), plus extra data
function evalOpt(b, c, opt, t, ci) {
  const x = cx(ci), y = cy(ci);
  switch (opt.kind) {
    case 'weapon': {
      const n = opt.n + (c.cond.hasted ? 1 : 0);
      return { v: evWeapon(b, c, opt.w, t, x, y, n) };
    }
    case 'spell': {
      const sp = opt.sp;
      if (sp.kind === 'attack') {
        if (!b.los(x, y, t.x, t.y)) return null;
        const rays = (sp.rays || 1) + (opt.lvl - sp.lvl) * (sp.upRays || 0);
        const adv = advEst(b, c, t, { melee: false, ranged: true, x, y });
        const ac = b.acOf(t) + b.sight(x, y, t.x, t.y).cover;
        if (t.hp === 0) return { v: c.p.ruthless * 5 };
        const p = pAtLeast(ac, c.s.spellHit + (c.cond.blessed ? 2.5 : 0), adv, true);
        const pc = pCrit(20, adv);
        const n = sp.dice[0] + (opt.lvl - sp.lvl) * (sp.upDice || 0);
        const avg = n * (sp.dice[1] + 1) / 2 + (sp.addMod ? c.s.castMod : 0);
        let per = p * avg + pc * n * (sp.dice[1] + 1) / 2;
        if (c.conc && c.conc.mark === t.id && sp.addMod) per += p * 3.5;
        let v = dmgValue(b, c, t, rays * per);
        if (sp.cond === 'guided') v += p * 4;
        if (t.hasShieldFlag) v *= 0.8;
        return { v };
      }
      if (sp.kind === 'auto') {
        if (!b.los(x, y, t.x, t.y) || t.hp === 0) return null;
        const darts = sp.darts + (opt.lvl - 1) * (sp.upDarts || 0);
        let v = dmgValue(b, c, t, darts * 3.5);
        if (t.reaction && b.hasShield(t)) v *= 0.15;
        return { v };
      }
      if (sp.kind === 'save' && !sp.area) {
        if (!b.los(x, y, t.x, t.y)) return null;
        if (sp.cond === 'paralyzed' && t.cond.paralyzed) return null;
        let v = spellOnOne(b, c, sp, opt.lvl, t, x, y);
        const extra = (sp.targets ? (opt.lvl - sp.lvl) * (sp.upTargets || 0) : 0);
        let targets = [t];
        if (extra > 0) {
          const more = b.enemiesOf(c).filter((e) => e !== t && cheb(x, y, e.x, e.y) <= sp.range && b.los(x, y, e.x, e.y) && !e.cond.paralyzed)
            .map((e) => ({ e, v: spellOnOne(b, c, sp, opt.lvl, e, x, y) })).sort((a, b2) => b2.v - a.v).slice(0, extra);
          for (const m of more) { v += m.v; targets.push(m.e); }
        }
        return { v, targets };
      }
      if (sp.kind === 'heal') {
        if (t.team !== c.team) return null;
        const amt = spellDice(sp, opt.lvl) + c.s.castMod + (c.s.feats.has('discipleOfLife') ? 2 + opt.lvl : 0);
        return { v: healValue(b, c, t, amt) };
      }
      if (sp.kind === 'buff') {
        if (sp.cond === 'blessed') {
          const allies = b.alliesOf(c).filter((a) => cheb(x, y, a.x, a.y) <= sp.range && !a.cond.blessed).sort((p, q) => q.dpr - p.dpr).slice(0, 3);
          if (!allies.length || !b.enemiesOf(c).length) return null;
          const v = allies.reduce((s, a) => s + a.dpr * 0.17 * 3, 0) * (0.4 + c.p.teamwork);
          return { v, targets: allies };
        }
        if (sp.cond === 'hasted') {
          if (t.team !== c.team || t.cond.hasted || !b.up(t)) return null;
          const v = (MELEE_CLS.has(t.cls) || t.cls === 'ranger' ? t.dpr * 0.42 : t.dpr * 0.15) * 3 * (0.4 + c.p.teamwork) + 3;
          return { v, targets: [t] };
        }
      }
      if (sp.kind === 'zone') {
        if (t.hp === 0) return null;
        // beam on a creature locked in melee stays put; a free mover walks out
        const engaged = b.alliesOf(c).some((a) => b.dist(a, t) <= 1) || t.cond.restrained || t.cond.paralyzed;
        let v = 0;
        for (const o of b.cs) if (!o.dead && b.up(o) && cheb(o.x, o.y, t.x, t.y) <= 1) {
          const sh = spellOnOne(b, c, sp, opt.lvl, o, x, y);
          v += o.team === c.team ? sh * 1.5 : sh * (engaged ? 2.2 : 0.8);
        }
        return { v, center: [t.x, t.y] };
      }
      if (sp.area && !sp.area.cube) {
        const v = areaValue(b, c, sp, opt.lvl, t.x, t.y);
        return { v, center: [t.x, t.y] };
      }
      return null;
    }
    case 'layOnHands': {
      if (t.team !== c.team) return null;
      const amt = t.hp === 0 ? Math.min(c.res.layOnHands, 10) : Math.min(c.res.layOnHands, t.maxHp - t.hp);
      return { v: healValue(b, c, t, amt) * 0.9, amt };
    }
  }
  return null;
}

function areaValue(b, c, sp, lvl, x, y) {
  let hit = b.inArea(sp, x, y, c);
  if (c.s.feats.has('sculptSpells')) hit = hit.filter((o) => o.team !== c.team);
  let v = 0, enemies = 0;
  for (const o of hit) { const sh = spellOnOne(b, c, sp, lvl, o, x, y); v += sh; if (o.team !== c.team && o.hp > 0) enemies++; }
  return enemies ? v : -1;
}

function selfOpt(b, c, opt, ci) {
  const x = cx(ci), y = cy(ci);
  if (opt.kind === 'dodge') {
    const d = dangerAt(b, c, x, y, b.enemiesOf(c));
    return { v: d * 0.25 * (0.3 + c.p.caution) - 2 };
  }
  if (opt.kind === 'escape') return { v: c.cond.restrained ? 6 * (MELEE_CLS.has(c.cls) ? 1.5 : 0.8) : -1 };
  if (opt.kind === 'preserveLife') {
    const allies = b.cs.filter((a) => a.team === c.team && !a.dead && cheb(x, y, a.x, a.y) <= 6);
    let pool = 25, v = 0;
    for (const a of allies.sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp)) {
      const cap = Math.max(0, Math.floor(a.maxHp / 2) - a.hp); const amt = Math.min(pool, cap);
      if (amt > 0) { v += healValue(b, c, a, amt); pool -= amt; }
    }
    return { v };
  }
  const sp = opt.sp;
  if (sp && sp.kind === 'aura') {
    let v = 0;
    for (const e of b.enemiesOf(c)) {
      const d = cheb(e.x, e.y, x, y);
      const share = spellOnOne(b, c, sp, opt.lvl, e, x, y);
      if (d <= 3) v += share * 2.2; else if (d <= 7) v += share * (MELEE_CLS.has(e.cls) ? 1.2 : 0.4);
    }
    return { v };
  }
  if (sp && sp.area && sp.area.cube) {
    let best = null;
    for (const dir of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const v = areaValue(b, c, sp, opt.lvl, x + dir[0] * 2, y + dir[1] * 2);
      if (!best || v > best.v) best = { v, dir };
    }
    return best;
  }
  return null;
}

// ---------------------------------------------------------------- planning
function targetsFor(b, c, opt) {
  if (opt.tgt === 'enemy') {
    const list = b.enemiesOf(c);
    if (c.p.ruthless > 0.15 && (opt.kind === 'weapon' || (opt.sp && opt.sp.kind === 'attack')))
      for (const o of b.cs) if (o.team !== c.team && !o.dead && o.hp === 0) list.push(o);
    return list;
  }
  if (opt.tgt === 'area') return b.enemiesOf(c);
  if (opt.tgt === 'ally') return b.cs.filter((a) => a.team === c.team && !a.dead);
  return [];
}

function plan(b, c, { noLeveled = false } = {}) {
  const R = b.reach(c, c.turn.move);
  const scores = cellScores(b, c, R);
  const sorted = R.cells.slice().sort((p, q) => scores.get(q) - scores.get(p));
  const opts = actionOptions(b, c, noLeveled);
  let best = null;
  const consider = (opt, t, ci, res) => {
    if (!res || res.v == null || res.v <= 0 && opt.kind !== 'dodge') return;
    const total = (res.v - optCost(b, c, opt)) * noise(b, c) + scores.get(ci);
    if (!best || total > best.total) best = { total, opt, t, ci, res };
  };
  for (const opt of opts) {
    if (opt.tgt === 'self') {
      const cand = sorted.slice(0, 12);
      if (opt.sp && opt.sp.area && opt.sp.area.cube)
        for (const ci of R.cells) if (!cand.includes(ci) && b.enemiesOf(c).some((e) => cheb(e.x, e.y, cx(ci), cy(ci)) <= 2)) cand.push(ci);
      if (opt.sp && opt.sp.kind === 'aura')
        for (const ci of R.cells) if (!cand.includes(ci) && b.enemiesOf(c).some((e) => cheb(e.x, e.y, cx(ci), cy(ci)) <= 1)) cand.push(ci);
      for (const ci of cand) consider(opt, null, ci, selfOpt(b, c, opt, ci));
      continue;
    }
    for (const t of targetsFor(b, c, opt)) {
      // range check against the target (areas: centre on the target)
      const needLos = opt.kind !== 'weapon' || !opt.melee;
      let found = null;
      for (const ci of sorted) {
        const x = cx(ci), y = cy(ci);
        const d = cheb(x, y, t.x, t.y);
        if (d > opt.range) continue;
        if (opt.melee && d < 1) continue;
        if (opt.kind === 'layOnHands' || (opt.sp && opt.sp.range === 1)) { if (d > 1) continue; }
        if (needLos && d > 0 && !b.los(x, y, t.x, t.y)) continue;
        found = ci; break;
      }
      if (found == null) continue;
      consider(opt, t, found, evalOpt(b, c, opt, t, found));
    }
  }
  // melee: dash to engage when no swing is possible this turn
  if (!MELEE_CLS.has(c.cls) && c.cls !== 'cleric' && !(c.cls === 'rogue' && c.p.aggression >= 0.6)) return best;
  const w = c.s.weapons.find((x) => !x.ranged);
  const canSwing = best && best.opt.kind === 'weapon' && best.opt.melee;
  if (!canSwing && w && c.turn.action && c.turn.move > 0) {
    const R2 = b.reach(c, c.turn.move + b.speedOf(c));
    let pick = null;
    for (const t of b.enemiesOf(c)) {
      let cell = null;
      for (const ci of R2.cells) if (cheb(cx(ci), cy(ci), t.x, t.y) <= 1 && (cell == null || R2.dist[ci] < R2.dist[cell])) cell = ci;
      if (cell == null) continue;
      const v = evWeapon(b, c, w, t, cx(cell), cy(cell), c.s.attacks) * (0.45 + 0.45 * c.p.aggression) - dangerAt(b, c, cx(cell), cy(cell), b.enemiesOf(c)) * 0.1 * c.p.caution;
      if (!pick || v > pick.v) pick = { v, cell, t };
    }
    if (pick) {
      const total = pick.v * noise(b, c);
      if (!best || total > best.total) best = { total, opt: { kind: 'dash' }, t: pick.t, ci: pick.cell, res: { v: pick.v }, R2 };
    }
  }
  return best;
}

// ---------------------------------------------------------------- bonus actions
function bonusSpellPlan(b, c, x, y) {
  if (!c.turn.bonus || c.turn.leveled) return null;
  let best = null;
  const take = (v, run) => { if (v > 0 && (!best || v > best.v)) best = { v, run }; };
  for (const id of c.s.spells) {
    const sp = SPELLS[id];
    if (sp.cast !== 'bonus') continue;
    const lvl = b.slotAvail(c, sp.lvl); if (!lvl) continue;
    const cost = c.pact ? slotCost(c, 3) : slotCost(c, lvl);
    if (sp.kind === 'heal') {
      const amt = spellDice(sp, lvl) + c.s.castMod + (c.s.feats.has('discipleOfLife') ? 2 + lvl : 0);
      const pool = b.cs.filter((a) => a.team === c.team && !a.dead && cheb(x, y, a.x, a.y) <= sp.range)
        .map((a) => ({ a, v: healValue(b, c, a, amt) })).filter((p) => p.v > 0).sort((p, q) => q.v - p.v).slice(0, sp.targets);
      if (!pool.length) continue;
      const v = pool.reduce((s, p) => s + p.v, 0) - cost;
      take(v, () => b.cast(c, id, { targets: pool.map((p) => p.a) }));
    } else if (sp.kind === 'mark') {
      if (c.conc && c.conc.mark != null && b.up(b.cs[c.conc.mark])) continue;
      if (c.conc && c.conc.mark == null) continue; // holding something else
      const tg = b.enemiesOf(c).filter((e) => cheb(x, y, e.x, e.y) <= sp.range && b.los(x, y, e.x, e.y))
        .sort((p, q) => targetWeight(b, c, q) - targetWeight(b, c, p))[0];
      if (!tg) continue;
      const per = c.cls === 'warlock' ? 2 : c.s.attacks;
      take(per * 0.65 * 3.5 * 3 - cost, () => b.cast(c, id, { target: tg }));
    } else if (sp.kind === 'weapon') {
      if (c.sw) continue;
      const tg = b.enemiesOf(c).filter((e) => cheb(x, y, e.x, e.y) <= sp.range).sort((p, q) => targetWeight(b, c, q) - targetWeight(b, c, p))[0];
      if (!tg) continue;
      take(0.65 * 8.5 * 3 * 1.1 - cost, () => b.cast(c, id, { target: tg }));
    }
  }
  return best;
}

function preActionBonus(b, c, A) {
  const T = c.turn;
  if (!T.bonus || !b.canAct(c)) return;
  if (c.s.feats.has('rage') && !c.raging && c.res.rage > 0 && b.enemiesOf(c).some((e) => b.dist(e, c) <= 1)) {
    c.raging = 10; c.res.rage--; T.bonus = false; b.log(`${c.name} RAGES`); b.ev({ k: 'rage', id: c.id }); return;
  }
  const bs = bonusSpellPlan(b, c, c.x, c.y);
  if (bs && bs.v > 3) { bs.run(); T.bonus = false; }
}

function postActionBonus(b, c) {
  const T = c.turn;
  if (!T.bonus || !b.up(c) || !b.canAct(c)) return;
  const P = c.p;
  const enemies = b.enemiesOf(c);
  const adj = enemies.filter((e) => b.dist(e, c) <= 1);
  // monk: flurry / martial arts
  if (c.s.feats.has('martialArts') && T.attacked && adj.length) {
    const w = c.s.weapons.find((x) => x.id === 'shortsword');
    const unarmed = { ...w, name: 'Unarmed strike', finesse: true };
    const flurry = c.res.ki > 0 && (c.res.ki >= 2 || P.nova > 0.6);
    T.bonus = false;
    if (flurry) { c.res.ki--; T.flurry = true; b.log(`${c.name} Flurry of Blows`); }
    const n = flurry ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const t = pickAdjacent(b, c); if (!t) break;
      b.weaponAttack(c, t, unarmed);
    }
    T.flurry = false;
    return;
  }
  // berserker frenzy
  if (c.s.feats.has('frenzy') && c.raging > 0 && adj.length) {
    const w = c.s.weapons.find((x) => !x.ranged);
    const t = pickAdjacent(b, c); T.bonus = false;
    b.weaponAttack(c, t, w, { reckless: wantsReckless(c) }); return;
  }
  if (c.s.feats.has('rage') && !c.raging && c.res.rage > 0 && adj.length) { c.raging = 10; c.res.rage--; T.bonus = false; b.log(`${c.name} RAGES`); b.ev({ k: 'rage', id: c.id }); return; }
  // spiritual weapon strike
  if (c.sw) {
    const near = enemies.filter((e) => cheb(e.x, e.y, c.sw.x, c.sw.y) <= 5).sort((p, q) => targetWeight(b, c, q) - targetWeight(b, c, p));
    const bs = bonusSpellPlan(b, c, c.x, c.y);
    if (near.length && !(bs && bs.v > 12)) { T.bonus = false; b.log(`${c.name} directs the Spiritual Weapon`); b.spiritStrike(c, near[0]); return; }
  }
  const bs = bonusSpellPlan(b, c, c.x, c.y);
  if (bs && bs.v > 2) { bs.run(); T.bonus = false; return; }
  if (c.s.feats.has('secondWind') && c.res.secondWind > 0 && c.hp < c.maxHp * (0.35 + P.caution * 0.25)) {
    c.res.secondWind--; T.bonus = false; const h = b.rng.die(10) + 5; b.ev({ k: 'heal', a: c.id, t: c.id, spell: 'secondWind' }); b.heal(c, c, h); b.log(`${c.name} Second Wind +${h}`); return;
  }
  if (c.s.feats.has('bardicInspiration') && c.res.bi > 1) {
    const a = b.alliesOf(c, false).filter((a) => !a.cond.inspired && b.dist(a, c) <= 12).sort((p, q) => q.dpr - p.dpr)[0];
    if (a && P.teamwork > 0.2) { c.res.bi--; a.cond.inspired = true; T.bonus = false; b.log(`${c.name} inspires ${a.name}`); return; }
  }
  // misty step out of melee for casters
  if (RANGED_ROLES.has(c.s.role) && adj.length && !T.leveled && b.slotAvail(c, 2) && c.s.spells.includes('mistyStep') && P.caution > 0.3) {
    const dest = bestRetreatCell(b, c, 6, true);
    if (dest != null) { b.cast(c, 'mistyStep', { center: [cx(dest), cy(dest)] }); T.bonus = false; return; }
  }
  if (c.s.feats.has('patientDefense') && c.res.ki > 0 && adj.length >= 2 && P.caution > 0.5) {
    c.res.ki--; c.cond.dodging = true; T.bonus = false; b.log(`${c.name} Patient Defense`); return;
  }
}

function pickAdjacent(b, c) {
  return b.enemiesOf(c).filter((e) => b.dist(e, c) <= 1).sort((p, q) => targetWeight(b, c, q) - targetWeight(b, c, p) + (p.hp - q.hp) * 0.01)[0] || null;
}

function bestRetreatCell(b, c, budget, teleport) {
  const R = teleport ? teleportReach(b, c, budget) : b.reach(c, budget);
  const scores = cellScores(b, c, R);
  const here = R.start;
  let best = null, bs = scores.has(here) ? scores.get(here) : -1e9;
  for (const ci of R.cells) {
    const s = scores.get(ci);
    if (s > bs + 1.5) { bs = s; best = ci; }
  }
  return best;
}
function teleportReach(b, c, r) {
  const cells = []; const dist = new Int16Array(24 * 16).fill(-1);
  for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
    if (b.map.blocksMove(x, y) || b.at(x, y) && !(x === c.x && y === c.y)) continue;
    if (!b.los(c.x, c.y, x, y)) continue;
    const ci = y * GW + x; cells.push(ci); dist[ci] = 0;
  }
  return { cells, dist, start: c.y * GW + c.x };
}

// ---------------------------------------------------------------- executing the plan
function runAction(b, c, best) {
  const { opt, t, res } = best;
  const T = c.turn;
  T.action = false;
  switch (opt.kind) {
    case 'weapon': {
      const n = opt.n;
      let tgt = t;
      if (t && t.team !== c.team && t.hp > 0) b.focus[c.team] = t.id;
      for (let i = 0; i < n; i++) {
        if (!b.up(c) || !b.canAct(c)) return;
        if (!tgt || tgt.dead || (tgt.hp === 0 && c.p.ruthless < 0.5 && tgt !== t)) tgt = retarget(b, c, opt.w);
        if (tgt && tgt.hp === 0 && tgt === t && c.p.ruthless < 0.5 && i > 0) tgt = retarget(b, c, opt.w) || tgt;
        if (!tgt) return;
        b.weaponAttack(c, tgt, opt.w, { reckless: wantsReckless(c) && !opt.w.ranged });
        if (wantsReckless(c) && !opt.w.ranged) c.cond.reckless = true;
      }
      return;
    }
    case 'spell': {
      const sp = opt.sp;
      if (t && t.team !== c.team && t.hp > 0) b.focus[c.team] = t.id;
      if (sp.kind === 'attack' || sp.kind === 'auto') {
        const rays = sp.kind === 'auto' ? sp.darts + (opt.lvl - 1) * (sp.upDarts || 0) : (sp.rays || 1) + (opt.lvl - sp.lvl) * (sp.upRays || 0);
        const targets = Array(rays).fill(t);
        // spread rays that would overkill
        if (sp.kind === 'attack' && rays > 1) {
          const perRay = (sp.dice[0] * (sp.dice[1] + 1) / 2 + (sp.addMod ? c.s.castMod : 0)) * 0.65;
          const need = Math.ceil(t.hp / Math.max(1, perRay)) + 1;
          if (need < rays) {
            const other = b.enemiesOf(c).filter((e) => e !== t && b.dist(e, c) <= sp.range && b.los(c.x, c.y, e.x, e.y)).sort((p, q) => targetWeight(b, c, q) - targetWeight(b, c, p))[0];
            if (other) for (let i = need; i < rays; i++) targets[i] = other;
          }
        }
        b.cast(c, opt.id, { targets, slot: opt.lvl, free: opt.free });
      } else if (sp.kind === 'save' && !sp.area) b.cast(c, opt.id, { targets: res.targets || [t], slot: opt.lvl });
      else if (sp.kind === 'save' && sp.area && sp.area.cube) b.cast(c, opt.id, { dir: res.dir, slot: opt.lvl });
      else if (sp.kind === 'save' || sp.kind === 'zone') {
        if (opt.free && sp.kind === 'zone') { c.conc.zone = { x: res.center[0], y: res.center[1], r: 1 }; b.log(`${c.name} moves the Moonbeam to (${res.center})`); }
        else b.cast(c, opt.id, { center: res.center, slot: opt.lvl, free: opt.free });
      }
      else if (sp.kind === 'heal') b.cast(c, opt.id, { target: t, slot: opt.lvl });
      else if (sp.kind === 'buff') b.cast(c, opt.id, { targets: res.targets, slot: opt.lvl });
      else if (sp.kind === 'aura') b.cast(c, opt.id, { slot: opt.lvl });
      return;
    }
    case 'layOnHands': {
      const amt = Math.min(c.res.layOnHands, res.amt); c.res.layOnHands -= amt;
      b.log(`${c.name} Lay on Hands → ${t.name} +${amt}`); b.ev({ k: 'heal', a: c.id, t: t.id, spell: 'layOnHands' }); b.heal(c, t, amt); return;
    }
    case 'preserveLife': {
      c.res.channel--; let pool = 25; b.log(`${c.name} Channel Divinity: Preserve Life`); b.ev({ k: 'cast', a: c.id, spell: 'preserveLife' });
      const allies = b.cs.filter((a) => a.team === c.team && !a.dead && b.dist(a, c) <= 6).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp);
      for (const a of allies) { const amt = Math.min(pool, Math.max(0, Math.floor(a.maxHp / 2) - a.hp)); if (amt > 0) { b.heal(c, a, amt); pool -= amt; } }
      return;
    }
    case 'escape': {
      const k = c.cond.restrained;
      if (k && b.rng.die(20) + c.s.saves.str >= k.dc) { delete c.cond.restrained; b.log(`${c.name} tears free of the vines`); }
      else b.log(`${c.name} struggles in the vines`);
      return;
    }
    case 'dodge': c.cond.dodging = true; b.log(`${c.name} takes the Dodge action`); return;
  }
}

function retarget(b, c, w) {
  const range = w.ranged ? w.range : 1;
  let list = b.enemiesOf(c).filter((e) => b.dist(e, c) <= range && (!w.ranged || b.los(c.x, c.y, e.x, e.y)));
  if (!list.length && !w.ranged && c.turn.move > 0) {
    // step to a new victim with leftover movement
    const R = b.reach(c, c.turn.move);
    let best = null;
    for (const e of b.enemiesOf(c)) for (const ci of R.cells) if (cheb(cx(ci), cy(ci), e.x, e.y) <= 1) { if (!best || R.dist[ci] < best.d) best = { d: R.dist[ci], ci, e }; }
    if (best) { b.moveTo(c, best.ci); if (b.up(c) && b.dist(best.e, c) <= 1) return best.e; }
    return null;
  }
  return list.sort((p, q) => targetWeight(b, c, q) - targetWeight(b, c, p))[0] || null;
}

// head for the enemy when nothing is in range: move, re-plan, dash if still nothing
function approach(b, c) {
  const T = c.turn;
  const enemies = b.enemiesOf(c);
  if (!enemies.length) return;
  const goal = enemies.sort((p, q) => targetWeight(b, c, q) - targetWeight(b, c, p))[0];
  const R = b.reach(c, 80);
  const ranged = RANGED_ROLES.has(c.s.role) || c.cls === 'rogue';
  let best = null;
  for (const ci of R.cells) {
    const x = cx(ci), y = cy(ci);
    const d = cheb(x, y, goal.x, goal.y);
    const ok = ranged ? d <= 12 && b.los(x, y, goal.x, goal.y) : d <= 1;
    if (ok && (!best || R.dist[ci] < best.d)) best = { d: R.dist[ci], ci };
  }
  if (!best) { // can't reach: just get as close as possible
    for (const ci of R.cells) { const d = cheb(cx(ci), cy(ci), goal.x, goal.y); if (!best || d < best.d) best = { d, ci }; }
  }
  if (!best) return;
  const path = b.pathTo(R, best.ci);
  const from = [c.x, c.y];
  b.walk(c, path);
  if (from[0] !== c.x || from[1] !== c.y) b.log(`${c.name} advances (${from}) → (${c.x},${c.y})`);
  if (!b.up(c)) return;
  const p2 = plan(b, c, {});
  if (p2 && p2.total > 0 && p2.opt.kind !== 'dodge') { runAction(b, c, p2); return; }
  if (T.action && (c.p.aggression > 0.25 || !ranged)) {
    T.action = false; T.move += b.speedOf(c);
    const R2 = b.reach(c, 80);
    const rest = b.pathTo(R2, best.ci);
    b.log(`${c.name} dashes`);
    b.walk(c, rest);
  }
}

// ---------------------------------------------------------------- the turn
export function takeTurn(b, c) {
  const T = c.turn;
  const P = c.p;
  let A = plan(b, c, {});
  // a leveled action spell forbids a leveled bonus spell; check whether the bonus would be worth more
  if (A && A.opt.leveled) {
    const bs = bonusSpellPlan(b, c, cx(A.ci), cy(A.ci));
    if (bs && bs.v > 6) {
      const A0 = plan(b, c, { noLeveled: true });
      if (A0 && A0.total + bs.v > A.total) A = A0;
    }
  }
  if (!A || (A.opt.kind === 'dodge' && A.total < 1 && P.aggression > 0.3)) {
    preActionBonus(b, c, null);
    approach(b, c);
    postActionBonus(b, c);
    retreat(b, c);
    return;
  }
  if (A.opt.kind === 'dash') {
    T.action = false; T.move += b.speedOf(c);
    b.log(`${c.name} dashes in`);
    b.moveTo(c, A.ci);
    preActionBonus(b, c, null);
    postActionBonus(b, c);
    return;
  }
  // move (cheap disengage if leaving melee)
  const here = c.y * GW + c.x;
  if (A.ci !== here) {
    const leaving = b.enemiesOf(c).some((e) => b.dist(e, c) <= 1 && cheb(e.x, e.y, cx(A.ci), cy(A.ci)) > 1);
    let dis = false;
    if (leaving && canDisengageCheap(b, c)) {
      dis = true; T.bonus = false;
      if (!c.s.feats.has('cunningAction')) c.res.ki--;
      b.log(`${c.name} disengages`);
    }
    b.moveTo(c, A.ci, { disengage: dis });
  }
  if (!b.up(c) || !b.canAct(c)) return;
  // sorcerer: quicken the big spell, then still get a cantrip with the action
  if (A.opt.leveled && A.opt.sp && A.opt.sp.cast === 'action' && c.s.feats.has('quickenedSpell') && c.res.sp >= 2 && T.bonus) {
    c.res.sp -= 2; T.bonus = false; b.log(`${c.name} quickens the spell`);
    runAction(b, c, A);
    T.leveled = false; T.bonusSpell = true; T.action = true;
    if (!b.up(c) || !b.canAct(c) || !b.enemiesOf(c).length) { postActionBonus(b, c); retreat(b, c); return; }
    const A2 = plan(b, c, { noLeveled: true });
    if (A2 && A2.opt.kind !== 'dash') { if (A2.ci !== c.y * GW + c.x) b.moveTo(c, A2.ci); if (b.up(c) && b.canAct(c)) runAction(b, c, A2); }
    retreat(b, c);
    return;
  }
  if (A.opt.kind !== 'spell' || !A.opt.leveled) preActionBonus(b, c, A);
  // targets might have moved/died during our walk (opportunity attacks); re-plan in place if so
  if (A.t && (A.t.dead || (A.t.hp === 0 && A.opt.tgt === 'enemy' && P.ruthless < 0.15))) {
    const again = plan(b, c, {}); if (again) A = again;
  }
  runAction(b, c, A);
  // fighter: action surge
  if (b.up(c) && c.res.actionSurge > 0 && b.enemiesOf(c).length && (P.nova > 0.45 || b.round >= 3 || b.enemiesOf(c).some((e) => e.hp < 20))) {
    c.res.actionSurge--; b.log(`${c.name} ACTION SURGE`);
    T.action = true; const A2 = plan(b, c, { noLeveled: true });
    if (A2 && A2.opt.kind !== 'dodge') { if (A2.ci !== c.y * GW + c.x) b.moveTo(c, A2.ci); if (b.up(c)) runAction(b, c, A2); }
  }
  // haste: one extra weapon attack
  if (b.up(c) && c.cond.hasted && b.canAct(c)) {
    const w = c.s.weapons.find((x) => !x.ranged); const wr = c.s.weapons.find((x) => x.ranged);
    let t = pickAdjacent(b, c), use = w;
    if (!t && wr) { t = retarget(b, c, wr); use = wr; }
    if (t) b.weaponAttack(c, t, use, { reckless: wantsReckless(c) && use === w });
  }
  postActionBonus(b, c);
  retreat(b, c);
}

function retreat(b, c) {
  const T = c.turn;
  if (!T || !b.up(c) || !b.canAct(c) || T.move <= 0) return;
  const P = c.p;
  const ranged = RANGED_ROLES.has(c.s.role) || (c.cls === 'rogue' && P.aggression < 0.6);
  const hurt = c.hp < c.maxHp * 0.3 * (0.5 + P.caution);
  if (!ranged && !hurt) return;
  const adj = b.enemiesOf(c).some((e) => b.dist(e, c) <= 1 && e.reaction && b.canAct(e));
  if (adj && T.bonus && c.s.feats.has('cunningAction')) { T.bonus = false; T.disengaged = true; b.log(`${c.name} disengages (Cunning Action)`); }
  const dest = bestRetreatCell(b, c, T.move, false);
  if (dest != null) b.moveTo(c, dest);
  // rogue: hide if nobody can see us clearly
  if (T.bonus && c.s.feats.has('cunningAction') && b.up(c)) {
    const seen = b.enemiesOf(c).filter((e) => b.canAct(e)).some((e) => { const s = b.sight(e.x, e.y, c.x, c.y); return s.los && !s.cover; });
    if (!seen) { T.bonus = false; c.cond.hidden = { ttlBy: c.id, ttl: 1 }; b.log(`${c.name} hides`); }
  }
}

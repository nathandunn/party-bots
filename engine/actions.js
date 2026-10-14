// Actions: weapon attacks, spells, class features. Patched onto Battle.prototype.
import { Battle, cheb, idx, W } from './combat.js';
import { SPELLS } from './spells.js';
import { hitHooks } from './ai.js';

const P = Battle.prototype;

P.rollWeaponDice = function (w, crit) {
  const n = w.dice[0] * (crit ? 2 : 1); let t = 0;
  for (let i = 0; i < n; i++) {
    let r = this.rng.die(w.dice[1]);
    if (w.gwf && r <= 2) r = this.rng.die(w.dice[1]);
    t += r;
  }
  return t;
};

P.sneakOK = function (a, t, adv) {
  if (adv > 0) return true;
  if (adv < 0) return false;
  return this.cs.some((o) => o.team === a.team && o !== a && this.up(o) && this.canAct(o) && this.dist(o, t) <= 1);
};

// one weapon attack. opts.reckless, opts.noMod (off-hand), opts.label
P.weaponAttack = function (a, t, w, opts = {}) {
  if (t.dead) return { hit: false };
  const melee = !w.ranged;
  const reckless = !!(opts.reckless && melee && w.abil === 'str');
  const advPre = this.advOnAttack(a, t, { melee, ranged: !!w.ranged, reckless });
  const r = this.attackRoll(a, t, { bonus: w.hit, melee, ranged: !!w.ranged, critOn: a.s.critOn, reckless, weaponRanged: !!w.ranged });
  a.turn && (a.turn.attacked = true);
  if (this.record) this.fx.push({ k: melee ? 'swing' : 'shot', a: a.id, t: t.id, hit: r.hit });
  if (!r.hit) { this.log(`  ${a.name} ${w.name} → ${t.name}: miss`); return { hit: false }; }
  const parts = [];
  let base = this.rollWeaponDice(w, r.crit) + (opts.noMod ? 0 : w.dmgBonus);
  if (a.raging > 0 && melee && w.abil === 'str') base += 2;
  parts.push([base, w.type]);
  const extra = [];
  if (a.conc && a.conc.mark === t.id) { parts.push([this.rng.dice(r.crit ? 2 : 1, 6), a.conc.spell === 'hex' ? 'necrotic' : w.type]); extra.push(a.conc.spell === 'hex' ? 'hex' : 'mark'); }
  if (a.s.feats.has('colossusSlayer') && a.turn && !a.turn.colossus && t.hp < t.maxHp) {
    a.turn.colossus = true; parts.push([this.rng.dice(r.crit ? 2 : 1, 8), w.type]); extra.push('colossus');
  }
  if (a.s.feats.has('sneakAttack') && a.turn && !a.turn.sneak && (w.finesse || w.ranged) && this.sneakOK(a, t, advPre)) {
    a.turn.sneak = true; parts.push([this.rng.dice(a.s.sneakDice * (r.crit ? 2 : 1), 6), w.type]); extra.push('sneak');
  }
  const hooks = hitHooks(this, a);
  if (melee && hooks.smite) {
    const lvl = hooks.smite(t, r, parts.reduce((s, p) => s + p[0], 0));
    if (lvl) { const used = this.spendSlot(a, lvl); const n = Math.min(5, 1 + used); parts.push([this.rng.dice(n * (r.crit ? 2 : 1), 8), 'radiant']); extra.push(`smite${used}`); }
  }
  const total = parts.reduce((s, p) => s + p[0], 0);
  this.log(`  ${a.name} ${w.name} → ${t.name}: ${r.crit ? 'CRIT ' : ''}${total}${extra.length ? ' (' + extra.join('+') + ')' : ''}`);
  this.damage(a, t, parts, w.type, { crit: r.crit, melee, attack: true, weaponRanged: !!w.ranged });
  if (hooks.afterHit) hooks.afterHit(t, r, w);
  return { hit: true, crit: r.crit };
};

P.opportunity = function (e, c) {
  const w = e.s.weapons.find((x) => !x.ranged);
  if (!w) return;
  e.reaction = false;
  this.log(`  ${e.name} takes an opportunity attack`);
  const saved = e.turn; if (!e.turn) e.turn = { colossus: true, sneak: false };
  this.weaponAttack(e, c, w, {});
  e.turn = saved;
};

// ---------------- spells ----------------
// inArea: creatures (not dead) a spell centred at (x,y) would touch
P.inArea = function (sp, x, y, caster) {
  const a = sp.area; const out = [];
  for (const o of this.cs) {
    if (o.dead || o === caster) continue;
    let inside;
    if (a.round) inside = Math.hypot(o.x - x, o.y - y) <= a.r + 0.5;
    else inside = cheb(o.x, o.y, x, y) <= a.r;
    const lx = Math.max(0, Math.min(23, x)), ly = Math.max(0, Math.min(15, y));
    if (inside && (lx === o.x && ly === o.y || this.los(lx, ly, o.x, o.y))) out.push(o);
  }
  return out;
};

// thunderwave: 15-ft cube on one side of the caster -> centre 2 cells out, radius 1
P.cubeCentre = function (c, dir) { return [c.x + dir[0] * 2, c.y + dir[1] * 2]; };

P.cast = function (c, id, o = {}) {
  const sp = SPELLS[id];
  let lvl = sp.lvl;
  if (sp.lvl > 0 && !o.free) {
    lvl = this.spendSlot(c, o.slot || sp.lvl);
    if (!lvl) return false;
    if (sp.cast === 'bonus') c.turn.bonusSpell = true; else c.turn.leveled = true;
  }
  if (!o.free) c.st.spells++;
  const up = lvl - sp.lvl;
  const dc = c.s.spellDC;
  if (sp.conc && !o.free) this.startConc(c, id, { lvl });
  const label = `${c.name} casts ${sp.name}${sp.lvl && up > 0 ? ` (L${lvl})` : ''}`;

  switch (sp.kind) {
    case 'attack': {
      const rays = (sp.rays || 1) + up * (sp.upRays || 0);
      const n = sp.dice[0] + up * (sp.upDice || 0);
      this.log(label);
      for (let i = 0; i < rays; i++) {
        let t = (o.targets && o.targets[i]) || o.target;
        if (!t || t.dead || (t.hp === 0 && t !== o.target)) t = this.fallbackTarget(c, sp.range);
        if (!t) continue;
        const r = this.attackRoll(c, t, { bonus: c.s.spellHit, spell: true });
        if (this.record) this.fx.push({ k: 'bolt', a: c.id, t: t.id, hit: r.hit, spell: id });
        if (!r.hit) { this.log(`  → ${t.name}: miss`); continue; }
        const parts = [[this.rng.dice(n * (r.crit ? 2 : 1), sp.dice[1]) + (sp.addMod ? c.s.castMod : 0), sp.type]];
        if (c.conc && c.conc.mark === t.id && c.conc.spell === 'hex') parts.push([this.rng.dice(r.crit ? 2 : 1, 6), 'necrotic']);
        this.log(`  → ${t.name}: ${r.crit ? 'CRIT ' : ''}${parts.reduce((s, p) => s + p[0], 0)}`);
        this.damage(c, t, parts, sp.type, { crit: r.crit });
        if (sp.cond === 'guided' && this.up(t)) t.cond.guided = { ttlBy: c.id, ttl: 1 };
      }
      break;
    }
    case 'auto': {
      const darts = sp.darts + up * (sp.upDarts || 0);
      this.log(label);
      const per = new Map();
      for (let i = 0; i < darts; i++) {
        let t = (o.targets && o.targets[i % o.targets.length]) || o.target;
        if (!t || t.dead) t = this.fallbackTarget(c, sp.range); if (!t) continue;
        per.set(t, (per.get(t) || 0) + this.rng.die(4) + 1);
      }
      for (const [t, d] of per) {
        if (t.reaction && this.canAct(t) && this.hasShield(t)) {
          this.spendSlot(t, 1); t.reaction = false; t.cond.shielded = true;
          this.log(`  ${t.name} casts Shield — the missiles fizzle`); continue;
        }
        this.log(`  → ${t.name}: ${d}`);
        if (this.record) this.fx.push({ k: 'bolt', a: c.id, t: t.id, hit: true, spell: id });
        this.damage(c, t, d, sp.type);
      }
      break;
    }
    case 'save': {
      let targets;
      if (sp.area) {
        let x, y;
        if (sp.area.cube) [x, y] = this.cubeCentre(c, o.dir);
        else [x, y] = o.center;
        targets = this.inArea(sp, x, y, c);
        if (c.s.feats.has('sculptSpells')) targets = targets.filter((t) => t.team !== c.team);
        if (sp.recast) c.conc && (c.conc.strike = true);
        this.log(`${label} at (${x},${y})`);
        if (this.record) this.fx.push({ k: 'area', x, y, r: sp.area.r, round: !!sp.area.round, spell: id, team: c.team });
      } else {
        const max = (sp.targets || 1) + up * (sp.upTargets || 0);
        targets = (o.targets || [o.target]).filter(Boolean).slice(0, max);
        this.log(`${label} → ${targets.map((t) => t.name).join(', ')}`);
        if (this.record) for (const t of targets) this.fx.push({ k: 'bolt', a: c.id, t: t.id, hit: true, spell: id });
      }
      const n = sp.dice ? sp.dice[0] + up * (sp.upDice || 0) : 0;
      const dmgRoll = sp.dice ? this.rng.dice(n, sp.dice[1]) : 0; // area spells: one roll for everyone
      let affected = 0;
      for (const t of targets) {
        if (t.dead) continue;
        const cover = sp.ignoreCover ? 0 : this.sight(o.center ? o.center[0] : c.x, o.center ? o.center[1] : c.y, t.x, t.y).cover;
        const ok = this.save(t, sp.abil, dc, cover);
        if (sp.dice) {
          const d = sp.area ? dmgRoll : this.rng.dice(n, sp.dice[1]);
          const amt = ok ? (sp.half ? Math.floor(d / 2) : 0) : d;
          this.log(`  ${t.name} ${ok ? 'saves' : 'fails'}${amt ? ': ' + amt : ''}`);
          if (amt) this.damage(c, t, amt, sp.type);
        } else this.log(`  ${t.name} ${ok ? 'saves' : 'fails'}`);
        if (!ok && this.up(t)) {
          affected++;
          if (sp.push) this.push(c, t, sp.push);
          if (sp.cond === 'mocked') t.cond.mocked = { ttlBy: t.id, ttl: 0 };
          else if (sp.cond === 'flee') this.flee(t, c);
          else if (sp.cond) t.cond[sp.cond] = { by: c.id, conc: true, dc };
        }
      }
      if (sp.conc && sp.noDamage && !affected && c.conc && c.conc.spell === id) this.breakConc(c);
      break;
    }
    case 'heal': {
      const ts = (o.targets || [o.target]).filter(Boolean).slice(0, sp.targets || 1);
      const n = sp.dice[0] + up * (sp.upDice || 0);
      this.log(`${label} → ${ts.map((t) => t.name).join(', ')}`);
      if (this.record) for (const t of ts) this.fx.push({ k: 'heal', a: c.id, t: t.id });
      for (const t of ts) {
        let amt = this.rng.dice(n, sp.dice[1]) + c.s.castMod;
        if (c.s.feats.has('discipleOfLife')) amt += 2 + lvl;
        this.heal(c, t, amt);
      }
      break;
    }
    case 'buff': {
      const max = (sp.targets || 1) + up * (sp.upTargets || 0);
      const ts = (o.targets || [o.target]).filter(Boolean).slice(0, max);
      this.log(`${label} → ${ts.map((t) => t.name).join(', ')}`);
      for (const t of ts) t.cond[sp.cond] = { by: c.id, conc: true };
      break;
    }
    case 'mark': {
      c.conc.mark = o.target.id;
      this.log(`${label} → ${o.target.name}`);
      break;
    }
    case 'weapon': {
      this.log(label);
      c.sw = { x: c.x, y: c.y, left: sp.duration };
      if (o.target) this.spiritStrike(c, o.target);
      break;
    }
    case 'aura': this.log(label); break;
    case 'zone': {
      c.conc.zone = { x: o.center[0], y: o.center[1], r: sp.area.r };
      this.log(`${label} at (${o.center})`);
      break;
    }
    case 'teleport': this.teleport(c, o.center[0], o.center[1]); break;
  }
  return true;
};

P.fallbackTarget = function (c, range) {
  return this.enemiesOf(c).filter((e) => this.dist(e, c) <= range && this.los(c.x, c.y, e.x, e.y)).sort((a, b) => a.hp - b.hp)[0] || null;
};

P.spiritStrike = function (c, t) {
  const sw = c.sw;
  // move up to 20 ft next to the target
  sw.x = t.x + (c.x > t.x ? 1 : c.x < t.x ? -1 : 0); sw.y = t.y + (c.y > t.y ? 1 : c.y < t.y ? -1 : 0);
  const r = this.attackRoll(c, t, { bonus: c.s.spellHit, melee: true, spell: true });
  if (!r.hit) { this.log(`  Spiritual Weapon → ${t.name}: miss`); return; }
  const d = this.rng.dice(r.crit ? 2 : 1, 8) + c.s.castMod;
  this.log(`  Spiritual Weapon → ${t.name}: ${d}`);
  this.damage(c, t, d, 'force', { crit: r.crit, melee: true, attack: true });
};

// dissonant whispers: target spends its reaction running away (provokes)
P.flee = function (t, from) {
  if (!t.reaction) return;
  t.reaction = false;
  const saved = t.turn;
  t.turn = { move: this.speedOf(t), disengaged: false };
  const R = this.reach(t, t.turn.move);
  let best = null, bd = -1;
  for (const ci of R.cells) { const d = cheb(ci % W, (ci / W) | 0, from.x, from.y); if (d > bd) { bd = d; best = ci; } }
  if (best != null) { this.log(`  ${t.name} flees in terror`); this.walk(t, this.pathTo(R, best)); }
  t.turn = saved;
};

export { Battle };

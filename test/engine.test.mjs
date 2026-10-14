// node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle, buildSheet, CLASS_IDS, MAP_IDS, PRESET_IDS, matchup, mono } from '../engine/index.js';
import { makeRng, pAtLeast } from '../engine/dice.js';

test('level-5 sheets match SRD arithmetic', () => {
  const f = buildSheet('fighter');
  assert.equal(f.maxHp, 44); assert.equal(f.ac, 16); assert.equal(f.critOn, 19);
  assert.equal(f.weapons[0].hit, 7); assert.equal(f.weapons[0].dmgBonus, 4);
  const b = buildSheet('barbarian');
  assert.equal(b.maxHp, 50); assert.equal(b.ac, 14); assert.equal(b.speed, 8);
  const w = buildSheet('wizard');
  assert.equal(w.maxHp, 32); assert.equal(w.ac, 15); assert.equal(w.spellDC, 15); assert.equal(w.spellHit, 7);
  const m = buildSheet('monk');
  assert.equal(m.ac, 16); assert.equal(m.spellDC, 13); assert.equal(m.res.ki, 5);
  const s = buildSheet('sorcerer');
  assert.equal(s.maxHp, 37); assert.equal(s.saves.con, 5);
  const r = buildSheet('ranger');
  assert.equal(r.weapons[0].hit, 9); // archery
  const p = buildSheet('paladin');
  assert.equal(p.weapons[0].dmgBonus, 6); // dueling
  for (const id of CLASS_IDS) {
    const sh = buildSheet(id);
    const total = Object.values(sh.abil).reduce((a, v) => a + v, 0);
    assert.equal(total, 16 + 15 + 14 + 13 + 11 + 9 + 2, `${id} ability total`);
  }
});

test('dice probabilities', () => {
  assert.equal(pAtLeast(11, 0, 0, true), 0.5);
  assert.equal(pAtLeast(30, 0, 0, true), 0.05); // nat 20
  assert.equal(pAtLeast(1, 10, 0, true), 0.95); // nat 1 misses
  assert.equal(pAtLeast(11, 0, 1, true), 0.75);
  const r = makeRng(5); let t = 0; for (let i = 0; i < 20000; i++) t += r.die(6);
  assert.ok(Math.abs(t / 20000 - 3.5) < 0.05);
});

test('same seed, same fight', () => {
  const teams = [mono('cleric'), mono('wizard')];
  const a = new Battle({ teams, map: 'ruins', seed: 42 }).run();
  const b = new Battle({ teams, map: 'ruins', seed: 42 }).run();
  assert.deepEqual(a.units.map((u) => [u.hp, u.dmg]), b.units.map((u) => [u.hp, u.dmg]));
  assert.equal(a.winner, b.winner);
});

test('fuzz: random parties on every map finish without errors and with consistent state', () => {
  const r = makeRng(7);
  for (const map of MAP_IDS) for (let k = 0; k < 25; k++) {
    const party = () => Array.from({ length: 1 + r.int(5) }, () => ({ cls: r.pick(CLASS_IDS), personality: r.pick(PRESET_IDS) }));
    const res = new Battle({ teams: [party(), party()], map, seed: k + 1, record: k === 0 }).run();
    assert.ok([-1, 0, 1].includes(res.winner));
    for (const u of res.units) { assert.ok(u.hp >= 0 && u.hp <= u.maxHp); if (u.dead) assert.equal(u.hp, 0); }
    if (res.winner >= 0) assert.ok(res.units.some((u) => u.team === res.winner && u.up));
  }
});

test('big fuzz: 1200 random fights, every class and personality, all maps', () => {
  const r = makeRng(2026);
  for (let k = 0; k < 1200; k++) {
    const party = () => Array.from({ length: 1 + r.int(6) }, () => ({ cls: r.pick(CLASS_IDS), personality: r.pick(PRESET_IDS) }));
    const res = new Battle({ teams: [party(), party()], map: r.pick(MAP_IDS), seed: 1000 + k }).run();
    assert.ok([-1, 0, 1].includes(res.winner));
  }
});

test('regression: druid loses concentration before moving Moonbeam (Holy order vs Classic, forest)', () => {
  // reported from the live site: "Cannot set properties of null (setting 'zone')"
  const holy = ['paladin', 'cleric', 'bard', 'druid'].map((cls) => ({ cls }));
  const classic = ['fighter', 'cleric', 'rogue', 'wizard'].map((cls) => ({ cls }));
  const r = matchup(holy, classic, { map: 'forest', n: 20, seed: 61 });
  assert.equal(r.winsA + r.winsB + r.draws, 20);
});

test('no two creatures ever share a square (400 random recorded fights)', () => {
  const r = makeRng(9);
  for (let k = 0; k < 400; k++) {
    const party = () => Array.from({ length: 2 + r.int(5) }, () => ({ cls: r.pick(CLASS_IDS), personality: r.pick(PRESET_IDS) }));
    const res = new Battle({ teams: [party(), party()], map: r.pick(MAP_IDS), seed: k + 1, record: true }).run();
    for (const f of res.frames) {
      const seen = new Set();
      for (const u of f.units) {
        if (u.dead) continue;
        const key = u.x + ',' + u.y;
        assert.ok(!seen.has(key), `fight ${k + 1} round ${f.round}: two creatures on ${key}`);
        seen.add(key);
      }
    }
  }
});

test('nobody stands in a wall or on another creature', () => {
  for (const map of MAP_IDS) {
    const b = new Battle({ teams: [mono('monk'), mono('barbarian')], map, seed: 3, record: true });
    const res = b.run();
    for (const f of res.frames) {
      const seen = new Set();
      for (const u of f.units) {
        if (u.dead) continue;
        assert.ok(!b.map.blocksMove(u.x, u.y), `${map}: unit in wall at ${u.x},${u.y}`);
        const k = u.x + ',' + u.y;
        if (u.hp > 0) { assert.ok(!seen.has(k), `${map}: two creatures on ${k}`); seen.add(k); }
      }
    }
  }
});

test('matchup aggregates add up', () => {
  const r = matchup(mono('fighter', 2), mono('paladin', 2), { n: 10 });
  assert.equal(r.winsA + r.winsB + r.draws, 10);
});

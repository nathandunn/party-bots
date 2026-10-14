// Level-5 SRD 5.1 (2014 rules) builds. Human (+1 all), standard array, ASI at 4 into the primary stat.
// One SRD subclass per class. Numbers are derived here, not hand-typed, so a rules fix lands everywhere.
export const LEVEL = 5;
export const PROF = 3;
export const mod = (s) => Math.floor((s - 10) / 2);

// ability order: str dex con int wis cha
const A = (str, dex, con, int, wis, cha) => ({ str, dex, con, int, wis, cha });

const W = {
  greataxe:   { name: 'Greataxe', dice: [1, 12], abil: 'str', reach: 1, type: 'slashing', heavy: true },
  greatsword: { name: 'Greatsword', dice: [2, 6], abil: 'str', reach: 1, type: 'slashing', heavy: true },
  longsword:  { name: 'Longsword', dice: [1, 8], abil: 'str', reach: 1, type: 'slashing' },
  mace:       { name: 'Mace', dice: [1, 6], abil: 'str', reach: 1, type: 'bludgeoning' },
  rapier:     { name: 'Rapier', dice: [1, 8], abil: 'dex', reach: 1, type: 'piercing', finesse: true },
  shortsword: { name: 'Shortsword', dice: [1, 6], abil: 'dex', reach: 1, type: 'piercing', finesse: true },
  scimitar:   { name: 'Scimitar', dice: [1, 6], abil: 'dex', reach: 1, type: 'slashing', finesse: true },
  dagger:     { name: 'Dagger', dice: [1, 4], abil: 'dex', reach: 1, type: 'piercing', finesse: true },
  quarterstaff:{ name: 'Quarterstaff', dice: [1, 6], abil: 'str', reach: 1, type: 'bludgeoning' },
  unarmed:    { name: 'Unarmed', dice: [1, 6], abil: 'dex', reach: 1, type: 'bludgeoning', monk: true },
  longbow:    { name: 'Longbow', dice: [1, 8], abil: 'dex', range: 30, long: 120, type: 'piercing', ranged: true },
  shortbow:   { name: 'Shortbow', dice: [1, 6], abil: 'dex', range: 16, long: 64, type: 'piercing', ranged: true },
  lightxbow:  { name: 'Light crossbow', dice: [1, 8], abil: 'dex', range: 16, long: 64, type: 'piercing', ranged: true },
  javelin:    { name: 'Javelin', dice: [1, 6], abil: 'str', range: 6, long: 24, type: 'piercing', ranged: true, thrown: true },
  dart:       { name: 'Dart', dice: [1, 4], abil: 'dex', range: 4, long: 12, type: 'piercing', ranged: true, thrown: true },
};

// spells: ids from spells.js. slots index = spell level.
export const CLASSES = {
  barbarian: {
    name: 'Barbarian', sub: 'Path of the Berserker', role: 'melee', hd: 12,
    abil: A(18, 14, 15, 9, 13, 11), saves: ['str', 'con'],
    ac: (m) => 10 + m.dex + m.con, speed: 8,
    weapons: ['greataxe', 'javelin'], attacks: 2,
    feats: ['rage', 'reckless', 'frenzy', 'dangerSense'],
    res: { rage: 3 },
  },
  bard: {
    name: 'Bard', sub: 'College of Lore', role: 'support', hd: 8,
    abil: A(9, 15, 14, 11, 13, 18), saves: ['dex', 'cha'], cast: 'cha',
    ac: (m) => 11 + m.dex, speed: 6, // leather
    weapons: ['rapier', 'lightxbow'], attacks: 1,
    feats: ['bardicInspiration', 'cuttingWords'],
    res: { bi: 4 }, biDie: 8,
    cantrips: ['viciousMockery'],
    spells: ['healingWord', 'faerieFire', 'shatter', 'holdPerson', 'hypnoticPattern', 'dissonantWhispers'],
    slots: [0, 4, 3, 2],
  },
  cleric: {
    name: 'Cleric', sub: 'Life Domain', role: 'frontcaster', hd: 8,
    abil: A(14, 11, 15, 9, 18, 13), saves: ['wis', 'cha'], cast: 'wis',
    ac: () => 18, speed: 6, // chain mail + shield
    weapons: ['mace', 'lightxbow'], attacks: 1,
    feats: ['discipleOfLife', 'preserveLife'],
    res: { channel: 1 },
    cantrips: ['sacredFlame'],
    spells: ['bless', 'cureWounds', 'healingWord', 'guidingBolt', 'spiritualWeapon', 'holdPerson', 'spiritGuardians', 'massHealingWord'],
    slots: [0, 4, 3, 2],
  },
  druid: {
    name: 'Druid', sub: 'Circle of the Land (Grassland)', role: 'caster', hd: 8,
    abil: A(9, 14, 15, 13, 18, 11), saves: ['int', 'wis'], cast: 'wis',
    ac: (m) => 12 + Math.min(2, m.dex) + 2, speed: 6, // hide + shield
    weapons: ['scimitar'], attacks: 1,
    feats: [],
    cantrips: ['produceFlame'],
    spells: ['healingWord', 'entangle', 'thunderwave', 'moonbeam', 'haste', 'callLightning'],
    slots: [0, 4, 3, 2],
  },
  fighter: {
    name: 'Fighter', sub: 'Champion', role: 'melee', hd: 10,
    abil: A(18, 14, 15, 9, 13, 11), saves: ['str', 'con'],
    ac: () => 16, speed: 6, // chain mail
    weapons: ['greatsword', 'javelin'], attacks: 2, gwf: true,
    feats: ['secondWind', 'actionSurge', 'improvedCritical'],
    res: { secondWind: 1, actionSurge: 1 }, critOn: 19,
  },
  monk: {
    name: 'Monk', sub: 'Way of the Open Hand', role: 'skirmisher', hd: 8,
    abil: A(9, 18, 14, 11, 15, 13), saves: ['str', 'dex'],
    ac: (m) => 10 + m.dex + m.wis, speed: 8,
    weapons: ['shortsword', 'dart'], attacks: 2,
    feats: ['martialArts', 'flurry', 'stunningStrike', 'deflectMissiles', 'openHand', 'patientDefense', 'stepOfTheWind'],
    res: { ki: 5 }, kiDC: true,
  },
  paladin: {
    name: 'Paladin', sub: 'Oath of Devotion', role: 'melee', hd: 10,
    abil: A(18, 11, 14, 9, 13, 15), saves: ['wis', 'cha'], cast: 'cha',
    ac: () => 18, speed: 6, // chain + shield, Dueling style
    weapons: ['longsword', 'javelin'], attacks: 2, dueling: true,
    feats: ['divineSmite', 'layOnHands'],
    res: { layOnHands: 25 },
    spells: ['bless', 'cureWounds'],
    slots: [0, 4, 2],
  },
  ranger: {
    name: 'Ranger', sub: 'Hunter', role: 'ranged', hd: 10,
    abil: A(13, 18, 15, 9, 14, 11), saves: ['str', 'dex'], cast: 'wis',
    ac: (m) => 12 + m.dex, speed: 6, // studded leather
    weapons: ['longbow', 'shortsword'], attacks: 2, archery: true,
    feats: ['colossusSlayer'],
    spells: ['huntersMark', 'cureWounds'],
    slots: [0, 4, 2],
  },
  rogue: {
    name: 'Rogue', sub: 'Thief', role: 'skirmisher', hd: 8,
    abil: A(9, 18, 15, 13, 14, 11), saves: ['dex', 'int'],
    ac: (m) => 12 + m.dex, speed: 6,
    weapons: ['shortbow', 'rapier'], attacks: 1,
    feats: ['sneakAttack', 'cunningAction', 'uncannyDodge'], sneakDice: 3,
  },
  sorcerer: {
    name: 'Sorcerer', sub: 'Draconic Bloodline (Red)', role: 'caster', hd: 6, hpBonus: 5,
    abil: A(9, 14, 15, 11, 13, 18), saves: ['con', 'cha'], cast: 'cha',
    ac: (m) => 13 + m.dex, speed: 6, // draconic resilience
    weapons: ['dagger', 'lightxbow'], attacks: 1,
    feats: ['quickenedSpell', 'shield'],
    res: { sp: 5 },
    cantrips: ['fireBolt'],
    spells: ['magicMissile', 'shield', 'scorchingRay', 'mistyStep', 'holdPerson', 'fireball'],
    slots: [0, 4, 3, 2],
  },
  warlock: {
    name: 'Warlock', sub: 'The Fiend', role: 'caster', hd: 8,
    abil: A(9, 14, 15, 11, 13, 18), saves: ['wis', 'cha'], cast: 'cha',
    ac: (m) => 13 + m.dex, speed: 6, // Armor of Shadows (mage armor at will)
    weapons: ['dagger', 'lightxbow'], attacks: 1,
    feats: ['darkOnesBlessing', 'agonizingBlast'],
    cantrips: ['eldritchBlast'],
    spells: ['hex', 'holdPerson', 'fireball'],
    pact: { slots: 2, level: 3 },
  },
  wizard: {
    name: 'Wizard', sub: 'School of Evocation', role: 'caster', hd: 6,
    abil: A(9, 14, 15, 18, 13, 11), saves: ['int', 'wis'], cast: 'int',
    ac: (m) => 13 + m.dex, speed: 6, // mage armor cast before the fight (slot spent)
    weapons: ['quarterstaff', 'lightxbow'], attacks: 1,
    feats: ['sculptSpells', 'shield'],
    cantrips: ['fireBolt'],
    spells: ['magicMissile', 'shield', 'scorchingRay', 'mistyStep', 'holdPerson', 'fireball'],
    slots: [0, 3, 3, 2], // one 1st spent on mage armor
  },
};
export const CLASS_IDS = Object.keys(CLASSES);

export function buildSheet(clsId) {
  const C = CLASSES[clsId];
  if (!C) throw new Error('unknown class ' + clsId);
  const m = {};
  for (const k in C.abil) m[k] = mod(C.abil[k]);
  const hpAvg = Math.floor(C.hd / 2) + 1;
  const maxHp = C.hd + m.con + (LEVEL - 1) * (hpAvg + m.con) + (C.hpBonus || 0);
  const saves = {};
  for (const k in m) saves[k] = m[k] + (C.saves.includes(k) ? PROF : 0);
  const weapons = C.weapons.map((w) => {
    const base = W[w];
    let abil = base.abil;
    if (base.finesse || base.monk) abil = m.dex >= m.str ? 'dex' : 'str';
    if (clsId === 'monk' && !base.ranged) abil = 'dex';
    let hit = m[abil] + PROF;
    if (base.ranged && C.archery) hit += 2;
    let dmgBonus = m[abil];
    if (C.dueling && !base.ranged && !base.heavy) dmgBonus += 2;
    let dice = base.dice;
    if (clsId === 'monk' && !base.ranged) dice = [1, Math.max(6, base.dice[1])]; // martial arts d6 at 5
    return { id: w, ...base, dice, hit, dmgBonus, gwf: !!(C.gwf && base.heavy) };
  });
  const castMod = C.cast ? m[C.cast] : 0;
  return {
    cls: clsId, name: C.name, sub: C.sub, role: C.role,
    abil: { ...C.abil }, mods: m, saves, ac: C.ac(m), maxHp, speed: C.speed,
    weapons, attacks: C.attacks, feats: new Set(C.feats || []), critOn: C.critOn || 20,
    spellDC: C.cast ? 8 + PROF + castMod : 8 + PROF + m.wis, // monk ki DC uses wis
    spellHit: PROF + castMod, castMod,
    cantrips: C.cantrips || [], spells: C.spells || [],
    slots: C.slots ? [...C.slots] : [0], pact: C.pact ? { ...C.pact } : null,
    res: { ...(C.res || {}) }, biDie: C.biDie || 0, sneakDice: C.sneakDice || 0,
  };
}

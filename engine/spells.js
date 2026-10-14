// SRD 5.1 spells used by the level-5 builds. Ranges/areas in 5-ft cells.
// kind: attack (spell attack rolls), save (saving throw), auto (magic missile), heal, buff, mark,
//       weapon (spiritual weapon), aura (spirit guardians), zone (moonbeam), teleport, shield
// area.r uses Chebyshev distance unless area.round (euclidean, used for fireball's sphere).
export const SPELLS = {
  // cantrips (level-5 scaling baked in)
  fireBolt:       { name: 'Fire Bolt', lvl: 0, cast: 'action', range: 24, kind: 'attack', rays: 1, dice: [2, 10], type: 'fire' },
  eldritchBlast:  { name: 'Eldritch Blast', lvl: 0, cast: 'action', range: 24, kind: 'attack', rays: 2, dice: [1, 10], type: 'force', addMod: true },
  produceFlame:   { name: 'Produce Flame', lvl: 0, cast: 'action', range: 6, kind: 'attack', rays: 1, dice: [2, 8], type: 'fire' },
  sacredFlame:    { name: 'Sacred Flame', lvl: 0, cast: 'action', range: 12, kind: 'save', abil: 'dex', dice: [2, 8], type: 'radiant', half: false, ignoreCover: true },
  viciousMockery: { name: 'Vicious Mockery', lvl: 0, cast: 'action', range: 12, kind: 'save', abil: 'wis', dice: [2, 4], type: 'psychic', half: false, cond: 'mocked' },

  // 1st
  magicMissile:   { name: 'Magic Missile', lvl: 1, cast: 'action', range: 24, kind: 'auto', darts: 3, dice: [1, 4], plus: 1, type: 'force', upDarts: 1 },
  shield:         { name: 'Shield', lvl: 1, cast: 'reaction', kind: 'shield' },
  guidingBolt:    { name: 'Guiding Bolt', lvl: 1, cast: 'action', range: 24, kind: 'attack', rays: 1, dice: [4, 6], type: 'radiant', upDice: 1, cond: 'guided' },
  healingWord:    { name: 'Healing Word', lvl: 1, cast: 'bonus', range: 12, kind: 'heal', dice: [1, 4], upDice: 1, targets: 1 },
  cureWounds:     { name: 'Cure Wounds', lvl: 1, cast: 'action', range: 1, kind: 'heal', dice: [1, 8], upDice: 1, targets: 1 },
  bless:          { name: 'Bless', lvl: 1, cast: 'action', range: 6, kind: 'buff', conc: true, cond: 'blessed', targets: 3, upTargets: 1 },
  faerieFire:     { name: 'Faerie Fire', lvl: 1, cast: 'action', range: 12, kind: 'save', conc: true, abil: 'dex', area: { r: 2 }, cond: 'faerie', noDamage: true },
  entangle:       { name: 'Entangle', lvl: 1, cast: 'action', range: 18, kind: 'save', conc: true, abil: 'str', area: { r: 2 }, cond: 'restrained', noDamage: true },
  thunderwave:    { name: 'Thunderwave', lvl: 1, cast: 'action', range: 0, kind: 'save', abil: 'con', dice: [2, 8], type: 'thunder', half: true, area: { cube: true, r: 1 }, push: 2, upDice: 1 },
  dissonantWhispers: { name: 'Dissonant Whispers', lvl: 1, cast: 'action', range: 12, kind: 'save', abil: 'wis', dice: [3, 6], type: 'psychic', half: true, cond: 'flee', upDice: 1 },
  huntersMark:    { name: "Hunter's Mark", lvl: 1, cast: 'bonus', range: 18, kind: 'mark', conc: true, dice: [1, 6] },
  hex:            { name: 'Hex', lvl: 1, cast: 'bonus', range: 18, kind: 'mark', conc: true, dice: [1, 6] },

  // 2nd
  spiritualWeapon:{ name: 'Spiritual Weapon', lvl: 2, cast: 'bonus', range: 12, kind: 'weapon', dice: [1, 8], type: 'force', duration: 10 },
  scorchingRay:   { name: 'Scorching Ray', lvl: 2, cast: 'action', range: 24, kind: 'attack', rays: 3, dice: [2, 6], type: 'fire', upRays: 1 },
  holdPerson:     { name: 'Hold Person', lvl: 2, cast: 'action', range: 12, kind: 'save', conc: true, abil: 'wis', cond: 'paralyzed', noDamage: true, targets: 1, upTargets: 1, repeatSave: true },
  mistyStep:      { name: 'Misty Step', lvl: 2, cast: 'bonus', range: 6, kind: 'teleport' },
  shatter:        { name: 'Shatter', lvl: 2, cast: 'action', range: 12, kind: 'save', abil: 'con', dice: [3, 8], type: 'thunder', half: true, area: { r: 2, round: true }, upDice: 1 },
  moonbeam:       { name: 'Moonbeam', lvl: 2, cast: 'action', range: 24, kind: 'zone', conc: true, abil: 'con', dice: [2, 10], type: 'radiant', half: true, area: { r: 1 }, upDice: 1 },

  // 3rd
  fireball:       { name: 'Fireball', lvl: 3, cast: 'action', range: 30, kind: 'save', abil: 'dex', dice: [8, 6], type: 'fire', half: true, area: { r: 4, round: true }, upDice: 1 },
  spiritGuardians:{ name: 'Spirit Guardians', lvl: 3, cast: 'action', range: 0, kind: 'aura', conc: true, abil: 'wis', dice: [3, 8], type: 'radiant', half: true, area: { r: 3 }, upDice: 1 },
  hypnoticPattern:{ name: 'Hypnotic Pattern', lvl: 3, cast: 'action', range: 24, kind: 'save', conc: true, abil: 'wis', cond: 'hypnotized', noDamage: true, area: { r: 2 } },
  callLightning:  { name: 'Call Lightning', lvl: 3, cast: 'action', range: 24, kind: 'save', conc: true, abil: 'dex', dice: [3, 10], type: 'lightning', half: true, area: { r: 1 }, recast: true, upDice: 1 },
  massHealingWord:{ name: 'Mass Healing Word', lvl: 3, cast: 'bonus', range: 12, kind: 'heal', dice: [1, 4], targets: 6 },
  haste:          { name: 'Haste', lvl: 3, cast: 'action', range: 6, kind: 'buff', conc: true, cond: 'hasted', targets: 1 },
};

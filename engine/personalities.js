// Personalities are policies, not stats. Every class can wear any of them.
// All traits are 0..1. target picks whose death matters most.
export const TRAITS = {
  aggression: 'Closes distance, dashes in, takes opportunity attacks to get a swing.',
  caution:    'Weighs danger: avoids being flanked, kites, retreats and heals itself when low.',
  focus:      'Piles onto the team\'s chosen target and prizes kill shots over spreading damage.',
  teamwork:   'Heals, buffs and revives allies instead of dealing its own damage.',
  nova:       'Burns spell slots, smites, ki and surges early instead of saving them.',
  ruthless:   'Keeps hitting downed enemies so they cannot be healed back up.',
  randomness: 'Noise on every decision. 0 = machine, 1 = chaos.',
};
export const TARGET_MODES = {
  threat: 'Highest expected damage output',
  weakest: 'Lowest remaining hit points',
  nearest: 'Whoever is closest',
  squishy: 'Low AC, low max HP — the casters',
};

export const PRESETS = {
  balanced:  { name: 'Balanced',  aggression: .5,  caution: .5,  focus: .5,  teamwork: .5,  nova: .5,  ruthless: .2, randomness: .1,  target: 'threat',  blurb: 'Plays it by the book.' },
  berserker: { name: 'Berserker', aggression: .95, caution: .05, focus: .3,  teamwork: .15, nova: .95, ruthless: .5, randomness: .15, target: 'nearest', blurb: 'Charges the closest thing and spends everything now.' },
  tactician: { name: 'Tactician', aggression: .6,  caution: .5,  focus: .95, teamwork: .6,  nova: .65, ruthless: .7, randomness: .05, target: 'threat',  blurb: 'Focus fire on the biggest threat, finish it off.' },
  guardian:  { name: 'Guardian',  aggression: .4,  caution: .6,  focus: .5,  teamwork: .95, nova: .4,  ruthless: .1, randomness: .1,  target: 'threat',  blurb: 'Keeps the party alive first, kills second.' },
  coward:    { name: 'Coward',    aggression: .1,  caution: .95, focus: .4,  teamwork: .3,  nova: .3,  ruthless: .1, randomness: .1,  target: 'nearest', blurb: 'Hangs back, kites, bolts when hurt.' },
  assassin:  { name: 'Assassin',  aggression: .7,  caution: .4,  focus: .85, teamwork: .15, nova: .8,  ruthless: .95, randomness: .1, target: 'squishy', blurb: 'Hunts the casters and makes sure they stay down.' },
  hoarder:   { name: 'Hoarder',   aggression: .5,  caution: .5,  focus: .5,  teamwork: .5,  nova: .05, ruthless: .2, randomness: .1,  target: 'weakest', blurb: 'Saves every slot for a better moment that never comes.' },
  wildcard:  { name: 'Wildcard',  aggression: .6,  caution: .4,  focus: .3,  teamwork: .4,  nova: .6,  ruthless: .4, randomness: .6,  target: 'nearest', blurb: 'Anything could happen.' },
};
export const PRESET_IDS = Object.keys(PRESETS);

export function resolvePersonality(p) {
  if (!p) return { id: 'balanced', ...PRESETS.balanced };
  if (typeof p === 'string') {
    if (!PRESETS[p]) throw new Error('unknown personality ' + p);
    return { id: p, ...PRESETS[p] };
  }
  return { id: p.id || 'custom', ...PRESETS.balanced, ...p };
}

// Loop-bibliotek. Alle melodiske loops er i C-dur pentatonisk (C D E G A),
// saa alt lyder godt sammen uanset hvad Charlie kombinerer.

export const CATEGORIES = [
  { id: 'drums', name: 'Trommer', emoji: '🥁', color: '#ff5a5f' },
  { id: 'perc',  name: 'Percussion', emoji: '🪘', color: '#ffb400' },
  { id: 'bass',  name: 'Bas', emoji: '🐘', color: '#3aa0ff' },
  { id: 'synth', name: 'Synth', emoji: '🚀', color: '#b06cff' },
  { id: 'keys',  name: 'Keys', emoji: '🎹', color: '#2fd06f' },
  { id: 'horns', name: 'Horns', emoji: '🎺', color: '#ff8a3d' },
  { id: 'vokal', name: 'Vokal', emoji: '🎤', color: '#4dd6c1' },
  { id: 'fx',    name: 'Sjov', emoji: '🦄', color: '#ff5ad0' },
  { id: 'mine',  name: 'Mine Lyde', emoji: '⭐', color: '#ffd23f' },
];

// trommemønster: 16 tegn pr. takt (16.-dele). x = haardt, o = bloedt
function D(id, name, emoji, steps, takts = 1) {
  const events = [];
  for (const [inst, pat] of Object.entries(steps)) {
    const p = pat.replace(/ /g, '');
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === '.') continue;
      events.push({ t: i / 4, inst, dur: 0.25, vel: c === 'x' ? 1 : 0.55 });
    }
  }
  return { id, name, emoji, cat: 'drums', takts, events };
}
// tonemønster: [t (slag), midi eller [midi..], varighed i slag, evt. styrke]
function N(id, name, emoji, cat, inst, takts, notes) {
  const events = [];
  for (const [t, m, dur, vel] of notes) {
    for (const mm of Array.isArray(m) ? m : [m]) {
      events.push({ t, inst, midi: mm, dur, vel: vel ?? 0.9 });
    }
  }
  return { id, name, emoji, cat, takts, events };
}
function P(id, name, emoji, steps, takts = 1) {
  const l = D(id, name, emoji, steps, takts);
  l.cat = 'perc';
  return l;
}

// toner: C2=36 C3=48 C4=60 C5=72 · pentatonisk: +0 +2 +4 +7 +9
const C2 = 36, D2 = 38, E2 = 40, G2 = 43, A2 = 45;
const C3 = 48, D3 = 50, E3 = 52, G3 = 55, A3 = 57;
const C4 = 60, D4 = 62, E4 = 64, G4 = 67, A4 = 69;
const C5 = 72, D5 = 74, E5 = 76, G5 = 79, A5 = 81;
// akkorder (C-dur / a-mol / F-dur / G-dur)
const chC = [C3, E3, G3], chAm = [A2, C3, E3], chF = [A2, C3, 53], chG = [G2, 47, D3];
const chC4 = [C4, E4, G4], chAm4 = [A3, C4, E4], chF4 = [A3, C4, 65], chG4 = [G3, 59, D4];

export const LOOPS = [
  // ------------------- TROMMER -------------------
  D('dr_rock', 'Rock Beat', '🤘', {
    kick: 'x......x..x.....', snare: '....x.......x...', hatC: 'x.x.x.x.x.x.x.x.' }),
  D('dr_disco', 'Disco Beat', '🪩', {
    kick: 'x...x...x...x...', snare: '....x.......x...', hatC: 'x.o.x.o.x.o.x.o.', hatO: '..x...x...x...x.' }),
  D('dr_hiphop', 'Hip Hop', '🧢', {
    kick: 'x.....x...x...x.', snare: '....x.......x...', hatC: 'x.x.x.x.x.x.x.x.' }),
  D('dr_techno', 'Techno', '🤖', {
    kick808: 'x...x...x...x...', clap: '....x.......x...', hatO: '..x...x...x...x.' }),
  D('dr_reggaeton', 'Reggaeton', '🌴', {
    kick: 'x...x...x...x...', snare2: '...x..x....x..x.', hatC: 'x.x.x.x.x.x.x.x.' }),
  D('dr_trap', 'Trap', '💎', {
    kick808: 'x.....x.....x...', snare2: '....x.......x...',
    hatC: 'x.xxx.x.xxxxx.x.' }),
  D('dr_march', 'March', '🥾', {
    kick: 'x...x...x...x...', snare: 'x.o.x.o.x.oox.o.' }),
  D('dr_boomBap', 'Boom Bap', '📦', {
    kick: 'x..x......x..x..', snare: '....x.......x...', hatC: 'x.x.x.x.x.x.x.x.', hatO: '..............x.' }),
  D('dr_fast', 'Hurtig Beat', '🏎️', {
    kick: 'x.....x...x.....', snare: '....x..x....x...', hatC: 'xxxxxxxxxxxxxxxx' }),
  D('dr_klap', 'Klap Beat', '👏', {
    clap: 'x...x...x..xx...', kick: 'x.......x.......' }),
  D('dr_kick', 'Kun Stortromme', '👟', {
    kick: 'x...x...x...x...' }),
  D('dr_hats', 'Hi-hat Groove', '🎩', {
    hatC: 'x.o.xoo.x.o.xoo.', hatO: '......x.......x.' }),
  D('dr_808', '808 Beat', '🔊', {
    kick808: 'x......x.x......', snare2: '....x.......x...', hatC: 'x.xox.xox.xox.xo' }),
  D('dr_sving', 'Sving Beat', '🎷', {
    kick: 'x.....x.x.....x.', ride: 'x..ox..ox..ox..o', hatC: '....x.......x...' }),
  D('dr_elektro', 'Elektro', '⚡', {
    kick: 'x..x..x...x..x..', clap: '....x.......x...', hatC: '..x...x...x...x.' }),
  D('dr_stomp', 'Trampe Beat', '🦶', {
    kick: 'x.x.....x.x.....', clap: '....x.......x...', tomL: '......x.......xo' }),
  D('dr_fill', 'Beat med Fill', '🌟', {
    kick: 'x......x..x.....x......x..x.....x......x..x.....x......x..x.....'.slice(0, 64),
    snare: '....x.......x.......x.......x.......x.......x.......x...xoxoxxxx',
    hatC: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x........',
    crash: '................................................................'.slice(0, 63) + 'x' }, 4),
  D('dr_fest', 'Fest Beat', '🎉', {
    kick: 'x...x...x...x...', snare: '....x.......x...', hatO: '..x...x...x...x.',
    clap: '....x.......x...', cowbell: 'x.....x...x.....' }),

  // ------------------- PERCUSSION -------------------
  P('pc_shaker', 'Shaker', '🧂', { shaker: 'x.oox.oox.oox.oo' }),
  P('pc_tamb', 'Tamburin', '🛎️', { tamb: '..x...x...x...x.' }),
  P('pc_conga', 'Conga Groove', '🪘', { conga: 'x..o..x.o..x..o.', bongo: '..x......x....x.' }),
  P('pc_bongo', 'Bongo Trold', '🐒', { bongo: 'x.xo.x.ox.xo.x.o' }),
  P('pc_cowbell', 'Koklokke', '🐄', { cowbell: 'x...x...x...x...' }),
  P('pc_woodblock', 'Træklods', '🪵', { woodblock: 'x..x..x...x.x...' }),
  P('pc_clave', 'Clave', '🥢', { clave: 'x..x..x...x.x...' }),
  P('pc_triangle', 'Trekant', '🔺', { triangle: 'x.......x.......' }),
  P('pc_cabasa', 'Cabasa', '🌾', { cabasa: 'x.xox.xox.xox.xo' }),
  P('pc_toms', 'Tam-tam Groove', '🛢️', { tomL: 'x.....x.....x...', tomM: '..x.....x.......', tomH: '....x......x..x.' }),
  P('pc_timbale', 'Tromme Trold', '🦁', { tomH: 'x.x...x.x...x.x.', rim: '..x..x....x..x..' }),
  P('pc_party', 'Percussion Fest', '🎊', {
    shaker: 'x.oox.oox.oox.oox.oox.oox.oox.oox.oox.oox.oox.oox.oox.oox.oox.oo',
    conga: 'x..o..x.o..x..o.x..o..x.o..x..o.x..o..x.o..x..o.x..o..x.o..x..o.',
    cowbell: '............................x...........................x...x..',
    triangle: 'x...............x...............x...............x...............'.slice(0, 64) }, 4),

  // ------------------- BAS -------------------
  N('bs_dyb', 'Dyb Bas', '🐋', 'bass', 'sub', 1,
    [[0, C2, 1.6], [2, C2, 0.8], [3, G2, 0.8]]),
  N('bs_hop', 'Hoppebas', '🐰', 'bass', 'sawbass', 1,
    [[0, C2, 0.4], [0.5, C3, 0.4], [1, C2, 0.4], [1.5, C3, 0.4], [2, A2, 0.4], [2.5, A3 - 12, 0.4], [3, G2, 0.4], [3.5, G3 - 12, 0.4]]),
  N('bs_acid', 'Syre Bas', '🍋', 'bass', 'acid', 1,
    [[0, C2, 0.3], [0.75, C2, 0.2], [1.5, E2, 0.3], [2, G2, 0.3], [2.75, G2, 0.2], [3.5, A2, 0.4]]),
  N('bs_funk', 'Funky Bas', '🕺', 'bass', 'fmbass', 1,
    [[0, C2, 0.3], [0.5, C2, 0.15], [1, E2, 0.3], [1.75, G2, 0.2], [2.5, C3, 0.3], [3, A2, 0.3], [3.5, G2, 0.4]]),
  N('bs_gang', 'Gåtur Bas', '🚶', 'bass', 'sub', 4, [
    [0, C2, 0.9], [1, D2, 0.9], [2, E2, 0.9], [3, G2, 0.9],
    [4, A2, 0.9], [5, G2, 0.9], [6, E2, 0.9], [7, D2, 0.9],
    [8, C2, 0.9], [9, E2, 0.9], [10, G2, 0.9], [11, A2, 0.9],
    [12, G2, 0.9], [13, E2, 0.9], [14, D2, 0.9], [15, C2, 0.9]]),
  N('bs_wobble', 'Wobble Bas', '🐙', 'bass', 'wobble', 1,
    [[0, C2, 1.9], [2, A2 - 12, 1.9]]),
  N('bs_puls', 'Puls Bas', '💓', 'bass', 'sawbass', 1,
    [[0, C2, 0.4], [0.5, C2, 0.4], [1, C2, 0.4], [1.5, C2, 0.4], [2, C2, 0.4], [2.5, C2, 0.4], [3, C2, 0.4], [3.5, C2, 0.4]]),
  N('bs_disco', 'Disco Bas', '🕶️', 'bass', 'sawbass', 4, [
    [0, C2, 0.4], [0.5, C3, 0.4], [1, C2, 0.4], [1.5, C3, 0.4], [2, C2, 0.4], [2.5, C3, 0.4], [3, C2, 0.4], [3.5, C3, 0.4],
    [4, A2 - 12, 0.4], [4.5, A2, 0.4], [5, A2 - 12, 0.4], [5.5, A2, 0.4], [6, A2 - 12, 0.4], [6.5, A2, 0.4], [7, A2 - 12, 0.4], [7.5, A2, 0.4],
    [8, 41, 0.4], [8.5, 53, 0.4], [9, 41, 0.4], [9.5, 53, 0.4], [10, 41, 0.4], [10.5, 53, 0.4], [11, 41, 0.4], [11.5, 53, 0.4],
    [12, G2 - 12, 0.4], [12.5, G2, 0.4], [13, G2 - 12, 0.4], [13.5, G2, 0.4], [14, G2 - 12, 0.4], [14.5, G2, 0.4], [15, G2 - 12, 0.4], [15.5, G2, 0.4]]),
  N('bs_reggae', 'Reggae Bas', '🦜', 'bass', 'sub', 1,
    [[0.5, C2, 0.6], [1.5, C2, 0.4], [2.5, G2, 0.6], [3.5, E2, 0.4]]),
  N('bs_drone', 'Kæmpe Sub', '🐳', 'bass', 'sub', 1,
    [[0, C2 - 12, 3.9]]),
  N('bs_melodi', 'Bas Melodi', '🎵', 'bass', 'fmbass', 4, [
    [0, C2, 0.7], [1, E2, 0.7], [2, G2, 0.7], [3, E2, 0.7],
    [4, A2, 0.7], [5, G2, 0.7], [6, E2, 0.7], [7, D2, 0.7],
    [8, C2, 0.7], [9, E2, 0.7], [10, G2, 0.7], [11, C3, 0.7],
    [12, A2, 0.7], [13, G2, 0.7], [14, D2, 0.7], [15, C2, 1.4]]),
  N('bs_oktav', 'Oktav Hop', '🦘', 'bass', 'fmbass', 1,
    [[0, C2, 0.2], [0.25, C3, 0.2], [1, C2, 0.2], [1.25, C3, 0.2], [2, C2, 0.2], [2.25, C3, 0.2], [3, C2, 0.2], [3.25, C3, 0.2], [3.75, G2, 0.2]]),

  // ------------------- SYNTH -------------------
  N('sy_arp_op', 'Arp Op', '🪜', 'synth', 'pluck', 1,
    [[0, C4, 0.25], [0.5, E4, 0.25], [1, G4, 0.25], [1.5, C5, 0.25], [2, E5, 0.25], [2.5, C5, 0.25], [3, G4, 0.25], [3.5, E4, 0.25]]),
  N('sy_arp_hurtig', 'Hurtig Arp', '⚡', 'synth', 'chip', 1,
    [[0, C4, 0.2], [0.25, E4, 0.2], [0.5, G4, 0.2], [0.75, A4, 0.2], [1, C5, 0.2], [1.25, A4, 0.2], [1.5, G4, 0.2], [1.75, E4, 0.2],
     [2, D4, 0.2], [2.25, G4, 0.2], [2.5, A4, 0.2], [2.75, C5, 0.2], [3, D5, 0.2], [3.25, C5, 0.2], [3.5, A4, 0.2], [3.75, G4, 0.2]]),
  N('sy_melodi1', 'Glad Melodi', '😄', 'synth', 'lead', 4, [
    [0, C5, 0.9], [1, D5, 0.9], [2, E5, 1.9],
    [4, G5, 0.9], [5, E5, 0.9], [6, D5, 1.9],
    [8, C5, 0.9], [9, D5, 0.9], [10, E5, 0.9], [11, G5, 0.9],
    [12, A5, 0.9], [13, G5, 0.9], [14, C5, 1.9]]),
  N('sy_melodi2', 'Rum Melodi', '🌌', 'synth', 'squarelead', 4, [
    [0, E5, 1.4], [1.5, D5, 0.4], [2, C5, 1.9],
    [4, A4, 1.4], [5.5, C5, 0.4], [6, D5, 1.9],
    [8, E5, 1.4], [9.5, G5, 0.4], [10, A5, 1.9],
    [12, G5, 0.9], [13, E5, 0.9], [14, D5, 1.9]]),
  N('sy_pluk', 'Pluk Mønster', '🫰', 'synth', 'pluck', 1,
    [[0, G4, 0.3], [0.75, E4, 0.3], [1.5, G4, 0.3], [2, A4, 0.3], [2.75, G4, 0.3], [3.5, E4, 0.3]]),
  N('sy_pad', 'Blød Pude', '☁️', 'synth', 'pad', 4, [
    [0, chC4, 3.8], [4, chAm4, 3.8], [8, chF4, 3.8], [12, chG4, 3.8]]),
  N('sy_pad2', 'Drømme Pude', '💭', 'synth', 'pad', 4, [
    [0, [C4, G4, D5], 7.8], [8, [A3, E4, C5], 7.8]]),
  N('sy_chip', 'Spil Melodi', '👾', 'synth', 'chip', 4, [
    [0, C5, 0.4], [0.5, C5, 0.4], [1, G4, 0.4], [1.5, G4, 0.4], [2, A4, 0.4], [2.5, A4, 0.4], [3, G4, 0.9],
    [4, E5, 0.4], [4.5, E5, 0.4], [5, D5, 0.4], [5.5, D5, 0.4], [6, C5, 0.4], [6.5, C5, 0.4], [7, G4, 0.9],
    [8, C5, 0.4], [8.5, C5, 0.4], [9, G4, 0.4], [9.5, G4, 0.4], [10, A4, 0.4], [10.5, A4, 0.4], [11, G4, 0.9],
    [12, E5, 0.4], [12.5, D5, 0.4], [13, C5, 0.4], [13.5, D5, 0.4], [14, C5, 1.9]]),
  N('sy_stab', 'Synth Stik', '🗡️', 'synth', 'lead', 1,
    [[0, chC4, 0.3], [1.5, chC4, 0.3], [3, chAm4, 0.3]]),
  N('sy_rave', 'Rave Stik', '🔥', 'synth', 'brass', 1,
    [[0, [C4, E4, G4, C5], 0.25], [1, [C4, E4, G4, C5], 0.25], [2.5, [D4, G4, A4, D5], 0.25], [3.25, [D4, G4, A4, D5], 0.25]]),
  N('sy_bounce', 'Hoppe Synth', '🏀', 'synth', 'squarelead', 1,
    [[0, C4, 0.2], [0.5, E4, 0.2], [1, C4, 0.2], [1.5, G4, 0.2], [2, C4, 0.2], [2.5, A4, 0.2], [3, G4, 0.2], [3.5, E4, 0.2]]),
  N('sy_sol', 'Solskin Arp', '🌞', 'synth', 'bell', 1,
    [[0, C5, 0.5], [1, E5, 0.5], [2, G5, 0.5], [3, A5, 0.5]]),
  N('sy_nat', 'Nat Synth', '🌙', 'synth', 'pad', 4, [
    [0, [E4, A4, C5], 3.8], [4, [D4, G4, D5], 3.8], [8, [C4, G4, E5], 3.8], [12, [D4, A4, D5], 3.8]]),
  N('sy_stjerne', 'Stjernedrys', '✨', 'synth', 'bell', 1,
    [[0, C5, 0.4], [0.5, D5, 0.4], [1, E5, 0.4], [1.5, G5, 0.4], [2, A5, 0.4], [2.5, G5, 0.4], [3, E5, 0.4], [3.5, D5, 0.4]]),

  // ------------------- KEYS -------------------
  N('ky_akkord', 'Klaver Akkorder', '🎹', 'keys', 'piano', 4, [
    [0, chC4, 3.5], [4, chAm4, 3.5], [8, chF4, 3.5], [12, chG4, 3.5]]),
  N('ky_hop', 'Hoppe Klaver', '🎪', 'keys', 'piano', 1,
    [[0, chC4, 0.4], [1, chC4, 0.4], [2, chC4, 0.4], [3, chC4, 0.4]]),
  N('ky_melodi', 'Klaver Melodi', '🎼', 'keys', 'piano', 4, [
    [0, E4, 0.9], [1, G4, 0.9], [2, A4, 1.9],
    [4, G4, 0.9], [5, E4, 0.9], [6, C4, 1.9],
    [8, D4, 0.9], [9, E4, 0.9], [10, G4, 0.9], [11, A4, 0.9],
    [12, C5, 0.9], [13, A4, 0.9], [14, G4, 1.9]]),
  N('ky_orgel', 'Orgel Groove', '⛪', 'keys', 'organ', 1,
    [[0, chC, 0.4], [0.75, chC, 0.4], [1.5, chC, 0.4], [2.5, chAm, 0.4], [3.25, chAm, 0.4]]),
  N('ky_orgel_lang', 'Orgel Toner', '🌈', 'keys', 'organ', 4, [
    [0, chC4, 3.8], [4, chF4, 3.8], [8, chAm4, 3.8], [12, chG4, 3.8]]),
  N('ky_epiano', 'Blødt Elklaver', '🧸', 'keys', 'epiano', 4, [
    [0, chC4, 1.8], [2, chC4, 1.8], [4, chAm4, 1.8], [6, chAm4, 1.8],
    [8, chF4, 1.8], [10, chF4, 1.8], [12, chG4, 1.8], [14, chG4, 1.8]]),
  N('ky_marimba', 'Marimba', '🍡', 'keys', 'marimba', 1,
    [[0, C4, 0.4], [0.5, E4, 0.4], [1, G4, 0.4], [1.5, E4, 0.4], [2, A4, 0.4], [2.5, G4, 0.4], [3, E4, 0.4], [3.5, D4, 0.4]]),
  N('ky_spilledaase', 'Spilledåse', '🎁', 'keys', 'bell', 4, [
    [0, C5, 0.9], [1, E5, 0.9], [2, G5, 0.9], [3, E5, 0.9],
    [4, A5, 0.9], [5, G5, 0.9], [6, E5, 0.9], [7, D5, 0.9],
    [8, C5, 0.9], [9, E5, 0.9], [10, G5, 0.9], [11, A5, 0.9],
    [12, G5, 0.9], [13, E5, 0.9], [14, C5, 1.9]]),
  N('ky_boogie', 'Boogie Klaver', '🎩', 'keys', 'piano', 1,
    [[0, C3, 0.4], [0.5, E3, 0.4], [1, G3, 0.4], [1.5, A3, 0.4], [2, 58, 0.4], [2.5, A3, 0.4], [3, G3, 0.4], [3.5, E3, 0.4]]),
  N('ky_oktav', 'Klaver Oktaver', '🦆', 'keys', 'piano', 1,
    [[0, [C4, C5], 0.4], [1, [C4, C5], 0.4], [2, [A3, A4], 0.4], [3, [G3, G4], 0.4]]),

  // ------------------- HORNS -------------------
  N('hn_fanfare', 'Fanfare', '📯', 'horns', 'trumpet', 4, [
    [0, C4, 0.4], [0.5, C4, 0.4], [1, C4, 0.4], [1.5, E4, 0.9], [3, G4, 0.9],
    [4, E4, 0.4], [4.5, G4, 0.4], [5, A4, 1.9],
    [8, C5, 0.9], [9, A4, 0.4], [9.5, G4, 0.4], [10, A4, 0.9], [11, G4, 0.9],
    [12, E4, 0.9], [13, D4, 0.9], [14, C4, 1.9]]),
  N('hn_stik', 'Horn Stik', '🌶️', 'horns', 'brass', 1,
    [[0, [C4, E4, G4], 0.3], [2, [C4, E4, G4], 0.3], [3, [D4, G4, A4], 0.3]]),
  N('hn_riff', 'Trompet Riff', '🎺', 'horns', 'trumpet', 4, [
    [0, G4, 0.4], [0.5, A4, 0.4], [1, C5, 0.9], [2.5, A4, 0.4], [3, G4, 0.9],
    [4, E4, 0.4], [4.5, G4, 0.4], [5, A4, 1.9],
    [8, G4, 0.4], [8.5, A4, 0.4], [9, C5, 0.9], [10.5, D5, 0.4], [11, C5, 0.9],
    [12, A4, 0.9], [13, G4, 0.9], [14, E4, 1.9]]),
  N('hn_offbeat', 'Skæve Horn', '🦀', 'horns', 'brass', 1,
    [[0.5, [C4, E4], 0.4], [1.5, [C4, E4], 0.4], [2.5, [A3, E4], 0.4], [3.5, [G3, D4], 0.4]]),
  N('hn_kald', 'Trompet Kald', '🐓', 'horns', 'trumpet', 1,
    [[0, C4, 0.2], [0.33, E4, 0.2], [0.66, G4, 0.2], [1, C5, 1.4], [3, G4, 0.9]]),
  N('hn_lange', 'Lange Horn', '🌅', 'horns', 'brass', 4, [
    [0, [C4, G4], 3.8], [4, [A3, E4], 3.8], [8, [A3, 65], 3.8], [12, [G3, D4], 3.8]]),
  N('hn_strygere', 'Strygere', '🎻', 'horns', 'strings', 4, [
    [0, [C4, E4, G4, C5], 3.8], [4, [A3, C4, E4, A4], 3.8],
    [8, [A3, C4, 65, A4], 3.8], [12, [G3, 59, D4, G4], 3.8]]),
  N('hn_kor', 'Kor Ahh', '👼', 'horns', 'choir', 4, [
    [0, [C4, E4, G4], 3.8], [4, [C4, 65, A4], 3.8], [8, [C4, E4, G4], 3.8], [12, [59, D4, G4], 3.8]]),
  N('hn_flojte', 'Fløjte', '🐦', 'horns', 'flute', 4, [
    [0, E5, 0.9], [1, G5, 0.9], [2, A5, 1.9],
    [4, G5, 0.9], [5, E5, 0.9], [6, D5, 1.9],
    [8, C5, 0.9], [9, D5, 0.9], [10, E5, 0.9], [11, G5, 0.9],
    [12, E5, 0.9], [13, D5, 0.9], [14, C5, 1.9]]),

  // ------------------- SJOVE LYDE -------------------
  N('fx_laser', 'Laser', '🔫', 'fx', 'laser', 1, [[0, 0, 0.3], [1, 0, 0.3], [2, 0, 0.3], [3, 0, 0.3]]),
  N('fx_zap', 'Zap Zap', '⚡', 'fx', 'zap', 1, [[0, 0, 0.2], [0.5, 0, 0.2], [2, 0, 0.2], [2.5, 0, 0.2]]),
  N('fx_boing', 'Boing', '🤸', 'fx', 'boing', 1, [[0, 0, 0.6], [2, 0, 0.6]]),
  N('fx_sirene', 'Sirene', '🚨', 'fx', 'siren', 1, [[0, 0, 3.8]]),
  N('fx_raket', 'Raket Op', '🚀', 'fx', 'riser', 1, [[0, 0, 3.8]]),
  N('fx_rutsjebane', 'Rutsjebane', '🎢', 'fx', 'fall', 1, [[0, 0, 3.5]]),
  N('fx_vind', 'Susende Vind', '🌪️', 'fx', 'whoosh', 1, [[0, 0, 3.8]]),
  N('fx_bilhorn', 'Dyt Dyt', '🚗', 'fx', 'carhorn', 1, [[0, 0, 0.4], [0.75, 0, 0.7]]),
  N('fx_robot', 'Robot Snak', '🤖', 'fx', 'robot', 1, [[0, 45, 0.9], [1.5, 43, 0.5], [2.5, 48, 0.9]]),
  N('fx_klapsalve', 'Klapsalve', '👏', 'fx', 'applause', 1, [[0, 0, 3.5]]),
  N('fx_glimmer', 'Glimmer', '🧚', 'fx', 'bell', 1,
    [[0, C5 + 12, 0.3], [0.25, A5, 0.3], [0.5, G5 + 12, 0.3], [0.75, E5 + 12, 0.3], [1, C5 + 12, 0.3], [1.5, G5, 0.3], [2, A5, 0.3], [2.5, C5 + 12, 0.3]]),
  N('fx_ekko', 'Rum Ekko', '🛸', 'fx', 'squarelead', 1,
    [[0, C5, 0.15], [0.5, C5, 0.15, 0.6], [1, C5, 0.15, 0.35], [1.5, C5, 0.15, 0.2]]),

  // ------------------- RIGTIGE LYDE (VSCO-2-CE samples, CC0) -------------------
  // trommer
  D('dr_orkester', 'Orkester Beat', '🎻', {
    smpBigdrum: 'x.......x.......', smpSnare: '....x.......x...', smpCrash: 'x...............' }),
  D('dr_kaempe', 'Kæmpe Tromme', '🐘', {
    smpBigdrum: 'x...x.....x...x.', smpBigdrumS: '......x.......x.' }),
  D('dr_pauker', 'Pauker Beat', '🦣', {
    smpTimpLo: 'x......x........', smpTimpHi: '....x.......x.x.' }),
  D('dr_hvirvel', 'Trommehvirvel', '🌀', {
    smpSnareRoll: 'x...........', smpSnare: '............x.', smpCrash: '..............x.' }),
  // percussion
  P('pc_congas_real', 'Ægte Congas', '🥥', {
    smpConga: 'x..o..x.o.......', smpQuinto: '..........x..x.o', smpTumba: '........x.......' }),
  P('pc_kanebjaelder', 'Kanebjælder', '🦌', { smpSleigh: 'x...x...x...x...' }),
  P('pc_guiro_real', 'Guiro Frø', '🐸', { smpGuiro: 'x.......x.......' }),
  P('pc_traetrommer', 'Trætrommer', '🪵', {
    smpLogHi: 'x..x....x..x..x.', smpLogLo: '....x.......x...' }),
  P('pc_tamburin_real', 'Ægte Tamburin', '🪇', {
    smpTamb: '..x...x...x...x.', smpTambShake: 'x...............' }),
  P('pc_triangel_real', 'Ægte Triangel', '📐', { smpTriangle: 'x.......x.......' }),
  P('pc_kobell_real', 'Ægte Koklokke', '🐮', { smpCowbell: 'x...x...x..x.x..' }),
  P('pc_claves_real', 'Ægte Claves', '🎋', { smpClaves: 'x..x..x...x.x...' }),
  // keys
  N('ky_aegte_klaver', 'Ægte Klaver', '🏫', 'keys', 'smpPiano', 4, [
    [0, chC4, 3.5], [4, chAm4, 3.5], [8, chF4, 3.5], [12, chG4, 3.5]]),
  N('ky_klavermelodi_real', 'Klaver Sang', '🐻', 'keys', 'smpPiano', 4, [
    [0, C4, 0.9], [1, E4, 0.9], [2, G4, 1.9],
    [4, A4, 0.9], [5, G4, 0.9], [6, E4, 1.9],
    [8, D4, 0.9], [9, E4, 0.9], [10, G4, 0.9], [11, A4, 0.9],
    [12, G4, 0.9], [13, E4, 0.9], [14, C4, 1.9]]),
  N('ky_harpe', 'Harpe', '🌊', 'keys', 'smpHarp', 1,
    [[0, C4, 0.5], [0.5, E4, 0.5], [1, G4, 0.5], [1.5, C5, 0.5], [2, E5, 0.5], [2.5, G5, 0.5], [3, E5, 0.5], [3.5, C5, 0.5]]),
  N('ky_klokkespil', 'Klokkespil', '🔔', 'keys', 'smpGlock', 1,
    [[0, G5, 0.9], [1, C5 + 12, 0.9], [2, A5, 0.9], [3, G5, 0.9]]),
  N('ky_xylofon', 'Xylofon', '🍭', 'keys', 'smpXylo', 1,
    [[0, C5, 0.4], [0.5, D5, 0.4], [1, E5, 0.4], [1.5, G5, 0.4], [2, E5, 0.4], [2.5, D5, 0.4], [3, C5, 0.9]]),
  N('ky_marimba_real', 'Ægte Marimba', '🦜', 'keys', 'smpMarimba', 1,
    [[0, C4, 0.4], [0.75, E4, 0.4], [1.5, G4, 0.4], [2, A4, 0.4], [2.75, G4, 0.4], [3.5, E4, 0.4]]),
  // horns & strygere
  N('hn_aegte_trompet', 'Ægte Trompet', '🌟', 'horns', 'smpTrumpetStac', 4, [
    [0, C5, 0.4], [1, C5, 0.4], [2, D5, 0.9],
    [4, E5, 0.4], [5, D5, 0.4], [6, C5, 0.9],
    [8, A4, 0.4], [9, C5, 0.4], [10, D5, 0.9],
    [12, C5, 0.4], [13, A4, 0.4], [14, G4, 0.9]]),
  N('hn_trompet_lang', 'Trompet Toner', '🎖️', 'horns', 'smpTrumpet', 4, [
    [0, G4, 1.8], [2, A4, 1.8], [4, C5, 3.8],
    [8, A4, 1.8], [10, G4, 1.8], [12, E4 + 12, 3.8]]),
  N('hn_basun', 'Basun', '🦛', 'horns', 'smpTrombone', 1,
    [[0, C3, 0.9], [1.5, G2, 0.9], [3, A2, 0.9]]),
  N('hn_pizzicato', 'Pizzicato', '🤏', 'horns', 'smpPizz', 1,
    [[0, C4, 0.4], [0.5, E4, 0.4], [1, G4, 0.4], [1.5, E4, 0.4], [2, A4, 0.4], [2.5, G4, 0.4], [3, E4, 0.4], [3.5, D4, 0.4]]),
  N('hn_aegte_strygere', 'Ægte Strygere', '🎼', 'horns', 'smpStrings', 4, [
    [0, [C4, E4, G4], 3.8], [4, [A3, C4, E4], 3.8],
    [8, [A3, C4, 65], 3.8], [12, [59, D4, G4], 3.8]]),
  // vokal (rigtigt kor fra Sonatina Symphonic Orchestra + chops)
  N('vx_pigekor', 'Pige Kor', '👧', 'vokal', 'smpChoirF', 4, [
    [0, [C5, E5, G5], 3.8], [4, [A4, C5, E5], 3.8], [8, [G4, C5, D5], 3.8], [12, [C5, E5, G5], 3.8]]),
  N('vx_drengekor', 'Drenge Kor', '👦', 'vokal', 'smpChoirM', 4, [
    [0, [C3, E3, G3], 3.8], [4, [A2, C3, E3], 3.8], [8, [G2, C3, D3], 3.8], [12, [C3, E3, G3], 3.8]]),
  { // damer + herrer sammen — kan ikke laves med N()-hjaelperen (to instrumenter)
    id: 'vx_stortkor', name: 'Kæmpe Kor', emoji: '👨‍👩‍👧‍👦', cat: 'vokal', takts: 4,
    events: [
      { t: 0, inst: 'smpChoirM', midi: C3, dur: 7.8, vel: 0.9 }, { t: 0, inst: 'smpChoirM', midi: G3, dur: 7.8, vel: 0.9 },
      { t: 0, inst: 'smpChoirF', midi: C5, dur: 7.8, vel: 0.8 }, { t: 0, inst: 'smpChoirF', midi: E5, dur: 7.8, vel: 0.8 },
      { t: 8, inst: 'smpChoirM', midi: A2, dur: 7.8, vel: 0.9 }, { t: 8, inst: 'smpChoirM', midi: E3, dur: 7.8, vel: 0.9 },
      { t: 8, inst: 'smpChoirF', midi: A4, dur: 7.8, vel: 0.8 }, { t: 8, inst: 'smpChoirF', midi: C5, dur: 7.8, vel: 0.8 },
    ],
  },
  N('vx_kormelodi', 'Kor Melodi', '🎶', 'vokal', 'smpChoirF', 4, [
    [0, C5, 1.8], [2, D5, 1.8], [4, E5, 3.8],
    [8, G5, 1.8], [10, E5, 1.8], [12, C5, 3.8]]),
  N('vx_dybstemme', 'Dyb Stemme', '🐻', 'vokal', 'smpChoirM', 4, [
    [0, G2, 7.8], [8, C3, 7.8]]),
  N('vx_boelge', 'Kor Bølge', '🌊', 'vokal', 'smpChoirF', 1, [
    [0, A4, 1.9], [2, C5, 1.9]]),
  N('vx_hak', 'Vokal Hak', '✂️', 'vokal', 'smpVoxChop', 1, [
    [0, C5, 0.4], [0.5, C5, 0.3], [1, E5, 0.4], [1.75, G5, 0.3], [2.5, A5, 0.4], [3, G5, 0.3], [3.5, E5, 0.3]]),
  N('vx_hakhop', 'Hakke Hop', '🐇', 'vokal', 'smpVoxChop', 1, [
    [0, C5, 0.2], [0.5, C5 + 12, 0.2], [1, C5, 0.2], [1.5, G5, 0.2], [2, C5, 0.2], [2.5, C5 + 12, 0.2], [3, A5, 0.2], [3.5, G5, 0.2]]),
  N('vx_hakmelodi', 'Hakke Melodi', '🍬', 'vokal', 'smpVoxChop', 4, [
    [0, E5, 0.4], [0.75, G5, 0.4], [1.5, A5, 0.4], [2, G5, 0.4], [3, E5, 0.4],
    [4, D5, 0.4], [4.75, E5, 0.4], [5.5, G5, 0.4], [6, E5, 0.4], [7, D5, 0.4],
    [8, C5, 0.4], [8.75, E5, 0.4], [9.5, G5, 0.4], [10, A5, 0.4], [11, C5 + 12, 0.4],
    [12, A5, 0.4], [12.75, G5, 0.4], [13.5, E5, 0.4], [14, D5, 0.8]]),
  N('vx_dybhak', 'Dybe Hak', '🦍', 'vokal', 'smpVoxChopM', 1, [
    [0, C3, 0.3], [0.75, C3, 0.3], [1.5, E3, 0.3], [2, G3, 0.3], [2.75, G3, 0.3], [3.5, E3, 0.3]]),
  N('vx_ekko', 'Vokal Ekko', '🔁', 'vokal', 'smpVoxChop', 1, [
    [0, C5, 0.3, 1], [0.5, C5, 0.3, 0.55], [1, C5, 0.3, 0.3], [2, G5, 0.3, 1], [2.5, G5, 0.3, 0.55], [3, G5, 0.3, 0.3]]),

  // sjove lyde
  N('fx_gong', 'Kæmpe Gong', '🥇', 'fx', 'smpGong', 1, [[0, 0, 3.8]]),
  N('fx_skralde', 'Skralde', '⚙️', 'fx', 'smpRatchet', 1, [[0, 0, 1.8], [2, 0, 1.8]]),
  N('fx_rumvaesen', 'Rumvæsen', '👽', 'fx', 'smpAlien', 1, [[0, 0, 3.8]]),
  N('fx_klokketrae', 'Klokketræ', '🎐', 'fx', 'smpBelltree', 1, [[0, 0, 2], [2, 0, 2]]),
  N('fx_ambolt', 'Ambolt', '🔨', 'fx', 'smpAnvil', 1, [[0, 0, 0.5], [1, 0, 0.5], [2, 0, 0.5], [3, 0, 0.5]]),
  N('fx_aegte_zap', 'Ægte Zap', '💥', 'fx', 'smpZap', 1, [[0, 0, 0.4], [1, 0, 0.4], [2, 0, 0.4], [3, 0, 0.4]]),
];

export const LOOPS_BY_ID = {};
for (const l of LOOPS) LOOPS_BY_ID[l.id] = l;

// trommemaskinens standard-kit (de 8 raekker ved foerste start)
export const SEQ_INSTRUMENTS = [
  { inst: 'kick', name: 'Stortromme', emoji: '👟' },
  { inst: 'snare', name: 'Lilletromme', emoji: '🥁' },
  { inst: 'clap', name: 'Klap', emoji: '👏' },
  { inst: 'hatC', name: 'Hi-hat', emoji: '🎩' },
  { inst: 'hatO', name: 'Åben Hat', emoji: '🛸' },
  { inst: 'tomM', name: 'Tam', emoji: '🛢️' },
  { inst: 'cowbell', name: 'Koklokke', emoji: '🐄' },
  { inst: 'shaker', name: 'Shaker', emoji: '🧂' },
];
// ...og alle de ekstra lyde, en raekke kan skiftes til (✏️)
export const SEQ_EXTRA = [
  { inst: 'kick808', name: '808 Stortromme', emoji: '🔊' },
  { inst: 'snare2', name: 'El-tromme', emoji: '⚡' },
  { inst: 'tomL', name: 'Dyb Tam', emoji: '🪣' },
  { inst: 'tomH', name: 'Lys Tam', emoji: '🥫' },
  { inst: 'crash', name: 'Bækken', emoji: '💥' },
  { inst: 'ride', name: 'Ride', emoji: '🥏' },
  { inst: 'rim', name: 'Kant-slag', emoji: '🥢' },
  { inst: 'tamb', name: 'Tamburin', emoji: '🛎️' },
  { inst: 'conga', name: 'Conga', emoji: '🪘' },
  { inst: 'bongo', name: 'Bongo', emoji: '🐒' },
  { inst: 'woodblock', name: 'Træklods', emoji: '🪵' },
  { inst: 'clave', name: 'Clave', emoji: '🥖' },
  { inst: 'cabasa', name: 'Cabasa', emoji: '🌾' },
  { inst: 'triangle', name: 'Trekant', emoji: '🔺' },
  { inst: 'smpBigdrum', name: 'Ægte Stortromme', emoji: '🐘' },
  { inst: 'smpSnare', name: 'Ægte Lilletromme', emoji: '🪖' },
  { inst: 'smpConga', name: 'Ægte Conga', emoji: '🥥' },
  { inst: 'smpCowbell', name: 'Ægte Koklokke', emoji: '🐮' },
  { inst: 'smpTamb', name: 'Ægte Tamburin', emoji: '🪇' },
  { inst: 'smpTriangle', name: 'Ægte Trekant', emoji: '📐' },
  { inst: 'smpGuiro', name: 'Guiro', emoji: '🐸' },
  { inst: 'smpSleigh', name: 'Kanebjælder', emoji: '🦌' },
  { inst: 'smpLogHi', name: 'Trætromme', emoji: '🐿️' },
  { inst: 'smpTimpLo', name: 'Pauke', emoji: '🦣' },
  { inst: 'smpGong', name: 'Gong', emoji: '🥇' },
  { inst: 'smpAnvil', name: 'Ambolt', emoji: '🔨' },
];

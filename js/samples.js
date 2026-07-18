// Rigtige samples fra VSCO-2 Community Edition (github.com/sgossner/VSCO-2-CE)
// Licens: CC0 1.0 (public domain) — se samples/OM SAMPLES.txt
// Filerne ligger i samples/ og er trimmet til mono 16-bit 44.1 kHz.

// one-shots: instrumentnavn -> fil (+ gain, cut = klip ved nodens længde)
export const ONESHOTS = [
  { inst: 'smpBigdrum',   file: 'bigdrum.wav',        gain: 1.0 },
  { inst: 'smpBigdrumS',  file: 'bigdrum_soft.wav',   gain: 0.8 },
  { inst: 'smpSnare',     file: 'snare_real.wav',     gain: 0.8 },
  { inst: 'smpSnareS',    file: 'snare_real_soft.wav', gain: 0.6 },
  { inst: 'smpSnareRoll', file: 'snare_roll.wav',     gain: 0.7, cut: true },
  { inst: 'smpCrash',     file: 'crash_real.wav',     gain: 0.5 },
  { inst: 'smpConga',     file: 'conga_real.wav',     gain: 0.8 },
  { inst: 'smpQuinto',    file: 'quinto_real.wav',    gain: 0.8 },
  { inst: 'smpTumba',     file: 'tumba_real.wav',     gain: 0.9 },
  { inst: 'smpCowbell',   file: 'cowbell_real.wav',   gain: 0.55 },
  { inst: 'smpClaves',    file: 'claves_real.wav',    gain: 0.7 },
  { inst: 'smpTamb',      file: 'tamb_real.wav',      gain: 0.6 },
  { inst: 'smpTambShake', file: 'tamb_shake.wav',     gain: 0.6 },
  { inst: 'smpTriangle',  file: 'triangle_real.wav',  gain: 0.45 },
  { inst: 'smpGuiro',     file: 'guiro.wav',          gain: 0.7 },
  { inst: 'smpSleigh',    file: 'sleigh.wav',         gain: 0.6 },
  { inst: 'smpLogHi',     file: 'log_hi.wav',         gain: 0.8 },
  { inst: 'smpLogLo',     file: 'log_lo.wav',         gain: 0.8 },
  { inst: 'smpTimpLo',    file: 'timp_lo.wav',        gain: 0.9 },
  { inst: 'smpTimpHi',    file: 'timp_hi.wav',        gain: 0.9 },
  { inst: 'smpGong',      file: 'gong.wav',           gain: 0.7 },
  { inst: 'smpRatchet',   file: 'ratchet.wav',        gain: 0.7, cut: true },
  { inst: 'smpAlien',     file: 'alien.wav',          gain: 0.7, cut: true },
  { inst: 'smpZap',       file: 'zap_real.wav',       gain: 0.7 },
  { inst: 'smpBelltree',  file: 'belltree.wav',       gain: 0.5 },
  { inst: 'smpAnvil',     file: 'anvil.wav',          gain: 0.6 },
];

// tonede instrumenter: noteliste [fil, midi]; sustain = holdes/slippes ved nodens længde
export const PITCHED = [
  { inst: 'smpTrumpet', sustain: true, gain: 0.55, notes: [
    ['trumpet_sus_g3.wav', 55], ['trumpet_sus_d4.wav', 62], ['trumpet_sus_f4.wav', 65],
    ['trumpet_sus_a4.wav', 69], ['trumpet_sus_c5.wav', 72]] },
  { inst: 'smpTrumpetStac', sustain: false, gain: 0.6, notes: [
    ['trumpet_stac_d4.wav', 62], ['trumpet_stac_a4.wav', 69], ['trumpet_stac_c5.wav', 72]] },
  { inst: 'smpTrombone', sustain: true, gain: 0.65, notes: [
    ['trombone_d2.wav', 38], ['trombone_f2.wav', 41], ['trombone_c3.wav', 48], ['trombone_f3.wav', 53]] },
  { inst: 'smpPizz', sustain: false, gain: 0.8, notes: [
    ['vlnpizz_d3.wav', 50], ['vlnpizz_c4.wav', 60], ['vlnpizz_e4.wav', 64],
    ['vlnpizz_g4.wav', 67], ['vlnpizz_d5.wav', 74]] },
  { inst: 'smpStrings', sustain: true, gain: 0.5, notes: [
    ['vlnsus_a3.wav', 57], ['vlnsus_c4.wav', 60], ['vlnsus_e4.wav', 64],
    ['vlnsus_g4.wav', 67], ['vlnsus_d5.wav', 74]] },
  { inst: 'smpHarp', sustain: false, gain: 0.75, notes: [
    ['harp_c3.wav', 48], ['harp_e3.wav', 52], ['harp_g3.wav', 55], ['harp_d4.wav', 62],
    ['harp_a4.wav', 69], ['harp_c5.wav', 72], ['harp_e5.wav', 76], ['harp_g5.wav', 79]] },
  { inst: 'smpPiano', sustain: false, gain: 0.85, notes: [
    ['piano_45.wav', 45], ['piano_53.wav', 53], ['piano_61.wav', 61],
    ['piano_69.wav', 69], ['piano_77.wav', 77], ['piano_85.wav', 85]] },
  { inst: 'smpGlock', sustain: false, gain: 0.5, notes: [
    ['glock_g5.wav', 79], ['glock_c6.wav', 84]] },
  { inst: 'smpXylo', sustain: false, gain: 0.6, notes: [
    ['xylo_c5.wav', 72], ['xylo_g5.wav', 79]] },
  { inst: 'smpMarimba', sustain: false, gain: 0.7, notes: [
    ['marimba_c4.wav', 60], ['marimba_g4.wav', 67]] },
  // rigtigt kor (Sonatina Symphonic Orchestra, CC Sampling Plus 1.0)
  { inst: 'smpChoirF', sustain: true, gain: 0.55, notes: [
    ['choir_female_g4.wav', 67], ['choir_female_a4.wav', 69], ['choir_female_c5.wav', 72],
    ['choir_female_d5.wav', 74], ['choir_female_e5.wav', 76], ['choir_female_g5.wav', 79],
    ['choir_female_a5.wav', 81], ['choir_female_c6.wav', 84]] },
  { inst: 'smpChoirM', sustain: true, gain: 0.6, notes: [
    ['choir_male_g2.wav', 43], ['choir_male_c3.wav', 48], ['choir_male_d3.wav', 50],
    ['choir_male_e3.wav', 52], ['choir_male_g3.wav', 55], ['choir_male_a3.wav', 57],
    ['choir_male_c4.wav', 60], ['choir_male_e4.wav', 64]] },
  // vokal-chops: samme kor, men klippet i korte bidder (moderne vocal chop-lyd)
  { inst: 'smpVoxChop', chop: true, gain: 0.85, notes: [
    ['choir_female_g4.wav', 67], ['choir_female_a4.wav', 69], ['choir_female_c5.wav', 72],
    ['choir_female_d5.wav', 74], ['choir_female_e5.wav', 76], ['choir_female_g5.wav', 79],
    ['choir_female_a5.wav', 81], ['choir_female_c6.wav', 84]] },
  { inst: 'smpVoxChopM', chop: true, gain: 0.9, notes: [
    ['choir_male_c3.wav', 48], ['choir_male_e3.wav', 52], ['choir_male_g3.wav', 55],
    ['choir_male_c4.wav', 60], ['choir_male_e4.wav', 64]] },
];

export const ALL_FILES = [
  ...ONESHOTS.map(o => o.file),
  ...PITCHED.flatMap(p => p.notes.map(n => n[0])),
];

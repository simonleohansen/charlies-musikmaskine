import { Player, renderSong, BEATS_PER_CELL, loadSamples, loadRecordingFile, decodeRecordingBytes, registerRecordingBuffer, recordingDuration, encodeWav, scheduleLoop } from './audio.js';
import { CATEGORIES, LOOPS, LOOPS_BY_ID, SEQ_INSTRUMENTS, SEQ_EXTRA } from './loops.js';

// ---------------- tilstand ----------------
const TRACKS = 16;
const state = {
  bpm: 110,
  tool: null,          // {type:'loop', id} eller {type:'erase'} eller null
  selected: null,      // {tr, bar}
  activeCat: 'drums',
  song: newSong(),
};

function newSong() {
  return {
    bars: 8,
    trackCount: TRACKS,
    tracks: Array.from({ length: TRACKS }, () => ({ vol: 0.9, muted: false })),
    cells: {}, // "tr:bar" -> {loopId, vol, pan, filter, comp, auto}
  };
}

// egne beats fra trommemaskinen
let customLoops = [];
try { customLoops = JSON.parse(localStorage.getItem('charlie-custom-loops') || '[]'); } catch (e) {}
for (const l of customLoops) { l.cat = 'mine'; LOOPS_BY_ID[l.id] = l; }

// gem/indlaes sang
try {
  const saved = JSON.parse(localStorage.getItem('charlie-song-v1') || 'null');
  if (saved && saved.cells && saved.tracks) state.song = Object.assign(newSong(), saved);
  const bpm = Number(localStorage.getItem('charlie-bpm'));
  if (bpm >= 70 && bpm <= 150) state.bpm = bpm;
} catch (e) {}

// ---------------- fortryd (Ctrl/Cmd+Z) ----------------
const undoStack = [], redoStack = [];
function pushHistory() {
  undoStack.push(JSON.stringify(state.song));
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
}
function restoreSong(json) {
  state.song = Object.assign(newSong(), JSON.parse(json));
  state.selected = null;
  renderGrid(); renderHeads(); renderClipPanel();
  persist();
}
function undo() {
  if (!undoStack.length) { toast('Ikke mere at fortryde', true); return; }
  redoStack.push(JSON.stringify(state.song));
  restoreSong(undoStack.pop());
  toast('↩️ Fortrudt');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state.song));
  restoreSong(redoStack.pop());
  toast('↪️ Gendannet');
}
window.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  }
});

// ---------------- server eller browser-lager? ----------------
// hjemme koerer appen med den lille python-server (filer paa disken).
// online (delt med venner) findes serveren ikke — saa bruges browserens
// IndexedDB til optagelser og backup, og eksport bliver en download.
let hasServer = true;
const serverProbe = fetch('/ping', { cache: 'no-store' })
  .then(r => { hasServer = r.ok; })
  .catch(() => { hasServer = false; });

function idbOpen() {
  return new Promise((res, rej) => {
    const q = indexedDB.open('charlie-db', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('filer');
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('filer', 'readwrite');
    tx.objectStore('filer').put(val, key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const rq = db.transaction('filer').objectStore('filer').get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbDel(key) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction('filer', 'readwrite');
    tx.objectStore('filer').delete(key);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

// ---------------- auto-backup til disk ----------------
// alt vigtigt ligger i localStorage — serveren faar en kopi i Backup/-mappen
const BACKUP_KEYS = ['charlie-song-v1', 'charlie-songs', 'charlie-custom-loops', 'charlie-seq-kit', 'charlie-bpm', 'charlie-current-song-id', 'charlie-open-songs', 'charlie-active-song'];
let backupTimer = null;
function scheduleBackup() {
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    const data = {};
    for (const k of BACKUP_KEYS) data[k] = localStorage.getItem(k);
    const payload = JSON.stringify({ savedAt: new Date().toISOString(), data });
    if (hasServer) {
      fetch('/backup', { method: 'POST', body: payload }).catch(() => {});
    } else {
      idbSet('backup', payload).catch(() => {});
    }
  }, 3000);
}
async function restoreBackup(interactive) {
  try {
    let b = null;
    if (hasServer) {
      const r = await fetch('Backup/charlie-backup.json', { cache: 'no-store' });
      if (r.ok) b = await r.json();
    } else {
      const raw = await idbGet('backup');
      if (raw) b = JSON.parse(raw);
    }
    if (!b) { if (interactive) toast('Ingen backup fundet', true); return; }
    for (const [k, v] of Object.entries(b.data || {})) {
      if (v != null) localStorage.setItem(k, v);
    }
    sessionStorage.setItem('charlie-restored', '1');
    location.reload();
  } catch (e) {
    if (interactive) toast('Kunne ikke gendanne backup', true);
  }
}
// hvis browserens data er væk (ny browser / ryddet data), gendan automatisk
serverProbe.then(() => {
  if (!localStorage.getItem('charlie-song-v1') && !localStorage.getItem('charlie-songs')
      && !localStorage.getItem('charlie-custom-loops') && !sessionStorage.getItem('charlie-restored')) {
    restoreBackup(false);
  }
});

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    syncActiveTab();
    localStorage.setItem('charlie-song-v1', JSON.stringify(state.song));
    localStorage.setItem('charlie-open-songs', JSON.stringify(openSongs));
    localStorage.setItem('charlie-active-song', String(activeSong));
    localStorage.setItem('charlie-bpm', String(state.bpm));
    scheduleBackup();
  }, 250);
}

const catById = {};
for (const c of CATEGORIES) catById[c.id] = c;
function loopColor(loop) { return (catById[loop.cat] || catById.drums).color; }
// barens effektive loop: indbygget performance-loop ELLER biblioteks-loop
function effLoop(clip) { return clip ? (clip.inline || LOOPS_BY_ID[clip.loopId]) : null; }

const player = new Player(() => ({ song: state.song, loopsById: LOOPS_BY_ID, bpm: state.bpm }));

// rigtige samples (VSCO-2-CE) indlæses i baggrunden ved start
const samplesReady = loadSamples().catch(e => { console.warn('samples', e); return 0; });

// Charlies egne optagelser: hent lydfilerne for de gemte rec-loops
// (fra disk hjemme, fra IndexedDB online); fjern loops hvis filen mangler
async function loadOneRecording(file) {
  if (hasServer) return loadRecordingFile(file);
  const bytes = await idbGet('rec:' + file);
  if (!bytes) throw new Error('mangler i browser-lager: ' + file);
  return decodeRecordingBytes(file, bytes);
}
const recordingsReady = serverProbe.then(() => Promise.all(
  customLoops.filter(l => l.rec).map(l =>
    loadOneRecording(l.rec).catch(() => {
      customLoops = customLoops.filter(x => x !== l);
      delete LOOPS_BY_ID[l.id];
    })
  )
)).then(() => {
  localStorage.setItem('charlie-custom-loops', JSON.stringify(customLoops));
  renderTiles(); renderSeq(); renderPadInsts(); renderSndSources();
});

// ---------------- dom ----------------
const $ = id => document.getElementById(id);
const gridEl = $('grid'), barNumsEl = $('barNums'), headsEl = $('trackHeads');
const playheadEl = $('playhead'), gridScroll = $('gridScroll');
const CELL_W = 104;

function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = err ? 'err' : '';
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------------- spor-hoveder ----------------
function renderHeads() {
  headsEl.innerHTML = '<div></div>'; // spacer over bar-numrene
  state.song.tracks.forEach((tr, i) => {
    const d = document.createElement('div');
    d.className = 'trackHead' + (tr.muted ? ' muted' : '');
    d.innerHTML = `<span class="num">${i + 1}</span>
      <button class="mute" title="Lyd til/fra">${tr.muted ? '🔇' : '🔊'}</button>
      <input type="range" min="0" max="1.2" step="0.01" value="${tr.vol}" title="Sporets volumen">`;
    d.querySelector('.mute').onclick = () => {
      pushHistory();
      tr.muted = !tr.muted;
      player.setTrackGain(i, tr.muted ? 0 : tr.vol);
      renderHeads(); persist();
    };
    d.querySelector('input').addEventListener('pointerdown', pushHistory);
    d.querySelector('input').oninput = e => {
      tr.vol = Number(e.target.value);
      if (!tr.muted) player.setTrackGain(i, tr.vol);
      persist();
    };
    d.addEventListener('contextmenu', e => {
      const items = [{
        emoji: tr.muted ? '🔊' : '🔇',
        label: tr.muted ? 'Lyd til' : 'Lyd fra',
        action: () => {
          pushHistory();
          tr.muted = !tr.muted;
          player.setTrackGain(i, tr.muted ? 0 : tr.vol);
          renderHeads(); persist();
        },
      }];
      if (Object.keys(state.song.cells).some(k => +k.split(':')[0] === i)) {
        items.push({ emoji: '🧹', label: 'Ryd hele sporet', danger: true, action: () => {
          pushHistory();
          for (const k of Object.keys(state.song.cells)) {
            if (+k.split(':')[0] === i) delete state.song.cells[k];
          }
          if (state.selected && state.selected.tr === i) selectClip(null, { hear: false });
          repaintAll(); persist();
        } });
      }
      showMenu(items, e.clientX, e.clientY);
    });
    headsEl.appendChild(d);
  });
}

// ---------------- grid ----------------
function renderGrid() {
  gridEl.innerHTML = '';
  barNumsEl.innerHTML = '';
  for (let b = 0; b < state.song.bars; b++) {
    const num = document.createElement('div');
    num.className = 'barNum';
    num.dataset.bar = b;
    num.textContent = b + 1;
    barNumsEl.appendChild(num);
    const col = document.createElement('div');
    col.className = 'gridCol';
    for (let tr = 0; tr < TRACKS; tr++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.tr = tr;
      cell.dataset.bar = b;
      paintCell(cell);
      col.appendChild(cell);
    }
    gridEl.appendChild(col);
  }
  $('barCount').textContent = state.song.bars + (state.song.bars === 1 ? ' bar' : ' bars');
}

function cellEl(tr, bar) {
  return gridEl.querySelector(`.cell[data-tr="${tr}"][data-bar="${bar}"]`);
}

function paintCell(cell) {
  const tr = +cell.dataset.tr, bar = +cell.dataset.bar;
  const clip = state.song.cells[tr + ':' + bar];
  const selHere = state.selected && state.selected.tr === tr && state.selected.bar === bar;
  if (!clip) {
    cell.className = 'cell' + (selHere ? ' selected' : '');
    cell.style.background = '';
    cell.innerHTML = '';
    return;
  }
  // delt bar: 2 eller 4 smaa felter side om side + synligt ✂️-maerke
  if (clip.split) {
    cell.className = 'cell splitCell';
    cell.style.background = '';
    cell.innerHTML = '<span class="splitBadge">✂️</span>';
    clip.parts.forEach((p, i) => {
      const s = document.createElement('span');
      const lp = p ? effLoop(p) : null;
      s.className = 'part' + (p ? ' filled' : '') + (selHere && state.selected.slot === i ? ' sel' : '');
      if (p) {
        s.style.background = lp ? loopColor(lp) : '#888';
        s.textContent = lp ? lp.emoji : '?';
        s.title = lp ? lp.name : '';
      }
      cell.appendChild(s);
    });
    return;
  }
  const sel = selHere && state.selected.slot == null;
  const loop = effLoop(clip);
  cell.className = 'cell filled' + (sel ? ' selected' : '');
  cell.style.background = loop ? loopColor(loop) : '#888';
  const taktBadge = clip.takt != null
    ? `<span class="taktBadge">takt ${(Array.isArray(clip.takt) ? clip.takt : [clip.takt]).map(x => x + 1).join('+')}</span>`
    : '';
  cell.innerHTML = loop
    ? `<span class="emo">${loop.emoji}</span><span class="nm">${loop.name}</span>${clip.auto ? '<span class="autoBadge">📈</span>' : ''}${taktBadge}`
    : '';
}

function repaintAll() {
  gridEl.querySelectorAll('.cell').forEach(paintCell);
}

// shift+traek paa en fyldt bar: forlaeng den hen over tomme celler paa samme spor.
// traek tilbage fjerner igen (kun de celler gesturen selv har tilfoejet)
// almindeligt traek paa en fyldt bar: FLYT den til en tom celle (alle spor)
let stretch = null, dragMove = null, suppressClick = false;
gridEl.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const tr = +cell.dataset.tr, bar = +cell.dataset.bar;
  const clip = state.song.cells[tr + ':' + bar];
  if (!clip) return;
  if (e.shiftKey) {
    e.preventDefault();
    stretch = { tr, srcBar: bar, clip, added: new Set(), pushed: false };
  } else {
    // maaske et traek — afgoeres af om markoeren flytter sig
    dragMove = { tr, bar, clip, startX: e.clientX, startY: e.clientY, dragging: false, ghost: null, target: null };
  }
});

function dragCellAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest('.cell') : null;
}
window.addEventListener('pointermove', e => {
  if (!dragMove) return;
  if (!dragMove.dragging) {
    if (Math.hypot(e.clientX - dragMove.startX, e.clientY - dragMove.startY) < 10) return;
    dragMove.dragging = true;
    const loop = effLoop(dragMove.clip);
    const isSplit = !!dragMove.clip.split;
    const g = document.createElement('div');
    g.className = 'dragGhost';
    g.style.background = loop ? loopColor(loop) : (isSplit ? '#4dd6c1' : '#888');
    g.innerHTML = `<span class="emo">${loop ? loop.emoji : (isSplit ? '✂️' : '🎵')}</span><span class="nm">${loop ? loop.name : (isSplit ? 'Delt bar' : '')}</span>`;
    document.body.appendChild(g);
    dragMove.ghost = g;
    const src = cellEl(dragMove.tr, dragMove.bar);
    if (src) src.classList.add('dragSrc');
  }
  dragMove.ghost.style.left = e.clientX + 10 + 'px';
  dragMove.ghost.style.top = e.clientY - 14 + 'px';
  // fremhaev gyldigt maal (tom celle)
  if (dragMove.target) dragMove.target.classList.remove('dropOk');
  dragMove.target = null;
  const cell = dragCellAt(e.clientX, e.clientY);
  if (cell) {
    const tr = +cell.dataset.tr, bar = +cell.dataset.bar;
    const isSrc = tr === dragMove.tr && bar === dragMove.bar;
    if (!isSrc && !state.song.cells[tr + ':' + bar]) {
      cell.classList.add('dropOk');
      dragMove.target = cell;
    }
  }
});
window.addEventListener('pointerup', e => {
  if (!dragMove) return;
  const d = dragMove;
  dragMove = null;
  if (!d.dragging) return; // almindeligt klik — lad click-handleren klare det
  suppressClick = true;
  if (d.ghost) d.ghost.remove();
  const src = cellEl(d.tr, d.bar);
  if (src) src.classList.remove('dragSrc');
  if (d.target) {
    d.target.classList.remove('dropOk');
    const tr = +d.target.dataset.tr, bar = +d.target.dataset.bar;
    pushHistory();
    delete state.song.cells[d.tr + ':' + d.bar];
    state.song.cells[tr + ':' + bar] = d.clip;
    if (src) paintCell(src);
    persist();
    selectClip({ tr, bar });
  }
});
window.addEventListener('pointermove', e => {
  if (!stretch) return;
  const rect = gridEl.getBoundingClientRect();
  const bar = Math.max(0, Math.min(state.song.bars - 1, Math.floor((e.clientX - rect.left) / CELL_W)));
  const lo = Math.min(stretch.srcBar, bar), hi = Math.max(stretch.srcBar, bar);
  for (let b = lo; b <= hi; b++) {
    if (b === stretch.srcBar) continue;
    const key = stretch.tr + ':' + b;
    if (!state.song.cells[key] && !stretch.added.has(b)) {
      if (!stretch.pushed) { pushHistory(); stretch.pushed = true; }
      state.song.cells[key] = JSON.parse(JSON.stringify(stretch.clip));
      stretch.added.add(b);
      const c = cellEl(stretch.tr, b);
      if (c) paintCell(c);
    }
  }
  for (const b of [...stretch.added]) {
    if (b < lo || b > hi) {
      delete state.song.cells[stretch.tr + ':' + b];
      stretch.added.delete(b);
      const c = cellEl(stretch.tr, b);
      if (c) paintCell(c);
    }
  }
});
window.addEventListener('pointerup', () => {
  if (!stretch) return;
  if (stretch.added.size) {
    persist();
    suppressClick = true; // slug det efterfoelgende klik, saa der ikke ogsaa placeres/vaelges
    toast(`📏 Forlænget: ${stretch.added.size + 1} bars i alt`);
  }
  stretch = null;
});

// hvilket stykke i en delt bar blev der trykket paa?
function slotAt(cell, clientX, split) {
  const r = cell.getBoundingClientRect();
  return Math.max(0, Math.min(split - 1, Math.floor((clientX - r.left) / r.width * split)));
}

gridEl.addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; return; }
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const tr = +cell.dataset.tr, bar = +cell.dataset.bar;
  const key = tr + ':' + bar;
  const existing = state.song.cells[key];
  // delt bar: arbejd paa det enkelte stykke
  if (existing && existing.split) {
    const slot = slotAt(cell, e.clientX, existing.split);
    if (state.tool?.type === 'erase') {
      if (existing.parts[slot]) {
        pushHistory();
        existing.parts[slot] = null;
        if (existing.parts.every(p => !p)) delete state.song.cells[key];
        if (state.selected && state.selected.tr === tr && state.selected.bar === bar) selectClip(null, { hear: false });
        paintCell(cell); persist();
      }
      return;
    }
    if (existing.parts[slot]) { selectClip({ tr, bar, slot }); return; }
    if (state.tool?.type === 'loop') {
      pushHistory();
      existing.parts[slot] = { loopId: state.tool.id, vol: 0.9, pan: 0, filter: 0.5, comp: 0, auto: null };
      persist();
      selectClip({ tr, bar, slot });
      return;
    }
    selectClip(null);
    return;
  }
  if (state.tool?.type === 'erase') {
    if (existing) {
      pushHistory();
      delete state.song.cells[key];
      if (state.selected && state.selected.tr === tr && state.selected.bar === bar) selectClip(null);
      paintCell(cell); persist();
    }
    return;
  }
  // et fyldt felt bliver ALDRIG erstattet ved tryk — det vaelges og hoeres bare.
  // nye lyde kan kun laegges i tomme felter (slet foerst hvis lyden skal skiftes)
  if (existing) {
    selectClip({ tr, bar });
    return;
  }
  if (state.tool?.type === 'loop') {
    pushHistory();
    state.song.cells[key] = {
      loopId: state.tool.id,
      vol: 0.9, pan: 0, filter: 0.5, comp: 0,
      auto: null,
    };
    persist();
    selectClip({ tr, bar });
    return;
  }
  selectClip(null);
});

// ---------------- kategorier & fliser ----------------
function renderCats() {
  const el = $('cats');
  el.innerHTML = '';
  for (const c of CATEGORIES) {
    const b = document.createElement('button');
    b.className = 'catBtn' + (state.activeCat === c.id ? ' active' : '');
    b.style.color = c.color;
    b.textContent = `${c.emoji} ${c.name}`;
    b.onclick = () => { state.activeCat = c.id; renderCats(); renderTiles(); };
    el.appendChild(b);
  }
}

function allLoops() { return LOOPS.concat(customLoops); }

function renderTiles() {
  const el = $('tiles');
  el.innerHTML = '';
  for (const loop of allLoops().filter(l => l.cat === state.activeCat)) {
    const t = document.createElement('button');
    t.className = 'tile' + (state.tool?.type === 'loop' && state.tool.id === loop.id ? ' active' : '');
    t.dataset.loopId = loop.id;
    t.style.background = loopColor(loop);
    t.innerHTML = `<span class="emo">${loop.emoji}</span><span class="nm">${loop.name}</span><span class="len">${loop.takts === 1 ? '1 takt' : '4 takter'}</span>`;
    t.onclick = () => {
      if (state.tool?.type === 'loop' && state.tool.id === loop.id) {
        // andet tryk: stop forsmagen og laeg vaerktoejet fra sig
        state.tool = null;
        player.stopPreview();
      } else {
        state.tool = { type: 'loop', id: loop.id };
        player.preview(loop, state.bpm);
      }
      renderTiles(); renderEraseBtn();
    };
    el.appendChild(t);
  }
}

function renderEraseBtn() {
  $('eraseBtn').classList.toggle('active', state.tool?.type === 'erase');
}
$('eraseBtn').onclick = () => {
  state.tool = state.tool?.type === 'erase' ? null : { type: 'erase' };
  renderTiles(); renderEraseBtn();
};

// faner
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $('libPanel').hidden = tab.dataset.tab !== 'lib';
    $('seqPanel').hidden = tab.dataset.tab !== 'seq';
    $('soundPanel').hidden = tab.dataset.tab !== 'snd';
    $('recPanel').hidden = tab.dataset.tab !== 'rec';
    $('padPanel').hidden = tab.dataset.tab !== 'pad';
  };
});

// ---------------- clip-panel (volumen/balance/filter/punch + automation) ----------------
function selectedClip() {
  if (!state.selected) return null;
  const v = state.song.cells[state.selected.tr + ':' + state.selected.bar];
  if (!v) return null;
  if (v.split) {
    const s = state.selected.slot;
    return s == null ? null : (v.parts[s] || null);
  }
  return state.selected.slot == null ? v : null;
}
// hvor mange slag fylder det valgte (helt felt = 16, halvt = 8, kvart = 4)?
function selectedBeats() {
  if (!state.selected) return BEATS_PER_CELL;
  const v = state.song.cells[state.selected.tr + ':' + state.selected.bar];
  return v?.split ? BEATS_PER_CELL / v.split : BEATS_PER_CELL;
}

function selectClip(sel, { hear = true } = {}) {
  const prev = state.selected;
  state.selected = sel;
  if (prev) { const c = cellEl(prev.tr, prev.bar); if (c) paintCell(c); }
  if (sel) { const c = cellEl(sel.tr, sel.bar); if (c) paintCell(c); }
  renderClipPanel();
  // hoer baren/stykket med egne indstillinger (kun naar sangen ikke spiller).
  // trykker man paa det samme igen mens det spiller, stopper det i stedet
  if (hear && sel && !player.playing) {
    const clip = selectedClip();
    const loop = clip && effLoop(clip);
    const key = 'clip:' + sel.tr + ':' + sel.bar + (sel.slot != null ? ':' + sel.slot : '');
    if (player.isPreviewing(key)) {
      player.stopPreview();
    } else if (loop) {
      player.previewClip(loop, clip, state.bpm, key, selectedBeats());
    }
  }
}

function renderClipPanel() {
  const clip = selectedClip();
  $('clipEmpty').hidden = !!clip;
  $('clipEdit').hidden = !clip;
  if (!clip) return;
  const loop = effLoop(clip);
  const isPart = state.selected.slot != null;
  const partTxt = isPart ? ` · Stykke ${state.selected.slot + 1}` : '';
  $('clipTitle').innerHTML = `${loop ? loop.emoji + ' ' + loop.name : '?'} <small>· Bar ${state.selected.bar + 1} · Spor ${state.selected.tr + 1}${partTxt}</small>`;
  // takt-vaelger kun for 1-takts loops i hele barer; automation kun for hele barer
  $('autoBox').hidden = isPart;
  $('clipDelete').textContent = isPart ? '🧽 Fjern dette stykke' : '🧽 Fjern denne bar';
  $('taktRow').hidden = !loop || isPart || loop.takts !== 1;
  if (loop && !isPart && loop.takts === 1) {
    const cur = clip.takt;
    document.querySelectorAll('.taktBtn').forEach(b => {
      if (b.dataset.takt === 'all') {
        b.classList.toggle('active', cur == null);
      } else {
        const v = +b.dataset.takt;
        b.classList.toggle('active', Array.isArray(cur) ? cur.includes(v) : cur === v);
      }
    });
  }
  $('kVol').value = clip.vol;
  $('kPan').value = clip.pan;
  $('kFilter').value = clip.filter;
  $('kComp').value = clip.comp;
  $('kVerb').value = clip.verb ?? 0;
  $('kEcho').value = clip.echo ?? 0;
  $('kDist').value = clip.dist ?? 0;
  $('kTrem').value = clip.trem ?? 0;
  document.querySelectorAll('.octBtn').forEach(b =>
    b.classList.toggle('active', (clip.oct || 0) === +b.dataset.oct));
  document.querySelectorAll('.autoParam').forEach(b =>
    b.classList.toggle('active', clip.auto?.param === b.dataset.param));
  document.querySelectorAll('.spanBtn').forEach(b =>
    b.classList.toggle('active', !!clip.auto && (clip.auto.span || 1) === +b.dataset.span));
  drawAutoCanvas();
}

for (const [id, prop] of [['kVol', 'vol'], ['kPan', 'pan'], ['kFilter', 'filter'], ['kComp', 'comp'], ['kVerb', 'verb'], ['kEcho', 'echo'], ['kDist', 'dist'], ['kTrem', 'trem']]) {
  $(id).addEventListener('pointerdown', () => { if (selectedClip()) pushHistory(); });
  $(id).oninput = e => {
    const clip = selectedClip();
    if (!clip) return;
    clip[prop] = Number(e.target.value);
    persist();
  };
}

document.querySelectorAll('.taktBtn').forEach(b => {
  b.onclick = () => {
    const clip = selectedClip();
    if (!clip) return;
    pushHistory();
    if (b.dataset.takt === 'all') {
      clip.takt = null;
    } else {
      // toggle takten til/fra i valget — flere takter kan kombineres (fx 1+3)
      const v = +b.dataset.takt;
      let arr = clip.takt == null ? [] : (Array.isArray(clip.takt) ? [...clip.takt] : [clip.takt]);
      arr = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v].sort();
      clip.takt = (arr.length === 0 || arr.length === 4) ? null : (arr.length === 1 ? arr[0] : arr);
    }
    persist();
    renderClipPanel();
    paintCell(cellEl(state.selected.tr, state.selected.bar));
    const loop = effLoop(clip);
    if (loop && !player.playing) player.previewClip(loop, clip, state.bpm);
  };
});

document.querySelectorAll('.octBtn').forEach(b => {
  b.onclick = () => {
    const clip = selectedClip();
    if (!clip) return;
    pushHistory();
    clip.oct = +b.dataset.oct;
    persist();
    renderClipPanel();
    const loop = effLoop(clip);
    if (loop && !player.playing) player.previewClip(loop, clip, state.bpm, 'clip:' + state.selected.tr + ':' + state.selected.bar);
  };
});

function deleteSelected() {
  if (!state.selected) return;
  const { tr, bar, slot } = state.selected;
  const key = tr + ':' + bar;
  const v = state.song.cells[key];
  pushHistory();
  if (v && v.split && slot != null) {
    v.parts[slot] = null;
    if (v.parts.every(p => !p)) delete state.song.cells[key];
  } else {
    delete state.song.cells[key];
  }
  const c = cellEl(tr, bar);
  selectClip(null, { hear: false });
  if (c) paintCell(c);
  persist();
}
$('clipDelete').onclick = deleteSelected;

// automation
document.querySelectorAll('.autoParam').forEach(b => {
  b.onclick = () => {
    const clip = selectedClip();
    if (!clip) return;
    pushHistory();
    const param = b.dataset.param;
    if (!clip.auto) {
      clip.auto = { param, span: 1, curve: new Array(64).fill(param === 'filter' ? 0.5 : 0.6) };
    } else {
      clip.auto.param = param;
    }
    persist(); renderClipPanel();
    paintCell(cellEl(state.selected.tr, state.selected.bar));
  };
});
document.querySelectorAll('.spanBtn').forEach(b => {
  b.onclick = () => {
    const clip = selectedClip();
    if (!clip || !clip.auto) return;
    pushHistory();
    clip.auto.span = +b.dataset.span;
    persist(); renderClipPanel();
  };
});
$('autoClear').onclick = () => {
  const clip = selectedClip();
  if (!clip || !clip.auto) return;
  pushHistory();
  clip.auto = null;
  persist(); renderClipPanel();
  paintCell(cellEl(state.selected.tr, state.selected.bar));
};

const autoCanvas = $('autoCanvas');
const actx = autoCanvas.getContext('2d');
// cursor: 0..1 = afspilningsposition hen over kurven (tegnes ovenpaa)
function drawAutoCanvas(cursor = null) {
  const w = autoCanvas.width, h = autoCanvas.height;
  actx.clearRect(0, 0, w, h);
  const clip = selectedClip();
  actx.strokeStyle = '#343b48';
  actx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    actx.beginPath(); actx.moveTo(w * i / 4, 0); actx.lineTo(w * i / 4, h); actx.stroke();
  }
  if (!clip || !clip.auto) {
    actx.fillStyle = '#8b94a5';
    actx.font = '15px sans-serif';
    actx.textAlign = 'center';
    actx.fillText('Tryk 🔊 eller 🌈 og tegn en kurve her', w / 2, h / 2 + 5);
  } else {
    const curve = clip.auto.curve;
    actx.strokeStyle = clip.auto.param === 'vol' ? '#ffd23f' : '#3aa0ff';
    actx.lineWidth = 4;
    actx.lineJoin = 'round';
    actx.beginPath();
    for (let i = 0; i < curve.length; i++) {
      const x = i / (curve.length - 1) * w;
      const y = (1 - curve[i]) * (h - 8) + 4;
      i === 0 ? actx.moveTo(x, y) : actx.lineTo(x, y);
    }
    actx.stroke();
  }
  if (cursor != null) {
    const x = cursor * w;
    actx.strokeStyle = '#ffffff';
    actx.lineWidth = 2.5;
    actx.shadowColor = '#ffd23f';
    actx.shadowBlur = 8;
    actx.beginPath(); actx.moveTo(x, 0); actx.lineTo(x, h); actx.stroke();
    actx.shadowBlur = 0;
  }
}

let drawing = false, lastIdx = null;
function canvasPoint(e) {
  const r = autoCanvas.getBoundingClientRect();
  const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
  const y = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
  return { idx: Math.round(x * 63), val: 1 - y };
}
autoCanvas.addEventListener('pointerdown', e => {
  const clip = selectedClip();
  if (!clip) return;
  pushHistory();
  if (!clip.auto) {
    clip.auto = { param: 'vol', span: 1, curve: new Array(64).fill(0.6) };
    renderClipPanel();
  }
  drawing = true;
  autoCanvas.setPointerCapture(e.pointerId);
  const p = canvasPoint(e);
  clip.auto.curve[p.idx] = p.val;
  lastIdx = p;
  drawAutoCanvas();
});
autoCanvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  const clip = selectedClip();
  if (!clip?.auto) return;
  const p = canvasPoint(e);
  const a = lastIdx || p;
  const lo = Math.min(a.idx, p.idx), hi = Math.max(a.idx, p.idx);
  for (let i = lo; i <= hi; i++) {
    const f = hi === lo ? 1 : (i - a.idx) / (p.idx - a.idx || 1);
    clip.auto.curve[i] = a.val + (p.val - a.val) * f;
  }
  lastIdx = p;
  drawAutoCanvas();
});
window.addEventListener('pointerup', () => {
  if (drawing) {
    drawing = false; lastIdx = null;
    persist();
    if (state.selected) paintCell(cellEl(state.selected.tr, state.selected.bar));
  }
});

// ---------------- trommemaskine ----------------
// fast kit paa 8 raekker — hver raekke kan skiftes til ENHVER lyd med ✏️.
// kittet huskes; moensteret i raekken bevares naar man skifter lyd
const DEFAULT_KIT = SEQ_INSTRUMENTS.map(si => ({ kind: 'inst', inst: si.inst }));
let seqKit;
try { seqKit = JSON.parse(localStorage.getItem('charlie-seq-kit') || 'null'); } catch (e) { seqKit = null; }
if (!Array.isArray(seqKit) || seqKit.length !== 8) seqKit = DEFAULT_KIT.map(s => ({ ...s }));
function saveKit() { localStorage.setItem('charlie-seq-kit', JSON.stringify(seqKit)); scheduleBackup(); }

function instMeta(inst) {
  return SEQ_INSTRUMENTS.find(s => s.inst === inst) || SEQ_EXTRA.find(s => s.inst === inst);
}
function seqRowDefs() {
  return seqKit.map((spec, i) => {
    if (spec.kind === 'loop') {
      const l = customLoops.find(x => x.id === spec.loopId);
      if (l) {
        return l.rec
          ? { kind: 'rec', rec: l.rec, name: l.name, emoji: l.emoji }
          : { kind: 'custom', sound: l.sound, name: l.name, emoji: l.emoji };
      }
      // lyden er slettet — fald tilbage til standard-instrumentet for raekken
    }
    const m = (spec.kind === 'inst' && instMeta(spec.inst)) || SEQ_INSTRUMENTS[i % SEQ_INSTRUMENTS.length];
    return { kind: 'inst', inst: m.inst, name: m.name, emoji: m.emoji };
  });
}
let seqRows = [];
let seqSteps = Array.from({ length: 8 }, () => new Array(16).fill(false));
function hearSeqRow(row) {
  if (row.kind === 'rec') player.hitRec(row.rec);
  else if (row.kind === 'custom') player.testCustom(row.sound);
  else player.hit(row.inst);
}
function openKitPicker(ri, x, y) {
  const pick = spec => {
    seqKit[ri] = spec;
    saveKit();
    renderSeq();
    hearSeqRow(seqRows[ri]);
  };
  const items = [{ header: '🥁 Trommer & percussion' }];
  for (const m of [...SEQ_INSTRUMENTS, ...SEQ_EXTRA]) {
    items.push({ emoji: m.emoji, label: m.name, action: () => pick({ kind: 'inst', inst: m.inst }) });
  }
  const mine = customLoops.filter(l => l.sound || l.rec);
  if (mine.length) {
    items.push({ header: '⭐ Mine Lyde' });
    for (const l of mine) {
      items.push({ emoji: l.emoji, label: l.name, action: () => pick({ kind: 'loop', loopId: l.id }) });
    }
  }
  showMenu(items, x, y);
}
function renderSeq() {
  seqRows = seqRowDefs();
  const el = $('seqGrid');
  el.innerHTML = '';
  seqRows.forEach((row, ri) => {
    const r = document.createElement('div');
    r.className = 'seqRow';
    const lab = document.createElement('div');
    lab.className = 'seqLabel';
    lab.title = row.name + ' (tryk = hør)';
    lab.textContent = row.emoji;
    lab.onclick = () => hearSeqRow(row);
    r.appendChild(lab);
    const swap = document.createElement('button');
    swap.className = 'seqSwap';
    swap.title = 'Skift lyd på denne række';
    swap.textContent = '✏️';
    swap.onclick = e => openKitPicker(ri, e.clientX, e.clientY);
    r.appendChild(swap);
    for (let s = 0; s < 16; s++) {
      const c = document.createElement('button');
      c.className = 'seqCell' + (s % 4 === 0 ? ' beat4' : '') + (seqSteps[ri][s] ? ' on' : '');
      c.onclick = () => {
        seqSteps[ri][s] = !seqSteps[ri][s];
        c.classList.toggle('on', seqSteps[ri][s]);
        if (seqSteps[ri][s]) hearSeqRow(row);
      };
      r.appendChild(c);
    }
    el.appendChild(r);
  });
}
function seqEvents() {
  const ev = [];
  seqRows.forEach((row, ri) => {
    seqSteps[ri].forEach((on, s) => {
      if (!on) return;
      if (row.kind === 'rec') {
        ev.push({ t: s / 4, inst: '@rec', rec: row.rec, dur: 0.25, vel: 1 });
      } else if (row.kind === 'custom') {
        ev.push({ t: s / 4, inst: '@custom', midi: row.sound.midi, dur: 0.25, vel: 1, params: { ...row.sound } });
      } else {
        ev.push({ t: s / 4, inst: row.inst, dur: 0.25, vel: 1 });
      }
    });
  });
  return ev;
}
// "koer i ring": trommemaskinen looper live, mens man taender/slukker felter.
// planlaegges eet slag ad gangen, saa aendringer hoeres med det samme
const seqLoopState = { on: false, timer: null, nextBeat: 0, nextTime: 0, gain: null, lastStep: -1 };
function startSeqLoop() {
  const ctx = player.ensureCtx();
  if (player.playing) togglePlay(); // stop sangen, saa de ikke spiller i munden paa hinanden
  seqLoopState.on = true;
  seqLoopState.gain = ctx.createGain();
  seqLoopState.gain.connect(player.master);
  seqLoopState.nextBeat = 0;
  seqLoopState.nextTime = ctx.currentTime + 0.1;
  seqLoopState.timer = setInterval(seqLoopTick, 30);
  $('seqLoopBtn').classList.add('active');
  seqLoopTick();
}
function seqLoopTick() {
  const ctx = player.ctx;
  const spb = 60 / state.bpm;
  while (seqLoopState.nextTime < ctx.currentTime + 0.25) {
    const beat = seqLoopState.nextBeat % 4;
    const evs = seqEvents()
      .filter(e => e.t >= beat && e.t < beat + 1)
      .map(e => ({ ...e, t: e.t - beat }));
    if (evs.length) {
      scheduleLoop(ctx, seqLoopState.gain, { takts: 1, events: evs }, seqLoopState.nextTime, state.bpm, 1);
    }
    seqLoopState.nextTime += spb;
    seqLoopState.nextBeat++;
  }
}
function stopSeqLoop() {
  if (!seqLoopState.on) return;
  clearInterval(seqLoopState.timer);
  if (seqLoopState.gain && player.ctx) {
    const g = seqLoopState.gain;
    g.gain.setTargetAtTime(0.0001, player.ctx.currentTime, 0.02);
    setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 300);
  }
  seqLoopState.on = false;
  seqLoopState.gain = null;
  $('seqLoopBtn').classList.remove('active');
  highlightSeqStep(-1);
}
function highlightSeqStep(step) {
  if (step === seqLoopState.lastStep) return;
  document.querySelectorAll('#seqGrid .seqRow').forEach(r => {
    if (seqLoopState.lastStep >= 0) r.children[seqLoopState.lastStep + 1]?.classList.remove('playStep');
    if (step >= 0) r.children[step + 1]?.classList.add('playStep');
  });
  seqLoopState.lastStep = step;
}
$('seqLoopBtn').onclick = () => (seqLoopState.on ? stopSeqLoop() : startSeqLoop());

$('seqPlay').onclick = () => {
  const ev = seqEvents();
  if (!ev.length) { toast('Tænd nogle felter først 🥁', true); return; }
  player.preview({ takts: 1, events: ev }, state.bpm);
};
$('seqClear').onclick = () => {
  seqSteps.forEach(r => r.fill(false));
  renderSeq();
};
$('seqSave').onclick = () => {
  const ev = seqEvents();
  if (!ev.length) { toast('Tænd nogle felter først 🥁', true); return; }
  const n = customLoops.filter(l => !l.sound).length + 1;
  const loop = { id: 'custom_' + Date.now(), name: `Charlies Beat ${n}`, emoji: '🥁', cat: 'mine', takts: 1, events: ev };
  customLoops.push(loop);
  LOOPS_BY_ID[loop.id] = loop;
  localStorage.setItem('charlie-custom-loops', JSON.stringify(customLoops));
  state.activeCat = 'mine';
  state.tool = { type: 'loop', id: loop.id };
  renderCats(); renderTiles(); renderEraseBtn();
  document.querySelector('.tab[data-tab="lib"]').click();
  toast(`⭐ Gemt: ${loop.name}! Tryk på en bar for at bruge det`);
};

// ---------------- hoejreklik-menu ----------------
const ctxMenu = document.createElement('div');
ctxMenu.id = 'ctxMenu';
ctxMenu.hidden = true;
document.body.appendChild(ctxMenu);

function showMenu(items, x, y) {
  if (!items.length) return;
  ctxMenu.innerHTML = '';
  for (const it of items) {
    if (it.header) {
      const h = document.createElement('div');
      h.className = 'ctxHeader';
      h.textContent = it.header;
      ctxMenu.appendChild(h);
      continue;
    }
    const b = document.createElement('button');
    b.className = 'ctxItem' + (it.danger ? ' danger' : '');
    b.textContent = `${it.emoji} ${it.label}`;
    b.onclick = () => { hideMenu(); it.action(); };
    ctxMenu.appendChild(b);
  }
  ctxMenu.hidden = false;
  ctxMenu.style.left = '0px'; ctxMenu.style.top = '0px';
  const r = ctxMenu.getBoundingClientRect();
  ctxMenu.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  ctxMenu.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
}
function hideMenu() { ctxMenu.hidden = true; }
window.addEventListener('pointerdown', e => { if (!ctxMenu.contains(e.target)) hideMenu(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu(); });
// ingen browser-menu inde i appen (undtagen i tekstfelter)
window.addEventListener('contextmenu', e => { if (!e.target.closest('input,textarea')) e.preventDefault(); });

let clipboard = null; // kopieret bar/stykke (med alle indstillinger)

function pasteInto(tr, bar) {
  if (!clipboard) return;
  pushHistory();
  state.song.cells[tr + ':' + bar] = JSON.parse(JSON.stringify(clipboard));
  persist();
  selectClip({ tr, bar });
}

// del en bar op i n stykker (eksisterende indhold ryger i foerste stykke),
// eller omfordel hvis den allerede er delt
function splitCell(tr, bar, n) {
  pushHistory();
  const key = tr + ':' + bar;
  const v = state.song.cells[key];
  const parts = new Array(n).fill(null);
  if (v && !v.split) {
    parts[0] = v;
  } else if (v && v.split) {
    v.parts.forEach((p, i) => {
      if (!p) return;
      const idx = Math.min(n - 1, Math.floor(i * n / v.split));
      if (!parts[idx]) parts[idx] = p;
    });
  }
  state.song.cells[key] = { split: n, parts };
  if (state.selected && state.selected.tr === tr && state.selected.bar === bar) selectClip(null, { hear: false });
  paintCell(cellEl(tr, bar));
  persist();
}
// saml en delt bar igen (foerste stykke bliver hele baren)
function mergeCell(tr, bar) {
  const key = tr + ':' + bar;
  const v = state.song.cells[key];
  if (!v || !v.split) return;
  pushHistory();
  const first = v.parts.find(p => p);
  if (first) state.song.cells[key] = first;
  else delete state.song.cells[key];
  if (state.selected && state.selected.tr === tr && state.selected.bar === bar) selectClip(null, { hear: false });
  paintCell(cellEl(tr, bar));
  persist();
}

gridEl.addEventListener('contextmenu', e => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const tr = +cell.dataset.tr, bar = +cell.dataset.bar;
  const key = tr + ':' + bar;
  const clip = state.song.cells[key];
  const items = [];
  // delt bar: menu for det stykke der blev hoejreklikket paa
  if (clip && clip.split) {
    const slot = slotAt(cell, e.clientX, clip.split);
    const part = clip.parts[slot];
    if (part) {
      const loop = effLoop(part);
      items.push({ emoji: '🔊', label: 'Hør stykket', action: () => selectClip({ tr, bar, slot }) });
      items.push({ emoji: '📋', label: 'Kopiér stykket', action: () => {
        clipboard = JSON.parse(JSON.stringify(part));
        toast(`📋 Kopieret: ${loop ? loop.name : 'stykke'}`);
      } });
      items.push({ emoji: '🧽', label: 'Slet stykket', danger: true, action: () => {
        pushHistory();
        clip.parts[slot] = null;
        if (clip.parts.every(p => !p)) delete state.song.cells[key];
        if (state.selected && state.selected.tr === tr && state.selected.bar === bar) selectClip(null, { hear: false });
        paintCell(cell); persist();
      } });
    } else if (clipboard && !clipboard.split) {
      items.push({ emoji: '📌', label: 'Sæt ind her', action: () => {
        pushHistory();
        clip.parts[slot] = JSON.parse(JSON.stringify(clipboard));
        persist();
        selectClip({ tr, bar, slot });
      } });
    }
    if (clip.split === 2) items.push({ emoji: '✂️', label: 'Del i 4 i stedet', action: () => splitCell(tr, bar, 4) });
    if (clip.split === 4) items.push({ emoji: '✂️', label: 'Del i 2 i stedet', action: () => splitCell(tr, bar, 2) });
    items.push({ emoji: '🔗', label: 'Saml baren igen', action: () => mergeCell(tr, bar) });
    showMenu(items, e.clientX, e.clientY);
    return;
  }
  if (clip) {
    const loop = effLoop(clip);
    items.push({ emoji: '🔊', label: 'Hør baren', action: () => selectClip({ tr, bar }) });
    items.push({ emoji: '📋', label: 'Kopiér', action: () => {
      clipboard = JSON.parse(JSON.stringify(clip));
      toast(`📋 Kopieret: ${loop ? loop.name : 'bar'}`);
    } });
    if (clipboard) items.push({ emoji: '📌', label: 'Sæt ind (erstat)', action: () => pasteInto(tr, bar) });
    if (clip.auto) items.push({ emoji: '📈', label: 'Fjern automation', action: () => {
      pushHistory(); clip.auto = null; persist(); paintCell(cell); renderClipPanel();
    } });
    items.push({ emoji: '✂️', label: 'Del baren i 2', action: () => splitCell(tr, bar, 2) });
    items.push({ emoji: '✂️', label: 'Del baren i 4', action: () => splitCell(tr, bar, 4) });
    items.push({ emoji: '🧽', label: 'Slet', danger: true, action: () => {
      pushHistory();
      delete state.song.cells[key];
      if (state.selected && state.selected.tr === tr && state.selected.bar === bar) selectClip(null, { hear: false });
      paintCell(cell); persist();
    } });
  } else {
    if (clipboard) items.push({ emoji: '📌', label: 'Sæt ind', action: () => pasteInto(tr, bar) });
    items.push({ emoji: '✂️', label: 'Del baren i 2', action: () => splitCell(tr, bar, 2) });
    items.push({ emoji: '✂️', label: 'Del baren i 4', action: () => splitCell(tr, bar, 4) });
  }
  showMenu(items, e.clientX, e.clientY);
});

function saveCustoms() {
  localStorage.setItem('charlie-custom-loops', JSON.stringify(customLoops));
  scheduleBackup();
}
function renameCustom(loop) {
  const name = prompt('Nyt navn:', loop.name);
  if (!name || !name.trim()) return;
  loop.name = name.trim().slice(0, 24);
  saveCustoms();
  renderTiles(); renderSeq(); renderPadInsts(); renderSndSources(); repaintAll(); renderClipPanel();
  toast('✏️ Omdøbt til ' + loop.name);
}
function deleteCustom(loop) {
  const used = Object.keys(state.song.cells).filter(k => {
    const v = state.song.cells[k];
    return v.loopId === loop.id || (v.split && v.parts.some(p => p && p.loopId === loop.id));
  });
  let extra = used.length ? ` Den bruges i ${used.length} bar${used.length > 1 ? 's' : ''}, som også slettes.` : '';
  if (loop.rec) {
    const soundsUsing = customLoops.filter(l => l.sound?.src === loop.rec).length;
    if (soundsUsing) extra += ` OBS: ${soundsUsing} Lydmaskine-lyd${soundsUsing > 1 ? 'e' : ''} bruger optagelsen og mister den.`;
  }
  if (!confirm(`Slet "${loop.name}" helt fra Mine Lyde?${extra}`)) return;
  if (used.length) {
    pushHistory();
    used.forEach(k => delete state.song.cells[k]);
    if (state.selected && used.includes(state.selected.tr + ':' + state.selected.bar)) selectClip(null, { hear: false });
  }
  customLoops = customLoops.filter(l => l !== loop);
  delete LOOPS_BY_ID[loop.id];
  if (state.tool?.type === 'loop' && state.tool.id === loop.id) state.tool = null;
  if (loop.rec) {
    // slet ogsaa selve lydfilen
    if (hasServer) fetch('/record-delete', { method: 'POST', body: JSON.stringify({ file: loop.rec }) }).catch(() => {});
    else idbDel('rec:' + loop.rec).catch(() => {});
  }
  if (sndParams.src === loop.rec) { sndParams.src = null; syncSndUI(); }
  // ryd raekker i trommemaskinens kit der pegede paa lyden
  seqKit = seqKit.map((s, i) => (s.kind === 'loop' && s.loopId === loop.id)
    ? { kind: 'inst', inst: SEQ_INSTRUMENTS[i % SEQ_INSTRUMENTS.length].inst } : s);
  saveKit();
  saveCustoms(); persist();
  renderTiles(); renderSeq(); renderPadInsts(); renderSndSources(); renderEraseBtn(); repaintAll(); renderClipPanel();
  toast('🗑️ Slettet: ' + loop.name);
}

$('tiles').addEventListener('contextmenu', e => {
  const t = e.target.closest('.tile');
  if (!t) return;
  const loop = LOOPS_BY_ID[t.dataset.loopId];
  if (!loop) return;
  const items = [{ emoji: '▶️', label: 'Hør lyden', action: () => player.preview(loop, state.bpm) }];
  if (customLoops.includes(loop)) {
    items.push({ emoji: '✏️', label: 'Omdøb', action: () => renameCustom(loop) });
    items.push({ emoji: '🗑️', label: 'Slet fra Mine Lyde', danger: true, action: () => deleteCustom(loop) });
  }
  showMenu(items, e.clientX, e.clientY);
});

// ---------------- lydmaskine ----------------
const PENT = [0, 2, 4, 7, 9]; // C-dur pentatonisk
function snapPent(midi) {
  let best = midi, bd = 99;
  for (let oct = 24; oct <= 96; oct += 12) {
    for (const d of PENT) {
      const m = oct + d;
      if (Math.abs(m - midi) < bd) { bd = Math.abs(m - midi); best = m; }
    }
  }
  return best;
}
const sndParams = {
  wave: 'sine', src: null, rev: false, midi: 60, len: 0.5,
  slide: 0, punch: 0, fat: 0, wah: 0, wobble: 0, bright: 0.7, echo: 0,
  pan: 0, attack: 0, verb: 0, trem: 0, dist: 0,
};

// startpunkter: saet sliderne til en genkendelig lyd, som Charlie kan skrue videre paa
const D0 = { src: null, rev: false, slide: 0, punch: 0, fat: 0, wah: 0, wobble: 0, echo: 0, pan: 0, attack: 0, verb: 0, trem: 0, dist: 0 }; // faelles nulpunkt
const SND_PRESETS = [
  { name: 'Stortromme', emoji: '🦶', p: { ...D0, wave: 'sine', midi: 28, len: 0.35, punch: 0.8, bright: 0.5 } },
  { name: 'Lilletromme', emoji: '🥁', p: { ...D0, wave: 'noise', midi: 57, len: 0.18, punch: 0.4, bright: 0.8 } },
  { name: 'Hi-hat', emoji: '🎩', p: { ...D0, wave: 'noise', midi: 81, len: 0.07, bright: 1 } },
  { name: 'Klap', emoji: '👏', p: { ...D0, wave: 'noise', midi: 64, len: 0.22, punch: 0.2, bright: 0.85, echo: 0.12 } },
  { name: 'Tam', emoji: '🛢️', p: { ...D0, wave: 'sine', midi: 45, len: 0.3, punch: 0.5, bright: 0.7 } },
  { name: 'Dyb Bas', emoji: '🐘', p: { ...D0, wave: 'sine', midi: 36, len: 0.5, punch: 0.1, fat: 0.4, bright: 0.5 } },
  { name: 'Rock Bas', emoji: '🦖', p: { ...D0, wave: 'sawtooth', midi: 36, len: 0.4, fat: 0.5, wah: 0.35, bright: 0.6 } },
  { name: 'Syre Bas', emoji: '🍋', p: { ...D0, wave: 'sawtooth', midi: 36, len: 0.3, wah: 0.9, bright: 0.7, echo: 0.1 } },
  { name: 'Synth Lead', emoji: '🚀', p: { ...D0, wave: 'sawtooth', midi: 72, len: 0.6, fat: 0.7, bright: 0.8, echo: 0.2 } },
  { name: 'Spille-synth', emoji: '👾', p: { ...D0, wave: 'square', midi: 72, len: 0.25, bright: 0.9 } },
  { name: 'Blød Synth', emoji: '☁️', p: { ...D0, wave: 'triangle', midi: 64, len: 1.6, fat: 0.6, bright: 0.5, echo: 0.3, attack: 0.45, verb: 0.35 } },
  { name: 'Spøgelse', emoji: '👻', p: { ...D0, wave: 'sine', midi: 76, len: 1.4, wobble: 0.25, bright: 0.4, attack: 0.6, verb: 0.7, trem: 0.4 } },
  { name: 'El-guitar', emoji: '🎸', p: { ...D0, wave: 'sawtooth', midi: 48, len: 0.7, dist: 0.7, bright: 0.6, verb: 0.2 } },
  { name: 'Laser', emoji: '🔫', p: { ...D0, wave: 'sawtooth', midi: 84, len: 0.3, slide: -1, bright: 0.9, echo: 0.25 } },
  { name: 'Robot', emoji: '🤖', p: { ...D0, wave: 'square', midi: 48, len: 0.4, wobble: 0.8, bright: 0.6, echo: 0.2 } },
  { name: 'Tone', emoji: '🎵', p: { ...D0, wave: 'sine', midi: 60, len: 0.5, bright: 0.7 } },
];

const SND_SLIDERS = [['sndPitch', 'midi'], ['sndLen', 'len'], ['sndPunch', 'punch'], ['sndSlide', 'slide'], ['sndFat', 'fat'], ['sndWah', 'wah'], ['sndWobble', 'wobble'], ['sndBright', 'bright'], ['sndEcho', 'echo'], ['sndPan', 'pan'], ['sndAttack', 'attack'], ['sndVerb', 'verb'], ['sndTrem', 'trem'], ['sndDist', 'dist']];
function syncSndUI() {
  for (const [id, prop] of SND_SLIDERS) $(id).value = sndParams[prop];
  document.querySelectorAll('.waveBtn').forEach(b =>
    b.classList.toggle('active', !sndParams.src && b.dataset.wave === sndParams.wave));
  document.querySelectorAll('.recSrcBtn').forEach(b =>
    b.classList.toggle('active', sndParams.src === b.dataset.src));
  $('sndRev').classList.toggle('active', !!sndParams.rev);
}
$('sndRev').onclick = () => {
  sndParams.rev = !sndParams.rev;
  syncSndUI();
  if (sndParams.src) player.testCustom(sndParams); // baglaens gaelder kun optagelser
};
// Charlies optagelser som kilder i Lydmaskinen
function renderSndSources() {
  const el = $('sndRecSources');
  if (!el) return;
  el.innerHTML = '';
  for (const l of customLoops.filter(x => x.rec)) {
    const b = document.createElement('button');
    b.className = 'recSrcBtn' + (sndParams.src === l.rec ? ' active' : '');
    b.dataset.src = l.rec;
    b.textContent = `${l.emoji} ${l.name}`;
    b.title = 'Brug optagelsen som lyd-kilde';
    b.onclick = () => {
      sndParams.src = l.rec;
      syncSndUI();
      player.testCustom(sndParams);
    };
    el.appendChild(b);
  }
}
function renderSndPresets() {
  const el = $('sndPresets');
  el.innerHTML = '';
  for (const pre of SND_PRESETS) {
    const b = document.createElement('button');
    b.className = 'presetBtn';
    b.textContent = `${pre.emoji} ${pre.name}`;
    b.onclick = () => {
      Object.assign(sndParams, pre.p);
      syncSndUI();
      player.testCustom(sndParams);
    };
    el.appendChild(b);
  }
}

document.querySelectorAll('.waveBtn').forEach(b => {
  b.onclick = () => {
    sndParams.wave = b.dataset.wave;
    sndParams.src = null; // tilbage til synth-kilde
    syncSndUI();
    player.testCustom(sndParams);
  };
});
for (const [id, prop] of SND_SLIDERS) {
  $(id).oninput = e => {
    let v = Number(e.target.value);
    if (prop === 'midi') v = snapPent(v);
    sndParams[prop] = v;
  };
  $(id).onchange = () => player.testCustom(sndParams); // hoer lyden naar man slipper
}
$('sndTest').onclick = () => player.testCustom(sndParams);

// nulstil: tilbage til lyden praecis som den var (optagelse = naturlig afspilning)
$('sndReset').onclick = () => {
  if (sndParams.src) {
    const dur = recordingDuration(sndParams.src) || 1;
    Object.assign(sndParams, D0, {
      src: sndParams.src,
      midi: 60,                                  // naturlig tonehøjde
      len: Math.min(Math.ceil(dur * 100) / 100, 4), // hele optagelsen
      bright: 1,                                 // filteret helt åbent
    });
  } else {
    Object.assign(sndParams, D0, { midi: 60, len: 0.5, bright: 0.7 });
  }
  syncSndUI();
  player.testCustom(sndParams);
  toast('🔄 Lyden er nulstillet');
};

const SND_EMOJI = ['🧪', '🎈', '🪄', '🍬', '🫧', '🌟', '🥳', '🦖', '🍄', '🛸'];
$('sndSave').onclick = () => {
  const n = customLoops.filter(l => l.sound).length + 1;
  const durBeats = Math.max(0.25, Math.min(sndParams.len / 0.545, 4)); // ca. beats ved 110 BPM
  const loop = {
    id: 'custom_' + Date.now(),
    name: `Charlies Lyd ${n}`,
    emoji: SND_EMOJI[(n - 1) % SND_EMOJI.length],
    cat: 'mine', takts: 1,
    sound: { ...sndParams },
    // spiller paa hvert taktslag 1; brug takt-vaelgeren eller Trommemaskinen til rytmer
    events: [{ t: 0, inst: '@custom', midi: sndParams.midi, dur: durBeats, vel: 1 }],
  };
  customLoops.push(loop);
  LOOPS_BY_ID[loop.id] = loop;
  localStorage.setItem('charlie-custom-loops', JSON.stringify(customLoops));
  state.activeCat = 'mine';
  state.tool = { type: 'loop', id: loop.id };
  renderCats(); renderTiles(); renderEraseBtn();
  renderSeq(); // lyden bliver ogsaa en raekke i Trommemaskinen
  document.querySelector('.tab[data-tab="lib"]').click();
  toast(`${loop.emoji} Gemt: ${loop.name}! Læg den i en bar — eller vælg den i Trommemaskinen med ✏️`);
};

// ---------------- optag (mikrofon) ----------------
const recBtn = $('recBtn');
const REC_MAX_SEC = 4;
let recStream = null, recRecorder = null, recChunks = [], recBuffer = null, recTimer = null;

// gem en optagelse: paa disken via serveren hjemme, i browserens IndexedDB online
async function storeRecording(name, wavBytes) {
  try {
    if (hasServer) {
      const r = await fetch('/record', {
        method: 'POST',
        headers: { 'X-Name': encodeURIComponent(name), 'Content-Type': 'application/octet-stream' },
        body: wavBytes,
      });
      if (!r.ok) throw new Error('server');
      return (await r.json()).file;
    }
    const file = `${name}.wav`;
    await idbSet('rec:' + file, wavBytes);
    return file;
  } catch (e) {
    toast('Kunne ikke gemme optagelsen', true);
    return null;
  }
}

async function ensureMic() {
  if (recStream && recStream.active) return recStream;
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return recStream;
  } catch (e) {
    toast('Kunne ikke få adgang til mikrofonen 🎙️', true);
    return null;
  }
}

async function startRec() {
  if (recRecorder) return;
  if (!(await ensureMic())) return;
  recChunks = [];
  recRecorder = new MediaRecorder(recStream);
  recRecorder.ondataavailable = e => recChunks.push(e.data);
  recRecorder.onstop = processRec;
  recRecorder.start();
  recBtn.classList.add('recording');
  recBtn.innerHTML = '🔴 OPTAGER…<br>SLIP NÅR DU ER FÆRDIG';
  $('recResult').hidden = true;
  recTimer = setTimeout(stopRec, REC_MAX_SEC * 1000);
}
function stopRec() {
  clearTimeout(recTimer);
  if (recRecorder && recRecorder.state === 'recording') recRecorder.stop();
}
recBtn.addEventListener('pointerdown', e => { e.preventDefault(); startRec(); });
window.addEventListener('pointerup', stopRec);

// trim stilhed, normaliser og goer mono
function trimRecording(buf) {
  const ctx = player.ensureCtx();
  const sr = buf.sampleRate;
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak < 0.01) return null; // kun stilhed
  const th = peak * 0.04;
  let start = 0, end = d.length - 1;
  while (start < d.length && Math.abs(d[start]) < th) start++;
  while (end > start && Math.abs(d[end]) < th) end--;
  start = Math.max(0, start - Math.floor(sr * 0.02));
  end = Math.min(d.length - 1, end + Math.floor(sr * 0.15));
  const len = Math.min(end - start + 1, Math.floor(REC_MAX_SEC * sr));
  if (len < sr * 0.05) return null;
  const out = ctx.createBuffer(1, len, sr);
  const o = out.getChannelData(0);
  const scale = 0.9 / peak;
  for (let i = 0; i < len; i++) o[i] = d[start + i] * scale;
  // kort fade ind/ud mod klik
  const fade = Math.min(Math.floor(sr * 0.008), len >> 1);
  for (let i = 0; i < fade; i++) {
    o[i] *= i / fade;
    o[len - 1 - i] *= i / fade;
  }
  return out;
}

async function processRec() {
  recRecorder = null;
  recBtn.classList.remove('recording');
  recBtn.innerHTML = '🎙️ HOLD KNAPPEN NEDE<br>OG SIG NOGET SJOVT';
  try {
    const blob = new Blob(recChunks);
    const raw = await player.ensureCtx().decodeAudioData(await blob.arrayBuffer());
    recBuffer = trimRecording(raw);
  } catch (e) {
    console.warn(e);
    recBuffer = null;
  }
  if (!recBuffer) {
    toast('Der var kun stilhed 🤫 — prøv igen', true);
    return;
  }
  $('recResult').hidden = false;
  player.playBuffer(recBuffer);
}

// sjove stemmer: egern (hurtig/lys), kaempe (langsom/dyb), robot (hakkende)
let recEffect = 'normal';
function transformRec(buf, fx) {
  if (fx === 'normal' || !buf) return buf;
  const ctx = player.ensureCtx();
  const sr = buf.sampleRate;
  const d = buf.getChannelData(0);
  if (fx === 'egern' || fx === 'kaempe') {
    const rate = fx === 'egern' ? 1.6 : 0.6;
    const len = Math.floor(d.length / rate);
    const out = ctx.createBuffer(1, len, sr);
    const o = out.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i * rate, i0 = Math.floor(p);
      o[i] = d[i0] + (d[Math.min(i0 + 1, d.length - 1)] - d[i0]) * (p - i0);
    }
    return out;
  }
  if (fx === 'robot') {
    const out = ctx.createBuffer(1, d.length, sr);
    const o = out.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      o[i] = d[i] * (Math.sin(2 * Math.PI * 35 * i / sr) > 0 ? 1 : 0.22);
    }
    return out;
  }
  return buf;
}
function currentRecBuffer() {
  return recBuffer ? transformRec(recBuffer, recEffect) : null;
}
document.querySelectorAll('.fxBtn').forEach(b => {
  b.onclick = () => {
    recEffect = b.dataset.fx;
    document.querySelectorAll('.fxBtn').forEach(x => x.classList.toggle('active', x === b));
    const buf = currentRecBuffer();
    if (buf) player.playBuffer(buf);
  };
});
function resetRecFx() {
  recEffect = 'normal';
  document.querySelectorAll('.fxBtn').forEach(x => x.classList.toggle('active', x.dataset.fx === 'normal'));
}

$('recPlay').onclick = () => { const buf = currentRecBuffer(); if (buf) player.playBuffer(buf); };
$('recRetry').onclick = () => { recBuffer = null; resetRecFx(); $('recResult').hidden = true; };

const REC_EMOJI = ['🗣️', '📢', '🦁', '🐱', '👻', '🐸', '🦆', '🐷'];
const FX_SUFFIX = { normal: '', egern: ' Egern', kaempe: ' Kæmpe', robot: ' Robot' };
$('recSave').onclick = async () => {
  const saveBuf = currentRecBuffer();
  if (!saveBuf) return;
  const n = customLoops.filter(l => l.rec).length + 1;
  const name = `Charlies Stemme ${n}${FX_SUFFIX[recEffect] || ''}`;
  const file = await storeRecording(name, encodeWav(saveBuf));
  if (!file) return;
  registerRecordingBuffer(file, saveBuf);
  const loop = {
    id: 'rec_' + Date.now(),
    name, emoji: REC_EMOJI[(n - 1) % REC_EMOJI.length],
    cat: 'mine', takts: 1, rec: file,
    events: [{ t: 0, inst: '@rec', dur: 1, vel: 1 }],
  };
  customLoops.push(loop);
  LOOPS_BY_ID[loop.id] = loop;
  saveCustoms();
  recBuffer = null;
  resetRecFx();
  $('recResult').hidden = true;
  state.activeCat = 'mine';
  state.tool = { type: 'loop', id: loop.id };
  renderCats(); renderTiles(); renderEraseBtn(); renderSeq(); renderPadInsts(); renderSndSources();
  document.querySelector('.tab[data-tab="lib"]').click();
  toast(`${loop.emoji} Gemt: ${name}! Læg den i en bar — eller vælg den i Trommemaskinen med ✏️`);
};

// ---------------- syng med sangen ----------------
// mikrofonen optager mens sangen spiller een gang igennem; stemmen laegges
// derefter ind som bar-clips paa et ledigt spor, synkroniseret med sangen
let sing = null;
$('singBtn').onclick = () => (sing ? stopSing() : startSing());

async function startSing() {
  const stream = await ensureMic();
  if (!stream) return;
  stopSeqLoop();
  if (player.playing) togglePlay(); // vi starter forfra sammen med optagelsen
  const rec = new MediaRecorder(stream);
  const take = { rec, chunks: [], cellDur: BEATS_PER_CELL * 60 / state.bpm, bars: state.song.bars, r0: 0, p0: 0, timer: null };
  rec.ondataavailable = e => take.chunks.push(e.data);
  rec.onstop = () => processSing(take);
  rec.onstart = () => {
    take.r0 = performance.now();
    player.play(0);
    setPlayingUI(true);
    take.p0 = performance.now();
    // stop selv efter een gennemspilning
    take.timer = setTimeout(stopSing, take.cellDur * take.bars * 1000 + 200);
  };
  sing = take;
  rec.start();
  $('singBtn').classList.add('recording');
  $('singBtn').innerHTML = '⏹ STOP<br>SANGEN OPTAGER…';
}
function stopSing() {
  if (!sing) return;
  clearTimeout(sing.timer);
  if (sing.rec.state === 'recording') sing.rec.stop();
}

async function processSing(take) {
  sing = null;
  $('singBtn').classList.remove('recording');
  $('singBtn').innerHTML = '🎤 SYNG<br>MED SANGEN';
  if (player.playing) togglePlay();
  let buf;
  try {
    const blob = new Blob(take.chunks);
    buf = await player.ensureCtx().decodeAudioData(await blob.arrayBuffer());
  } catch (e) {
    toast('Optagelsen mislykkedes — prøv igen', true);
    return;
  }
  // klip mikrofonens forspring fra, saa stemmen ligger i takt med sangen
  const skew = Math.max(0, (take.p0 - take.r0) / 1000);
  const sr = buf.sampleRate;
  const d = buf.getChannelData(0);
  const start = Math.min(Math.floor(skew * sr), Math.max(d.length - 1, 0));
  const len = Math.min(d.length - start, Math.floor(take.cellDur * take.bars * sr));
  if (len < sr * 0.2) { toast('Der kom ingen sang med 🤫', true); return; }
  let peak = 0;
  for (let i = start; i < start + len; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak < 0.01) { toast('Der var kun stilhed 🤫 — prøv igen', true); return; }
  const ctx = player.ensureCtx();
  const out = ctx.createBuffer(1, len, sr);
  const o = out.getChannelData(0);
  const scale = 0.9 / peak;
  for (let i = 0; i < len; i++) o[i] = d[start + i] * scale;
  // gem hele optagelsen paa disken og som lyd i Mine Lyde
  const n = customLoops.filter(l => l.rec).length + 1;
  const name = `Charlies Sang-stemme ${n}`;
  const file = await storeRecording(name, encodeWav(out));
  if (!file) return;
  registerRecordingBuffer(file, out);
  const takeLoop = {
    id: 'rec_' + Date.now(), name, emoji: '🎤', cat: 'mine', takts: 1, rec: file,
    events: [{ t: 0, inst: '@rec', dur: 1, vel: 1 }],
  };
  customLoops.push(takeLoop);
  LOOPS_BY_ID[takeLoop.id] = takeLoop;
  saveCustoms();
  renderTiles(); renderPadInsts(); renderSndSources();
  // laeg stemmen ind i sangen, en bar-bid ad gangen
  const covered = Math.min(Math.ceil(out.duration / take.cellDur), take.bars);
  const bars = Array.from({ length: covered }, (_, k) => k);
  const tr = findFreeTrack(bars);
  if (tr < 0) {
    toast(`🎤 Gemt som "${name}" i Mine Lyde — men der var ingen ledige spor`, true);
    return;
  }
  pushHistory();
  for (let k = 0; k < covered; k++) {
    state.song.cells[tr + ':' + k] = {
      inline: {
        name: 'Charlies Stemme', emoji: '🎤', cat: 'vokal', takts: 4,
        events: [{ t: 0, inst: '@rec', rec: file, off: k * take.cellDur, cut: take.cellDur, dur: 16, vel: 1 }],
      },
      vol: 0.9, pan: 0, filter: 0.5, comp: 0, auto: null,
    };
    const c = cellEl(tr, k);
    if (c) paintCell(c);
  }
  persist();
  toast(`🎤 Stemmen ligger på spor ${tr + 1}! Tryk ▶️ og hør jer selv`);
}

// ---------------- spille-pads ----------------
const PAD_NOTES = [60, 62, 64, 67, 69, 72, 74, 76]; // C-dur pentatonisk over 2 oktaver
const PAD_COLORS = ['#ff5a5f', '#ff8a3d', '#ffd23f', '#2fd06f', '#4dd6c1', '#3aa0ff', '#b06cff', '#ff5ad0'];
const PAD_LABELS = ['Do', 'Re', 'Mi', 'Sol', 'La', 'Do', 'Re', 'Mi'];
let padInst = { inst: 'smpPiano', name: 'Klaver', emoji: '🎹' };

function padInstDefs() {
  return [
    { inst: 'smpPiano', name: 'Klaver', emoji: '🎹' },
    { inst: 'smpXylo', name: 'Xylofon', emoji: '🍭' },
    { inst: 'smpGlock', name: 'Klokkespil', emoji: '🔔' },
    { inst: 'smpTrumpetStac', name: 'Trompet', emoji: '🎺' },
    { inst: 'smpPizz', name: 'Pizzicato', emoji: '🤏' },
    { inst: 'smpVoxChop', name: 'Vokal', emoji: '🎤' },
    { inst: 'lead', name: 'Synth', emoji: '🚀' },
    { inst: 'sawbass', name: 'Bas', emoji: '🐘', shift: -24 },
    { inst: 'marimba', name: 'Marimba', emoji: '🦜' },
    // Charlies egne optagelser kan ogsaa spilles paa pads (pitch-shiftet!)
    ...customLoops.filter(l => l.rec).map(l => ({ rec: l.rec, name: l.name, emoji: l.emoji })),
  ];
}
function renderPadInsts() {
  const el = $('padInsts');
  if (!el) return;
  el.innerHTML = '';
  for (const def of padInstDefs()) {
    const b = document.createElement('button');
    b.className = 'padInstBtn' + ((padInst.inst && padInst.inst === def.inst) || (padInst.rec && padInst.rec === def.rec) ? ' active' : '');
    b.textContent = `${def.emoji} ${def.name}`;
    b.onclick = () => {
      padInst = def;
      renderPadInsts();
      player.padHit(def, 72);
    };
    el.appendChild(b);
  }
}
function renderPads() {
  const el = $('padGrid');
  el.innerHTML = '';
  PAD_NOTES.forEach((midi, i) => {
    const p = document.createElement('button');
    p.className = 'pad';
    p.style.background = PAD_COLORS[i];
    p.innerHTML = `${['🔴','🟠','🟡','🟢','🩵','🔵','🟣','🩷'][i] ?? '🎵'}<span class="nm">${PAD_LABELS[i]}</span>`;
    p.addEventListener('pointerdown', e => {
      e.preventDefault();
      player.padHit(padInst, midi);
      // optager vi? saa noter slaget, kvantiseret til naermeste halve slag
      if (padRec) {
        const pos = player.position();
        if (pos) {
          let beat = Math.round(pos.frac * BEATS_PER_CELL * 2) / 2;
          let bar = pos.bar;
          if (beat >= BEATS_PER_CELL) { beat = 0; bar = (bar + 1) % state.song.bars; }
          padRec.hits.push({ bar, beat, midi, spec: { ...padInst } });
        }
      }
      p.classList.add('hit');
      setTimeout(() => p.classList.remove('hit'), 120);
    });
    el.appendChild(p);
  });
}

// optag pad-spil ind i sangen som rigtige bar-clips
let padRec = null;
function findFreeTrack(bars) {
  for (let tr = 0; tr < TRACKS; tr++) {
    if (bars.every(b => !state.song.cells[tr + ':' + b])) return tr;
  }
  return -1;
}
$('padRecBtn').onclick = () => (padRec ? stopPadRec() : startPadRec());
function startPadRec() {
  stopSeqLoop();
  if (!player.playing) { player.play(); setPlayingUI(true); }
  padRec = { hits: [] };
  $('padRecBtn').classList.add('recording');
  $('padRecBtn').textContent = '⏹ Stop og læg i sangen';
}
function stopPadRec() {
  const hits = padRec.hits;
  padRec = null;
  $('padRecBtn').classList.remove('recording');
  $('padRecBtn').textContent = '🔴 Optag dit spil';
  if (!hits.length) { toast('Du nåede ikke at spille noget 🎹', true); return; }
  const bars = [...new Set(hits.map(h => h.bar))];
  const tr = findFreeTrack(bars);
  if (tr < 0) { toast('Ingen ledige spor til dit spil — slet noget først', true); return; }
  pushHistory();
  for (const b of bars) {
    const events = hits.filter(h => h.bar === b).map(h => h.spec.rec
      ? { t: h.beat, inst: '@rec', rec: h.spec.rec, dur: 0.5, vel: 1 }
      : { t: h.beat, inst: h.spec.inst, midi: h.midi + (h.spec.shift || 0), dur: 0.5, vel: 1 });
    state.song.cells[tr + ':' + b] = {
      inline: { name: 'Charlies Spil', emoji: '🎹', cat: 'mine', takts: 4, events },
      vol: 0.9, pan: 0, filter: 0.5, comp: 0, auto: null,
    };
    const c = cellEl(tr, b);
    if (c) paintCell(c);
  }
  persist();
  toast(`🎹 Optaget! Dit spil ligger på spor ${tr + 1} — Ctrl+Z fortryder`);
}

// ---------------- transport ----------------
const playBtn = $('playBtn');
function setPlayingUI(on) {
  playBtn.textContent = on ? '⏹' : '▶️';
  playBtn.classList.toggle('playing', on);
  playheadEl.style.display = on ? 'block' : 'none';
  if (!on) document.querySelectorAll('.barNum').forEach(b => b.classList.remove('current'));
}
function togglePlay() {
  if (player.playing) {
    player.stop();
    setPlayingUI(false);
  } else {
    stopSeqLoop();
    player.play();
    setPlayingUI(true);
  }
}
playBtn.onclick = togglePlay;
// klik paa et bar-tal: hop derhen og spil derfra
barNumsEl.addEventListener('click', e => {
  const num = e.target.closest('.barNum');
  if (!num) return;
  stopSeqLoop();
  player.play(+num.dataset.bar);
  setPlayingUI(true);
});
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT') { e.preventDefault(); togglePlay(); }
  // Delete/Backspace sletter den valgte bar / det valgte stykke
  if ((e.key === 'Delete' || e.key === 'Backspace') && e.target.tagName !== 'INPUT') {
    if (!selectedClip()) return;
    e.preventDefault();
    deleteSelected();
    toast('🧽 Slettet — Ctrl+Z fortryder');
  }
});

$('tempo').oninput = e => {
  state.bpm = Number(e.target.value);
  $('bpmLabel').textContent = state.bpm;
  persist();
};
$('tempo').value = state.bpm;
$('bpmLabel').textContent = state.bpm;

$('moreBars').onclick = () => {
  if (state.song.bars < 16) { pushHistory(); state.song.bars++; renderGrid(); persist(); }
};
$('lessBars').onclick = () => {
  if (state.song.bars > 1) { pushHistory(); state.song.bars--; if (state.selected && state.selected.bar >= state.song.bars) selectClip(null); renderGrid(); persist(); }
};

$('newBtn').onclick = () => {
  if (!confirm('Vil du starte helt forfra? Sangen bliver slettet. (Ctrl+Z fortryder)')) return;
  pushHistory();
  state.song = newSong();
  selectClip(null);
  renderGrid(); renderHeads(); persist();
};

// playhead-animation + danser + trommemaskine-loebelys
const DANCERS = ['🕺', '💃', '🐸', '🦁', '🐵', '🦄', '🤖', '👾', '🐧', '🦖'];
const dancerEl = $('dancer');
let lastDanceBeat = -1;
function tick() {
  const pos = player.position();
  if (pos) {
    const x = (pos.bar + pos.frac) * CELL_W;
    playheadEl.style.left = x + 'px';
    document.querySelectorAll('.barNum').forEach(b =>
      b.classList.toggle('current', +b.dataset.bar === pos.bar));
    // hold playhead synlig
    const viewL = gridScroll.scrollLeft, viewR = viewL + gridScroll.clientWidth;
    if (x < viewL || x > viewR - 40) gridScroll.scrollLeft = Math.max(0, x - 60);
    // danseren hopper paa hvert slag og skifter figur pr. bar
    dancerEl.hidden = false;
    dancerEl.textContent = DANCERS[pos.bar % DANCERS.length];
    const beat = Math.floor(pos.frac * BEATS_PER_CELL);
    if (beat !== lastDanceBeat) {
      lastDanceBeat = beat;
      dancerEl.style.animation = 'none';
      void dancerEl.offsetWidth;
      dancerEl.style.animation = 'dancerBounce 0.22s';
    }
  } else {
    dancerEl.hidden = true;
  }
  // loebelys i trommemaskinen
  if (seqLoopState.on && player.ctx) {
    const spb = 60 / state.bpm;
    const loopStart = seqLoopState.nextTime - seqLoopState.nextBeat * spb;
    const step = Math.floor((player.ctx.currentTime - loopStart) / (spb / 4)) % 16;
    highlightSeqStep(((step % 16) + 16) % 16);
  }
  // cursor i automation-vinduet: hvor i den valgte bar er afspilningen?
  let autoCursor = null;
  if (state.selected && !drawing && !$('clipEdit').hidden) {
    const clip = selectedClip();
    if (clip) {
      const span = clip.auto?.span || 1;
      if (pos) {
        const rel = pos.bar - state.selected.bar;
        if (rel >= 0 && rel < span) autoCursor = (rel + pos.frac) / span;
      } else {
        const pr = player.isPreviewing('clip:' + state.selected.tr + ':' + state.selected.bar)
          ? player.previewProgress() : null;
        if (pr != null) autoCursor = pr / span; // forsmagen spiller kun barens egen del af kurven
      }
    }
  }
  if (autoCursor !== lastAutoCursor) {
    lastAutoCursor = autoCursor;
    drawAutoCanvas(autoCursor);
  }
  requestAnimationFrame(tick);
}
let lastAutoCursor = null;
requestAnimationFrame(tick);

// ---------------- sang-bibliotek ----------------
const SONG_EMOJI = ['🎵', '🌟', '🚀', '🦄', '🐸', '🌈', '🔥', '🍭', '🤖', '👑', '🐘', '🎪'];
let songLib = [];
try { songLib = JSON.parse(localStorage.getItem('charlie-songs') || '[]'); } catch (e) {}
let currentSongId = localStorage.getItem('charlie-current-song-id') || null;

function saveLib() {
  localStorage.setItem('charlie-songs', JSON.stringify(songLib));
  localStorage.setItem('charlie-current-song-id', currentSongId || '');
  scheduleBackup();
}
function renderSongCards() {
  const el = $('songCards');
  el.innerHTML = '';
  if (!songLib.length) {
    el.innerHTML = '<div class="empty">Ingen gemte sange endnu.<br>Tryk "Gem denne sang" for at gemme den I laver nu 🎵</div>';
    return;
  }
  for (const entry of songLib) {
    const c = document.createElement('div');
    c.className = 'songCard' + (entry.id === currentSongId ? ' current' : '');
    const barCount = entry.song.bars;
    c.innerHTML = `<span class="cover">${entry.emoji}</span><span class="nm">${entry.name}</span>
      <span class="meta">${barCount} bar${barCount === 1 ? '' : 's'} · ${entry.bpm} BPM</span>
      <button class="del" title="Slet sangen">🗑️</button>`;
    c.querySelector('.del').onclick = e => {
      e.stopPropagation();
      if (!confirm(`Slet sangen "${entry.name}"?`)) return;
      songLib = songLib.filter(s => s !== entry);
      if (currentSongId === entry.id) currentSongId = null;
      saveLib(); renderSongCards();
    };
    c.onclick = () => {
      // aabn i en fane: fokusér hvis den allerede er aaben, ellers ny fane
      const existing = openSongs.findIndex(t => t.libId === entry.id);
      if (existing >= 0) {
        switchSong(existing);
      } else if (openSongs.length >= 8) {
        toast('Højst 8 åbne sange — luk en fane først', true);
        return;
      } else {
        if (player.playing) togglePlay();
        stopSeqLoop();
        syncActiveTab();
        stashUndo();
        openSongs.push({
          id: 'tab_' + Date.now() + '_' + (tabSeq++),
          name: entry.name, emoji: entry.emoji,
          song: JSON.parse(JSON.stringify(entry.song)),
          bpm: entry.bpm, libId: entry.id,
        });
        loadTab(openSongs.length - 1);
        saveTabsStore();
      }
      $('songLib').hidden = true;
      toast(`${entry.emoji} Åbnet: ${entry.name}`);
    };
    el.appendChild(c);
  }
}
$('libBtn').onclick = () => { renderSongCards(); $('songLib').hidden = false; };
$('libClose').onclick = () => { $('songLib').hidden = true; };
$('songLib').addEventListener('click', e => { if (e.target === $('songLib')) $('songLib').hidden = true; });

$('libSaveCurrent').onclick = () => {
  const name = $('songName').value.trim() || `Charlies Sang ${songLib.length + 1}`;
  const snapshot = JSON.parse(JSON.stringify(state.song));
  const existing = songLib.find(s => s.id === currentSongId);
  if (existing) {
    existing.song = snapshot;
    existing.bpm = state.bpm;
    existing.name = name;
    toast(`${existing.emoji} Opdateret: ${name}`);
  } else {
    const entry = {
      id: 'song_' + Date.now(),
      name,
      emoji: SONG_EMOJI[songLib.length % SONG_EMOJI.length],
      song: snapshot,
      bpm: state.bpm,
    };
    songLib.push(entry);
    currentSongId = entry.id;
    toast(`${entry.emoji} Gemt i biblioteket: ${name}`);
  }
  $('songName').value = name;
  const tab = tabEntry();
  tab.libId = currentSongId;
  tab.emoji = songLib.find(s => s.id === currentSongId)?.emoji || tab.emoji;
  saveLib(); renderSongCards(); renderSongTabs(); saveTabsStore();
};
$('libRestore').onclick = () => {
  if (!confirm('Gendan alt fra backup-filen? Det du har lavet siden sidste backup (op til få sekunder) overskrives.')) return;
  restoreBackup(true);
};
$('libNew').onclick = () => {
  $('songLib').hidden = true;
  newSongTab();
};

// ---------------- sang-faner (flere sange aabne paa een gang) ----------------
let tabSeq = 1;
function makeTab(name) {
  return { id: 'tab_' + Date.now() + '_' + (tabSeq++), name, emoji: '🎵', song: newSong(), bpm: 110, libId: null };
}
let openSongs = null, activeSong = 0;
try { openSongs = JSON.parse(localStorage.getItem('charlie-open-songs') || 'null'); } catch (e) {}
if (!Array.isArray(openSongs) || !openSongs.length) {
  // foerste gang: den nuvaerende arbejds-sang bliver fane 1
  const name = songLib.find(s => s.id === currentSongId)?.name || 'Sang 1';
  openSongs = [{ id: 'tab_boot', name, emoji: '🎵', song: state.song, bpm: state.bpm, libId: currentSongId || null }];
  activeSong = 0;
} else {
  activeSong = Math.min(Math.max(parseInt(localStorage.getItem('charlie-active-song') || '0', 10) || 0, 0), openSongs.length - 1);
  const e = openSongs[activeSong];
  state.song = Object.assign(newSong(), e.song);
  e.song = state.song;
  if (e.bpm >= 70 && e.bpm <= 150) state.bpm = e.bpm;
  currentSongId = e.libId || null;
}
$('songName').value = openSongs[activeSong].name || '';
$('tempo').value = state.bpm;
$('bpmLabel').textContent = state.bpm;

function tabEntry() { return openSongs[activeSong]; }
function syncActiveTab() {
  const e = tabEntry();
  if (!e) return;
  e.song = state.song;
  e.bpm = state.bpm;
  e.name = $('songName').value.trim() || e.name || 'Sang';
  e.libId = currentSongId || null;
}
function saveTabsStore() {
  syncActiveTab();
  localStorage.setItem('charlie-open-songs', JSON.stringify(openSongs));
  localStorage.setItem('charlie-active-song', String(activeSong));
  scheduleBackup();
}
// fortryd-historik pr. fane (kun i hukommelsen)
const undoStash = {};
function stashUndo() {
  undoStash[tabEntry().id] = { u: undoStack.splice(0), r: redoStack.splice(0) };
}
function restoreUndo(id) {
  const s = undoStash[id];
  undoStack.splice(0, undoStack.length, ...(s?.u || []));
  redoStack.splice(0, redoStack.length, ...(s?.r || []));
}
function loadTab(idx) {
  activeSong = idx;
  const e = openSongs[idx];
  state.selected = null;
  state.song = Object.assign(newSong(), e.song);
  e.song = state.song; // fanen og arbejds-sangen deler objekt, saa alt holdes i sync
  state.bpm = (e.bpm >= 70 && e.bpm <= 150) ? e.bpm : 110;
  currentSongId = e.libId || null;
  restoreUndo(e.id);
  $('songName').value = e.name || '';
  $('tempo').value = state.bpm;
  $('bpmLabel').textContent = state.bpm;
  renderGrid(); renderHeads(); renderClipPanel(); renderSongTabs();
  persist();
}
function switchSong(idx) {
  if (idx === activeSong || !openSongs[idx]) return;
  if (player.playing) togglePlay();
  stopSeqLoop();
  syncActiveTab();
  stashUndo();
  loadTab(idx);
}
function newSongTab() {
  if (openSongs.length >= 8) { toast('Højst 8 åbne sange — luk en fane først', true); return; }
  syncActiveTab();
  stashUndo();
  openSongs.push(makeTab(`Sang ${openSongs.length + 1}`));
  loadTab(openSongs.length - 1);
  saveTabsStore();
  toast('➕ Ny sang — god fornøjelse!');
}
function closeSong(idx) {
  const e = openSongs[idx];
  const wasActive = idx === activeSong;
  if (wasActive) syncActiveTab();
  // en sang med indhold gemmes altid i biblioteket foer fanen lukkes
  const cells = e.song?.cells || {};
  if (Object.keys(cells).length) {
    const snap = JSON.parse(JSON.stringify(e.song));
    const lib = songLib.find(s => s.id === e.libId);
    if (lib) {
      lib.song = snap; lib.bpm = e.bpm; lib.name = e.name;
    } else {
      songLib.push({ id: 'song_' + Date.now(), name: e.name, emoji: e.emoji || SONG_EMOJI[songLib.length % SONG_EMOJI.length], song: snap, bpm: e.bpm });
    }
    saveLib();
    toast(`📚 "${e.name}" er gemt i biblioteket`);
  }
  delete undoStash[e.id];
  openSongs.splice(idx, 1);
  if (idx < activeSong) activeSong--;
  if (!openSongs.length) {
    openSongs.push(makeTab('Sang 1'));
    loadTab(0);
  } else if (wasActive) {
    loadTab(Math.min(activeSong, openSongs.length - 1));
  } else {
    renderSongTabs();
  }
  saveTabsStore();
}
function renderSongTabs() {
  const el = $('songTabs');
  el.innerHTML = '';
  openSongs.forEach((e, i) => {
    const t = document.createElement('div');
    t.className = 'songTab' + (i === activeSong ? ' active' : '');
    t.innerHTML = `<span>${e.emoji || '🎵'} ${e.name || 'Sang'}</span><button class="close" title="Luk fanen">✖</button>`;
    t.onclick = ev => { if (!ev.target.closest('.close')) switchSong(i); };
    t.querySelector('.close').onclick = () => closeSong(i);
    el.appendChild(t);
  });
  const add = document.createElement('button');
  add.id = 'songTabAdd';
  add.title = 'Ny sang-fane';
  add.textContent = '➕';
  add.onclick = newSongTab;
  el.appendChild(add);
}
// navnefeltet opdaterer den aktive fane live
$('songName').addEventListener('input', () => {
  const e = tabEntry();
  e.name = $('songName').value.trim() || e.name;
  renderSongTabs();
  persist();
});

// ---------------- eksport ----------------
$('exportBtn').onclick = async () => {
  if (!Object.keys(state.song.cells).length) {
    toast('Læg nogle lyde ind først 🎵', true);
    return;
  }
  const btn = $('exportBtn');
  btn.classList.add('busy');
  btn.textContent = '⏳ Laver lydfil…';
  try {
    await samplesReady; // rigtige lyde skal være med i eksporten
    await recordingsReady; // ...og Charlies egne optagelser
    const wav = await renderSong({ song: state.song, loopsById: LOOPS_BY_ID, bpm: state.bpm });
    const name = ($('songName').value.trim() || 'Charlies Sang');
    try {
      if (!hasServer) throw new Error('ingen server — download i stedet');
      const r = await fetch('/save', {
        method: 'POST',
        headers: { 'X-Song-Name': encodeURIComponent(name), 'Content-Type': 'application/octet-stream' },
        body: wav,
      });
      if (!r.ok) throw new Error('server');
      const j = await r.json();
      toast(`💾 Gemt i "Faerdige Sange": ${j.saved} 🎉`);
    } catch (e) {
      // ingen server (fx åbnet som fil) -> almindelig download
      const blob = new Blob([wav], { type: 'audio/wav' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '.wav';
      a.click();
      toast('💾 Gemt som download');
    }
  } catch (e) {
    console.error(e);
    toast('Øv, noget gik galt med eksporten', true);
  }
  btn.classList.remove('busy');
  btn.textContent = '💾 Gem sang';
};

// ---------------- start ----------------
// debug-haandtag (bruges kun til fejlsoegning i konsollen)
window.__charlie = { player, state, selectedClip: () => selectedClip() };

renderSongTabs();
renderHeads();
renderGrid();
renderCats();
renderTiles();
renderSeq();
renderSndPresets();
renderSndSources();
syncSndUI();
renderPads();
renderPadInsts();
renderClipPanel();

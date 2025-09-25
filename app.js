// 2048 enhanced: Undo, autosave, export/import, i18n, merge animations
const SIZE = 4;
const gridEl = document.getElementById('grid');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const newGameBtn = document.getElementById('newGameBtn');
const undoBtn = document.getElementById('undoBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const scorePlusEl = document.getElementById('score-plus');
const langEl = document.getElementById('lang');
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const instructionsEl = document.getElementById('instructions');

let board = [];
let score = 0;
let best = Number(localStorage.getItem('2048_best') || 0);
let undoStack = []; // store {board, score}
let animating = false;

const UI_TEXT = {
  fr: {
    subtitle: "Glisse ou utilise les flèches",
    instructions: "Glissez (mobile) ou utilisez ← ↑ → ↓ pour jouer. PWA prête — ajouter à l'écran d'accueil.",
    newGame: "Nouvelle partie",
    undo: "Undo",
    export: "Exporter",
    import: "Importer"
  },
  en: {
    subtitle: "Swipe or use arrow keys",
    instructions: "Swipe (mobile) or use ← ↑ → ↓ to play. PWA ready — add to home screen.",
    newGame: "New game",
    undo: "Undo",
    export: "Export",
    import: "Import"
  }
};

bestEl.textContent = best;

function createEmptyBoard(){
  board = Array.from({length: SIZE}, ()=> Array(SIZE).fill(0));
}
function indexToPos(i,j){
  const gap = 12;
  const pad = 14;
  const containerSize = gridEl.clientWidth - pad*2;
  const cellSize = (containerSize - (SIZE-1)*gap) / SIZE;
  const top = pad + j*(cellSize + gap);
  const left = pad + i*(cellSize + gap);
  return {top, left, size: cellSize};
}

function buildCells(){
  gridEl.innerHTML = '';
  gridEl.style.position = 'relative';
  for(let y=0;y<SIZE;y++){
    for(let x=0;x<SIZE;x++){
      const div = document.createElement('div');
      div.className = 'cell';
      gridEl.appendChild(div);
    }
  }
}

function createTileDOM(value, x, y, opts={}){
  const el = document.createElement('div');
  el.className = `tile tile-${value}`;
  if(opts.pop) el.classList.add('pop');
  if(opts.merge) el.classList.add('merge');
  el.dataset.x = x;
  el.dataset.y = y;
  el.dataset.value = value;
  const inner = document.createElement('span');
  inner.className = 'value';
  inner.textContent = value;
  el.appendChild(inner);
  positionTileEl(el, x, y);
  gridEl.appendChild(el);
  // remove pop class after animation
  if(opts.pop){
    setTimeout(()=> el.classList.remove('pop'), 300);
  }
  if(opts.merge){
    setTimeout(()=> el.classList.remove('merge'), 220);
  }
  return el;
}

function positionTileEl(el, x, y){
  const {top,left,size} = indexToPos(x,y);
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
}

function spawnRandom(){
  const empties = [];
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++) if(board[y][x]===0) empties.push({x,y});
  if(!empties.length) return false;
  const {x,y} = empties[Math.floor(Math.random()*empties.length)];
  board[y][x] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

function updateScore(v){
  score += v;
  scoreEl.textContent = score;
  if(v>0){
    scorePlusEl.textContent = `+${v}`;
    scorePlusEl.classList.add('show');
    setTimeout(()=> scorePlusEl.classList.remove('show'), 700);
  }
  if(score > best){
    best = score;
    bestEl.textContent = best;
    localStorage.setItem('2048_best', best);
  }
  autosave();
}

// autosave / load functions
function autosave(){
  const state = {board, score, best};
  localStorage.setItem('2048_state', JSON.stringify(state));
}
function loadSaved(){
  try{
    const s = localStorage.getItem('2048_state');
    if(s){
      const st = JSON.parse(s);
      if(st.board) { board = st.board; score = st.score || 0; best = st.best || best; scoreEl.textContent = score; bestEl.textContent = best; return true; }
    }
  } catch(e){}
  return false;
}

function saveUndo(){
  // keep small undo depth
  undoStack.push({board: board.map(r=>r.slice()), score});
  if(undoStack.length > 6) undoStack.shift();
  updateUndoButton();
}

function updateUndoButton(){
  undoBtn.disabled = undoStack.length===0;
}

function render(){
  Array.from(gridEl.querySelectorAll('.tile')).forEach(t => t.remove());
  for(let y=0;y<SIZE;y++){
    for(let x=0;x<SIZE;x++){
      const v = board[y][x];
      if(v !== 0){
        createTileDOM(v, x, y);
      }
    }
  }
}

function compressAndMerge(arr){
  const res = arr.filter(v=>v!==0);
  let merged = [];
  let gained = 0;
  for(let i=0;i<res.length;i++){
    if(res[i] === res[i+1]){
      const val = res[i]*2;
      merged.push(val);
      gained += val;
      i++;
    } else merged.push(res[i]);
  }
  while(merged.length < SIZE) merged.push(0);
  return {arr: merged, gained};
}

function move(dir){
  if(animating) return false;
  let moved = false;
  let totalGain = 0;
  const old = JSON.stringify(board);
  saveUndo();
  if(dir === 'left' || dir === 'right'){
    for(let y=0;y<SIZE;y++){
      let row = board[y].slice();
      if(dir === 'right') row = row.reverse();
      const {arr,gained} = compressAndMerge(row);
      totalGain += gained;
      if(dir === 'right') arr.reverse();
      board[y] = arr;
    }
  } else {
    for(let x=0;x<SIZE;x++){
      let col = [];
      for(let y=0;y<SIZE;y++) col.push(board[y][x]);
      if(dir === 'down') col = col.reverse();
      const {arr,gained} = compressAndMerge(col);
      totalGain += gained;
      if(dir === 'down') arr.reverse();
      for(let y=0;y<SIZE;y++) board[y][x] = arr[y];
    }
  }
  if(JSON.stringify(board) !== old){
    moved = true;
    if(totalGain>0) updateScore(totalGain);
    spawnRandom();
    renderWithMergeAnimation();
  } else {
    // revert undo push since nothing changed
    undoStack.pop();
    updateUndoButton();
  }
  if(!canMove()){
    setTimeout(()=> alert(getText('gameOver') || 'Game over — aucun mouvement possible.'), 80);
  }
  autosave();
  return moved;
}

function canMove(){
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    if(board[y][x]===0) return true;
    const v = board[y][x];
    if(x+1<SIZE && board[y][x+1] === v) return true;
    if(y+1<SIZE && board[y+1][x] === v) return true;
  }
  return false;
}

function newGame(init=false){
  score = 0;
  scoreEl.textContent = score;
  createEmptyBoard();
  spawnRandom();
  spawnRandom();
  undoStack = [];
  updateUndoButton();
  render();
  if(!init) autosave();
}

newGameBtn.addEventListener('click', ()=> {
  if(confirm(getText('confirmNew') || 'Start new game?')) newGame();
});

undoBtn.addEventListener('click', ()=>{
  if(undoStack.length===0) return;
  const prev = undoStack.pop();
  board = prev.board.map(r=>r.slice());
  score = prev.score;
  scoreEl.textContent = score;
  render();
  updateUndoButton();
  autosave();
});

function renderWithMergeAnimation(){
  // simple approach: compare previous render and current to add merge class on newly-created merged tiles
  Array.from(gridEl.querySelectorAll('.tile')).forEach(t => t.remove());
  for(let y=0;y<SIZE;y++){
    for(let x=0;x<SIZE;x++){
      const v = board[y][x];
      if(v !== 0){
        // mark pop for newly created tiles (if they appear in empty spot)
        createTileDOM(v, x, y, {pop: true});
      }
    }
  }
}

// keyboard
window.addEventListener('keydown', (e)=>{
  const keyMap = {
    'ArrowLeft':'left',
    'ArrowRight':'right',
    'ArrowUp':'up',
    'ArrowDown':'down',
    'h':'left','j':'down','k':'up','l':'right'
  };
  if(keyMap[e.key]){
    e.preventDefault();
    move(keyMap[e.key]);
  }
});

// touch support (swipe)
let touchStart = null;
window.addEventListener('touchstart', e=>{
  if(e.touches.length!==1) return;
  touchStart = {x:e.touches[0].clientX, y:e.touches[0].clientY};
});
window.addEventListener('touchend', e=>{
  if(!touchStart) return;
  const dx = (e.changedTouches[0].clientX - touchStart.x);
  const dy = (e.changedTouches[0].clientY - touchStart.y);
  const absX = Math.abs(dx), absY = Math.abs(dy);
  if(Math.max(absX,absY) > 20){
    if(absX > absY) move(dx>0 ? 'right' : 'left');
    else move(dy>0 ? 'down' : 'up');
  }
  touchStart = null;
});

// On resize, reposition tiles
window.addEventListener('resize', ()=> render());

// export/import
exportBtn.addEventListener('click', ()=>{
  const data = {board, score, best};
  const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '2048-save.json';
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', ()=> importFile.click());
importFile.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=> {
    try{
      const data = JSON.parse(reader.result);
      if(data.board){
        board = data.board;
        score = data.score||0;
        best = data.best||best;
        scoreEl.textContent = score;
        bestEl.textContent = best;
        render();
        autosave();
        alert(getText('imported') || 'Importé avec succès');
      }
    }catch(err){ alert('Fichier invalide'); }
  };
  reader.readAsText(f);
});

// i18n
function setLang(l){
  if(!UI_TEXT[l]) l='fr';
  langEl.value = l;
  subtitleEl.textContent = UI_TEXT[l].subtitle;
  instructionsEl.textContent = UI_TEXT[l].instructions;
  newGameBtn.textContent = UI_TEXT[l].newGame;
  undoBtn.textContent = UI_TEXT[l].undo;
  exportBtn.textContent = UI_TEXT[l].export;
  importBtn.textContent = UI_TEXT[l].import;
}
langEl.addEventListener('change', ()=> setLang(langEl.value));
setLang(localStorage.getItem('2048_lang') || 'fr');
langEl.addEventListener('change', ()=> localStorage.setItem('2048_lang', langEl.value));

function getText(key){
  const l = langEl.value || 'fr';
  return (UI_TEXT[l] && UI_TEXT[l][key]) || null;
}

// Try load saved state, else new game
if(!loadSaved()) newGame(true);
else render();
updateUndoButton();

// ai.js — 2048 RL auto-apprenante avec TensorFlow.js

// Assure-toi que tf.js est chargé
if(typeof tf === 'undefined') console.error("TensorFlow.js non trouvé!");

// Paramètres RL
const INPUT_SIZE = 16;      // 4x4 grille
const ACTIONS = ['left','up','right','down'];
let aiPlaying = false;

// Crée le modèle (simple réseau feed-forward)
let model = tf.sequential();
model.add(tf.layers.dense({inputShape:[INPUT_SIZE], units:128, activation:'relu'}));
model.add(tf.layers.dense({units:64, activation:'relu'}));
model.add(tf.layers.dense({units:4, activation:'softmax'}));
model.compile({optimizer: tf.train.adam(0.001), loss:'categoricalCrossentropy'});

// Charger le modèle existant si disponible
(async ()=>{
  try{
    const saved = await tf.loadLayersModel('indexeddb://2048-ai');
    if(saved){ 
      model = saved; 
      console.log("Modèle AI chargé depuis IndexedDB");
    }
  } catch(e){ console.log("Pas de modèle AI sauvegardé"); }
})();

// Convertit la grille en vecteur normalisé
function gridToState(board){
  return board.flat().map(v=> v===0?0: Math.log2(v)/11);
}

// Fonction epsilon-greedy
function chooseAction(state, epsilon=0.1){
  if(Math.random()<epsilon){
    return Math.floor(Math.random()*4);
  }
  const probs = tf.tidy(()=> model.predict(tf.tensor2d([state])));
  const action = tf.argMax(probs,1).dataSync()[0];
  probs.dispose();
  return action;
}

// Entraînement d’une partie
async function trainEpisode(epsilon=0.2){
  let done = false;
  newGame(true); // reset board
  let state = gridToState(board);

  while(!done){
    const actionIdx = chooseAction(state, epsilon);
    const actionStr = ACTIONS[actionIdx];
    const reward = move(actionStr) ? score : 0;
    const nextState = gridToState(board);

    // training step simple: reward comme one-hot target
    const target = [0,0,0,0];
    target[actionIdx] = reward;
    await model.fit(tf.tensor2d([state]), tf.tensor2d([target]), {epochs:1, verbose:0});

    state = nextState;
    if(!canMove()) done = true;
  }
  // sauvegarde le modèle après chaque épisode
  await model.save('indexeddb://2048-ai');
}

// Boucle d’entraînement continue
async function trainAI(episodes=1000, epsilon=0.2){
  for(let ep=0; ep<episodes; ep++){
    await trainEpisode(epsilon);
    if(ep%10===0) console.log("Episode",ep,"Score:",score);
  }
}

// Fonction de jeu automatique
function playAI(){
  if(!aiPlaying) return;
  const state = gridToState(board);
  const actionIdx = chooseAction(state, 0); // greedy
  move(ACTIONS[actionIdx]);
  setTimeout(playAI, 150); // vitesse AI
}

// Bouton AI Play
const aiBtn = document.createElement('button');
aiBtn.textContent = "AI Play";
aiBtn.className = "btn small";
document.querySelector('.controls').appendChild(aiBtn);
aiBtn.addEventListener('click', ()=>{
  aiPlaying = !aiPlaying;
  aiBtn.textContent = aiPlaying ? "Stop AI" : "AI Play";
  if(aiPlaying) playAI();
});

// Expose trainAI globalement pour console
window.trainAI = trainAI;
window.aiModel = model;
console.log("AI 2048 prêt. Tapez trainAI() pour entraîner, AI Play pour jouer automatiquement.");

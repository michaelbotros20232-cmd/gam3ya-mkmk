import { doc, setDoc, getDoc, updateDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from './firebase.js';
import {
  initGameState,
  drawFromPile,
  discardCard,
  discardCardWithTarget,
  proposeJam3eya,
  voteJam3eya,
  cancelJam3eya,
  WIN_JAM3EYAT,
} from './gameLogic.js';

function roomRef(roomId) {
  return doc(db, 'rooms', roomId.toUpperCase());
}

export function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createRoom(roomId, hostName) {
  const ref = roomRef(roomId);
  const hostId = crypto.randomUUID();
  await setDoc(ref, {
    status: 'waiting',
    hostId,
    playersList: [{ id: hostId, name: hostName }],
    game: null,
    createdAt: Date.now(),
    messages: [],
  });
  return hostId;
}

export async function joinRoom(roomId, name) {
  const ref = roomRef(roomId);
  const playerId = crypto.randomUUID();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('الروم دي مش موجودة');
    const data = snap.data();
    if (data.status !== 'waiting') throw new Error('اللعبة بدأت بالفعل');
    const playersList = [...data.playersList, { id: playerId, name }];
    tx.update(ref, { playersList });
  });
  return playerId;
}

export function subscribeRoom(roomId, cb) {
  return onSnapshot(roomRef(roomId), (snap) => {
    if (snap.exists()) cb(snap.data());
    else cb(null);
  });
}

export async function startGame(roomId) {
  const ref = roomRef(roomId);
  const snap = await getDoc(ref);
  const data = snap.data();
  const ids = data.playersList.map((p) => p.id);
  const names = Object.fromEntries(data.playersList.map((p) => [p.id, p.name]));
  const game = initGameState(ids, names);
  await updateDoc(ref, { status: 'playing', game });
}

async function commitGameUpdate(roomId, updater) {
  const ref = roomRef(roomId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const newGame = updater(data.game);
    let status = data.status;
    // شرط الفوز: WIN_JAM3EYAT جمعيات (في gameLogic.js)
    const winner = Object.entries(newGame.players).find(([, p]) => p.jam3eyaCount >= WIN_JAM3EYAT);
    if (winner) {
      newGame.winnerId = winner[0];
      status = 'finished';
    }
    tx.update(ref, { game: newGame, status });
  });
}

// سحب ورقة من كومة ا ('deck') أو كومة ب ('discard')
export function actionDrawPile(roomId, playerId, source) {
  return commitGameUpdate(roomId, (game) => drawFromPile(game, playerId, source));
}

// رمي ورقة على كومة ب وإنهاء الدور
export function actionDiscard(roomId, playerId, cardId) {
  return commitGameUpdate(roomId, (game) => discardCard(game, playerId, cardId));
}

export function actionDiscardWithTarget(roomId, playerId, cardId, targets) {
  return commitGameUpdate(roomId, (game) => discardCardWithTarget(game, playerId, cardId, targets));
}

// اقتراح جمعية (بيظهر للباقيين عشان يوافقوا أو يرفضوا) — مع اسم حر للجمعية
export function actionProposeJam3eya(roomId, playerId, threeCardIds, jam3eyaName) {
  return commitGameUpdate(roomId, (game) => proposeJam3eya(game, playerId, threeCardIds, jam3eyaName));
}

export function actionVoteJam3eya(roomId, voterId, approve) {
  return commitGameUpdate(roomId, (game) => voteJam3eya(game, voterId, approve));
}

export function actionCancelJam3eya(roomId, playerId) {
  return commitGameUpdate(roomId, (game) => cancelJam3eya(game, playerId));
}

// بيبعت رسالة شات جوه الروم — كل رسالة معاها اسم اللاعب اللي بعتها
const MAX_MESSAGES = 100; // نفضّل نسيب آخر 100 رسالة بس عشان الدوكيومنت متكبرش أوي

export async function sendMessage(roomId, playerId, name, text) {
  const clean = text.trim();
  if (!clean) return;
  const ref = roomRef(roomId);
  const msg = {
    id: crypto.randomUUID(),
    playerId,
    name,
    text: clean.slice(0, 300), // حد أقصى لطول الرسالة
    at: Date.now(),
  };
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const messages = [...(data.messages || []), msg].slice(-MAX_MESSAGES);
    tx.update(ref, { messages });
  });
}

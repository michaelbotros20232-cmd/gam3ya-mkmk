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
  startCategories,
  requestPlayerCategory,
  WIN_JAM3EYAT,
} from './gameLogic.js';
import { DEFAULT_CATEGORIES } from './listCategories.js';

function roomRef(roomId) {
  return doc(db, 'rooms', roomId.toUpperCase());
}

export function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// لعبة واحدة بس (كوتشينة) وفيها نظام الجمعيات مدمج جواها.
// categories: قايمة الجمعيات (لحد 50) — لو مبعوتتش أو فاضية بيستخدم DEFAULT_CATEGORIES
export async function createRoom(roomId, hostName, categories = null) {
  const ref = roomRef(roomId);
  const hostId = crypto.randomUUID();
  await setDoc(ref, {
    status: 'waiting',
    hostId,
    playersList: [{ id: hostId, name: hostName }],
    game: null,
    categories: categories && categories.length ? categories.slice(0, 50) : null,
    createdAt: Date.now(),
    messages: [],
  });
  return hostId;
}

export async function joinRoom(roomId, name) {
  const ref = roomRef(roomId);
  let resultId;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('الروم دي مش موجودة');
    const data = snap.data();

    // لو فيه لاعب بنفس الاسم في الروم بالفعل، رجّعه بنفس الـ id بتاعه
    // عشان يكمل بنفس شخصيته في اللعبة (حتى لو اللعبة بدأت خلاص)
    const existing = data.playersList.find((p) => p.name === name);
    if (existing) {
      resultId = existing.id;
      return;
    }

    if (data.status !== 'waiting') throw new Error('اللعبة بدأت بالفعل — مفيش لاعب بالاسم ده جوه الروم');
    const playerId = crypto.randomUUID();
    const playersList = [...data.playersList, { id: playerId, name }];
    tx.update(ref, { playersList });
    resultId = playerId;
  });
  return resultId;
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
  const categories = data.categories && data.categories.length ? data.categories : DEFAULT_CATEGORIES;
  const game = initGameState(ids, names, categories, data.hostId);
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

// اقتراح جمعية (بيظهر للباقيين عشان يوافقوا أو يرفضوا) — الاسم بياخده أوتوماتيك من currentCategory
export function actionProposeJam3eya(roomId, playerId, threeCardIds) {
  return commitGameUpdate(roomId, (game) => proposeJam3eya(game, playerId, threeCardIds));
}

export function actionVoteJam3eya(roomId, voterId, approve) {
  return commitGameUpdate(roomId, (game) => voteJam3eya(game, voterId, approve));
}

export function actionCancelJam3eya(roomId, playerId) {
  return commitGameUpdate(roomId, (game) => cancelJam3eya(game, playerId));
}

// المضيف بيبدأ الجمعيات مرة واحدة في الأول — جمعية واحدة عشوائية تتحط لكل اللاعبين
export function actionStartCategories(roomId, playerId) {
  return commitGameUpdate(roomId, (game) => startCategories(game, playerId));
}

// كل لاعب بيدوس زراره الخاص لما جمعيته الحالية تتصفر — بتطلعله واحدة جديدة
export function actionRequestPlayerCategory(roomId, playerId) {
  return commitGameUpdate(roomId, (game) => requestPlayerCategory(game, playerId));
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

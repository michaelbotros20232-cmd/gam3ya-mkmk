import { buildDeck } from './cards.js';

// شرط الفوز: عدد الجمعيات (بيتقرا في room.js)
export const WIN_JAM3EYAT = 10;

// كوماندات محتاجة اختيار لاعب/لاعبين
export const TARGET_COUNT = {
  badal_ma3a_7ad: 1,
  nafad_wara2ak: 1,
  badal_bein_etnein: 2,
};

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function cardIndexFromDeck() {
  const all = buildDeck();
  const map = {};
  all.forEach((c) => (map[c.id] = c));
  return map;
}

export const ALL_CARDS = cardIndexFromDeck();

export function getCard(id) {
  return ALL_CARDS[id];
}

// ---- إعداد اللعبة ----
// الكومة الأساسية = state.deck   (كومة "ا")
// كومة الرمي     = state.discard (كومة "ب")، آخر عنصر فيها هو الورقة اللي فوق
export function initGameState(playerIds, names = {}) {
  const fullDeck = shuffle(buildDeck().map((c) => c.id));
  const players = {};
  const order = [...playerIds];
  const deck = [...fullDeck];

  order.forEach((pid) => {
    const hand = deck.splice(0, 5);
    players[pid] = { hand, jam3eyaCount: 0, laidDown: [], jam3eyaNames: [] };
  });

  // ورقة واحدة بس في كومة الرمي (ب) في أول اللعبة
  const discard = [deck.pop()];

  return {
    order,
    names,
    players,
    deck,
    discard,
    turnIndex: 0,
    // مرحلة الدور: 'draw' = لسه هتسحب، 'discard' = سحبت ولازم ترمي ورقة
    phase: 'draw',
    // آخر كارت اتسحب من كومة "ا" (عشان يتنور قدام اللاعب لحد ما يرمي)
    lastDrawnCardId: null,
    // جمعية مستنية موافقة: { playerId, cardIds, votes, name }
    pendingJam3eya: null,
    // اللاعب جرّب جمعية في الدور ده (مرة واحدة بس في الدور)
    jam3eyaTried: false,
    skipPlayerId: null,
    log: [{ text: 'بدأت اللعبة! يلا بينا 🎬' }],
    winnerId: null,
  };
}

function structuredCloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

function nm(state, id) {
  return state.names?.[id] || id;
}
const phaseOf = (state) => state.phase ?? 'draw';

// سقف لعدد أسطر اللوج — من غيره المستند بيكبر كل دور وبيبطئ اللعبة مع الوقت
const MAX_LOG = 40;
function pushLog(state, text) {
  state.log.push({ text });
  if (state.log.length > MAX_LOG) state.log = state.log.slice(-MAX_LOG);
}

function currentPlayerId(state) {
  return state.order[state.turnIndex];
}

function assertMyTurn(state, playerId) {
  if (currentPlayerId(state) !== playerId) throw new Error('مش دورك');
  if (state.pendingJam3eya) throw new Error('في جمعية مستنية موافقة اللاعبين');
}

// أول ما كومة "ا" تخلص: كل كومة "ب" بتتخلط عشوائي وتبقى هي كومة "ا"، وكومة "ب" بتفضى
function refillIfEmpty(state) {
  if (state.deck.length === 0 && state.discard.length > 0) {
    state.deck = shuffle(state.discard);
    state.discard = [];
    pushLog(state, 'كومة (ا) خلصت — كومة (ب) اتخلطت ورجعت هي كومة (ا)، وكومة (ب) فضيت 🔀');
  }
}

// سحب من كومة "ا" مع الخلط التلقائي أول ما تخلص
function drawFromDeck(state) {
  refillIfEmpty(state);
  if (state.deck.length === 0) return undefined;
  const card = state.deck.pop();
  refillIfEmpty(state);
  return card;
}

function drawRandom(state, count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    const c = drawFromDeck(state);
    if (c === undefined) break;
    drawn.push(c);
  }
  return drawn;
}

function nextIndex(state, fromIndex) {
  return (fromIndex + 1) % state.order.length;
}

function advanceTurn(state) {
  let ni = nextIndex(state, state.turnIndex);
  const nextPid = state.order[ni];
  if (state.skipPlayerId && state.skipPlayerId === nextPid) {
    pushLog(state, `${nm(state, nextPid)} اتعمله سكيب بسبب "بس يا بابا" 🚫`);
    state.skipPlayerId = null;
    ni = nextIndex(state, ni);
  }
  state.turnIndex = ni;
  state.phase = 'draw';
  state.jam3eyaTried = false;
  state.lastDrawnCardId = null;
}

function applyAutoCommand(state, actorId, cardKey) {
  const order = state.order;
  const actorIdx = order.indexOf(actorId);

  // "هاجي معاكو كدا": من غير أي أكشن خالص — بيتحسب بس لو نزل ضمن الـ3 كروت بتوع جمعية
  if (cardKey === 'bas_ya_baba') {
    const targetId = order[nextIndex(state, actorIdx)];
    state.skipPlayerId = targetId;
    pushLog(state, `${nm(state, actorId)} لعب "بس يا بابا"، ${nm(state, targetId)} هيتعمله سكيب`);
  }
  // 'badal_ma3a_7ad', 'nafad_wara2ak', 'badal_bein_etnein' محتاجين اختيار لاعب(ين)
  // فبيتنفذوا في discardCardWithTarget
}

// =========================================================
// 1) السحب: من كومة "ا" (deck) أو من كومة "ب" (discard)
// =========================================================
export function drawFromPile(prevState, playerId, source) {
  const state = structuredCloneState(prevState);
  assertMyTurn(state, playerId);
  if (phaseOf(state) !== 'draw') throw new Error('انت سحبت خلاص — ارمي ورقة');

  const player = state.players[playerId];
  let taken;

  if (source === 'discard') {
    if (state.discard.length === 0) throw new Error('كومة ب فاضية');
    taken = state.discard.pop();
    pushLog(state, `${nm(state, playerId)} سحب "${getCard(taken).name}" من كومة ب`);
    // الكارت ده كان باين على الطاولة أصلاً، فمفيش داعي ننوره
    state.lastDrawnCardId = null;
  } else if (source === 'deck') {
    taken = drawFromDeck(state);
    if (taken === undefined) throw new Error('كومة ا خلصت ومفيش ورق يتخلط');
    pushLog(state, `${nm(state, playerId)} سحب ورقة من كومة ا`);
    // كارت أعمى من كومة "ا" — ننوره في إيد اللاعب لحد ما يرمي ورقة
    state.lastDrawnCardId = taken;
  } else {
    throw new Error('اختار تسحب من أنهي كومة');
  }

  player.hand.push(taken);
  state.phase = 'discard';
  return state;
}

// =========================================================
// 2) الرمي: أي ورقة بتترمي بتروح على كومة "ب"
// =========================================================
function throwToPileB(state, playerId, cardId) {
  if (phaseOf(state) !== 'discard') throw new Error('اسحب ورقة الأول');
  const player = state.players[playerId];
  if (!player.hand.includes(cardId)) throw new Error('الكارت ده مش في إيدك');
  player.hand = player.hand.filter((c) => c !== cardId);
  state.discard.push(cardId);
  const card = getCard(cardId);
  pushLog(state, `${nm(state, playerId)} رمى "${card.name}" على كومة ب`);
  return card;
}

export function discardCard(prevState, playerId, cardId) {
  const state = structuredCloneState(prevState);
  assertMyTurn(state, playerId);
  if (phaseOf(state) !== 'discard') throw new Error('اسحب ورقة الأول');

  const card = getCard(cardId);
  if (card && card.type === 'command' && TARGET_COUNT[card.key]) {
    throw new Error('الكوماند ده محتاج تختار لاعب');
  }

  throwToPileB(state, playerId, cardId);

  if (card.type === 'command') applyAutoCommand(state, playerId, card.key);

  advanceTurn(state);
  return state;
}

// كوماندات محتاجة هدف: بدل مع حد / نفض ورق حد / بدل بين اتنين
export function discardCardWithTarget(prevState, playerId, cardId, targets) {
  const state = structuredCloneState(prevState);
  assertMyTurn(state, playerId);
  if (phaseOf(state) !== 'discard') throw new Error('اسحب ورقة الأول');

  const card = getCard(cardId);
  const need = card && card.type === 'command' ? TARGET_COUNT[card.key] : 0;
  if (!need) throw new Error('الكارت ده مش محتاج هدف');
  if (!Array.isArray(targets) || targets.length !== need) throw new Error('اختار العدد الصح من اللاعبين');
  if (new Set(targets).size !== targets.length) throw new Error('مينفعش تختار نفس اللاعب مرتين');
  if (!targets.every((t) => t !== playerId && state.players[t])) throw new Error('اختيار لاعب مش صح');

  throwToPileB(state, playerId, cardId);
  const player = state.players[playerId];

  if (card.key === 'badal_ma3a_7ad') {
    const target = state.players[targets[0]];
    if (player.hand.length && target.hand.length) {
      const myIdx = Math.floor(Math.random() * player.hand.length);
      const theirIdx = Math.floor(Math.random() * target.hand.length);
      const myCard = player.hand[myIdx];
      player.hand[myIdx] = target.hand[theirIdx];
      target.hand[theirIdx] = myCard;
    }
    pushLog(state, `${nm(state, playerId)} بدل ورقة عمياني مع ${nm(state, targets[0])}`);
  } else if (card.key === 'nafad_wara2ak') {
    const target = state.players[targets[0]];
    const oldHand = target.hand;
    // بيسحب الـ 5 الجداد الأول (عشان لو (ا) خلصت ماتتخلطش ورقه القديم معاها)، وبعدين ورقه القديم كله بيترمي على (ب)
    target.hand = drawRandom(state, 5);
    state.discard.push(...oldHand);
    pushLog(state, `${nm(state, playerId)} نفض ورق ${nm(state, targets[0])} — رمى إيده كلها على (ب) وسحب 5 جداد`);
  } else if (card.key === 'badal_bein_etnein') {
    const a = state.players[targets[0]];
    const b = state.players[targets[1]];
    const tmp = a.hand;
    a.hand = b.hand;
    b.hand = tmp;
    pushLog(state, `${nm(state, playerId)} بدل إيد ${nm(state, targets[0])} مع إيد ${nm(state, targets[1])} بالكامل`);
  }

  advanceTurn(state);
  return state;
}

// =========================================================
// 3) الجمعية: اقتراح -> تصويت باقي اللاعبين -> تنفيذ أو رفض
// =========================================================

// اللاعب يختار 3 ورقات (قبل ما يسحب) ويعرضهم على الباقيين، مع اسم حر للجمعية
export function proposeJam3eya(prevState, playerId, threeCardIds, jam3eyaName) {
  const state = structuredCloneState(prevState);
  assertMyTurn(state, playerId);
  if (phaseOf(state) !== 'draw') throw new Error('الجمعية بتتعمل قبل ما تسحب');
  if (state.jam3eyaTried) throw new Error('جرّبت جمعية في دورك ده خلاص');
  if (!Array.isArray(threeCardIds) || new Set(threeCardIds).size !== 3) throw new Error('لازم بالظبط 3 كروت');

  const player = state.players[playerId];
  if (!threeCardIds.every((id) => player.hand.includes(id))) throw new Error('لازم الكروت التلاتة تكون في إيدك');

  const cleanName = (jam3eyaName || '').toString().trim().slice(0, 40) || 'جمعية';

  state.pendingJam3eya = { playerId, cardIds: [...threeCardIds], votes: {}, name: cleanName };
  state.jam3eyaTried = true;
  const cardNames = threeCardIds.map((id) => getCard(id).name).join(' + ');
  pushLog(
    state,
    `${nm(state, playerId)} عايز ينزل جمعية "${cleanName}": ${cardNames} — مستنيين موافقة الباقيين ⏳`
  );
  return state;
}

// تصويت لاعب تاني: approve = true/false
export function voteJam3eya(prevState, voterId, approve) {
  const state = structuredCloneState(prevState);
  const pend = state.pendingJam3eya;
  if (!pend) throw new Error('مفيش جمعية مستنية تصويت');
  if (!state.players[voterId]) throw new Error('لاعب مش موجود');
  if (voterId === pend.playerId) throw new Error('مينفعش تصوّت على جمعيتك');
  if (pend.votes[voterId] !== undefined) throw new Error('انت صوّت خلاص');

  if (!approve) {
    state.pendingJam3eya = null;
    pushLog(
      state,
      `${nm(state, voterId)} رفض جمعية ${nm(state, pend.playerId)} ❌ — مش هتتحسب و${nm(state, pend.playerId)} بيكمل دوره عادي`
    );
    return state; // نفس الدور، phase لسه 'draw'
  }

  pend.votes[voterId] = true;
  const voters = state.order.filter((id) => id !== pend.playerId);
  if (voters.every((id) => pend.votes[id])) return finalizeJam3eya(state);
  return state;
}

// اللاعب صاحب الجمعية يلغيها (لو حد وقف/قفل)
export function cancelJam3eya(prevState, playerId) {
  const state = structuredCloneState(prevState);
  const pend = state.pendingJam3eya;
  if (!pend) throw new Error('مفيش جمعية مستنية');
  if (pend.playerId !== playerId) throw new Error('الجمعية دي مش بتاعتك');
  state.pendingJam3eya = null;
  pushLog(state, `${nm(state, playerId)} لغى الجمعية — بيكمل دوره عادي`);
  return state;
}

// كله وافق: الـ 3 كروت بتترمي على كومة "ب"، الجمعية بتتحسب، واللاعب يسحب 3 غيرهم
// وبعدها بيلعب دوره الأساسي (يسحب ورقة من ا أو ب ويرمي ورقة)
function finalizeJam3eya(state) {
  const { playerId, cardIds, name } = state.pendingJam3eya;
  const player = state.players[playerId];

  player.hand = player.hand.filter((id) => !cardIds.includes(id));
  player.laidDown.push(...cardIds);
  player.jam3eyaCount += 1;
  if (!player.jam3eyaNames) player.jam3eyaNames = [];
  player.jam3eyaNames.push(name);
  state.pendingJam3eya = null;

  // بيسحب 3 غيرهم الأول (عشان لو (ا) خلصت ماتتخلطش الـ 3 بتوعه معاها)، وبعدين الـ 3 بيترموا على (ب)
  const drawn = drawRandom(state, 3);
  player.hand.push(...drawn);
  state.discard.push(...cardIds);

  pushLog(state, `${nm(state, playerId)} نزّل جمعية "${name}"! (عدد جمعياته: ${player.jam3eyaCount}) 🎉`);

  // لو "هاجي معاكو كدا" أو "بس يا بابا" ضمن التلاتة كروت، تفعل تأثيرها كمان
  cardIds.forEach((cid) => {
    const c = getCard(cid);
    if (c.type === 'command') applyAutoCommand(state, playerId, c.key);
  });

  // مفيش advanceTurn: الدور لسه بتاعه، phase لسه 'draw'
  return state;
}

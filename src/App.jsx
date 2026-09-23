import React, { useEffect, useMemo, useState } from 'react';
import Card from './components/Card.jsx';
import { getCard, TARGET_COUNT, WIN_JAM3EYAT } from './gameLogic.js';
import { DEFAULT_CATEGORIES } from './listCategories.js';
import { playDrawSound, playDiscardSound, playJam3eyaSound } from './soundEffects.js';
import {
  createRoom,
  joinRoom,
  subscribeRoom,
  startGame,
  actionDrawPile,
  actionDiscard,
  actionDiscardWithTarget,
  actionProposeJam3eya,
  actionVoteJam3eya,
  actionCancelJam3eya,
  actionStartCategories,
  actionRequestPlayerCategory,
  makeRoomCode,
  sendMessage,
} from './room.js';

// ---- حفظ جلسة اللاعب في المتصفح عشان الريفريش ميطلعوش برا ----
const SESSION_KEY = 'jam3eya-session';

function saveSession(roomId, playerId, name) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerId, name }));
  } catch {
    // تجاهل لو الـ storage مش متاح
  }
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // تجاهل
  }
}

export default function App() {
  const savedSession = useMemo(() => readSession(), []);
  const [screen, setScreen] = useState(savedSession ? 'lobby' : 'home');
  const [mode, setMode] = useState('create');
  // القايمة المحفوظة في src/listCategories.js بتتحط هنا افتراضيًا عشان متكتبهاش من الأول كل مرة —
  // لو عايز تعدلها بشكل دائم، عدّل DEFAULT_CATEGORIES في src/listCategories.js
  const [categoriesText, setCategoriesText] = useState(() => DEFAULT_CATEGORIES.join('\n'));
  const [name, setName] = useState(savedSession?.name || '');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState(savedSession?.roomId || null);
  const [playerId, setPlayerId] = useState(savedSession?.playerId || null);
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // اقرأ كود الروم من اللينك لو موجود (بس لو مفيش جلسة محفوظة أصلاً)
  useEffect(() => {
    if (savedSession) return;
    const params = new URLSearchParams(window.location.search);
    const r = params.get('room');
    if (r) {
      setRoomCode(r.toUpperCase());
      setMode('join');
    }
  }, []);

  useEffect(() => {
    if (!roomId) return undefined;
    const unsub = subscribeRoom(roomId, (data) => {
      // الروم مش موجودة، أو إنت مش من ضمن اللاعبين فيها (الجلسة بقت مش صالحة) — ارجع للصفحة الرئيسية
      if (!data || (playerId && !data.playersList.some((p) => p.id === playerId))) {
        clearSession();
        setRoomData(null);
        setRoomId(null);
        setPlayerId(null);
        setScreen('home');
        return;
      }
      setRoomData(data);
      if (data.status !== 'waiting') setScreen('game');
    });
    return unsub;
  }, [roomId, playerId]);

  function handleExit() {
    clearSession();
    window.location.href = window.location.pathname;
  }

  async function handleCreate() {
    if (!name.trim()) return setError('اكتب اسمك الأول');
    setError('');
    setBusy(true);
    try {
      const code = makeRoomCode();
      const categories = categoriesText
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 50);
      const pid = await createRoom(code, name.trim(), categories);
      setRoomId(code);
      setPlayerId(pid);
      saveSession(code, pid, name.trim());
      setScreen('lobby');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) return setError('اكتب اسمك الأول');
    if (!roomCode.trim()) return setError('اكتب كود الروم');
    setError('');
    setBusy(true);
    try {
      const code = roomCode.trim().toUpperCase();
      const pid = await joinRoom(code, name.trim());
      setRoomId(code);
      setPlayerId(pid);
      saveSession(code, pid, name.trim());
      setScreen('lobby');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (screen === 'home') {
    return (
      <HomeScreen
        mode={mode}
        setMode={setMode}
        categoriesText={categoriesText}
        setCategoriesText={setCategoriesText}
        name={name}
        setName={setName}
        roomCode={roomCode}
        setRoomCode={setRoomCode}
        error={error}
        busy={busy}
        onCreate={handleCreate}
        onJoin={handleJoin}
      />
    );
  }

  if (!roomData) {
    return (
      <div className="screen">
        <p className="subtitle">بنجهز الروم…</p>
      </div>
    );
  }

  if (screen === 'lobby' || roomData.status === 'waiting') {
    return (
      <LobbyScreen
        roomId={roomId}
        roomData={roomData}
        playerId={playerId}
        onStart={() => startGame(roomId)}
        onExit={handleExit}
      />
    );
  }

  return <GameScreen roomId={roomId} roomData={roomData} playerId={playerId} onExit={handleExit} />;
}

function HomeScreen({
  mode,
  setMode,
  categoriesText,
  setCategoriesText,
  name,
  setName,
  roomCode,
  setRoomCode,
  error,
  busy,
  onCreate,
  onJoin,
}) {
  return (
    <div className="screen">
      <div className="panel">
        <h1 className="title">جمعية 🎬</h1>
        <p className="subtitle">لعبة كوتشينة مصرية سينمائية — نزّل جمعية قبل صحابك</p>
        <div className="reel-strip" />
        <div className="tabs">
          <div className={`tab ${mode === 'create' ? 'active' : ''}`} onClick={() => setMode('create')}>
            روم جديدة
          </div>
          <div className={`tab ${mode === 'join' ? 'active' : ''}`} onClick={() => setMode('join')}>
            انضم لروم
          </div>
        </div>

        <input
          className="field"
          placeholder="اسمك"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
        />

        {mode === 'join' && (
          <input
            className="field"
            placeholder="كود الروم"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={5}
            style={{ letterSpacing: 4, textAlign: 'center', fontFamily: 'var(--font-display)' }}
          />
        )}

        {mode === 'create' && (
          <>
            <p className="copy-hint" style={{ marginTop: -4, marginBottom: 6, textAlign: 'right' }}>
              قائمة الجمعيات — دي قائمتك المحفوظة، عدّل فيها هنا لو حابب (للروم دي بس)، أو عدّلها بشكل دائم من src/listCategories.js
            </p>
            <textarea
              className="field"
              placeholder="اكتب جمعياتك، سطر لكل واحدة (لحد 50)"
              value={categoriesText}
              onChange={(e) => setCategoriesText(e.target.value)}
              rows={5}
              style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }}
            />
            <p className="copy-hint" style={{ marginTop: -6, marginBottom: 12 }}>
              المضيف بيدوس "ابدأ الجمعيات" في أول اللعبة، وأول واحد يجمع {WIN_JAM3EYAT} جمعيات موافق عليهم يكسب 🏆
            </p>
          </>
        )}

        {error && <p className="error-text">{error}</p>}

        <button
          className="btn-gold"
          style={{ width: '100%' }}
          disabled={busy}
          onClick={mode === 'create' ? onCreate : onJoin}
        >
          {mode === 'create' ? 'اعمل روم' : 'ادخل الروم'}
        </button>
      </div>
    </div>
  );
}

function LobbyScreen({ roomId, roomData, playerId, onStart, onExit }) {
  const isHost = roomData.hostId === playerId;
  const players = roomData.playersList;
  const myName = players.find((p) => p.id === playerId)?.name || '';
  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="screen">
      <div className="panel">
        <button className="exit-btn exit-btn-inline" onClick={onExit} aria-label="خروج">
          ✕ خروج
        </button>
        <h1 className="title">استنى صحابك</h1>
        <p className="copy-hint" style={{ marginTop: -10, marginBottom: 10, textAlign: 'right' }}>
          🃏 جمعيات بالقائمة 🎲
        </p>
        <p className="subtitle">ابعتلهم الكود أو اللينك يدخلوا بيه</p>
        <div className="room-code">{roomId}</div>
        <button className="btn-ghost" style={{ width: '100%', marginBottom: 4 }} onClick={copyLink}>
          {copied ? 'اتنسخ! ✅' : 'انسخ لينك الدعوة'}
        </button>
        <p className="copy-hint">محتاجين 2 لاعبين على الأقل</p>

        <div className="reel-strip" />

        <ul className="player-list">
          {players.map((p) => (
            <li key={p.id}>
              🎭 {p.name} {p.id === roomData.hostId && '(المضيف)'}
            </li>
          ))}
        </ul>

        {isHost ? (
          <button className="btn-gold" style={{ width: '100%' }} disabled={players.length < 2} onClick={onStart}>
            ابدأ اللعبة
          </button>
        ) : (
          <p className="subtitle" style={{ textAlign: 'center' }}>
            في انتظار المضيف يبدأ اللعبة…
          </p>
        )}

        <ChatPanel roomId={roomId} playerId={playerId} myName={myName} messages={roomData.messages} />
      </div>
    </div>
  );
}

function ChatPanel({ roomId, playerId, myName, messages, open: openProp, onOpenChange }) {
  const list = messages || [];
  // لو الشاشة اللي بتستخدمنا مبعتتش open/onOpenChange (زي اللوبي) بنمسك حالة الفتح جوانا لوحدنا،
  // لو بعتتهم (زي شاشة اللعبة، عشان نمنع تراكب البانل ده مع بانل الجمعيات) بنبقى "controlled"
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = controlled ? onOpenChange : setOpenState;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // بنتتبع "وقت" آخر رسالة اتقرت (مش عدد الرسايل)، عشان القايمة بتتقص لآخر 100
  // رسالة بس (MAX_MESSAGES في room.js)، فالاعتماد على العدد بيبوظ بعد ما الرسايل تعدي 100
  const [lastReadAt, setLastReadAt] = useState(() => (list.length ? list[list.length - 1].at : 0));
  const bottomRef = React.useRef(null);

  const unread = list.filter((m) => m.playerId !== playerId && m.at > lastReadAt).length;

  // كل ما رسالة جديدة توصل والشات مفتوح، اعتبرها اتقرت على طول
  useEffect(() => {
    if (open && list.length) setLastReadAt(list[list.length - 1].at);
  }, [open, list.length]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [list.length, open]);

  function toggleOpen() {
    if (!open && list.length) setLastReadAt(list[list.length - 1].at); // فتحنا الشات = قرينا كل الرسايل
    setOpen(!open);
  }

  async function handleSend() {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    setText('');
    try {
      await sendMessage(roomId, playerId, myName, clean);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <button className="chat-fab" onClick={toggleOpen} aria-label="الشات">
        💬
        {unread > 0 && <span className="chat-fab-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="chat-float-panel">
          <div className="chat-float-header">
            <span>الشات 💬</span>
            <button className="chat-close-btn" onClick={() => setOpen(false)} aria-label="قفل الشات">
              ✕
            </button>
          </div>
          <div className="chat-messages">
            {list.length === 0 && <p className="chat-empty">من غير كلام لحد دلوقتي… ابدأ الدردشة 💬</p>}
            {list.map((m) => (
              <div key={m.id} className={`chat-msg ${m.playerId === playerId ? 'mine' : ''}`}>
                <span className="chat-name">{m.name}</span>
                <span className="chat-text">{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-row">
            <input
              className="field chat-input"
              placeholder="اكتب رسالة…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={300}
              autoFocus
            />
            <button className="btn-gold chat-send" disabled={!text.trim() || sending} onClick={handleSend}>
              ابعت
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Jam3eyatPanel({ players, open: openProp, onOpenChange }) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = controlled ? onOpenChange : setOpenState;
  const total = players.reduce((sum, p) => sum + (p.jam3eyaCount || 0), 0);

  return (
    <>
      <button className="jam-fab" onClick={() => setOpen(!open)} aria-label="الجمعيات">
        🏆
        {total > 0 && <span className="jam-fab-badge">{total > 99 ? '99+' : total}</span>}
      </button>

      {open && (
        <div className="jam-float-panel">
          <div className="chat-float-header">
            <span>الجمعيات 🏆</span>
            <button className="chat-close-btn" onClick={() => setOpen(false)} aria-label="قفل الجمعيات">
              ✕
            </button>
          </div>
          <div className="jam-list">
            {players.map((p) => (
              <div key={p.id} className="jam-row">
                <div className="jam-row-head">
                  <span className="jam-player-name">🎭 {p.name}</span>
                  <span className="jam-player-count">{p.jam3eyaCount || 0} جمعية</span>
                </div>
                {p.jam3eyaNames && p.jam3eyaNames.length > 0 ? (
                  <ul className="jam-names">
                    {p.jam3eyaNames.map((n, i) => (
                      <li key={i}>🎬 {n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="jam-empty">لسه ملوش جمعيات</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function GameScreen({ roomId, roomData, playerId, onExit }) {
  const game = roomData.game;
  const players = roomData.playersList;
  const nameOf = (id) => players.find((p) => p.id === id)?.name || '؟';
  const isHost = roomData.hostId === playerId;

  const me = game.players[playerId];
  const currentId = game.order[game.turnIndex];
  const myTurn = currentId === playerId;
  const phase = game.phase ?? 'draw';
  const pending = game.pendingJam3eya || null;
  const topDiscardId = game.discard[game.discard.length - 1];
  const topDiscard = topDiscardId ? getCard(topDiscardId) : null;

  const [selected, setSelected] = useState([]);
  const [pendingCommand, setPendingCommand] = useState(null); // {cardId, needCount}
  const [pickedTargets, setPickedTargets] = useState([]);
  const [error, setError] = useState('');
  // بانل الشات والجمعيات بيتفتحوا واحد لوحده بس — عشان محدش يتراكب فوق التاني
  const [activePanel, setActivePanel] = useState(null); // null | 'chat' | 'jam'

  // امسح الاختيار لما الدور أو المرحلة أو حالة الجمعية تتغير
  useEffect(() => {
    setSelected([]);
    setError('');
  }, [game.turnIndex, phase, !!pending]);

  // صوت احتفال لما أي لاعب في الروم يجمع جمعية (بيتشغل عند كل اللاعبين)
  const totalJam3eyat = game.order.reduce((sum, id) => sum + (game.players[id].jam3eyaCount || 0), 0);
  const prevTotalRef = React.useRef(totalJam3eyat);
  useEffect(() => {
    if (totalJam3eyat > prevTotalRef.current) playJam3eyaSound();
    prevTotalRef.current = totalJam3eyat;
  }, [totalJam3eyat]);

  if (roomData.status === 'finished') {
    return (
      <div className="screen">
        <div className="panel winner-screen">
          <h1 className="title">🏆 خلصت اللعبة!</h1>
          <p className="winner-crown">👑</p>
          <p className="winner-name">{nameOf(game.winnerId)}</p>
          <p className="winner-tag">هو الفائز 🏆</p>
          <p className="subtitle" style={{ fontSize: 15, color: 'var(--cream)' }}>
            كسب اللعبة بـ {game.players[game.winnerId].jam3eyaCount} جمعيات!
          </p>
          <button
            className="btn-gold"
            style={{ width: '100%' }}
            onClick={() => {
              clearSession();
              window.location.reload();
            }}
          >
            لعبة جديدة
          </button>
        </div>
      </div>
    );
  }

  async function run(fn) {
    setError('');
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }

  function toggleCard(cardId) {
    if (!myTurn || pendingCommand || pending) return;
    // مرحلة الرمي: ورقة واحدة بس. قبل السحب: لحد 3 (للجمعية)
    const maxSel = phase === 'discard' ? 1 : 3;
    setSelected((prev) => {
      if (prev.includes(cardId)) return prev.filter((c) => c !== cardId);
      if (prev.length >= maxSel) return maxSel === 1 ? [cardId] : prev;
      return [...prev, cardId];
    });
    setError('');
  }

  function handleDrawPile(source) {
    playDrawSound();
    return run(() => actionDrawPile(roomId, playerId, source));
  }

  async function handleDiscard() {
    if (selected.length !== 1) return;
    const cardId = selected[0];
    const card = getCard(cardId);
    setError('');
    if (card.type === 'command' && TARGET_COUNT[card.key]) {
      setPendingCommand({ cardId, needCount: TARGET_COUNT[card.key] });
      setPickedTargets([]);
      return;
    }
    playDiscardSound();
    if (await run(() => actionDiscard(roomId, playerId, cardId))) setSelected([]);
  }

  // مفيش اسم حر بيتكتب — الجمعية بتتنزل أوتوماتيك باسم currentCategory بتاع اللاعب
  async function handleJam3eya() {
    if (selected.length !== 3 || !me.currentCategory) return;
    setError('');
    const ok = await run(() => actionProposeJam3eya(roomId, playerId, selected));
    if (ok) setSelected([]);
  }

  async function confirmTargets() {
    if (!pendingCommand) return;
    playDiscardSound();
    const ok = await run(() =>
      actionDiscardWithTarget(roomId, playerId, pendingCommand.cardId, pickedTargets)
    );
    if (ok) {
      setSelected([]);
      setPendingCommand(null);
      setPickedTargets([]);
    }
  }

  const opponents = game.order.filter((id) => id !== playerId);
  const canPickPile = myTurn && phase === 'draw' && !pending && !pendingCommand;
  const canPropose = myTurn && phase === 'draw' && !pending && !game.jam3eyaTried && !!me.currentCategory;
  const canRequestOwnCategory = game.categoriesStarted && !me.currentCategory;

  let banner;
  if (!game.categoriesStarted) {
    banner = isHost ? 'دوس "ابدأ الجمعيات" عشان تبدأ اللعبة 🎲' : 'مستنيين المضيف يبدأ الجمعيات…';
  } else if (pending) {
    banner =
      pending.playerId === playerId
        ? 'مستني موافقة اللاعبين على جمعيتك…'
        : `${nameOf(pending.playerId)} عايز ينزل جمعية — وافق ولا ارفض`;
  } else if (canRequestOwnCategory) {
    banner = 'خلصت جمعيتك! دوس "هات جمعية" وهات واحدة جديدة 🎲';
  } else if (myTurn) {
    banner =
      phase === 'draw'
        ? 'دورك إنت! 🎬 اسحب ورقة من كومة (ا) أو (ب) — أو اعمل جمعية الأول'
        : 'اختار ورقة من إيدك وارمِها على كومة (ب)';
  } else {
    banner = `دور ${nameOf(currentId)}…`;
  }

  return (
    <div className="table-wrap">
      <div className="top-bar">
        <button className="exit-btn" onClick={onExit} aria-label="خروج">
          ✕ خروج
        </button>
        <div className="opponents">
          {opponents.map((id) => {
            const p = game.players[id];
            const isTurn = currentId === id;
            return (
              <div key={id} className={`player-chip ${isTurn ? 'turn' : ''}`}>
                <span className="name">{nameOf(id)}</span>
                <span className="meta">
                  🃏 {p.hand.length} · 🏅 {p.jam3eyaCount}
                </span>
                {p.currentCategory && <span className="meta">🎲 {p.currentCategory}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <p className="turn-banner">{banner}</p>

      {!game.categoriesStarted && (
        <div className="row" style={{ marginBottom: 10 }}>
          {isHost ? (
            <button className="btn-gold" style={{ width: '100%' }} onClick={() => run(() => actionStartCategories(roomId, playerId))}>
              🎲 ابدأ الجمعيات
            </button>
          ) : (
            <p className="subtitle" style={{ textAlign: 'center', width: '100%' }}>
              مستنيين المضيف يبدأ الجمعيات…
            </p>
          )}
        </div>
      )}

      <div className="center-table">
        <div className="pile">
          <span className="pile-label">الكومة الأساسية (ا) · {game.deck.length}</span>
          <Card faceDown />
          <button className="btn-gold pile-btn" disabled={!canPickPile} onClick={() => handleDrawPile('deck')}>
            اسحب من (ا)
          </button>
        </div>
        <div className="pile">
          <span className="pile-label">كومة الرمي (ب) · {game.discard.length}</span>
          {topDiscard ? <Card card={topDiscard} /> : <div className="card-empty">فاضية</div>}
          <button
            className="btn-gold pile-btn"
            disabled={!canPickPile || game.discard.length === 0}
            onClick={() => handleDrawPile('discard')}
          >
            اسحب من (ب)
          </button>
        </div>
      </div>

      {error && <p className="error-text" style={{ textAlign: 'center' }}>{error}</p>}

      <div className="hand-area">
        <div className="hand-row">
          {me.hand.map((cid) => (
            <Card
              key={cid}
              card={getCard(cid)}
              selected={selected.includes(cid)}
              highlight={myTurn && phase === 'discard' && cid === game.lastDrawnCardId}
              onClick={() => toggleCard(cid)}
            />
          ))}
        </div>
        <div className="controls">
          <button
            className="btn-gold"
            disabled={!myTurn || !!pending || phase !== 'discard' || selected.length !== 1}
            onClick={handleDiscard}
          >
            ارمي على (ب)
          </button>
          <button
            className="btn-ghost"
            disabled={!canPropose || selected.length !== 3}
            onClick={handleJam3eya}
          >
            جمعية ({selected.length}/3)
          </button>
          {canRequestOwnCategory && (
            <button className="btn-gold" onClick={() => run(() => actionRequestPlayerCategory(roomId, playerId))}>
              🎲 هات جمعية
            </button>
          )}
        </div>
        <p className="copy-hint">
          🏅 جمعياتك: {me.jam3eyaCount}
          {me.currentCategory ? ` — 🎲 بتجمع: "${me.currentCategory}"` : ''} —{' '}
          {phase === 'draw'
            ? 'اسحب ورقة، أو اختار 3 ورقات وعرضهم كجمعية على صحابك'
            : 'اختار ورقة واحدة وارمِها'}
        </p>
      </div>

      <div className="log-panel">
        {[...game.log].slice(-6).reverse().map((l, i) => (
          <div key={i}>{l.text}</div>
        ))}
      </div>

      <ChatPanel
        roomId={roomId}
        playerId={playerId}
        myName={nameOf(playerId)}
        messages={roomData.messages}
        open={activePanel === 'chat'}
        onOpenChange={(v) => setActivePanel(v ? 'chat' : null)}
      />
      <Jam3eyatPanel
        players={game.order.map((id) => ({ id, name: nameOf(id), ...game.players[id] }))}
        open={activePanel === 'jam'}
        onOpenChange={(v) => setActivePanel(v ? 'jam' : null)}
      />

      {pendingCommand && (
        <TargetModal
          command={getCard(pendingCommand.cardId)}
          needCount={pendingCommand.needCount}
          candidates={opponents.map((id) => ({ id, name: nameOf(id) }))}
          picked={pickedTargets}
          setPicked={setPickedTargets}
          onCancel={() => {
            setPendingCommand(null);
            setPickedTargets([]);
          }}
          onConfirm={confirmTargets}
        />
      )}

      {pending && (
        <Jam3eyaVoteModal
          pending={pending}
          proposerName={nameOf(pending.playerId)}
          isProposer={pending.playerId === playerId}
          voters={game.order
            .filter((id) => id !== pending.playerId)
            .map((id) => ({ id, name: nameOf(id), approved: !!pending.votes?.[id] }))}
          alreadyVoted={!!pending.votes?.[playerId]}
          error={error}
          onApprove={() => run(() => actionVoteJam3eya(roomId, playerId, true))}
          onReject={() => run(() => actionVoteJam3eya(roomId, playerId, false))}
          onCancel={() => run(() => actionCancelJam3eya(roomId, playerId))}
        />
      )}
    </div>
  );
}

function TargetModal({ command, needCount, candidates, picked, setPicked, onCancel, onConfirm }) {
  function toggle(id) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= needCount) return [...prev.slice(1), id];
      return [...prev, id];
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{command.name}</h3>
        <p className="subtitle" style={{ marginBottom: 14 }}>
          اختار {needCount === 1 ? 'لاعب' : `${needCount} لاعبين`}: {command.desc}
        </p>
        {candidates.map((c) => (
          <button
            key={c.id}
            className={`target-btn ${picked.includes(c.id) ? 'picked' : ''}`}
            onClick={() => toggle(c.id)}
          >
            {c.name}
          </button>
        ))}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn-ghost" onClick={onCancel}>
            إلغاء
          </button>
          <button className="btn-gold" disabled={picked.length !== needCount} onClick={onConfirm}>
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
}

function Jam3eyaVoteModal({ pending, proposerName, isProposer, voters, alreadyVoted, error, onApprove, onReject, onCancel }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{isProposer ? `جمعيتك "${pending.name}" مستنية الموافقة` : `جمعية "${pending.name}" — ${proposerName}`}</h3>
        <p className="subtitle" style={{ marginBottom: 12 }}>
          {isProposer
            ? 'صحابك شايفين الـ 3 ورقات دول دلوقتي. لو الكل وافق الجمعية بتتحسب.'
            : `${proposerName} عايز ينزل الـ 3 ورقات دول كجمعية باسم "${pending.name}". توافق؟`}
        </p>

        <div className="vote-cards">
          {pending.cardIds.map((cid) => (
            <Card key={cid} card={getCard(cid)} />
          ))}
        </div>

        <ul className="vote-status">
          {voters.map((v) => (
            <li key={v.id}>
              {v.approved ? '✅' : '⏳'} {v.name}
            </li>
          ))}
        </ul>

        {error && <p className="error-text">{error}</p>}

        {isProposer ? (
          <button className="btn-ghost" style={{ width: '100%' }} onClick={onCancel}>
            الغي الجمعية
          </button>
        ) : alreadyVoted ? (
          <p className="subtitle" style={{ textAlign: 'center', margin: 0 }}>
            وافقت ✅ — مستنيين باقي اللاعبين…
          </p>
        ) : (
          <div className="row">
            <button className="btn-ghost" onClick={onReject}>
              ارفض ❌
            </button>
            <button className="btn-gold" onClick={onApprove}>
              موافق ✅
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


import React, { useEffect, useMemo, useState } from 'react';
import Card from './components/Card.jsx';
import { getCard, TARGET_COUNT } from './gameLogic.js';
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
  makeRoomCode,
} from './room.js';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [mode, setMode] = useState('create');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // اقرأ كود الروم من اللينك لو موجود
  useEffect(() => {
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
      setRoomData(data);
      if (data && data.status !== 'waiting') setScreen('game');
    });
    return unsub;
  }, [roomId]);

  async function handleCreate() {
    if (!name.trim()) return setError('اكتب اسمك الأول');
    setError('');
    setBusy(true);
    try {
      const code = makeRoomCode();
      const pid = await createRoom(code, name.trim());
      setRoomId(code);
      setPlayerId(pid);
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
      />
    );
  }

  return <GameScreen roomId={roomId} roomData={roomData} playerId={playerId} />;
}

function HomeScreen({ mode, setMode, name, setName, roomCode, setRoomCode, error, busy, onCreate, onJoin }) {
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

function LobbyScreen({ roomId, roomData, playerId, onStart }) {
  const isHost = roomData.hostId === playerId;
  const players = roomData.playersList;
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
        <h1 className="title">استنى صحابك</h1>
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
      </div>
    </div>
  );
}

function GameScreen({ roomId, roomData, playerId }) {
  const game = roomData.game;
  const players = roomData.playersList;
  const nameOf = (id) => players.find((p) => p.id === id)?.name || '؟';

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

  // امسح الاختيار لما الدور أو المرحلة أو حالة الجمعية تتغير
  useEffect(() => {
    setSelected([]);
    setError('');
  }, [game.turnIndex, phase, !!pending]);

  if (roomData.status === 'finished') {
    return (
      <div className="screen">
        <div className="panel winner-screen">
          <h1 className="title">🏆 خلصت اللعبة!</h1>
          <p className="subtitle" style={{ fontSize: 18, color: 'var(--cream)' }}>
            {nameOf(game.winnerId)} كسب اللعبة بـ {game.players[game.winnerId].jam3eyaCount} جمعيات!
          </p>
          <button className="btn-gold" style={{ width: '100%' }} onClick={() => window.location.reload()}>
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
    if (await run(() => actionDiscard(roomId, playerId, cardId))) setSelected([]);
  }

  async function handleJam3eya() {
    if (selected.length !== 3) return;
    if (await run(() => actionProposeJam3eya(roomId, playerId, selected))) setSelected([]);
  }

  async function confirmTargets() {
    if (!pendingCommand) return;
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
  const canPropose = myTurn && phase === 'draw' && !pending && !game.jam3eyaTried;

  let banner;
  if (pending) {
    banner =
      pending.playerId === playerId
        ? 'مستني موافقة اللاعبين على جمعيتك…'
        : `${nameOf(pending.playerId)} عايز ينزل جمعية — وافق ولا ارفض`;
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
              </div>
            );
          })}
        </div>
      </div>

      <p className="turn-banner">{banner}</p>

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
            <Card key={cid} card={getCard(cid)} selected={selected.includes(cid)} onClick={() => toggleCard(cid)} />
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
        </div>
        <p className="copy-hint">
          🏅 جمعياتك: {me.jam3eyaCount} —{' '}
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
        <h3>{isProposer ? 'جمعيتك مستنية الموافقة' : `جمعية ${proposerName}`}</h3>
        <p className="subtitle" style={{ marginBottom: 12 }}>
          {isProposer
            ? 'صحابك شايفين الـ 3 ورقات دول دلوقتي. لو الكل وافق الجمعية بتتحسب.'
            : `${proposerName} عايز ينزل الـ 3 ورقات دول كجمعية. توافق؟`}
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

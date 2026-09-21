import React, { useEffect, useState } from 'react';
import { TYPE_LABEL } from '../cards.js';

export default function Card({ card, selected, onClick, faceDown }) {
  // الصورة جاية من cardsData.json (لكل الأنواع، الكوماند كمان)
  const src = card ? card.image : null;

  // لو الرابط باظ لأي سبب، نرجع للتصميم النصي بدل صورة مكسورة
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const imgSrc = broken ? null : src;

  if (faceDown) {
    return <div className="card-back">🎞️</div>;
  }
  if (!card) return null;

  return (
    <div
      className={`card ${card.type === 'command' ? 'command' : ''} ${selected ? 'selected' : ''} ${imgSrc ? 'has-photo' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {imgSrc && (
        <img
          className="card-photo"
          src={imgSrc}
          alt=""
          loading="lazy"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      )}
      <span className="kind">{TYPE_LABEL[card.type]}</span>
      <span className="name">{card.name}</span>
    </div>
  );
}

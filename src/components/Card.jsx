import React from 'react';
import { TYPE_LABEL } from '../cards.js';
import useCardImage from '../useCardImage.js';

export default function Card({ card, selected, onClick, faceDown }) {
  const hasPhoto = card && card.type !== 'command';
  const imgSrc = useCardImage(hasPhoto ? card.name : null, hasPhoto ? card.type : null, !!hasPhoto);

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
      {hasPhoto && imgSrc && (
        <img className="card-photo" src={imgSrc} alt="" loading="lazy" draggable={false} />
      )}
      <span className="kind">{TYPE_LABEL[card.type]}</span>
      <span className="name">{card.name}</span>
    </div>
  );
}

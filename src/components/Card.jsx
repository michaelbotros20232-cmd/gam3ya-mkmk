import React from 'react';
import { TYPE_LABEL } from '../cards.js';

export default function Card({ card, selected, onClick, faceDown }) {
  if (faceDown) {
    return <div className="card-back">🎞️</div>;
  }
  if (!card) return null;
  return (
    <div
      className={`card ${card.type === 'command' ? 'command' : ''} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <span className="kind">{TYPE_LABEL[card.type]}</span>
      <span className="name">{card.name}</span>
    </div>
  );
}

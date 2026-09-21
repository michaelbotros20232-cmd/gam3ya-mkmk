import data from './cardsData.json';

// كل كروت اللعبة بتتقرا من cardsData.json
// الملف ده بيتعمل من أداة review-images.html (إضافة/مسح كروت، عدد نسخ الكوماند، والصور)
// مفيش بحث ولا طلبات شبكة وقت اللعب.

const names = (arr) => (Array.isArray(arr) ? arr : []).filter((x) => x && x.name);

export const ACTORS = names(data.actor);
export const MOVIES = names(data.movie);
export const SERIES = names(data.series);
export const COMMANDS = names(data.commands);

export function buildDeck() {
  const deck = [];
  let id = 0;
  const push = (card) => deck.push({ id: `c${id++}`, ...card });

  [['actor', ACTORS], ['movie', MOVIES], ['series', SERIES]].forEach(([type, list]) => {
    list.forEach((x) => push({ type, name: x.name, image: x.image || null }));
  });

  // كل كوماند بييجي منه "count" نسخة (بتتحدد من الأداة)
  COMMANDS.forEach((cmd) => {
    const n = Math.max(0, parseInt(cmd.count, 10) || 0);
    for (let i = 0; i < n; i++) {
      push({ type: 'command', name: cmd.name, key: cmd.key, desc: cmd.desc || '', image: cmd.image || null });
    }
  });
  return deck;
}

export const TYPE_LABEL = {
  actor: 'ممثل/ممثلة',
  movie: 'فيلم',
  series: 'مسلسل',
  command: 'كوماند',
};
